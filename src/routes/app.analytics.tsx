import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Award, TrendingUp, Sparkles, Sprout, Coins, Wallet as WalletIcon, Activity } from "lucide-react";
import { useAth, useMarketChart, usePrice, useSync } from "@/hooks/use-bitcoin-data";
import { useAppStore } from "@/store/app";
import { classifyTxs } from "@/lib/sync-engine";
import { formatBtc, formatFiat, satsToBtc, timeAgo } from "@/lib/format";
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { consumeChartAnimation } from "@/lib/chart-animation";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/app/analytics")({
  component: Analytics,
});


function Analytics() {
  const t = useT();
  const { data: sync } = useSync();
  const price = usePrice();
  const ath = useAth();
  const currency = useAppStore((s) => s.settings.currency);
  const [animateAccChart] = useState(() => consumeChartAnimation("accumulation"));
  // CoinGecko free tier caps historical range to 365 days — "max" returns 401.
  // CANONICAL baseline: always fetch IDR chart — user's actual DCA cash flows
  // were in IDR, so IDR cost basis reflects reality. PnL % is computed from
  // this baseline and stays IDENTICAL across currency toggles.
  const chartIdr = useMarketChart(365, "idr");

  const owned = useMemo(
    () => new Set((sync?.addresses ?? []).map((a) => a.derived.address)),
    [sync]
  );
  const flows = useMemo(() => (sync ? classifyTxs(sync.txs, owned, 0) : []), [sync, owned]);

  // Incoming txs (DCA buys / deposits) — sorted oldest → newest for FIFO.
  const incoming = useMemo(
    () =>
      flows
        .filter((f) => f.direction !== "out" && f.net > 0 && f.tx.status.block_time)
        .sort((a, b) => (a.tx.status.block_time! - b.tx.status.block_time!)),
    [flows]
  );

  // Historical IDR price lookup (binary-search by ts ms).
  const priceAtMsIdr = useMemo(() => {
    const points = chartIdr.data ?? [];
    return (ts: number): number | null => {
      if (!points.length) return null;
      let lo = 0;
      let hi = points.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (points[mid].t < ts) lo = mid + 1;
        else hi = mid;
      }
      return points[lo].v;
    };
  }, [chartIdr.data]);

  const priceUsd = price.data?.usd ?? 0;
  const priceIdr = price.data?.idr ?? 0;
  const priceVal = currency === "USD" ? priceUsd : priceIdr;

  // Cost basis CANONICAL in IDR using historical BTC/IDR at each receive's block
  // time. This locks the real cash flow. PnL ratio is derived from this and is
  // currency-invariant; display values in USD are converted from this baseline.
  const { costBasisIdr, acquiredSats, pricedCount, totalReceivedSats } = useMemo(() => {
    let cb = 0;
    let acq = 0;
    let priced = 0;
    let received = 0;
    for (const f of incoming) {
      received += f.net;
      const ts = (f.tx.status.block_time as number) * 1000;
      const histIdr = priceAtMsIdr(ts);
      const p = histIdr ?? (priceIdr > 0 ? priceIdr : null);
      if (p == null) continue;
      const btc = satsToBtc(f.net);
      cb += btc * p;
      acq += f.net;
      if (histIdr != null) priced++;
    }
    return { costBasisIdr: cb, acquiredSats: acq, pricedCount: priced, totalReceivedSats: received };
  }, [incoming, priceAtMsIdr, priceIdr]);


  const totalBalanceSats = sync?.totalBalance ?? 0;
  const totalBtc = satsToBtc(totalBalanceSats);
  const portfolioValue = totalBtc * priceVal;
  const portfolioValueIdr = totalBtc * priceIdr;

  // Pro-rata cost basis for currently held sats (handles partial spends).
  const heldRatio = acquiredSats > 0 ? Math.min(1, totalBalanceSats / acquiredSats) : 0;
  const adjustedCostBasisIdr = costBasisIdr * heldRatio;

  // CANONICAL PnL ratio — computed in IDR (user's real cash-flow currency).
  // This ratio is invariant under currency toggle.
  const pnlRatio =
    adjustedCostBasisIdr > 0
      ? (portfolioValueIdr - adjustedCostBasisIdr) / adjustedCostBasisIdr
      : 0;
  const pnlPct = pnlRatio * 100;

  // Display cost basis: derive from current portfolio value & canonical ratio so
  // the % stays identical across USD/IDR. Falls back to direct FX conversion
  // when ratio is undefined (no acquisitions yet).
  const fxFromIdr = priceIdr > 0 ? priceVal / priceIdr : 0;
  const adjustedCostBasis =
    adjustedCostBasisIdr > 0 && pnlRatio !== -1
      ? portfolioValue / (1 + pnlRatio)
      : adjustedCostBasisIdr * fxFromIdr;
  const pnl = portfolioValue - adjustedCostBasis;

  // Avg buy price in display currency: full (un-pro-rated) cost basis ÷ acquired BTC.
  const costBasisFullDisplay =
    acquiredSats > 0 && heldRatio > 0
      ? adjustedCostBasis / heldRatio
      : costBasisIdr * fxFromIdr;
  const avgPrice = acquiredSats > 0 ? costBasisFullDisplay / satsToBtc(acquiredSats) : 0;

  // Live ATH from CoinGecko (per active currency for display) — falls back to
  // a sensible reference until data lands so the UI stays usable.
  const athDisplay = ath.data
    ? currency === "USD"
      ? ath.data.usd
      : ath.data.idr
    : 0;
  const athUsd = ath.data?.usd ?? 0;
  // % distance is currency-invariant (use USD baseline).
  const athDistance =
    price.data && athUsd > 0 ? ((price.data.usd - athUsd) / athUsd) * 100 : 0;
  const athProgress =
    price.data && athUsd > 0 ? Math.min(100, (price.data.usd / athUsd) * 100) : 0;

  // Build accumulation timeline from incoming txs (already sorted ascending).
  const timeline = useMemo(() => {
    let acc = 0;
    return incoming.map((f) => {
      acc += f.net;
      return {
        t: (f.tx.status.block_time as number) * 1000,
        balance: satsToBtc(acc),
      };
    });
  }, [incoming]);

  const firstReceive = incoming[0];
  

  return (
    <div className="px-5 pt-6">
      <header>
        <h1 className="text-2xl font-bold">{t("analytics.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("analytics.subtitle")}</p>
      </header>

      {/* PnL card */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("analytics.pnl")}
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
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">{t("analytics.costBasis")}</div>
            <div className="font-mono">{formatFiat(adjustedCostBasis, currency)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("analytics.currentValue")}</div>
            <div className="font-mono">{formatFiat(portfolioValue, currency)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("analytics.avgBuyPrice")}</div>
            <div className="font-mono">
              {avgPrice > 0 ? formatFiat(avgPrice, currency) : "—"}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground">{t("analytics.currentPrice")}</div>
            <div className="font-mono">
              {priceVal > 0 ? formatFiat(priceVal, currency) : "—"}
            </div>
          </div>
        </div>
        <div className="mt-3 text-[10px] text-muted-foreground">
          {chartIdr.isLoading && incoming.length > 0
            ? "Loading historical BTC prices to compute cost basis…"
            : chartIdr.isError
              ? "Could not load historical BTC prices — PnL unavailable. Retry later."
              : pricedCount < incoming.length && incoming.length > 0
                ? `Priced ${pricedCount}/${incoming.length} receives using historical BTC/IDR; some too recent or missing from history.`
                : `PnL % computed in IDR (your real cash-flow baseline) and stays identical across currency toggle; display values converted via live FX.`}
        </div>


      </section>

      {/* Accumulation timeline */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-bitcoin" />
          <h3 className="text-sm font-semibold">{t("analytics.accumulation")}</h3>
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
                  labelFormatter={(_, payload) => {
                    const ts = payload?.[0]?.payload?.t as number | undefined;
                    return ts ? new Date(ts).toLocaleDateString() : "";
                  }}
                  formatter={(v: number) => [`${v.toFixed(8)} BTC`, "Balance"]}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--bitcoin)"
                  strokeWidth={2}
                  fill="url(#acc)"
                  isAnimationActive={animateAccChart}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              {t("analytics.noAccum")}
            </div>
          )}
        </div>
      </section>

      {/* BTC vs ATH — live CoinGecko */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-bitcoin" />
          <h3 className="text-sm font-semibold">{t("analytics.vsAth")}</h3>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <div className="font-mono text-2xl font-bold">
            {ath.data && price.data ? `${athDistance >= 0 ? "+" : ""}${athDistance.toFixed(2)}%` : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("analytics.athLabel")} {athDisplay > 0 ? formatFiat(athDisplay, currency) : "—"}
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-background">
          <div
            className="h-full rounded-full gradient-bitcoin"
            style={{ width: `${athProgress}%` }}
          />
        </div>
      </section>

      {/* Bitcoin Journey — vertical flowchart timeline */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-bitcoin" />
          <h3 className="text-sm font-semibold">{t("analytics.journey")}</h3>
        </div>
        <ol className="relative mt-4 pl-2">
          {firstReceive && (
            <TimelineStep
              icon={<Sprout className="h-3.5 w-3.5" />}
              title={t("analytics.firstSats")}
              when={timeAgo(firstReceive.tx.status.block_time as number)}
              detail={`+${formatBtc(firstReceive.net)} BTC`}
            />
          )}
          <TimelineStep
            icon={<Coins className="h-3.5 w-3.5" />}
            title={t("analytics.totalReceived")}
            detail={`${formatBtc(totalReceivedSats)} BTC ${t("analytics.acrossTxs")} ${incoming.length} ${t("analytics.txsWord")}`}
          />
          <TimelineStep
            icon={<WalletIcon className="h-3.5 w-3.5" />}
            title={t("analytics.currentStack")}
            detail={`${formatBtc(sync?.totalBalance ?? 0)} BTC · ${formatFiat(portfolioValue, currency)}`}
          />
          <TimelineStep
            icon={<Activity className="h-3.5 w-3.5" />}
            title={t("analytics.dailyChange")}
            detail={
              price.data
                ? `${price.data.usd_24h_change >= 0 ? "+" : ""}${price.data.usd_24h_change.toFixed(2)}% (24h)`
                : "—"
            }
            last
          />
        </ol>
      </section>
    </div>
  );
}

function TimelineStep({
  icon,
  title,
  when,
  detail,
  last,
}: {
  icon: React.ReactNode;
  title: string;
  when?: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <li className="relative pl-9 pb-5 last:pb-0">
      {/* Connector line */}
      {!last && (
        <span
          aria-hidden
          className="absolute left-[10px] top-6 bottom-0 w-px bg-border"
        />
      )}
      {/* Node marker */}
      <span className="absolute left-0 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-bitcoin/40 bg-bitcoin/10 text-bitcoin">
        {icon}
      </span>
      <div className="text-sm font-semibold leading-tight">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {when && <span>{when} · </span>}
        {detail}
      </div>
    </li>
  );
}
