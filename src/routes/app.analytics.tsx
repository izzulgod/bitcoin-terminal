import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Award, TrendingUp, Sparkles } from "lucide-react";
import { useMarketChart, usePrice, useSync } from "@/hooks/use-bitcoin-data";
import { useAppStore } from "@/store/app";
import { classifyTxs } from "@/lib/sync-engine";
import { formatBtc, formatFiat, satsToBtc, timeAgo } from "@/lib/format";
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export const Route = createFileRoute("/app/analytics")({
  component: Analytics,
});

const ALL_TIME_HIGH_USD = 109_000; // updated reference point

function Analytics() {
  const { data: sync } = useSync();
  const price = usePrice();
  const chart = useMarketChart(365);
  const currency = useAppStore((s) => s.settings.currency);

  const owned = useMemo(
    () => new Set((sync?.addresses ?? []).map((a) => a.derived.address)),
    [sync]
  );
  const flows = useMemo(() => (sync ? classifyTxs(sync.txs, owned, 0) : []), [sync, owned]);

  // DCA / cost basis estimate: for each incoming tx, value at tx time approximated
  // by current price (real implementation would use historic price API).
  const incoming = flows.filter((f) => f.direction !== "out" && f.net > 0);
  const totalReceivedSats = incoming.reduce((s, f) => s + f.net, 0);
  const totalBtc = satsToBtc(sync?.totalBalance ?? 0);
  const priceVal = price.data ? (currency === "USD" ? price.data.usd : price.data.idr) : 0;
  const portfolioValue = totalBtc * priceVal;
  const costBasis = satsToBtc(totalReceivedSats) * priceVal; // simplified
  const pnl = portfolioValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  const athDistance = price.data
    ? ((price.data.usd - ALL_TIME_HIGH_USD) / ALL_TIME_HIGH_USD) * 100
    : 0;

  // Build accumulation timeline from incoming txs
  const timeline = useMemo(() => {
    const sorted = [...incoming]
      .filter((f) => f.tx.status.block_time)
      .sort((a, b) => (a.tx.status.block_time! - b.tx.status.block_time!));
    let acc = 0;
    return sorted.map((f) => {
      acc += f.net;
      return {
        t: (f.tx.status.block_time as number) * 1000,
        balance: satsToBtc(acc),
      };
    });
  }, [incoming]);

  const firstReceive = incoming[incoming.length - 1]; // earliest because sorted desc

  return (
    <div className="px-5 pt-6">
      <header>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-xs text-muted-foreground">Portfolio insights & journey</p>
      </header>

      {/* PnL card */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Estimated PnL
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <div
            className={`font-mono text-3xl font-bold ${
              pnl >= 0 ? "text-success" : "text-destructive"
            }`}
          >
            {pnl >= 0 ? "+" : ""}
            {formatFiat(pnl, currency)}
          </div>
          <div className={`text-sm ${pnl >= 0 ? "text-success" : "text-destructive"}`}>
            {pnlPct >= 0 ? "+" : ""}
            {pnlPct.toFixed(2)}%
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Cost basis (est.)</div>
            <div className="font-mono">{formatFiat(costBasis, currency)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Current value</div>
            <div className="font-mono">{formatFiat(portfolioValue, currency)}</div>
          </div>
        </div>
      </section>

      {/* Accumulation timeline */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-bitcoin" />
          <h3 className="text-sm font-semibold">Accumulation</h3>
        </div>
        <div className="mt-3 h-36">
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="acc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--bitcoin)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--bitcoin)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={[0, "dataMax"]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(t) => new Date(t as number).toLocaleDateString()}
                  formatter={(v: number) => [`${v.toFixed(8)} BTC`, "Balance"]}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--bitcoin)"
                  strokeWidth={2}
                  fill="url(#acc)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No accumulation data yet.
            </div>
          )}
        </div>
      </section>

      {/* BTC vs ATH */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-bitcoin" />
          <h3 className="text-sm font-semibold">vs All-Time High</h3>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <div className="font-mono text-2xl font-bold">
            {athDistance >= 0 ? "+" : ""}
            {athDistance.toFixed(2)}%
          </div>
          <div className="text-xs text-muted-foreground">
            ATH ${ALL_TIME_HIGH_USD.toLocaleString()}
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-background">
          <div
            className="h-full rounded-full gradient-bitcoin"
            style={{
              width: `${Math.min(100, ((price.data?.usd ?? 0) / ALL_TIME_HIGH_USD) * 100)}%`,
            }}
          />
        </div>
      </section>

      {/* Bitcoin Journey */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-bitcoin" />
          <h3 className="text-sm font-semibold">Your Bitcoin Journey</h3>
        </div>
        <ul className="mt-3 space-y-3">
          {firstReceive && (
            <Milestone
              title="First sats"
              when={timeAgo(firstReceive.tx.status.block_time as number)}
              detail={`+${formatBtc(firstReceive.net)} BTC`}
            />
          )}
          <Milestone
            title="Total received"
            detail={`${formatBtc(totalReceivedSats)} BTC across ${incoming.length} txs`}
          />
          <Milestone
            title="Current stack"
            detail={`${formatBtc(sync?.totalBalance ?? 0)} BTC · ${formatFiat(portfolioValue, currency)}`}
          />
          <Milestone
            title="Daily change"
            detail={
              price.data
                ? `${price.data.usd_24h_change >= 0 ? "+" : ""}${price.data.usd_24h_change.toFixed(2)}% (24h)`
                : "—"
            }
          />
        </ul>
        <div className="mt-3 text-[10px] text-muted-foreground">
          Cost basis is estimated using current spot price. Connect a historic price feed for
          per-tx accuracy.
        </div>
        {chart.data && chart.data.length === 0 && null}
      </section>
    </div>
  );
}

function Milestone({ title, when, detail }: { title: string; when?: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-1.5 h-2 w-2 rounded-full bg-bitcoin" />
      <div className="flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">
          {when && <span>{when} · </span>}
          {detail}
        </div>
      </div>
    </li>
  );
}
