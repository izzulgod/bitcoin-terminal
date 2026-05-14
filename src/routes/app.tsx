import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useAppStore } from "@/store/app";
import { BottomNav } from "@/components/bottom-nav";
import { Bitcoin } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { hydrated, wallet, settings, unlocked, hydrate, unlock } = useAppStore();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !wallet) {
      navigate({ to: "/" });
    }
  }, [hydrated, wallet, navigate]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Bitcoin className="h-10 w-10 animate-pulse text-bitcoin" />
      </div>
    );
  }

  if (!wallet) return null;

  if (settings.pinEnabled && settings.pin && !unlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="rounded-2xl bg-bitcoin/10 p-4 mb-6">
          <Bitcoin className="h-10 w-10 text-bitcoin" />
        </div>
        <h2 className="text-xl font-semibold">Enter PIN</h2>
        <p className="mt-1 text-sm text-muted-foreground">Unlock your terminal</p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => {
            setError(null);
            setPin(e.target.value.replace(/\D/g, ""));
          }}
          className="mt-6 w-48 rounded-lg border border-border bg-card px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono text-foreground focus:border-bitcoin focus:outline-none"
          placeholder="••••••"
          autoFocus
        />
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button
          onClick={() => {
            if (pin === settings.pin) unlock();
            else setError("Incorrect PIN");
          }}
          className="mt-6 rounded-lg bg-bitcoin px-8 py-2.5 font-semibold text-primary-foreground"
        >
          Unlock
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-2xl">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
