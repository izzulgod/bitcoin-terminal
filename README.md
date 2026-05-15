# ₿ Bitcoin Terminal — Watch-only xpub Dashboard

> **Bloomberg Terminal for personal Bitcoin.** Monitor a Ledger / hardware-wallet
> xpub in real time — fully private, watch-only, **no private keys ever**.

A cross-platform React web app (mobile-first) that imports an extended public
key (xpub / ypub / zpub) and renders a complete portfolio terminal: balance,
UTXO set, transactions, mempool pressure, fees, analytics, and a "Bitcoin
Journey" timeline.

Built as a web app first, designed so the UI ports cleanly to a future mobile
shell (Capacitor / React Native Web).

---

## ✨ Features

### Core
- 🔐 **Watch-only** — only public keys (xpub) are ever stored
- 🧠 **Auto-detect derivation** — BIP44 (Legacy), BIP49 (Nested SegWit),
  BIP84 (Native SegWit), BIP86 (Taproot)
- 🌐 Native xpub / ypub / zpub prefix handling (mainnet + testnet)
- 🔄 Gap-limit address scanning (default 20)
- 💰 UTXO aggregation & balance computation
- 🧾 Transaction classification (incoming / outgoing / self-send)
- 🔓 Optional 6-digit PIN gate
- 💱 Currency toggle USD ↔ IDR

### Screens
- **Onboarding** — Splash → Value prop → Import → Detect → Security → Sync
- **Home** — Total balance, fiat value, BTC chart (24H/7D/1M/1Y), insight
  cards (price, Fear & Greed, mempool, fast fee), receive address, recent txs
- **Wallet** — Addresses (used/unused), UTXO viewer, derivation info
- **Analytics** — PnL estimate, accumulation timeline, vs ATH, journey
  milestones
- **Mempool** — Block tip, mempool pressure gauge, recommended fees, next
  block estimate
- **Settings** — Currency, PIN management, data sources, remove wallet

