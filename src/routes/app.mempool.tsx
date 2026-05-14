import { createFileRoute } from "@tanstack/react-router";
import { useFees, useMempoolStats, useTipBlock } from "@/hooks/use-bitcoin-data";
import { Activity, Box, Clock, Gauge, Zap } from "lucide-react";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/app/mempool")({
  component: MempoolScreen,
});

function MempoolScreen() {
  const fees = useFees();
  const mempool = useMempoolStats();
  const tip = useTipBlock();

  const congestion = mempool.data ? Math.min(100, (mempool.data.vsize / 300_000_000) * 100) : 0;
  const tipBlock = tip.data?.[0];

  return (
    <div className="px-5 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mempool</h1>
          <p className="mt-1 text-xs text-muted-foreground">Real-time blockchain status</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Live
        </div>
      </header>

      {/* Tip block */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Box className="h-4 w-4 text-bitcoin" />
          Latest block
        </div>
        <div className="mt-1 font-mono text-2xl font-bold">
          #{tipBlock?.height.toLocaleString() ?? "—"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {tipBlock ? timeAgo(tipBlock.timestamp) : "—"} · next in ~10 min
        </div>
      </section>

      {/* Mempool stats */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-bitcoin" />
          <h3 className="text-sm font-semibold">Mempool pressure</h3>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <div className="font-mono text-2xl font-bold">
            {mempool.data?.count.toLocaleString() ?? "—"}
          </div>
          <div className="text-xs text-muted-foreground">unconfirmed txs</div>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${congestion}%`,
              background: `linear-gradient(90deg, var(--success), var(--warning), var(--destructive))`,
            }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>Calm</span>
          <span>Congested</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <Stat
            label="vSize"
            value={
              mempool.data ? `${(mempool.data.vsize / 1_000_000).toFixed(1)} MvB` : "—"
            }
          />
          <Stat
            label="Total fees"
            value={
              mempool.data
                ? `${(mempool.data.total_fee / 100_000_000).toFixed(3)} BTC`
                : "—"
            }
          />
        </div>
      </section>

      {/* Fee tiers */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-bitcoin" />
          <h3 className="text-sm font-semibold">Recommended fees</h3>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <FeeTier
            label="Slow"
            sub="~1 hour"
            value={fees.data?.hourFee}
            color="text-success"
          />
          <FeeTier
            label="Normal"
            sub="~30 min"
            value={fees.data?.halfHourFee}
            color="text-warning"
          />
          <FeeTier
            label="Fast"
            sub="next block"
            value={fees.data?.fastestFee}
            color="text-bitcoin"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Stat label="Economy" value={fees.data ? `${fees.data.economyFee} sat/vB` : "—"} />
          <Stat label="Minimum" value={fees.data ? `${fees.data.minimumFee} sat/vB` : "—"} />
        </div>
      </section>

      {/* Next block estimate */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-bitcoin" />
          <h3 className="text-sm font-semibold">Next block</h3>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Avg block time is 10 minutes. Pay <strong className="text-bitcoin">{fees.data?.fastestFee ?? "—"} sat/vB</strong> to land in the next block.
        </p>
      </section>
    </div>
  );
}

function FeeTier({
  label,
  sub,
  value,
  color,
}: {
  label: string;
  sub: string;
  value: number | undefined;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-center">
      <Zap className={`mx-auto h-4 w-4 ${color}`} />
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-lg font-bold">{value ?? "—"}</div>
      <div className="text-[10px] text-muted-foreground">sat/vB · {sub}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}
