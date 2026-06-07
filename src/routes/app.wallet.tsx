import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSync, usePrice } from "@/hooks/use-bitcoin-data";
import { useAppStore } from "@/store/app";
import {
  formatBtc,
  formatFiat,
  satsToBtc,
  shortAddr,
  shortTxid,
  timeAgo,
} from "@/lib/format";
import {
  Copy,
  ChevronDown,
  Pencil,
  Check,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Bitcoin,
} from "lucide-react";
import { toast } from "sonner";
import { classifyTxs } from "@/lib/sync-engine";
import { SendModal } from "@/components/send-modal";
import { ReceiveModal } from "@/components/receive-modal";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/app/wallet")({
  component: WalletScreen,
});

const TABS = ["Overview", "Addresses", "UTXOs", "Derivation"] as const;

function WalletScreen() {
  const { data: sync } = useSync();
  const wallet = useAppStore((s) => s.wallet);
  const renameWallet = useAppStore((s) => s.renameWallet);
  const settings = useAppStore((s) => s.settings);
  const price = usePrice();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [showUnused, setShowUnused] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);

  const currency = settings.currency;
  const priceVal = price.data ? (currency === "USD" ? price.data.usd : price.data.idr) : 0;
  const totalBtc = sync ? satsToBtc(sync.totalBalance) : 0;
  const fiatVal = totalBtc * priceVal;

  const txFlows = useMemo(() => {
    if (!sync) return [];
    const owned = new Set(sync.addresses.map((a) => a.derived.address));
    const tipHeight =
      sync.txs.find((t) => t.status.confirmed && t.status.block_height)?.status
        .block_height ?? 0;
    return classifyTxs(sync.txs, owned, tipHeight + 6);
  }, [sync]);

  function saveName() {
    const t = draft.trim();
    if (!t) return toast.error("Name cannot be empty");
    renameWallet(t);
    setEditing(false);
    toast.success("Wallet renamed");
  }

  return (
    <div className="px-5 pt-6">
      <header>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="mt-1 text-xs text-muted-foreground">{wallet?.derivationLabel}</p>
      </header>

      <div className="mt-5 flex gap-1 rounded-xl bg-card p-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
              tab === t ? "bg-bitcoin text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <>
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={40}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") setEditing(false);
                    }}
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                  />
                  <button
                    onClick={saveName}
                    className="rounded-md bg-bitcoin p-1 text-primary-foreground"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-md border border-border bg-background p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold">
                      {wallet?.label ?? "Wallet"}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDraft(wallet?.label ?? "");
                      setEditing(true);
                    }}
                    className="rounded-md border border-border bg-background p-1.5 text-muted-foreground"
                    aria-label="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
            <div className="mt-3 inline-flex items-center gap-1 rounded-md bg-bitcoin/10 px-2 py-0.5 text-[11px] font-semibold text-bitcoin">
              {wallet?.derivationLabel}
            </div>
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total balance
              </div>
              <div className="font-mono text-2xl font-bold">
                {formatBtc(sync?.totalBalance ?? 0)} BTC
              </div>
              <div className="text-sm text-muted-foreground">
                {price.data ? formatFiat(fiatVal, currency) : "—"}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowSend(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold"
              >
                <ArrowUpRight className="h-4 w-4" /> Send
              </button>
              <button
                onClick={() => setShowReceive(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-bitcoin py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <ArrowDownLeft className="h-4 w-4" /> Receive
              </button>
            </div>
          </div>

          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent activity</h3>
              <span className="text-xs text-muted-foreground">{txFlows.length} txs</span>
            </div>
            <div className="space-y-2">
              {txFlows.slice(0, 8).map((flow) => (
                <TxRow key={flow.tx.txid} flow={flow} />
              ))}
              {txFlows.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </div>
              )}
            </div>
          </section>
        </>
      )}

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
                      m/{a.derived.path} ·{" "}
                      {a.info.chain_stats.tx_count + a.info.mempool_stats.tx_count} tx
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
                  <div className="font-mono text-xs">
                    {shortTxid(u.txid)}:{u.vout}
                  </div>
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

      {showSend && <SendModal onClose={() => setShowSend(false)} />}
      {showReceive && <ReceiveModal onClose={() => setShowReceive(false)} />}
    </div>
  );
}

function TxRow({
  flow,
}: {
  flow: {
    tx: { txid: string; status: { confirmed: boolean; block_time?: number } };
    net: number;
    direction: "in" | "out" | "self";
    confirmations: number;
  };
}) {
  const incoming = flow.direction === "in";
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`rounded-lg p-2 shrink-0 ${
            incoming ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {incoming ? (
            <ArrowDownLeft className="h-4 w-4" />
          ) : (
            <ArrowUpRight className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {incoming ? "Received" : flow.direction === "self" ? "Self-send" : "Sent"}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground truncate">
            {shortTxid(flow.tx.txid)}
            {" · "}
            {flow.tx.status.block_time ? timeAgo(flow.tx.status.block_time) : "Unconfirmed"}
          </div>
        </div>
      </div>
      <div className="text-right pl-2 shrink-0">
        <div
          className={`font-mono text-sm font-semibold whitespace-nowrap ${
            incoming ? "text-success" : "text-foreground"
          }`}
        >
          {incoming ? "+" : ""}
          {formatBtc(flow.net)} BTC
        </div>
        <div className="text-[11px] text-muted-foreground">
          {flow.confirmations === 0 ? "0 conf" : `${flow.confirmations.toLocaleString()} conf`}
        </div>
      </div>
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
