import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore } from "@/store/app";
import {
  KeyRound,
  Github,
  ChevronRight,
  ExternalLink,
  Wallet as WalletIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { hashPin } from "@/lib/pin";
import { ModalShell } from "@/components/receive-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppLanguage } from "@/lib/wallet-store";
import { useT } from "@/lib/i18n";

const GITHUB_URL = "https://github.com/izzulgod/bitcoin-terminal";

const LANGUAGES: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "ja", label: "日本語 (Japanese)" },
  { value: "es", label: "Español (Spanish)" },
];

export const Route = createFileRoute("/app/settings")({
  component: SettingsScreen,
});

function SettingsScreen() {
  const t = useT();
  const navigate = useNavigate();
  const { wallets, activeWalletId, settings, updateSettings, removeWallet, setActiveWallet, clearWallet, lock } =
    useAppStore();
  const [pinDialog, setPinDialog] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [dangerForId, setDangerForId] = useState<string | null>(null);
  const [dangerConfirmText, setDangerConfirmText] = useState("");
  
  

  function handleRemove(id: string) {
    if (wallets.length === 1) {
      setDangerForId(id);
      setDangerConfirmText("");
      return;
    }
    removeWallet(id);
    toast.success("Wallet removed");
  }

  function confirmDangerDelete() {
    if (dangerConfirmText !== "DELETE") {
      toast.error('Type "DELETE" exactly to confirm');
      return;
    }
    clearWallet();
    updateSettings({ pin: null, pinEnabled: false });
    lock();
    setDangerForId(null);
    setManageOpen(false);
    toast.success("All wallets removed");
    navigate({ to: "/" });
  }

  return (
    <div className="px-5 pt-6">
      <header>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("settings.subtitle")}</p>
      </header>

      <Section title={t("settings.section.wallets")}>
        <Row
          label={t("settings.manageWallets")}
          value={`${wallets.length} ${t("settings.stored")}`}
          onClick={() => setManageOpen(true)}
          icon={<WalletIcon className="h-4 w-4" />}
        />
      </Section>

      <Section title={t("settings.section.preferences")}>
        <SelectRow
          label={t("settings.currency")}
          value={settings.currency}
          onChange={(v) => updateSettings({ currency: v as "USD" | "IDR" })}
          options={[
            { value: "USD", label: "USD — US Dollar" },
            { value: "IDR", label: "IDR — Indonesian Rupiah" },
          ]}
        />
        <SelectRow
          label={t("settings.theme")}
          value={settings.theme}
          onChange={(v) => updateSettings({ theme: v as "dark" | "light" })}
          options={[
            { value: "dark", label: t("settings.themeDark") },
            { value: "light", label: t("settings.themeLight") },
          ]}
        />
        <SelectRow
          label={t("settings.language")}
          value={settings.language}
          onChange={(v) => updateSettings({ language: v as AppLanguage })}
          options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
        />
        <Row
          label={t("settings.pinLock")}
          value={settings.pinEnabled ? t("settings.pinEnabled") : t("settings.pinOff")}
          onClick={() => setPinDialog(true)}
          icon={<KeyRound className="h-4 w-4" />}
        />
      </Section>

      <Section title={t("settings.section.dataSource")}>
        <Row label={t("settings.explorer")} value="mempool.space" />
        <Row label={t("settings.priceFeed")} value="CoinGecko" />
        <Row label={t("settings.sentiment")} value="alternative.me" />
      </Section>

      <Section title={t("settings.section.about")}>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left"
        >
          <span className="flex items-center gap-3 text-sm font-medium">
            <span className="text-muted-foreground">
              <Github className="h-4 w-4" />
            </span>
            {t("settings.github")}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            izzulgod/bitcoin-terminal
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
        </a>
      </Section>


      {pinDialog && (
        <ModalShell title="PIN lock" onClose={() => setPinDialog(false)}>
          <p className="text-xs text-muted-foreground">
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
              onClick={async () => {
                if (newPin.length !== 6) return toast.error("PIN must be 6 digits");
                if (newPin !== pinConfirm) return toast.error("PINs do not match");
                const hashed = await hashPin(newPin);
                updateSettings({ pin: hashed, pinEnabled: true });
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
        </ModalShell>
      )}

      {manageOpen && (
        <ModalShell title="Manage Wallets" onClose={() => setManageOpen(false)}>
          <div className="space-y-2">
            {wallets.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-semibold">{w.label}</div>
                    {w.id === activeWalletId && (
                      <span className="rounded-md bg-bitcoin/10 px-1.5 py-0.5 text-[10px] font-semibold text-bitcoin">
                        active
                      </span>
                    )}
                  </div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">
                    {w.derivationLabel} · {w.source === "ledger" ? "Ledger" : "xpub"}
                  </div>
                </div>
                {w.id !== activeWalletId && (
                  <button
                    onClick={() => setActiveWallet(w.id)}
                    className="rounded-md border border-border px-2 py-1 text-[11px]"
                  >
                    Use
                  </button>
                )}
                <button
                  onClick={() => handleRemove(w.id)}
                  className="rounded-md border border-destructive/30 bg-destructive/5 p-1.5 text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setManageOpen(false);
              navigate({ to: "/", search: { add: 1 } as any });
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bitcoin py-3 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add Wallet
          </button>
        </ModalShell>
      )}

      {dangerForId && (
        <ModalShell title="⚠ Danger Zone" onClose={() => setDangerForId(null)}>
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm font-semibold text-destructive">
              Remove the last wallet?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This will erase all wallet data from this device and return the
              app to the initial onboarding screen. This action cannot be
              undone.
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            To confirm, type <span className="font-mono font-bold text-destructive">DELETE</span>:
          </p>
          <input
            value={dangerConfirmText}
            onChange={(e) => setDangerConfirmText(e.target.value)}
            placeholder="DELETE"
            className="mt-2 w-full rounded-lg border border-destructive/40 bg-background p-3 font-mono text-sm"
            autoFocus
          />
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setDangerForId(null)}
              className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={confirmDangerDelete}
              disabled={dangerConfirmText !== "DELETE"}
              className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-40"
            >
              Delete everything
            </button>
          </div>
        </ModalShell>
      )}

      <p className="mt-10 mb-6 text-center text-xs text-muted-foreground">
        Bitcoin Terminal · v1.0
      </p>
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

function SelectRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <span className="text-sm font-medium">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-auto min-w-[140px] border-border bg-background text-xs font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
