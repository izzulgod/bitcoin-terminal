// Minimal PSBT builder for SegWit (p2wpkh) wallets.
// NOTE: This builds the unsigned PSBT only — signing is delegated to the
// hardware wallet (Ledger).
import "./buffer-polyfill";
import * as bitcoin from "bitcoinjs-lib";
import { Buffer } from "buffer";
import { deriveAddresses, type ScriptType } from "./xpub";
import type { StoredWallet } from "./wallet-store";
import type { UTXO } from "./mempool";

const networkFor = (n: "mainnet" | "testnet") =>
  n === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

export interface BuildInput {
  utxo: UTXO & { address: string };
  scriptPubKey: Buffer;
  derivationPath: string; // e.g. "0/3"
}

export interface BuildResult {
  psbtBase64: string;
  inputs: BuildInput[];
  changeAmount: number;
  changeDerivationPath?: string;
  fee: number;
  vsize: number;
}

// vsize estimate for p2wpkh: ~10.5 base + 68 per input + 31 per output
function estimateVsize(numInputs: number, numOutputs: number, scriptType: ScriptType): number {
  if (scriptType === "p2wpkh") {
    return Math.ceil(10.5 + numInputs * 68 + numOutputs * 31);
  }
  if (scriptType === "p2tr") {
    return Math.ceil(10.5 + numInputs * 57.5 + numOutputs * 43);
  }
  if (scriptType === "p2sh-p2wpkh") {
    return Math.ceil(10 + numInputs * 91 + numOutputs * 32);
  }
  // legacy p2pkh
  return 10 + numInputs * 148 + numOutputs * 34;
}

/** Largest-first coin selection. */
function selectCoins(
  utxos: (UTXO & { address: string })[],
  target: number,
  feeRate: number,
  scriptType: ScriptType
): { selected: (UTXO & { address: string })[]; fee: number; change: number; vsize: number } | null {
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  let total = 0;
  const selected: (UTXO & { address: string })[] = [];
  for (const u of sorted) {
    selected.push(u);
    total += u.value;
    // assume 2 outputs (recipient + change)
    const vsize = estimateVsize(selected.length, 2, scriptType);
    const fee = Math.ceil(vsize * feeRate);
    if (total >= target + fee) {
      const change = total - target - fee;
      // dust threshold ~546 sats; if change is dust, fold into fee
      if (change < 546) {
        const vsize1 = estimateVsize(selected.length, 1, scriptType);
        const fee1 = Math.ceil(vsize1 * feeRate);
        if (total >= target + fee1) {
          return { selected, fee: total - target, change: 0, vsize: vsize1 };
        }
      } else {
        return { selected, fee, change, vsize };
      }
    }
  }
  return null;
}

export interface BuildTxParams {
  wallet: StoredWallet;
  utxos: (UTXO & { address: string })[];
  /** map address -> derivation path "chain/index" */
  addressPaths: Map<string, string>;
  recipient: string;
  amountSats: number;
  feeRate: number; // sat/vB
  /** next unused change address + path */
  changeAddress: string;
  changeDerivationPath: string;
}

export function buildPsbt(p: BuildTxParams): BuildResult {
  const network = networkFor(p.wallet.network);
  const sel = selectCoins(p.utxos, p.amountSats, p.feeRate, p.wallet.scriptType);
  if (!sel) throw new Error("Insufficient funds for amount + fee");

  const psbt = new bitcoin.Psbt({ network });
  const inputs: BuildInput[] = [];

  for (const u of sel.selected) {
    const path = p.addressPaths.get(u.address);
    if (!path) throw new Error(`Missing derivation for ${u.address}`);
    // For SegWit, witnessUtxo suffices
    const scriptPubKey = bitcoin.address.toOutputScript(u.address, network);
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      witnessUtxo: { script: scriptPubKey, value: u.value },
    });
    inputs.push({ utxo: u, scriptPubKey, derivationPath: path });
  }

  psbt.addOutput({ address: p.recipient, value: p.amountSats });
  if (sel.change > 0) {
    psbt.addOutput({ address: p.changeAddress, value: sel.change });
  }

  return {
    psbtBase64: psbt.toBase64(),
    inputs,
    changeAmount: sel.change,
    changeDerivationPath: sel.change > 0 ? p.changeDerivationPath : undefined,
    fee: sel.fee,
    vsize: sel.vsize,
  };
}

/** Build a Map<address, "chain/index"> from a wallet by deriving the first N
 *  receive and change addresses. */
export function buildAddressPathMap(
  wallet: StoredWallet,
  count = 50
): Map<string, string> {
  const m = new Map<string, string>();
  for (const chain of [0, 1] as const) {
    const addrs = deriveAddresses(
      {
        scriptType: wallet.scriptType,
        derivationLabel: wallet.derivationLabel,
        network: wallet.network,
        normalizedXpub: wallet.normalizedXpub,
      },
      chain,
      0,
      count
    );
    for (const a of addrs) m.set(a.address, a.path);
  }
  return m;
}

/** Validate a Bitcoin address string for the given network. */
export function isValidAddress(addr: string, network: "mainnet" | "testnet"): boolean {
  try {
    bitcoin.address.toOutputScript(addr, networkFor(network));
    return true;
  } catch {
    return false;
  }
}
