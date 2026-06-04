// localStorage-backed wallet state. Multi-wallet store (v2).
// No private keys ever — xpub only.
import { type ScriptType } from "./xpub";

const V1_KEY = "btc-terminal:wallet:v1"; // legacy single-wallet
const V2_KEY = "btc-terminal:wallets:v2";
const SETTINGS_KEY = "btc-terminal:settings:v1";

export type WalletSource = "xpub" | "ledger";

export interface StoredWallet {
  id: string;
  rawXpub: string;
  normalizedXpub: string;
  scriptType: ScriptType;
  derivationLabel: string;
  network: "mainnet" | "testnet";
  label: string;
  source?: WalletSource;
  /** BIP path for the account, e.g. "84'/0'/0'" — needed for Ledger signing */
  accountPath?: string;
  createdAt: number;
}

export interface WalletStoreShape {
  wallets: StoredWallet[];
  activeWalletId: string | null;
}

export interface Settings {
  currency: "USD" | "IDR";
  pin: string | null;
  pinEnabled: boolean;
  theme: "dark" | "light";
}

const DEFAULT_SETTINGS: Settings = {
  currency: "USD",
  pin: null,
  pinEnabled: false,
  theme: "dark",
};

function genId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function migrateFromV1(): WalletStoreShape | null {
  try {
    const raw = localStorage.getItem(V1_KEY);
    if (!raw) return null;
    const old = JSON.parse(raw) as Omit<StoredWallet, "id">;
    const w: StoredWallet = { ...old, id: genId(), source: "xpub" };
    const shape: WalletStoreShape = { wallets: [w], activeWalletId: w.id };
    localStorage.setItem(V2_KEY, JSON.stringify(shape));
    localStorage.removeItem(V1_KEY);
    return shape;
  } catch {
    return null;
  }
}

export function loadStore(): WalletStoreShape {
  if (typeof window === "undefined") return { wallets: [], activeWalletId: null };
  try {
    const raw = localStorage.getItem(V2_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WalletStoreShape;
      // Ensure ids present and active is valid
      const wallets = (parsed.wallets || []).map((w) =>
        w.id ? w : { ...w, id: genId() }
      );
      let activeId = parsed.activeWalletId;
      if (!activeId || !wallets.some((w) => w.id === activeId)) {
        activeId = wallets[0]?.id ?? null;
      }
      return { wallets, activeWalletId: activeId };
    }
    const migrated = migrateFromV1();
    if (migrated) return migrated;
  } catch {
    /* ignore */
  }
  return { wallets: [], activeWalletId: null };
}

export function saveStore(s: WalletStoreShape) {
  localStorage.setItem(V2_KEY, JSON.stringify(s));
}

export function clearStore() {
  localStorage.removeItem(V2_KEY);
  localStorage.removeItem(V1_KEY);
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Settings) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function newWalletId(): string {
  return genId();
}
