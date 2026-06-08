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
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        {/* Soft pulse ring */}
        <div className="absolute inset-0 animate-ping rounded-full bg-bitcoin/15" />
        <div className="absolute inset-2 rounded-full bg-bitcoin/10" />
        {/* Transparent logo — falls back to lucide if asset missing */}
        <img
          src="/loading-logo.png"
          alt=""
          className="relative h-14 w-14 object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (fb) fb.style.display = "block";
          }}
        />
        <Bitcoin
          className="relative h-12 w-12 animate-spin text-bitcoin"
          style={{ display: "none" }}
        />
      </div>
      <h2 className="mt-8 text-base font-semibold tracking-tight">
        Scanning blockchain
      </h2>
      <p className="mt-2 max-w-xs text-xs text-muted-foreground">
        Deriving addresses and fetching balance from mempool.space
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
