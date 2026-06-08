import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "./receive-modal";
import { useAppStore } from "@/store/app";
import { useSync, useFees, usePrice } from "@/hooks/use-bitcoin-data";
import {
  subscribeLedger,
  signPsbtWithLedger,
  broadcastTx,
  type LedgerInfo,
} from "@/lib/ledger";

import {
  buildPsbt,
  buildAddressPathMap,
  isValidAddress,
} from "@/lib/tx-builder";
import { formatBtc, satsToBtc, formatFiat } from "@/lib/format";

type Tier = "slow" | "normal" | "fast";

export function SendModal({ onClose }: { onClose: () => void }) {
  const wallet = useAppStore((s) => s.wallet);
  const currency = useAppStore((s) => s.settings.currency);
  const { data: sync } = useSync();
  const { data: feeRates } = useFees();
  const price = usePrice();
  const [ledger, setLedger] = useState<LedgerInfo>({ connected: false });
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState(""); // string, in BTC
  const [tier, setTier] = useState<Tier>("normal");
  const [unit, setUnit] = useState<"BTC" | "FIAT">("BTC");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeLedger(setLedger), []);

  const feeRate = useMemo(() => {
    if (!feeRates) return 1;
    if (tier === "slow") return feeRates.hourFee;
    if (tier === "fast") return feeRates.fastestFee;
    return feeRates.halfHourFee;
  }, [feeRates, tier]);

  const priceVal = price.data ? (currency === "USD" ? price.data.usd : price.data.idr) : 0;

  const amountSats = useMemo(() => {
    const n = parseFloat(amount);
    if (!isFinite(n) || n <= 0) return 0;
    if (unit === "BTC") return Math.round(n * 1e8);
    // FIAT
    if (!priceVal) return 0;
    return Math.round((n / priceVal) * 1e8);
  }, [amount, unit, priceVal]);

  const preview = useMemo(() => {
    if (!wallet || !sync || amountSats <= 0) return null;
    if (!isValidAddress(recipient, wallet.network)) return null;
    try {
      const addressPaths = buildAddressPathMap(wallet);
      // change = first unused chain=1
      const changeEntry =
        sync.addresses.find((a) => a.derived.chain === 1 && !a.used) ??
        sync.addresses.find((a) => a.derived.chain === 1);
      if (!changeEntry) return null;
      return buildPsbt({
        wallet,
        utxos: sync.utxos,
        addressPaths,
        recipient,
        amountSats,
        feeRate,
        changeAddress: changeEntry.derived.address,
        changeDerivationPath: changeEntry.derived.path,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Build failed" } as const;
    }
  }, [wallet, sync, recipient, amountSats, feeRate]);

  const guarded = !ledger.connected;
  const supported = isWebHidSupported();

  async function handleSend() {
    if (!preview || "error" in preview) return;
    if (!ledger.connected) {
      toast.error("Connect Ledger first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const signedPsbtBase64 = await signPsbtWithLedger(preview.psbtBase64);
      // finalize: try to parse and finalize via bitcoinjs-lib
      const { Psbt } = await import("bitcoinjs-lib");
      const psbt = Psbt.fromBase64(signedPsbtBase64);
      try {
        psbt.finalizeAllInputs();
      } catch (e) {
        throw new Error(
          "Ledger returned PSBT but couldn't finalize inputs. " +
            (e instanceof Error ? e.message : "")
        );
      }
      const txHex = psbt.extractTransaction().toHex();
      const txid = await broadcastTx(txHex);
      toast.success(`Broadcast: ${txid.slice(0, 12)}…`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  if (!wallet || !sync) {
    return (
      <ModalShell title="Send" onClose={onClose}>
        <div className="py-8 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading wallet…
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Send Bitcoin" onClose={onClose}>
      {guarded && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <div className="text-sm font-semibold text-destructive">
              Ledger Not Connected
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Transactions must be signed by a hardware device. Use the
              <span className="mx-1 font-semibold text-foreground">Sign with Ledger</span>
              button below to connect and sign.
            </p>
          </div>
        </div>
      )}


      <div className="space-y-5">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Recipient address
          </label>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.trim())}
            placeholder="bc1q…"
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs"
          />
          {recipient && !isValidAddress(recipient, wallet.network) && (
            <p className="mt-1 text-[11px] text-destructive">Invalid mainnet address</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Amount
            </label>
            <button
              onClick={() => setUnit(unit === "BTC" ? "FIAT" : "BTC")}
              className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-semibold"
            >
              {unit === "BTC" ? "BTC" : currency}
            </button>
          </div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder={unit === "BTC" ? "0.00010000" : "100000"}
            className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-mono text-sm"
          />
          {amountSats > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              ≈ {formatBtc(amountSats)} BTC
              {priceVal > 0 &&
                ` · ${formatFiat(satsToBtc(amountSats) * priceVal, currency)}`}
            </p>
          )}
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Fee
          </label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {(["slow", "normal", "fast"] as Tier[]).map((t) => {
              const r =
                t === "slow"
                  ? feeRates?.hourFee
                  : t === "fast"
                  ? feeRates?.fastestFee
                  : feeRates?.halfHourFee;
              return (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`rounded-lg border p-2 text-xs ${
                    tier === t
                      ? "border-bitcoin bg-bitcoin/10"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="font-semibold capitalize">{t}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {r ?? "—"} sat/vB
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {preview && "error" in preview && (
          <p className="text-xs text-destructive">{preview.error}</p>
        )}
        {preview && !("error" in preview) && (
          <div className="rounded-lg border border-border bg-background p-3 text-xs">
            <Row k="Vsize" v={`${preview.vsize} vB`} />
            <Row k="Fee" v={`${preview.fee} sats`} />
            {preview.changeAmount > 0 && (
              <Row k="Change" v={`${formatBtc(preview.changeAmount)} BTC`} />
            )}
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}

        <button
          onClick={handleSend}
          disabled={
            busy ||
            !ledger.connected ||
            !preview ||
            "error" in (preview ?? {}) ||
            amountSats <= 0
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bitcoin py-3 font-semibold text-primary-foreground disabled:opacity-40"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing on device…
            </>
          ) : (
            <>
              Sign with Ledger <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
        <p className="text-center text-[10px] text-muted-foreground">
          Verify every detail on the Ledger device screen before confirming.
        </p>
      </div>
    </ModalShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
