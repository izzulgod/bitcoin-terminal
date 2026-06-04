// Ledger hardware wallet integration via WebHID.
// All @ledgerhq/* modules are loaded dynamically so they never enter the
// initial bundle and never run during SSR.
import type { ScriptType } from "./xpub";

export function isWebHidSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

export interface LedgerInfo {
  connected: boolean;
  deviceName?: string;
  appVersion?: string;
}

type Listener = (info: LedgerInfo) => void;
const listeners = new Set<Listener>();
let state: LedgerInfo = { connected: false };

export function subscribeLedger(l: Listener): () => void {
  listeners.add(l);
  l(state);
  return () => {
    listeners.delete(l);
  };
}

function setState(next: LedgerInfo) {
  state = next;
  listeners.forEach((l) => l(state));
}

export function getLedgerState(): LedgerInfo {
  return state;
}

interface OpenedSession {
  app: any; // AppBtc instance
  transport: any;
}

let session: OpenedSession | null = null;

async function openSession(): Promise<OpenedSession> {
  if (session) return session;
  if (!isWebHidSupported()) throw new Error("Browser does not support WebHID");
  const { default: TransportWebHID } = await import(
    "@ledgerhq/hw-transport-webhid"
  );
  const { default: AppBtc } = await import("@ledgerhq/hw-app-btc");
  const transport = await TransportWebHID.create();
  const app = new AppBtc({ transport, currency: "bitcoin" });
  transport.on("disconnect", () => {
    session = null;
    setState({ connected: false });
  });
  session = { app, transport };
  return session;
}

export async function connectLedger(): Promise<LedgerInfo> {
  const s = await openSession();
  let appVersion: string | undefined;
  try {
    const fw = await s.app.getAppAndVersion();
    appVersion = fw?.version;
  } catch {
    /* ignore */
  }
  const next: LedgerInfo = {
    connected: true,
    deviceName: "Ledger",
    appVersion,
  };
  setState(next);
  return next;
}

export async function disconnectLedger(): Promise<void> {
  try {
    await session?.transport?.close?.();
  } catch {
    /* ignore */
  }
  session = null;
  setState({ connected: false });
}

export function scriptTypeToBip(s: ScriptType): { purpose: number; format: "legacy" | "p2sh" | "bech32" | "bech32m" } {
  switch (s) {
    case "p2wpkh":
      return { purpose: 84, format: "bech32" };
    case "p2sh-p2wpkh":
      return { purpose: 49, format: "p2sh" };
    case "p2pkh":
      return { purpose: 44, format: "legacy" };
    case "p2tr":
      return { purpose: 86, format: "bech32m" };
  }
}

export function accountPath(scriptType: ScriptType, account = 0): string {
  const { purpose } = scriptTypeToBip(scriptType);
  return `${purpose}'/0'/${account}'`;
}

/**
 * Fetch the account-level xpub (matching the prefix the script type expects)
 * from a connected Ledger. Returns a standard xpub (the detector will
 * re-detect / normalize on import).
 */
export async function getLedgerXpub(scriptType: ScriptType, account = 0): Promise<{
  xpub: string;
  path: string;
}> {
  const s = await openSession();
  const path = accountPath(scriptType, account);
  // hw-app-btc exposes getWalletXpub on recent versions.
  if (typeof s.app.getWalletXpub === "function") {
    const xpub: string = await s.app.getWalletXpub({
      path,
      xpubVersion: 0x0488b21e, // standard xpub
    });
    return { xpub, path };
  }
  throw new Error("Ledger BTC app too old — please update to fetch xpub");
}

/**
 * Ask the Ledger device to display a derived address on its screen for the
 * user to verify physically.
 */
export async function verifyAddressOnDevice(
  scriptType: ScriptType,
  account = 0,
  chain: 0 | 1 = 0,
  index = 0
): Promise<string> {
  const s = await openSession();
  const { format } = scriptTypeToBip(scriptType);
  const path = `${accountPath(scriptType, account)}/${chain}/${index}`;
  const res = await s.app.getWalletPublicKey(path, { verify: true, format });
  return res.bitcoinAddress;
}

/**
 * Sign a base64 PSBT with Ledger. Requires hw-app-btc v11+ (signPsbt API).
 * Caller is responsible for finalizing & extracting tx.
 */
export async function signPsbtWithLedger(psbtBase64: string): Promise<string> {
  const s = await openSession();
  if (typeof s.app.signPsbt !== "function") {
    throw new Error("Ledger app does not support PSBT signing");
  }
  const signed = await s.app.signPsbt(psbtBase64);
  return signed;
}

/**
 * Broadcast a raw signed tx hex via mempool.space.
 */
export async function broadcastTx(hex: string): Promise<string> {
  const res = await fetch("https://mempool.space/api/tx", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: hex,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Broadcast failed: ${text}`);
  return text.trim(); // txid
}
