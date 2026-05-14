import { create } from "zustand";
import type { StoredWallet, Settings } from "@/lib/wallet-store";
import {
  loadSettings,
  loadWallet,
  saveSettings,
  saveWallet,
  clearWallet as clearStored,
} from "@/lib/wallet-store";

type State = {
  wallet: StoredWallet | null;
  settings: Settings;
  unlocked: boolean;
  hydrated: boolean;
  setWallet: (w: StoredWallet | null) => void;
  updateSettings: (s: Partial<Settings>) => void;
  unlock: () => void;
  lock: () => void;
  clearWallet: () => void;
  hydrate: () => void;
};

export const useAppStore = create<State>((set, get) => ({
  wallet: null,
  settings: { currency: "USD", pin: null, pinEnabled: false },
  unlocked: false,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const wallet = loadWallet();
    const settings = loadSettings();
    set({
      wallet,
      settings,
      hydrated: true,
      // If no PIN configured, app is unlocked by default.
      unlocked: !settings.pinEnabled || !settings.pin,
    });
  },
  setWallet: (w) => {
    if (w) saveWallet(w);
    else clearStored();
    set({ wallet: w });
  },
  updateSettings: (s) => {
    const next = { ...get().settings, ...s };
    saveSettings(next);
    set({ settings: next });
  },
  unlock: () => set({ unlocked: true }),
  lock: () => set({ unlocked: false }),
  clearWallet: () => {
    clearStored();
    set({ wallet: null });
  },
}));
