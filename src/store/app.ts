import { create } from "zustand";
import type { StoredWallet, Settings, WalletStoreShape } from "@/lib/wallet-store";
import {
  loadSettings,
  loadStore,
  saveSettings,
  saveStore,
  clearStore,
  newWalletId,
} from "@/lib/wallet-store";

type State = {
  // Multi-wallet
  wallets: StoredWallet[];
  activeWalletId: string | null;
  /** Convenience: currently-active wallet (computed at hydrate/mutation time). */
  wallet: StoredWallet | null;

  settings: Settings;
  unlocked: boolean;
  hydrated: boolean;

  // Settings
  updateSettings: (s: Partial<Settings>) => void;
  unlock: () => void;
  lock: () => void;

  // Wallet management
  setWallet: (w: Omit<StoredWallet, "id"> | StoredWallet | null) => void; // back-compat: replaces all
  addWallet: (w: Omit<StoredWallet, "id"> & { id?: string }) => StoredWallet;
  removeWallet: (id: string) => void;
  setActiveWallet: (id: string) => void;
  renameWallet: (label: string) => void; // renames active
  clearWallet: () => void; // clears all wallets
  hydrate: () => void;
};

function persist(shape: WalletStoreShape) {
  saveStore(shape);
}

export const useAppStore = create<State>((set, get) => ({
  wallets: [],
  activeWalletId: null,
  wallet: null,
  settings: { currency: "USD", pin: null, pinEnabled: false, theme: "dark" },
  unlocked: false,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const store = loadStore();
    const settings = loadSettings();
    const active = store.wallets.find((w) => w.id === store.activeWalletId) ?? null;
    set({
      wallets: store.wallets,
      activeWalletId: store.activeWalletId,
      wallet: active,
      settings,
      hydrated: true,
      unlocked: !settings.pinEnabled || !settings.pin,
    });
  },

  updateSettings: (s) => {
    const next = { ...get().settings, ...s };
    saveSettings(next);
    set({ settings: next });
  },

  unlock: () => set({ unlocked: true }),
  lock: () => set({ unlocked: false }),

  setWallet: (w) => {
    if (!w) {
      clearStore();
      set({ wallets: [], activeWalletId: null, wallet: null });
      return;
    }
    const withId: StoredWallet = "id" in w && w.id ? (w as StoredWallet) : { ...(w as Omit<StoredWallet, "id">), id: newWalletId() };
    const shape: WalletStoreShape = { wallets: [withId], activeWalletId: withId.id };
    persist(shape);
    set({ wallets: shape.wallets, activeWalletId: withId.id, wallet: withId });
  },

  addWallet: (w) => {
    const withId: StoredWallet = { ...w, id: w.id ?? newWalletId() } as StoredWallet;
    const wallets = [...get().wallets, withId];
    const shape: WalletStoreShape = { wallets, activeWalletId: withId.id };
    persist(shape);
    set({ wallets, activeWalletId: withId.id, wallet: withId });
    return withId;
  },

  removeWallet: (id) => {
    const remaining = get().wallets.filter((w) => w.id !== id);
    const activeId =
      get().activeWalletId === id ? (remaining[0]?.id ?? null) : get().activeWalletId;
    const shape: WalletStoreShape = { wallets: remaining, activeWalletId: activeId };
    persist(shape);
    const active = remaining.find((w) => w.id === activeId) ?? null;
    set({ wallets: remaining, activeWalletId: activeId, wallet: active });
  },

  setActiveWallet: (id) => {
    if (!get().wallets.some((w) => w.id === id)) return;
    const shape: WalletStoreShape = { wallets: get().wallets, activeWalletId: id };
    persist(shape);
    const active = get().wallets.find((w) => w.id === id) ?? null;
    set({ activeWalletId: id, wallet: active });
  },

  renameWallet: (label) => {
    const id = get().activeWalletId;
    if (!id) return;
    const wallets = get().wallets.map((w) => (w.id === id ? { ...w, label } : w));
    const shape: WalletStoreShape = { wallets, activeWalletId: id };
    persist(shape);
    const active = wallets.find((w) => w.id === id) ?? null;
    set({ wallets, wallet: active });
  },

  clearWallet: () => {
    clearStore();
    set({ wallets: [], activeWalletId: null, wallet: null });
  },
}));
