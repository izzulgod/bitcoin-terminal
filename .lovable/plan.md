# Plan: Ledger Integration + Multi-Wallet + UI Restructure

Ini perubahan besar. Saya pecah jadi 5 fase. Setiap fase bisa di-deploy independen, jadi kalau ada yang gagal kita masih punya app yang jalan.

## Scope & Asumsi

- **Mainnet only** untuk Send (sesuai brief).
- **Fee & broadcast**: pakai `mempool.space` (sudah ada di `src/lib/mempool.ts`).
- **Ledger libs**: `@ledgerhq/hw-transport-webhid`, `@ledgerhq/hw-app-btc`, plus `bitcoinjs-lib` (sudah terpasang untuk xpub).
- **WebHID feature-detect**: `typeof navigator !== 'undefined' && 'hid' in navigator`. Kalau false → sembunyikan tombol Ledger.
- **Backward compatibility**: data wallet lama (object tunggal di `btc-terminal:wallet:v1`) di-migrate otomatis ke array baru saat hydrate.
- **PWA Vercel**: semua ini frontend-only, tidak akan ganggu deploy yang sudah jalan. Push → auto deploy → user reload PWA dapat update.

---

## Fase 1 — Multi-Wallet Store + Migrasi

**File**: `src/lib/wallet-store.ts`, `src/store/app.ts`

- Tambah storage key baru `btc-terminal:wallets:v2` berisi `{ wallets: StoredWallet[], activeWalletId: string }`.
- `StoredWallet` dapat field `id: string` (uuid/timestamp).
- Hydrate logic:
  1. Coba load v2.
  2. Kalau kosong, baca v1 lama. Jika ada → wrap jadi array, generate id, simpan ke v2, hapus v1.
- Store actions baru: `addWallet`, `removeWallet(id)`, `setActiveWallet(id)`, plus `wallet` (computed = active wallet) tetap ada agar konsumen lama tidak rusak.
- `renameWallet` tetap, beroperasi pada active.

## Fase 2 — Ledger Integration Layer

**File baru**: `src/lib/ledger.ts`

- `isWebHidSupported()`.
- `connectLedger()` → buka transport WebHID, return `AppBtc` instance + device info.
- `getLedgerXpub(scriptType)` → derive path BIP84/BIP49/BIP44, return xpub yg dinormalisasi.
- `verifyAddressOnDevice(path)` → `getWalletPublicKey(path, { verify: true, format })`.
- `signPsbtWithLedger(psbtBase64, inputs, changePath)` → wrap `createPaymentTransaction`.
- Connection state singleton + event emitter sederhana untuk indikator header (connect / disconnect / status).

**Catatan teknis**: WebHID + Ledger app bitcoin v2 di Vite/Cloudflare butuh hati-hati pada SSR — semua impor `@ledgerhq/*` harus dynamic-import dari dalam handler, jangan di top-level route file, agar tidak crash SSR.

## Fase 3 — Transaction Builder

**File baru**: `src/lib/tx-builder.ts` (~150 LOC)

- Input: UTXOs, recipient, amount sats, feeRate sat/vB, change derivation path + address.
- Coin selection: largest-first (default) dengan fallback ke branch-and-bound sederhana.
- Build PSBT via `bitcoinjs-lib` (`Psbt`), tambah inputs (witnessUtxo untuk SegWit), outputs, change.
- Estimate vsize untuk kalkulasi fee actual.
- Return `{ psbtBase64, inputs: LedgerInput[], changePath, totalFee }`.

Fee tier UI map ke `useFees()` hook yg sudah ada (slow=hour, normal=halfHour, fast=fastest).

## Fase 4 — Home Tab Restructure

**File**: `src/routes/app.index.tsx`, komponen baru `src/components/send-modal.tsx`, `src/components/receive-modal.tsx`, `src/components/ledger-indicator.tsx`, `src/components/ledger-guard-modal.tsx`.

