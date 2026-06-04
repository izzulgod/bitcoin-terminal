import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useAppStore } from "@/store/app";

export function WalletSwitcher() {
  const wallets = useAppStore((s) => s.wallets);
  const activeId = useAppStore((s) => s.activeWalletId);
  const setActiveWallet = useAppStore((s) => s.setActiveWallet);
  const [open, setOpen] = useState(false);
  if (wallets.length <= 1) return null;
  const active = wallets.find((w) => w.id === activeId);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold"
      >
        {active?.label ?? "Wallet"}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-border bg-card p-1 shadow-lg">
            {wallets.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setActiveWallet(w.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-background"
              >
                <span className="truncate">{w.label}</span>
                {w.id === activeId && <Check className="h-3 w-3 text-bitcoin" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
