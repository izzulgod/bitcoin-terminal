// Wallet sync engine: derive addresses with gap-limit scanning,
// fetch tx + utxo from mempool.space, aggregate balance.
import {
  deriveAddresses,
  detectAndNormalize,
  type DerivedAddress,
  type DetectedWallet,
} from "./xpub";
import { mempoolApi, type AddressInfo, type Tx, type UTXO } from "./mempool";
import type { StoredWallet } from "./wallet-store";

const GAP_LIMIT = 20;
const BATCH = 5;

export interface AddressEntry {
  derived: DerivedAddress;
  info: AddressInfo;
  used: boolean;
  balance: number; // sats
}

export interface SyncResult {
  wallet: DetectedWallet;
  addresses: AddressEntry[];
  utxos: (UTXO & { address: string })[];
  txs: Tx[]; // unique
  totalBalance: number; // sats unspent (chain + mempool)
  receiveAddress: string; // first unused on chain 0
}

async function scanChain(
  wallet: DetectedWallet,
  chain: 0 | 1,
  onProgress?: (msg: string) => void
): Promise<AddressEntry[]> {
  const out: AddressEntry[] = [];
  let idx = 0;
  let emptyStreak = 0;
  while (emptyStreak < GAP_LIMIT) {
    const batch = deriveAddresses(wallet, chain, idx, BATCH);
    onProgress?.(`Scanning chain ${chain} index ${idx}…`);
    const infos = await Promise.all(
      batch.map((d) => mempoolApi.address(d.address).catch(() => null))
    );
    for (let i = 0; i < batch.length; i++) {
      const info = infos[i];
      if (!info) {
        // network failure — treat as unused for now
        out.push({
          derived: batch[i],
          info: emptyAddressInfo(batch[i].address),
          used: false,
          balance: 0,
        });
        emptyStreak++;
        continue;
      }
      const used =
        info.chain_stats.tx_count > 0 || info.mempool_stats.tx_count > 0;
      const balance =
        info.chain_stats.funded_txo_sum -
        info.chain_stats.spent_txo_sum +
        info.mempool_stats.funded_txo_sum -
        info.mempool_stats.spent_txo_sum;
      out.push({ derived: batch[i], info, used, balance });
      if (used) emptyStreak = 0;
      else emptyStreak++;
      if (emptyStreak >= GAP_LIMIT) break;
    }
    idx += BATCH;
    if (idx > 200) break; // safety
  }
  return out;
}

function emptyAddressInfo(address: string): AddressInfo {
  return {
    address,
    chain_stats: {
      funded_txo_count: 0,
      funded_txo_sum: 0,
      spent_txo_count: 0,
      spent_txo_sum: 0,
      tx_count: 0,
    },
    mempool_stats: {
      funded_txo_count: 0,
      funded_txo_sum: 0,
      spent_txo_count: 0,
      spent_txo_sum: 0,
      tx_count: 0,
    },
  };
}

export async function syncWallet(
  stored: StoredWallet,
  onProgress?: (msg: string) => void
): Promise<SyncResult> {
  const wallet = detectAndNormalize(stored.rawXpub, stored.scriptType);

  onProgress?.("Detecting derivation…");
  const [receive, change] = await Promise.all([
    scanChain(wallet, 0, onProgress),
    scanChain(wallet, 1, onProgress),
  ]);

  const all = [...receive, ...change];
  const used = all.filter((a) => a.used);

  onProgress?.(`Fetching transactions for ${used.length} addresses…`);
  const txArrays = await Promise.all(
    used.map((a) => mempoolApi.addressTxs(a.derived.address).catch(() => []))
  );

  onProgress?.("Building UTXO set…");
  const utxoArrays = await Promise.all(
    used.map(async (a) => {
      const utxos = await mempoolApi.addressUtxo(a.derived.address).catch(() => []);
      return utxos.map((u) => ({ ...u, address: a.derived.address }));
    })
  );

  const seen = new Set<string>();
  const txs: Tx[] = [];
  for (const arr of txArrays) {
    for (const t of arr) {
      if (seen.has(t.txid)) continue;
      seen.add(t.txid);
      txs.push(t);
    }
  }

  const utxos = utxoArrays.flat();
  // Use address summaries as the source of truth for portfolio balance.
  // The UTXO endpoint can be blocked/rate-limited independently, while tx/address
  // summaries may still load; this prevents a false 0 balance when history exists.
  const totalBalance = all.reduce((s, a) => s + a.balance, 0);

  const firstUnusedReceive = receive.find((a) => !a.used) ?? receive[0];

  return {
    wallet,
    addresses: all,
    utxos,
    txs,
    totalBalance,
    receiveAddress: firstUnusedReceive.derived.address,
  };
}

export interface TxFlow {
  tx: Tx;
  net: number; // sats: positive = incoming, negative = outgoing
  direction: "in" | "out" | "self";
  confirmations: number; // 0 if unconfirmed
}

/** Compute net flow per tx vs our owned addresses. */
export function classifyTxs(
  txs: Tx[],
  ownedAddresses: Set<string>,
  tipHeight: number
): TxFlow[] {
  return txs
    .map((tx) => {
      let inFromUs = 0;
      let outToUs = 0;
      for (const v of tx.vin) {
        const a = v.prevout?.scriptpubkey_address;
        if (a && ownedAddresses.has(a)) inFromUs += v.prevout!.value;
      }
      for (const o of tx.vout) {
        if (o.scriptpubkey_address && ownedAddresses.has(o.scriptpubkey_address))
          outToUs += o.value;
      }
      const net = outToUs - inFromUs;
      const direction: TxFlow["direction"] =
        inFromUs > 0 && outToUs > 0 && net === 0
          ? "self"
          : net >= 0
            ? "in"
            : "out";
      const confirmations =
        tx.status.confirmed && tx.status.block_height
          ? Math.max(0, tipHeight - tx.status.block_height + 1)
          : 0;
      return { tx, net, direction, confirmations };
    })
    .sort((a, b) => {
      const ta = a.tx.status.block_time ?? Number.MAX_SAFE_INTEGER;
      const tb = b.tx.status.block_time ?? Number.MAX_SAFE_INTEGER;
      return tb - ta;
    });
}
