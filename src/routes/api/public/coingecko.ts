import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://api.coingecko.com/api/v3";
const ALLOWED_PATHS = [
  /^\/simple\/price(\?.*)?$/,
  /^\/coins\/bitcoin\/market_chart(\?.*)?$/,
];

export const Route = createFileRoute("/api/public/coingecko")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path") ?? "";

        if (!ALLOWED_PATHS.some((p) => p.test(path))) {
          return Response.json({ error: "Invalid coingecko path" }, { status: 400 });
        }

        const upstream = await fetch(`${BASE}${path}`, {
          headers: { accept: "application/json" },
        });
        const body = await upstream.text();

        return new Response(body, {
          status: upstream.status,
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "application/json",
            "cache-control": "public, max-age=60",
          },
        });
      },
    },
  },
});
