import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import "../lib/buffer-polyfill";
import { useAppStore } from "@/store/app";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-bitcoin">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The block you&apos;re looking for is not in the chain.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-bitcoin px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to terminal
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something broke</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-bitcoin px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0a0f" },
      { title: "Bitcoin Terminal — Secure & Private Bitcoin Wallet" },
      {
        name: "description",
        content:
          "Bitcoin Terminal - A secure, private, and fully functional Bitcoin wallet.",
      },
      { name: "application-name", content: "Bitcoin Terminal" },
      { property: "og:site_name", content: "Bitcoin Terminal" },
      { property: "og:title", content: "Bitcoin Terminal" },
      {
        property: "og:description",
        content:
          "Bitcoin Terminal - A secure, private, and fully functional Bitcoin wallet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Bitcoin Terminal" },
      {
        name: "twitter:description",
        content:
          "Bitcoin Terminal - A secure, private, and fully functional Bitcoin wallet.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const hydrate = useAppStore((s) => s.hydrate);
  const theme = useAppStore((s) => s.settings.theme);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme === "light" ? "light" : "dark");
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme={theme === "light" ? "light" : "dark"} position="top-center" />
    </QueryClientProvider>
  );
}
