import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Flame,
  Zap,
  Bitcoin,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { useAppStore } from "@/store/app";
import {
  useFearGreed,
  useFees,
  useMarketChart,
  useMempoolStats,
  usePrice,
  useSync,
} from "@/hooks/use-bitcoin-data";
import { classifyTxs } from "@/lib/sync-engine";
import { formatBtc, formatFiat, satsToBtc, shortAddr, shortTxid, timeAgo } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/")({
  component: Home,
});

const RANGES = [
  { label: "24H", days: 1 },
  { label: "7D", days: 7 },
  { label: "1M", days: 30 },
  { label: "1Y", days: 365 },
] as const;

function Home() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const { data: sync, refetch, isFetching } = useSync();
  const price = usePrice();
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);
  const chart = useMarketChart(range.days);
  const fng = useFearGreed();
  const fees = useFees();
  const mempool = useMempoolStats();

  const currency = settings.currency;
  const priceVal = price.data ? (currency === "USD" ? price.data.usd : price.data.idr) : 0;
  const totalBtc = sync ? satsToBtc(sync.totalBalance) : 0;
  const fiatVal = totalBtc * priceVal;

  const txFlows = useMemo(() => {
    if (!sync) return [];
    const owned = new Set(sync.addresses.map((a) => a.derived.address));
    const tipHeight =
      sync.txs.find((t) => t.status.confirmed && t.status.block_height)?.status.block_height ?? 0;
    return classifyTxs(sync.txs, owned, tipHeight + 6);
  }, [sync]);

  return (
    <div className="px-5 pt-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-bitcoin/15 p-1.5">
            <Bitcoin className="h-4 w-4 text-bitcoin" />
          </div>
          <span className="text-sm font-semibold">Bitcoin Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              updateSettings({ currency: currency === "USD" ? "IDR" : "USD" })
            }
            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold"
          >
            {currency}
          </button>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-border bg-card p-1.5"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Portfolio header */}
      <section className="mt-7">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Total balance
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="font-mono text-4xl font-bold tracking-tight">
            {formatBtc(sync?.totalBalance ?? 0)}
          </div>
          <span className="text-base text-muted-foreground">BTC</span>
        </div>
        <div className="mt-1 flex items-center gap-3">
          <div className="text-base text-muted-foreground">
            {price.data ? formatFiat(fiatVal, currency) : "—"}
          </div>
          {price.data && (
            <Delta value={price.data.usd_24h_change} suffix="%" />
          )}
        </div>
      </section>

      {/* Chart */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              BTC Price
            </div>
            <div className="font-mono text-xl font-semibold">
              {price.data ? formatFiat(priceVal, currency) : "—"}
            </div>
          </div>
          <div className="flex gap-1 rounded-lg bg-background p-1">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  range.label === r.label
                    ? "bg-bitcoin text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 h-32">
          {chart.data && chart.data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart.data}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(t) => new Date(t as number).toLocaleString()}
                  formatter={(v: number) => [`$${v.toFixed(0)}`, "BTC"]}
                />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="var(--bitcoin)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Loading chart…
            </div>
          )}
        </div>
      </section>

      {/* Insight cards */}
      <section className="mt-5 grid grid-cols-2 gap-3">
        <InsightCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="BTC Price"
          value={price.data ? formatFiat(priceVal, currency) : "—"}
        />
        <InsightCard
          icon={<Flame className="h-4 w-4" />}
          label="Fear & Greed"
          value={fng.data ? `${fng.data.value} · ${fng.data.classification}` : "—"}
        />
        <InsightCard
          icon={<Activity className="h-4 w-4" />}
          label="Mempool"
          value={mempool.data ? `${mempool.data.count.toLocaleString()} tx` : "—"}
        />
        <InsightCard
          icon={<Zap className="h-4 w-4" />}
          label="Fast Fee"
          value={fees.data ? `${fees.data.fastestFee} sat/vB` : "—"}
        />
      </section>

      {/* Quick actions */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Receive address
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="font-mono text-sm break-all">
            {sync ? shortAddr(sync.receiveAddress, 10) : "—"}
          </div>
          <button
            onClick={() => {
              if (sync) {
                navigator.clipboard.writeText(sync.receiveAddress);
                toast.success("Address copied");
              }
            }}
            className="rounded-lg border border-border bg-background p-2"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Recent txs */}
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
    </div>
  );
}

function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
        positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
      }`}
    >
      <Icon className="h-3 w-3" />
      {value.toFixed(2)}
      {suffix}
    </span>
  );
}

function InsightCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-bitcoin">{icon}</span>
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function TxRow({
  flow,
}: {
  flow: { tx: { txid: string; status: { confirmed: boolean; block_time?: number } }; net: number; direction: "in" | "out" | "self"; confirmations: number };
}) {
  const incoming = flow.direction === "in";
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-lg p-2 ${
            incoming ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {incoming ? (
            <ArrowDownLeft className="h-4 w-4" />
          ) : (
            <ArrowUpRight className="h-4 w-4" />
          )}
        </div>
        <div>
          <div className="text-sm font-semibold">
            {incoming ? "Received" : flow.direction === "self" ? "Self-send" : "Sent"}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {shortTxid(flow.tx.txid)}
            {" · "}
            {flow.tx.status.block_time
              ? timeAgo(flow.tx.status.block_time)
              : "Unconfirmed"}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div
          className={`font-mono text-sm font-semibold ${
            incoming ? "text-success" : "text-foreground"
          }`}
        >
          {incoming ? "+" : ""}
          {formatBtc(flow.net)} BTC
        </div>
        <div className="text-[11px] text-muted-foreground">
          {flow.confirmations === 0
            ? "0 conf"
            : `${flow.confirmations.toLocaleString()} conf`}
        </div>
      </div>
    </div>
  );
}
