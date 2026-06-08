import "./buffer-polyfill";
import * as bitcoin from "bitcoinjs-lib";
import { BIP32Factory, type BIP32Interface } from "bip32";
import * as ecc from "@bitcoinerlab/secp256k1";
import bs58check from "bs58check";
import { Buffer } from "buffer";

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

export type ScriptType = "p2wpkh" | "p2sh-p2wpkh" | "p2pkh" | "p2tr";

export interface DetectedWallet {
  scriptType: ScriptType;
  derivationLabel: string; // e.g. BIP84
  network: "mainnet" | "testnet";
  normalizedXpub: string; // converted to standard xpub for bip32
  scriptLocked?: boolean; // true when an output descriptor explicitly set the script type
}

const VERSION_BYTES: Record<string, { script: ScriptType; label: string; net: "mainnet" | "testnet" }> = {
  // Mainnet
  "0488b21e": { script: "p2pkh", label: "BIP44 | Legacy", net: "mainnet" }, // xpub
  "049d7cb2": { script: "p2sh-p2wpkh", label: "BIP49 | Nested SegWit", net: "mainnet" }, // ypub
  "04b24746": { script: "p2wpkh", label: "BIP84 | Native SegWit", net: "mainnet" }, // zpub
  // Testnet
  "043587cf": { script: "p2pkh", label: "BIP44 Testnet", net: "testnet" }, // tpub
  "044a5262": { script: "p2sh-p2wpkh", label: "BIP49 Testnet", net: "testnet" }, // upub
  "045f1cf6": { script: "p2wpkh", label: "BIP84 Testnet", net: "testnet" }, // vpub
};

const STANDARD_XPUB_VERSION = Buffer.from("0488b21e", "hex");
const STANDARD_TPUB_VERSION = Buffer.from("043587cf", "hex");

function cleanInput(input: string): string {
  return input.replace(/\s+/g, "").trim();
}

/**
 * Detect script type from prefix and convert non-standard xpub variants
 * (ypub/zpub/etc.) to standard xpub bytes that bip32 can parse.
 */
/**
 * Parse a Bitcoin output descriptor wrapper like:
 *   wpkh(xpub.../84'/0'/0'/*)
 *   sh(wpkh(ypub.../...))
 *   pkh(xpub.../...)
 *   tr(xpub.../...)
 * Returns { xpub, scriptHint? } extracted from inside the wrapper.
 */
