import { useEffect, useState } from "react";
import { Usb, AlertCircle } from "lucide-react";
import {
  isWebHidSupported,
  subscribeLedger,
  connectLedger,
  type LedgerInfo,
} from "@/lib/ledger";
import { toast } from "sonner";

export function LedgerIndicator() {
  const [info, setInfo] = useState<LedgerInfo>({ connected: false });
  const [busy, setBusy] = useState(false);
  const supported = isWebHidSupported();

  useEffect(() => subscribeLedger(setInfo), []);

  async function handleClick() {
    if (!supported) {
      toast.error("Browser does not support Ledger (WebHID)");
      return;
    }
    setBusy(true);
    try {
      await connectLedger();
      toast.success("Ledger connected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect Ledger");
    } finally {
      setBusy(false);
    }
  }

  const dotClass = !supported
    ? "bg-muted-foreground"
    : info.connected
    ? "bg-success"
    : "bg-destructive";
  const label = !supported ? "No HID" : info.connected ? "Ledger" : "Offline";

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
      title={
        !supported
          ? "Browser does not support WebHID — use Chrome/Edge"
          : info.connected
          ? `Ledger ${info.appVersion ?? ""} connected — click to reconnect`
          : "Click to connect Ledger"
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {supported ? (
        <Usb className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      {label}
    </button>
  );
}
