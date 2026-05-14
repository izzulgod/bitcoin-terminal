import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSync } from "@/hooks/use-bitcoin-data";
import { useAppStore } from "@/store/app";
import { formatBtc, shortAddr, shortTxid } from "@/lib/format";
import { Copy, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/wallet")({
  component: WalletScreen,
});

const TABS = ["Addresses", "UTXOs", "Derivation"] as const;

function WalletScreen() {
  const { data: sync } = useSync();
  const wallet = useAppStore((s) => s.wallet);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Addresses");
  const [showUnused, setShowUnused] = useState(false);

  return (
    <div className="px-5 pt-6">
      <header>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="mt-1 text-xs text-muted-foreground">{wallet?.derivationLabel}</p>
      </header>

      <div className="mt-5 flex gap-1 rounded-xl bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              tab === t ? "bg-bitcoin text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Addresses" && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{(sync?.addresses.filter((a) => a.used) ?? []).length} used</span>
            <button onClick={() => setShowUnused((v) => !v)} className="underline">
              {showUnused ? "Hide" : "Show"} unused
            </button>
          </div>
          {(sync?.addresses ?? [])
            .filter((a) => (showUnused ? true : a.used))
            .map((a) => (
              <div
                key={a.derived.address}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs truncate">{a.derived.address}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      m/{a.derived.path} · {a.info.chain_stats.tx_count + a.info.mempool_stats.tx_count}{" "}
                      tx
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-semibold">
                      {formatBtc(a.balance)}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(a.derived.address);
                        toast.success("Copied");
                      }}
                      className="mt-1 text-muted-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {tab === "UTXOs" && (
        <div className="mt-4 space-y-2">
          <div className="text-xs text-muted-foreground">
            {sync?.utxos.length ?? 0} unspent outputs
          </div>
          {(sync?.utxos ?? []).map((u) => (
            <div
              key={`${u.txid}:${u.vout}`}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-xs">{shortTxid(u.txid)}:{u.vout}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                    {shortAddr(u.address, 8)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold">{formatBtc(u.value)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {u.status.confirmed ? "Confirmed" : "Mempool"}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {sync && sync.utxos.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No unspent outputs.
            </div>
          )}
        </div>
      )}

      {tab === "Derivation" && wallet && (
        <div className="mt-4 space-y-3">
          <Field label="xpub" value={wallet.rawXpub} mono />
          <Field label="Script type" value={wallet.scriptType} />
          <Field label="Derivation" value={wallet.derivationLabel} />
          <Field label="Network" value={wallet.network} />
          <Field label="Gap limit" value="20" />
          <details className="rounded-xl border border-border bg-card p-3">
            <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold">
              Normalized xpub
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
              {wallet.normalizedXpub}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-1 break-all text-sm ${mono ? "font-mono text-[11px]" : "font-medium"}`}
      >
        {value}
      </div>
    </div>
  );
}