function parseDescriptor(input: string): { xpub: string; scriptHint?: ScriptType } {
  const s = input.trim();
  // Match outermost function name(s)
  const wpkh = /^wpkh\(\s*([^,)#\s]+?)(?:\/[\d'h*\/]+)?\s*\)(?:#[a-z0-9]+)?$/i;
  const shwpkh = /^sh\(\s*wpkh\(\s*([^,)#\s]+?)(?:\/[\d'h*\/]+)?\s*\)\s*\)(?:#[a-z0-9]+)?$/i;
  const pkh = /^pkh\(\s*([^,)#\s]+?)(?:\/[\d'h*\/]+)?\s*\)(?:#[a-z0-9]+)?$/i;
  const tr = /^tr\(\s*([^,)#\s]+?)(?:\/[\d'h*\/]+)?\s*\)(?:#[a-z0-9]+)?$/i;
  let m: RegExpMatchArray | null;
  if ((m = s.match(shwpkh))) return { xpub: m[1], scriptHint: "p2sh-p2wpkh" };
  if ((m = s.match(wpkh))) return { xpub: m[1], scriptHint: "p2wpkh" };
  if ((m = s.match(tr))) return { xpub: m[1], scriptHint: "p2tr" };
  if ((m = s.match(pkh))) return { xpub: m[1], scriptHint: "p2pkh" };
  // Bare xpub possibly with derivation suffix /84'/0'/0'/* — strip it.
  const bare = s.split("/")[0];
  return { xpub: bare };
}

export function detectAndNormalize(rawXpub: string, scriptOverride?: ScriptType): DetectedWallet {
  const cleaned = cleanInput(rawXpub);
  if (!cleaned) throw new Error("Empty xpub");

  const { xpub: extracted, scriptHint } = parseDescriptor(cleaned);

  let decoded: Uint8Array;
  try {
    decoded = bs58check.decode(extracted);
  } catch {
    throw new Error("Invalid xpub format. Paste a raw xpub/ypub/zpub or a descriptor like wpkh(xpub.../...).");
  }
  const versionHex = Buffer.from(decoded.slice(0, 4)).toString("hex");
  const meta = VERSION_BYTES[versionHex];
  if (!meta) throw new Error(`Unsupported extended public key version: ${versionHex}`);


  // Re-encode with standard xpub/tpub version bytes so bip32 lib accepts it.
  const versionReplacement = meta.net === "mainnet" ? STANDARD_XPUB_VERSION : STANDARD_TPUB_VERSION;
  const payload = new Uint8Array(decoded.length);
  payload.set(versionReplacement, 0);
  payload.set(decoded.slice(4), 4);
  const normalizedXpub = bs58check.encode(payload);

  // Descriptor wrappers (wpkh(...), sh(wpkh(...)), etc.) are authoritative.
  // Bare xpubs are ambiguous, so the user's manual BIP selection must win there.
  const scriptType = scriptHint ?? scriptOverride ?? meta.script;
  const label = scriptHint || scriptOverride ? scriptTypeLabel(scriptType) : meta.label;
  return {
    scriptType,
    derivationLabel: label,
    network: meta.net,
    normalizedXpub,
    scriptLocked: Boolean(scriptHint),
  };
}

export function scriptTypeLabel(s: ScriptType): string {
  switch (s) {
    case "p2wpkh": return "BIP84 | Native SegWit";
    case "p2sh-p2wpkh": return "BIP49 | Nested SegWit";
    case "p2pkh": return "BIP44 | Legacy";
    case "p2tr": return "BIP86 | Taproot";
  }
}

/**
 * Canonical SLIP-132 version bytes per (network, scriptType).
 * Taproot has no SLIP-132 prefix; we keep xpub/tpub for it.
 */
const CANONICAL_VERSIONS: Record<"mainnet" | "testnet", Record<ScriptType, string>> = {
  mainnet: {
    "p2pkh": "0488b21e",        // xpub
    "p2sh-p2wpkh": "049d7cb2",  // ypub
    "p2wpkh": "04b24746",       // zpub
    "p2tr": "0488b21e",         // xpub
  },
  testnet: {
    "p2pkh": "043587cf",        // tpub
    "p2sh-p2wpkh": "044a5262",  // upub
    "p2wpkh": "045f1cf6",       // vpub
    "p2tr": "043587cf",         // tpub
  },
};

/**
 * Re-encode the bip32-normalized xpub into its canonical SLIP-132 form
 * for the given script type (e.g. xpub→zpub for BIP84). Display-only.
 */
export function encodeForScriptType(
  normalizedXpub: string,
  scriptType: ScriptType,
  network: "mainnet" | "testnet" = "mainnet",
): string {
  try {
    const decoded = bs58check.decode(normalizedXpub);
    const versionHex = CANONICAL_VERSIONS[network][scriptType];
    const version = Buffer.from(versionHex, "hex");
    const payload = new Uint8Array(decoded.length);
    payload.set(version, 0);
    payload.set(decoded.slice(4), 4);
    return bs58check.encode(payload);
  } catch {
    return normalizedXpub;
  }
}

/** Short prefix label for the canonical extended key (xpub/ypub/zpub/...). */
export function canonicalPrefix(
  scriptType: ScriptType,
  network: "mainnet" | "testnet" = "mainnet",
): string {
  if (network === "testnet") {
    if (scriptType === "p2sh-p2wpkh") return "upub";
    if (scriptType === "p2wpkh") return "vpub";
    return "tpub";
  }
  if (scriptType === "p2sh-p2wpkh") return "ypub";
  if (scriptType === "p2wpkh") return "zpub";
  return "xpub";
}

function networkFor(net: "mainnet" | "testnet"): bitcoin.networks.Network {
  return net === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
}

function deriveAddressForNode(
  node: BIP32Interface,
  scriptType: ScriptType,
  network: bitcoin.networks.Network
): string {
  const pubkey = Buffer.from(node.publicKey);
  switch (scriptType) {
    case "p2wpkh":
      return bitcoin.payments.p2wpkh({ pubkey, network }).address!;
    case "p2sh-p2wpkh":
      return bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ pubkey, network }),
        network,
      }).address!;
    case "p2pkh":
      return bitcoin.payments.p2pkh({ pubkey, network }).address!;
    case "p2tr": {
      const xOnly = pubkey.slice(1, 33);
      return bitcoin.payments.p2tr({ internalPubkey: xOnly, network }).address!;
    }
  }
}

export interface DerivedAddress {
  address: string;
  path: string; // 0/i or 1/i
  index: number;
  chain: 0 | 1; // 0 = receive, 1 = change
}

/**
 * Derive a batch of addresses from a normalized xpub.
 * The xpub already represents account-level (m/purpose'/coin'/account').
 */
export function deriveAddresses(
  wallet: DetectedWallet,
  chain: 0 | 1,
  start: number,
  count: number
): DerivedAddress[] {
  const network = networkFor(wallet.network);
  const root = bip32.fromBase58(wallet.normalizedXpub, network);
  const branch = root.derive(chain);
  const out: DerivedAddress[] = [];
  for (let i = 0; i < count; i++) {
    const idx = start + i;
    const child = branch.derive(idx);
    out.push({
      address: deriveAddressForNode(child, wallet.scriptType, network),
      path: `${chain}/${idx}`,
      index: idx,
      chain,
    });
  }
  return out;
}
