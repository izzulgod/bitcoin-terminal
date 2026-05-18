import { Bitcoin } from "lucide-react";
import { useSync } from "@/hooks/use-bitcoin-data";

/**
 * Blocks rendering the dashboard until the very first wallet sync
 * has produced data. Once we have data (fresh or from localStorage
 * cache), children render immediately and any background refresh
 * happens silently.
 */
export function SyncGate({ children }: { children: React.ReactNode }) {
  const { data, error } = useSync();

  if (!data && !error) return <ScanningScreen />;
  if (!data && error) return <ScanningError message={error.message} />;
  return <>{children}</>;
}

function ScanningScreen() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <div className="rounded-3xl bg-bitcoin/10 p-6 bitcoin-glow">
        <Bitcoin className="h-12 w-12 animate-spin text-bitcoin" />
      </div>
      <h2 className="mt-6 text-lg font-semibold">Scanning blockchain</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Deriving addresses, fetching UTXOs and transaction history from mempool.space…
      </p>
    </div>
  );
}

function ScanningError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <h2 className="text-lg font-semibold">Sync failed</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{message}</p>
      <button
        onClick={() => location.reload()}
        className="mt-6 rounded-lg bg-bitcoin px-6 py-2.5 font-semibold text-primary-foreground"
      >
        Retry
      </button>
    </div>
  );
}
