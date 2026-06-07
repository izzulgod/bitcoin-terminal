import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Flame,
  Zap,
  Bitcoin,
  ArrowDownLeft,
  ArrowUpRight,
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
import { formatBtc, formatFiat, satsToBtc } from "@/lib/format";
import { LedgerIndicator } from "@/components/ledger-indicator";
import { WalletSwitcher } from "@/components/wallet-switcher";
import { ReceiveModal } from "@/components/receive-modal";
import { SendModal } from "@/components/send-modal";
import { consumeChartAnimation } from "@/lib/chart-animation";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const { data: sync, refetch, isFetching } = useSync();
  const price = usePrice();
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);
  const chart = useMarketChart(range.days);
  const fng = useFearGreed();
  const fees = useFees();
  const mempool = useMempoolStats();
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [animatePriceChart] = useState(() => consumeChartAnimation("price"));

  const currency = settings.currency;
  const priceVal = price.data ? (currency === "USD" ? price.data.usd : price.data.idr) : 0;
  const totalBtc = sync ? satsToBtc(sync.totalBalance) : 0;
  const fiatVal = totalBtc * priceVal;

  return (
    <div className="px-5 pt-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg bg-bitcoin/15 p-1.5 shrink-0">
            <Bitcoin className="h-4 w-4 text-bitcoin" />
          </div>
          <span className="truncate text-sm font-semibold">Bitcoin Terminal</span>
          <WalletSwitcher />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LedgerIndicator />
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
          {price.data && <Delta value={price.data.usd_24h_change} suffix="%" />}
        </div>

        {/* Send / Receive */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowSend(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold"
          >
            <ArrowUpRight className="h-4 w-4" /> Send
          </button>
          <button
            onClick={() => setShowReceive(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-bitcoin py-3 text-sm font-semibold text-primary-foreground"
          >
            <ArrowDownLeft className="h-4 w-4" /> Receive
          </button>
        </div>
      </section>

      {/* Chart */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              BTC Price
            </div>
            <div className="font-mono text-xl font-semibold truncate">
              {price.data ? formatFiat(priceVal, currency) : "—"}
            </div>
          </div>
          <div className="flex gap-0.5 rounded-lg bg-background p-1 shrink-0">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
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
                  labelFormatter={(_, payload) => {
                    const t = payload?.[0]?.payload?.t as number | undefined;
                    return t ? new Date(t).toLocaleString() : "";
                  }}
                  formatter={(v: number) => [`$${v.toFixed(0)}`, "BTC"]}
                />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="var(--bitcoin)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={animatePriceChart}
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
          icon={
            price.data && price.data.usd_24h_change >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )
          }
          label="24h Change"
          value={
            price.data
              ? `${price.data.usd_24h_change >= 0 ? "+" : ""}${price.data.usd_24h_change.toFixed(2)}%`
              : "—"
          }
          valueClass={
            price.data
              ? price.data.usd_24h_change >= 0
                ? "text-success"
                : "text-destructive"
              : undefined
          }
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

      {showSend && <SendModal onClose={() => setShowSend(false)} />}
      {showReceive && <ReceiveModal onClose={() => setShowReceive(false)} />}
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
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-bitcoin">{icon}</span>
        {label}
      </div>
      <div className={`mt-1 font-mono text-sm font-semibold ${valueClass ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
