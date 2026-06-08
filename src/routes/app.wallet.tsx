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
import { encodeForScriptType, canonicalPrefix } from "@/lib/xpub";

export const Route = createFileRoute("/app/wallet")({
  component: WalletScreen,
});

const TAB_KEYS = [
  { key: "Overview", label: "wallet.tab.overview" },
  { key: "Addresses", label: "wallet.tab.addresses" },
  { key: "UTXOs", label: "wallet.tab.utxos" },
  { key: "Derivation", label: "wallet.tab.derivation" },
] as const;
type TabKey = (typeof TAB_KEYS)[number]["key"];

function WalletScreen() {
  const t = useT();
  const { data: sync } = useSync();
  const wallet = useAppStore((s) => s.wallet);
  const renameWallet = useAppStore((s) => s.renameWallet);
  const settings = useAppStore((s) => s.settings);
  const price = usePrice();
  const [tab, setTab] = useState<TabKey>("Overview");
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
      sync.txs.find((tx) => tx.status.confirmed && tx.status.block_height)?.status
        .block_height ?? 0;
    return classifyTxs(sync.txs, owned, tipHeight + 6);
  }, [sync]);

  function saveName() {
    const txt = draft.trim();
    if (!txt) return toast.error("Name cannot be empty");
    renameWallet(txt);
    setEditing(false);
    toast.success("Wallet renamed");
  }

  // Masked xpub for the debit-card micro-detail row.
  const maskedXpub = wallet
    ? `${wallet.normalizedXpub.slice(0, 6)} •••• ${wallet.normalizedXpub.slice(-6)}`
    : "—";

  return (
    <div className="px-5 pt-6">
      <header>
        <h1 className="text-2xl font-bold">{t("wallet.title")}</h1>
      </header>

      <div className="mt-5 flex gap-1 rounded-xl bg-card p-1 overflow-x-auto">
        {TAB_KEYS.map((tk) => (
          <button
            key={tk.key}
            onClick={() => setTab(tk.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
              tab === tk.key ? "bg-bitcoin text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t(tk.label)}
          </button>
        ))}
      </div>


      {tab === "Overview" && (
        <>
          {/* Wallet name + rename */}
          <div className="mt-4 flex items-center gap-2">
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

          {/* Premium debit-card composition */}
          <div
            className="relative mt-3 overflow-hidden rounded-2xl border border-bitcoin/20 p-5 text-primary-foreground shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.32 0.07 60) 0%, oklch(0.22 0.05 50) 55%, oklch(0.14 0.02 40) 100%)",
            }}
          >
            {/* Decorative glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full"
              style={{ background: "radial-gradient(circle, oklch(0.78 0.17 60 / 0.35), transparent 70%)" }}
            />

            {/* Top row */}
            <div className="relative flex items-start justify-between gap-3">
              <div className="rounded-xl bg-white/10 p-2 backdrop-blur-sm">
                <Bitcoin className="h-5 w-5 text-bitcoin" />
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/90 backdrop-blur-sm">
                Native SegWit • BIP84
              </span>
            </div>

            {/* Center */}
            <div className="relative mt-7">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                {t("wallet.totalBalance")}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-extrabold tracking-tight text-white">
                  {formatBtc(sync?.totalBalance ?? 0)}
                </span>
                <span className="text-sm font-semibold text-white/70">BTC</span>
              </div>
              <div className="mt-1 font-mono text-sm text-white/80">
                {price.data ? formatFiat(fiatVal, currency) : "—"}
              </div>
            </div>

            {/* Lower row — masked xpub + network */}
            <div className="relative mt-6 flex items-end justify-between gap-2">
              <div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-white/50">xpub</div>
                <div className="font-mono text-[11px] text-white/80">{maskedXpub}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-[0.18em] text-white/50">
                  {t("wallet.network")}
                </div>
                <div className="text-[11px] font-semibold text-white/90">
                  {wallet?.network === "mainnet" ? "Mainnet" : "Testnet"}
                </div>
              </div>
            </div>
          </div>

          {/* Send / Receive */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowSend(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-sm font-semibold"
            >
              <ArrowUpRight className="h-4 w-4" /> {t("common.send")}
            </button>
            <button
              onClick={() => setShowReceive(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-bitcoin py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <ArrowDownLeft className="h-4 w-4" /> {t("common.receive")}
            </button>
          </div>

          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t("wallet.recent")}</h3>
              <span className="text-xs text-muted-foreground">{txFlows.length} {t("wallet.txs")}</span>
            </div>
            <div className="space-y-2">
              {txFlows.slice(0, 8).map((flow) => (
                <TxRow key={flow.tx.txid} flow={flow} />
              ))}
              {txFlows.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {t("wallet.noTxs")}
                </div>
              )}
            </div>
          </section>
        </>
      )}


      {tab === "Addresses" && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{(sync?.addresses.filter((a) => a.used) ?? []).length} {t("wallet.used")}</span>
            <button onClick={() => setShowUnused((v) => !v)} className="underline">
              {showUnused ? t("wallet.hideUnused") : t("wallet.showUnused")}
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
            {sync?.utxos.length ?? 0} {t("wallet.utxos")}
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
                    {u.status.confirmed ? t("wallet.confirmed") : t("wallet.mempool")}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {sync && sync.utxos.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t("wallet.noUtxos")}
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
  const t = useT();
  const incoming = flow.direction === "in";
  const label = incoming
    ? t("wallet.received")
    : flow.direction === "self"
      ? t("wallet.selfSend")
      : t("wallet.sent");
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
          <div className="text-sm font-semibold">{label}</div>
          <div className="font-mono text-[11px] text-muted-foreground truncate">
            {shortTxid(flow.tx.txid)}
            {" · "}
            {flow.tx.status.block_time ? timeAgo(flow.tx.status.block_time) : t("wallet.unconfirmed")}
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
          {flow.confirmations === 0
            ? `0 ${t("wallet.conf")}`
            : `${flow.confirmations.toLocaleString()} ${t("wallet.conf")}`}
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
