# ₿ Bitcoin Terminal

Bitcoin Terminal adalah aplikasi web (juga bisa dipasang sebagai PWA di Android/iOS) untuk memantau dan menggunakan **cold wallet Bitcoin** dengan tampilan ala terminal trading profesional. Aplikasi ini tidak pernah menyimpan private key — semua operasi sensitif (tanda tangan transaksi, verifikasi alamat) dilakukan di perangkat hardware **Ledger** milik pengguna.

## Apa yang bisa dilakukan

### Manajemen Wallet
- **Import lewat Ledger** (WebHID) — colok Ledger, buka app Bitcoin, pilih script type (Native SegWit / Taproot / Legacy / Nested SegWit), aplikasi otomatis mengambil xpub.
- **Import manual via xpub/ypub/zpub** — untuk mode watch-only tanpa hardware.
- **Multi-wallet** — simpan beberapa wallet sekaligus, ganti aktif lewat dropdown di header.
- **Beri nama wallet** sendiri saat import, bisa diubah kapan saja lewat ikon pensil di tab Wallet.

### Halaman Utama (Home)
- Total balance (BTC + konversi USD/IDR).
- Grafik harga BTC real-time dari CoinGecko.
- Indikator status Ledger (titik hijau/merah) di header.
- Tombol **Send** dan **Receive**.

### Send (Kirim BTC)
- Validasi alamat tujuan, input jumlah dengan toggle BTC ↔ IDR.
- Pilihan fee: Slow / Normal / Fast (data live dari mempool.space).
- Preview ukuran transaksi + total fee sebelum kirim.
- Wajib tanda tangan via Ledger — tanpa hardware terkoneksi, tombol Send dikunci.
- Broadcast otomatis ke jaringan Bitcoin lewat mempool.space.

### Receive (Terima BTC)
- QR code + alamat untuk disalin.
- Tombol **Verify on Ledger** untuk menampilkan alamat di layar hardware sebagai pengaman anti-phishing.

### Tab Wallet
- **Overview**: balance, nama wallet (editable), tombol Send/Receive, recent activity.
- **Addresses**: daftar alamat receive & change yang sudah dipakai.
- **UTXOs**: daftar unspent transaction output.
- **Derivation**: detail script type, derivation path, xpub.

### Tab Analytics & Mempool
- Statistik fee, tinggi block terbaru, kondisi mempool real-time.

### Settings
- Ganti mata uang fiat (USD/IDR).
- Toggle Light / Dark theme.
- Aktifkan / ubah PIN aplikasi (PIN ini lokal, hanya untuk membuka app — bukan untuk mengakses dana).
- **Manage Wallets**: tambah wallet baru, hapus wallet.
- **Danger Zone**: hapus seluruh data (harus mengetik "DELETE" untuk konfirmasi).
- Link ke repository GitHub.

## Keamanan

- **Tidak pernah** menyimpan atau meminta private key / seed phrase.
- Semua tanda tangan transaksi terjadi di Ledger; aplikasi hanya membangun PSBT (unsigned transaction).
- Verifikasi alamat receive bisa dilakukan langsung di layar Ledger.
- Data wallet (xpub, nama, settings) hanya disimpan di **localStorage browser** masing-masing pengguna — tidak ada server backend yang menyimpan data wallet.
- Komunikasi blockchain: read-only ke `mempool.space` dan `coingecko.com`.

## Mobile / PWA

Aplikasi sudah dikonfigurasi sebagai Progressive Web App. Di Android Chrome / iOS Safari, pilih **"Add to Home Screen"** untuk memasangnya seperti aplikasi native. Update otomatis mengikuti deployment web — tidak perlu install ulang.

> Catatan: fitur Ledger via WebHID hanya bekerja di Chrome/Edge desktop atau Android Chrome dengan kabel OTG. Di iOS Safari, Ledger tidak didukung browser, tapi mode watch-only (xpub) tetap jalan normal.

## Teknologi

React 19 + TanStack Start (Vite), Tailwind CSS v4, bitcoinjs-lib untuk derivasi alamat & PSBT, `@ledgerhq/hw-app-btc` + WebHID untuk hardware wallet, deploy via Vercel.
