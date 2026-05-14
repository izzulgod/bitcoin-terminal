import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, BarChart3, Activity, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/wallet", label: "Wallet", icon: Wallet },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/mempool", label: "Mempool", icon: Activity },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {items.map(({ to, label, icon: Icon }) => {
          const active = to === "/app" ? path === "/app" : path.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-bitcoin" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