### Data sources (all public, no API keys)
- [`mempool.space`](https://mempool.space) — addresses, UTXOs, txs, fees, mempool
- [`CoinGecko`](https://coingecko.com) — price + chart history
- [`alternative.me`](https://alternative.me) — Fear & Greed index

---

## 🧬 Architecture

```
src/
├── lib/
│   ├── xpub.ts             # detect prefix, normalize, derive addresses
│   ├── mempool.ts          # mempool.space + CoinGecko + FNG REST clients
│   ├── sync-engine.ts      # gap-limit scan, UTXO aggregation, tx classification
│   ├── wallet-store.ts     # localStorage persistence
│   ├── format.ts           # BTC / fiat / time formatters
│   └── buffer-polyfill.ts  # browser Buffer polyfill for bitcoinjs-lib
├── store/app.ts            # zustand global state (wallet + settings + lock)
├── hooks/use-bitcoin-data.ts # TanStack Query hooks for all remote data
├── components/
│   ├── bottom-nav.tsx
│   └── ui/                 # shadcn primitives
└── routes/
    ├── __root.tsx          # SSR shell + providers
    ├── index.tsx           # onboarding flow
    ├── app.tsx             # authenticated layout (PIN gate + bottom nav)
    ├── app.index.tsx       # Home
    ├── app.wallet.tsx      # Wallet
    ├── app.analytics.tsx   # Analytics
    ├── app.mempool.tsx     # Mempool
    ├── app.settings.tsx    # Settings
    └── sitemap[.]xml.ts
```

### Data flow

```
xpub input
   ↓
detectAndNormalize()        — bs58check decode, version byte → script type
   ↓
deriveAddresses(chain, i)   — BIP32 derive externals (0/*) + change (1/*)
   ↓
syncWallet()                — fetch /address/{a} per derived addr,
                              stop after gap-limit empty addresses
   ↓
utxos = ⋃ /address/{a}/utxo
balance = Σ utxos.value
txs    = dedupe(⋃ /address/{a}/txs)
   ↓
classifyTxs(owned)          — net flow per tx (in / out / self)
   ↓
React Query cache → screens
```

---

## 🚀 Getting started

```bash
# install
bun install
# or: npm install

# dev
bun dev
# → http://localhost:5173

# build
bun run build

# preview built bundle
bun run preview
```

### First launch
1. Splash → tap **Import Wallet**
2. Paste your xpub (or ypub/zpub). Example, an `xpub` from Ledger:
   ```
   xpub6CX16S9FXgLZDr9D8pbiVYRJxdMQKkLu19v6hQEQjxZJ4Gk9cWuHUpUAYcxa9sSf6BL8VG4ExuW8PDjdVMirxcbt6NEVspdbbxawWzbVs1n
   ```
   (spaces are auto-trimmed)
3. The app auto-detects the script type — for the Ledger key above, derivation
   `84'/0'/0'` indicates **BIP84 / Native SegWit (`bc1q…`)** — confirm or
   override.
4. Optionally set a 6-digit PIN.
5. Done — terminal opens, scans, and renders.

> ℹ️  Standard `xpub` prefix is BIP44 by default. Ledger Live exports `xpub`
> for **all** account types (its API encodes the path elsewhere). If you
> imported from Ledger and your account is Native SegWit, manually pick
> **BIP84** in the detect screen. The app supports overriding the auto-pick.

---

## 🚢 Deploying to Vercel

This project is **Vercel-ready**. A `vercel.json` is included with SPA
rewrites and security headers.

### Option 1 — One-click deploy
1. Push the repo to GitHub.
2. In the [Vercel dashboard](https://vercel.com/new), **Import Project** and
   pick the repo.
3. Vercel auto-detects:
   - Build command: `vite build`
   - Output directory: `dist/client`
4. Click **Deploy**.

### Option 2 — CLI
```bash
npm i -g vercel
vercel
# follow prompts
vercel --prod
```

### Notes for Vercel
- All API calls (`mempool.space`, `coingecko.com`, `alternative.me`) run
  **client-side** from the browser — no serverless functions required, no
  environment variables required.
- Static asset caching, gzip/brotli, and HTTPS are handled by Vercel
  automatically.
- The included security headers (`X-Frame-Options`, `Referrer-Policy`,
  `X-Content-Type-Options`) ship via `vercel.json`.

### Other hosts
The project also runs on **Netlify, Cloudflare Pages, GitHub Pages**, or any
static host — point them at `dist/client` after `vite build`.

---

## 🔒 Security & Privacy

- ✅ **No private keys** ever entered, derived, or stored
- ✅ xpub stored in `localStorage` on **your device only**
- ✅ All blockchain queries hit public REST APIs directly from the browser
- ✅ No analytics, no telemetry, no backend
- ⚠️ The PIN is a UX gate, not a cryptographic seal — anyone with filesystem
  access to your browser profile can still read the xpub. This matches the
  threat model of a watch-only tool.

> **Privacy tip:** Public block explorers see *which* xpub you query. For
> stronger privacy, run your own [mempool.space](https://github.com/mempool/mempool)
> instance and change `BASE` in `src/lib/mempool.ts`.

---

## 🛠 Tech Stack

| Area              | Library                                   |
|-------------------|-------------------------------------------|
| Framework         | TanStack Start (React 19, Vite)           |
| Routing           | TanStack Router (file-based)              |
| Data fetching     | TanStack Query                            |
| State             | Zustand                                   |
| Styling           | Tailwind CSS v4 + custom design tokens    |
| Charts            | Recharts                                  |
| Bitcoin           | bitcoinjs-lib, bip32, @bitcoinerlab/secp256k1 |
| Encoding          | bs58check                                 |
| Icons             | Lucide React                              |
| Toasts            | Sonner                                    |

---

## 🧭 Roadmap

- [ ] Multi-wallet support
- [ ] Cold-wallet labeling
- [ ] Price alerts (Web Push)
- [ ] Historic per-tx cost basis (use CoinGecko `/market_chart/range`)
- [ ] Transaction clustering & coin-control hints
- [ ] WebAuthn / passkey unlock
- [ ] Capacitor wrapper → Android & iOS install
- [ ] PWA install + offline cache
- [ ] Custom mempool/electrs backend selector

---

## 📝 License

MIT — do whatever you want, just don't blame us if your sats moon.
