import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, BarChart3, Activity, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const items = [
  { to: "/app", key: "nav.home", icon: Home },
  { to: "/app/wallet", key: "nav.wallet", icon: Wallet },
  { to: "/app/analytics", key: "nav.analytics", icon: BarChart3 },
  { to: "/app/mempool", key: "nav.mempool", icon: Activity },
  { to: "/app/settings", key: "nav.settings", icon: SettingsIcon },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const t = useT();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-2xl px-1">
        {items.map(({ to, key, icon: Icon }) => {
          const active = to === "/app" ? path === "/app" : path.startsWith(to);
          return (
            <li key={to} className="min-w-0 flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-bitcoin" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
                <span className="truncate max-w-full">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