Perubahan Home:
- Hapus section "Receive address" dan "Recent activity".
- Di bawah total balance: dua tombol [Send] dan [Receive].
- Header: tambah `<LedgerIndicator />` (dot merah/hijau + label, clickable → trigger connect).

Send modal:
- Form: address tujuan (validasi mainnet), amount (toggle BTC/IDR dgn konversi pakai price hook), fee tier (slow/normal/fast dari `useFees`).
- Preview vsize + total fee.
- Tombol "Sign with Ledger" → guard ledger → build PSBT → Ledger sign → broadcast via `/api/tx` mempool → toast txid.
- Kalau Ledger belum konek → `LedgerGuardModal` (no bypass untuk Send).

Receive modal:
- QR code (`qrcode` lib — perlu `bun add qrcode @types/qrcode`).
- Address string + tombol Copy.
- Tombol "Verify on Ledger" → `verifyAddressOnDevice`.
- Guard modal: kalau Ledger belum konek → opsi "Connect Ledger" atau "Lanjutkan tanpa Ledger" (warning merah).

## Fase 5 — Wallet Tab + Settings + Onboarding

**Wallet tab** (`src/routes/app.wallet.tsx`):
- Tambah sub-tab `Overview` (paling kiri, default).
- Card atas: nama wallet + ikon pensil (inline edit, save on enter / blur), total balance, [Send] [Receive] (pakai modal yg sama), badge script type.
- Card bawah: Recent activity (pindahkan logic `txFlows` dari Home).
- Sub-tab Addresses/UTXOs/Derivation tetap.

**Settings** (`src/routes/app.settings.tsx`):
- Hapus dialog rename wallet (sudah pindah ke Wallet Overview).
- Tambah entry "Manage Wallets" → buka panel/sheet:
  - List wallets dgn nama, script type, badge "active".
  - Tombol "Add Wallet" → kembali ke flow onboarding (mode add, bukan replace).
  - Tombol "Remove" per row → konfirmasi normal.
  - Kalau wallet tinggal 1 dan user remove → Danger Zone modal merah, harus ketik "DELETE" persis → hapus semua + redirect ke `/`.

**Onboarding** (`src/routes/index.tsx`):
- Step Import: tombol besar "Connect Ledger" (hanya kalau WebHID), link kecil "Paste xpub manual".
- Connect Ledger flow: pilih script type (BIP84 default) → fetch xpub via Ledger → lanjut ke step nama wallet + PIN seperti sekarang.
- xpub flow: tetap seperti sekarang.
- Mode "add wallet": skip PIN step kalau sudah pernah set, langsung append ke store.

**Header dropdown** (di `src/routes/app.tsx` atau header bersama): kalau `wallets.length > 1` → tampilkan dropdown switcher.

---

## Teknis & Risiko

- **Bundle size**: `@ledgerhq/*` cukup besar (~200KB+). Akan saya dynamic-import supaya tidak masuk bundle initial.
- **SSR**: semua kode Ledger ada di event handler / `useEffect`, tidak di module scope.
- **Broadcast endpoint**: `POST https://mempool.space/api/tx` body = raw hex.
- **Cloudflare Worker compat**: semua ini client-side, jadi aman.
- **Vercel deploy**: tidak ada perubahan config — push ke main → Vercel build & deploy seperti biasa.
- **Tidak ada perubahan backend / db / secret**.

## Yang TIDAK termasuk

- Testnet support.
- RBF / CPFP.
- Multisig.
- Hardware wallet lain (Trezor, Coldcard).
- Address book / labels per address.

---

## Estimasi

Fase 1 + 2 + 3: foundation, tidak ada perubahan UI yang terlihat.
Fase 4: Home + modal Send/Receive — perubahan UI utama.
Fase 5: Wallet/Settings restructure + onboarding Ledger.

Total file baru: ~7. File diedit: ~6. Dependensi baru: 4 package.

Setuju lanjut? Atau ada bagian yang mau diubah dulu (misalnya skip Send dulu, hanya Receive + Ledger detect)?
