// localStorage-backed wallet state. No private keys ever — xpub only.
import { type ScriptType } from "./xpub";

const STORAGE_KEY = "btc-terminal:wallet:v1";
const SETTINGS_KEY = "btc-terminal:settings:v1";

export interface StoredWallet {
  rawXpub: string;
  normalizedXpub: string;
  scriptType: ScriptType;
  derivationLabel: string;
  network: "mainnet" | "testnet";
  label: string;
  createdAt: number;
}

export interface Settings {
  currency: "USD" | "IDR";
  pin: string | null; // 6-digit PIN (stored client-side; watch-only access gate only)
  pinEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  currency: "USD",
  pin: null,
  pinEnabled: false,
};

export function loadWallet(): StoredWallet | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredWallet) : null;
  } catch {
    return null;
  }
}

export function saveWallet(w: StoredWallet) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
}

export function clearWallet() {
  localStorage.removeItem(STORAGE_KEY);
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
