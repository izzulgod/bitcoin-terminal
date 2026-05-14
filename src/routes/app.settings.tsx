import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore } from "@/store/app";
import {
  Trash2,
  KeyRound,
  Globe2,
  Github,
  ChevronRight,
  Bitcoin,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  component: SettingsScreen,
});

function SettingsScreen() {
  const navigate = useNavigate();
  const { wallet, settings, updateSettings, clearWallet, lock } = useAppStore();
  const [confirming, setConfirming] = useState(false);
  const [pinDialog, setPinDialog] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  return (
    <div className="px-5 pt-6">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-xs text-muted-foreground">Manage wallet & preferences</p>
      </header>

      <Section title="Wallet">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-bitcoin/10 p-2">
              <Bitcoin className="h-4 w-4 text-bitcoin" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{wallet?.label ?? "Wallet"}</div>
              <div className="font-mono text-[11px] text-muted-foreground truncate">
                {wallet?.derivationLabel}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Preferences">
        <Row
          label="Currency"
          value={settings.currency}
          onClick={() =>
            updateSettings({ currency: settings.currency === "USD" ? "IDR" : "USD" })
          }
        />
        <Row
          label="PIN lock"
          value={settings.pinEnabled ? "Enabled" : "Off"}
          onClick={() => setPinDialog(true)}
          icon={<KeyRound className="h-4 w-4" />}
        />
        <Row label="Theme" value="Dark" icon={<Globe2 className="h-4 w-4" />} />
      </Section>

      <Section title="Data source">
        <Row label="Explorer" value="mempool.space" />
        <Row label="Price feed" value="CoinGecko" />
        <Row label="Sentiment" value="alternative.me" />
      </Section>

      <Section title="About">
        <Row
          label="Bitcoin Terminal"
          value="v1.0"
          icon={<Github className="h-4 w-4" />}
        />
      </Section>

      <Section title="Danger">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="flex w-full items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-left text-destructive"
          >
            <span className="flex items-center gap-3 font-semibold">
              <Trash2 className="h-4 w-4" /> Remove wallet
            </span>
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
            <div className="text-sm font-semibold text-destructive">
              Remove wallet from this device?
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              You can re-import any time using your xpub.
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border border-border bg-card py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearWallet();
                  updateSettings({ pin: null, pinEnabled: false });
                  lock();
                  toast.success("Wallet removed");
                  navigate({ to: "/" });
                }}
                className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-destructive-foreground"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </Section>

      {pinDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center"
          onClick={() => setPinDialog(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-2xl"
          >
            <h3 className="text-lg font-bold">PIN lock</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {settings.pinEnabled
                ? "Disable or replace your PIN."
                : "Set a 6-digit PIN to gate access on this device."}
            </p>
            <div className="mt-4 space-y-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="New PIN"
                className="w-full rounded-xl border border-border bg-background p-3 text-center font-mono text-lg tracking-[0.5em]"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                placeholder="Confirm PIN"
                className="w-full rounded-xl border border-border bg-background p-3 text-center font-mono text-lg tracking-[0.5em]"
              />
            </div>
            <div className="mt-4 flex gap-2">
              {settings.pinEnabled && (
                <button
                  onClick={() => {
                    updateSettings({ pin: null, pinEnabled: false });
                    setPinDialog(false);
                    toast.success("PIN disabled");
                  }}
                  className="flex-1 rounded-lg border border-destructive/30 bg-destructive/5 py-2.5 text-sm font-semibold text-destructive"
                >
                  Disable
                </button>
              )}
              <button
                onClick={() => setPinDialog(false)}
                className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newPin.length !== 6) return toast.error("PIN must be 6 digits");
                  if (newPin !== pinConfirm) return toast.error("PINs do not match");
                  updateSettings({ pin: newPin, pinEnabled: true });
                  setPinDialog(false);
                  setNewPin("");
                  setPinConfirm("");
                  toast.success("PIN updated");
                }}
                className="flex-1 rounded-lg bg-bitcoin py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  onClick,
  icon,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left"
    >
      <span className="flex items-center gap-3 text-sm font-medium">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
      </span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {value}
        {onClick && <ChevronRight className="h-4 w-4" />}
      </span>
    </Comp>
  );
}
