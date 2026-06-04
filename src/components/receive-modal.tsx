import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, X, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app";
import { useSync } from "@/hooks/use-bitcoin-data";
import {
  subscribeLedger,
  connectLedger,
  verifyAddressOnDevice,
  isWebHidSupported,
  type LedgerInfo,
} from "@/lib/ledger";

export function ReceiveModal({ onClose }: { onClose: () => void }) {
  const wallet = useAppStore((s) => s.wallet);
  const { data: sync } = useSync();
  const [ledger, setLedger] = useState<LedgerInfo>({ connected: false });
  const [bypass, setBypass] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const address = sync?.receiveAddress;
  // figure out receive index from sync (first unused on chain 0)
  const receiveIdx =
    sync?.addresses.find((a) => a.derived.chain === 0 && !a.used)?.derived
      .index ?? 0;

  useEffect(() => subscribeLedger(setLedger), []);

  useEffect(() => {
    if (!address) return;
    QRCode.toDataURL(`bitcoin:${address}`, { margin: 1, width: 256 })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [address]);

  const supported = isWebHidSupported();
  const guarded = !ledger.connected && !bypass;

  async function handleVerify() {
    if (!wallet) return;
    if (!ledger.connected) {
      toast.error("Connect Ledger first");
      return;
    }
    setVerifying(true);
    try {
      const onDevice = await verifyAddressOnDevice(
        wallet.scriptType,
        0,
        0,
        receiveIdx
      );
      if (onDevice === address) {
        setVerified(true);
        toast.success("Address verified on device");
      } else {
        toast.error("Address mismatch — do not use!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <ModalShell title="Receive" onClose={onClose}>
      {guarded ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <div className="flex items-center gap-2 font-semibold text-destructive">
              <ShieldAlert className="h-4 w-4" />
              Ledger belum terhubung
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Hubungkan Ledger untuk memverifikasi alamat langsung di layar
              device sebelum digunakan.
            </p>
          </div>
          <button
            onClick={async () => {
              if (!supported) return toast.error("Browser tidak mendukung WebHID");
              try {
                await connectLedger();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
            disabled={!supported}
            className="w-full rounded-xl bg-bitcoin py-3 font-semibold text-primary-foreground disabled:opacity-40"
          >
            Connect Ledger
          </button>
          <button
            onClick={() => setBypass(true)}
            className="w-full rounded-xl border border-destructive/40 bg-destructive/5 py-3 text-sm font-semibold text-destructive"
          >
            Lanjutkan tanpa Ledger
          </button>
          <p className="text-[11px] text-destructive">
            ⚠ Kurang aman karena alamat di web app tidak diverifikasi langsung
            dengan device hardware.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-2xl bg-white p-3">
            {qrUrl ? (
              <img src={qrUrl} alt="Receive address QR" className="h-full w-full" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Next unused address
            </div>
            <div className="mt-1 break-all font-mono text-xs">{address ?? "—"}</div>
            <button
              onClick={() => {
                if (address) {
                  navigator.clipboard.writeText(address);
                  toast.success("Address copied");
                }
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          {ledger.connected ? (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="w-full rounded-xl bg-bitcoin py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {verifying ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Check device…
                </span>
              ) : verified ? (
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Verified
                </span>
              ) : (
                "Verify on Ledger"
              )}
            </button>
          ) : (
            <p className="text-center text-[11px] text-destructive">
              Alamat ini belum diverifikasi di device — gunakan dengan hati-hati.
            </p>
          )}
        </div>
      )}
    </ModalShell>
  );
}

export function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
