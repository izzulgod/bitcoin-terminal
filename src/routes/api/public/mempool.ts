import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://mempool.space/api";
const ALLOWED_PATHS = [
  /^\/address\/[a-zA-Z0-9]+$/,
  /^\/address\/[a-zA-Z0-9]+\/utxo$/,
  /^\/address\/[a-zA-Z0-9]+\/txs$/,
  /^\/v1\/fees\/recommended$/,
  /^\/mempool$/,
  /^\/blocks\/tip\/height$/,
  /^\/v1\/blocks$/,
];

export const Route = createFileRoute("/api/public/mempool")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path") ?? "";

        if (!ALLOWED_PATHS.some((pattern) => pattern.test(path))) {
          return Response.json({ error: "Invalid mempool path" }, { status: 400 });
        }

        const upstream = await fetch(`${BASE}${path}`, {
          headers: { accept: "application/json" },
        });
        const body = await upstream.text();

        return new Response(body, {
          status: upstream.status,
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "application/json",
            "cache-control": "public, max-age=5",
          },
        });
      },
    },
  },
});