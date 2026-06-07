import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bitcoin,
  ArrowRight,
  ShieldCheck,
  Eye,
  Activity,
  Usb,
  Loader2,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { detectAndNormalize, scriptTypeLabel, type ScriptType } from "@/lib/xpub";
import {
  isWebHidSupported,
  connectLedger,
  getLedgerXpub,
  accountPath,
} from "@/lib/ledger";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({
    add: s.add ? 1 : 0,
  }),
  component: Landing,
});

const STEPS = ["intro", "import", "detect", "security"] as const;
type Step = (typeof STEPS)[number];

function Landing() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/" });
  const addMode = search.add === 1;
  const { hydrate, hydrated, wallet, wallets, addWallet, updateSettings, settings } = useAppStore();
  const [step, setStep] = useState<Step>("intro");
  const [xpubInput, setXpubInput] = useState("");
  const [detected, setDetected] = useState<ReturnType<typeof detectAndNormalize> | null>(null);
  const [scriptType, setScriptType] = useState<ScriptType>("p2wpkh");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [usePin, setUsePin] = useState(false);
  const [walletLabel, setWalletLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"xpub" | "ledger">("xpub");
  const [accountPathStr, setAccountPathStr] = useState<string | undefined>();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && wallet && !addMode) {
      navigate({ to: "/app", replace: true });
    }
  }, [hydrated, wallet, addMode, navigate]);

  function handleDetect() {
    setError(null);
    try {
      const d = detectAndNormalize(xpubInput);
      setDetected(d);
      setScriptType(d.scriptType);
      setSource("xpub");
      setAccountPathStr(undefined);
      setStep("detect");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid xpub");
    }
  }

  async function handleConnectLedger(chosen: ScriptType = "p2wpkh") {
    setError(null);
    setConnecting(true);
    try {
      await connectLedger();
      const { xpub, path } = await getLedgerXpub(chosen);
      const d = detectAndNormalize(xpub, chosen);
      setDetected(d);
      setScriptType(chosen);
      setSource("ledger");
      setAccountPathStr(path);
      setStep("detect");
      toast.success("Ledger xpub fetched");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ledger connection failed");
    } finally {
      setConnecting(false);
    }
  }

  function handleConfirm() {
    if (!detected) return;
    const label = walletLabel.trim();
    if (!label) return setError("Wallet name is required");
    const finalScriptType = detected.scriptLocked ? detected.scriptType : scriptType;
    const finalWallet = detectAndNormalize(detected.normalizedXpub, finalScriptType);
    const hasPinAlready = settings.pinEnabled && settings.pin;
    // Only run PIN setup if no wallets yet AND no existing PIN
    const skipPinSetup = wallets.length > 0 || hasPinAlready;
    if (!skipPinSetup && usePin) {
      if (pin.length !== 6) return setError("PIN must be 6 digits");
      if (pin !== pinConfirm) return setError("PINs do not match");
    }
    if (!skipPinSetup) {
      updateSettings({
        pinEnabled: usePin,
        pin: usePin ? pin : null,
      });
    }
    addWallet({
      rawXpub: finalWallet.normalizedXpub,
      normalizedXpub: finalWallet.normalizedXpub,
      scriptType: finalWallet.scriptType,
      derivationLabel: scriptTypeLabel(finalWallet.scriptType),
      network: finalWallet.network,
      label,
      source,
      accountPath: accountPathStr ?? accountPath(finalScriptType),
      createdAt: Date.now(),
    });
    toast.success(addMode ? "Wallet added" : "Wallet imported");
    navigate({ to: "/app", replace: true });
  }

  if (!hydrated) return null;
  if (wallet && !addMode) return null;

  return (
    <main className="min-h-screen overflow-hidden">
      {step === "intro" && <Intro onNext={() => setStep("import")} addMode={addMode} />}
      {step === "import" && (
        <ImportScreen
          value={xpubInput}
          onChange={setXpubInput}
          onSubmit={handleDetect}
          onConnectLedger={() => handleConnectLedger("p2wpkh")}
          connecting={connecting}
          error={error}
        />
      )}
      {step === "detect" && detected && (
        <DetectScreen
          detected={detected}
          scriptType={scriptType}
          setScriptType={setScriptType}
          source={source}
          onBack={() => setStep("import")}
          onNext={() => setStep("security")}
        />
      )}
      {step === "security" && (
        <SecurityScreen
          walletLabel={walletLabel}
          setWalletLabel={setWalletLabel}
          usePin={usePin}
          setUsePin={setUsePin}
          pin={pin}
          setPin={setPin}
          pinConfirm={pinConfirm}
          setPinConfirm={setPinConfirm}
          error={error}
          onConfirm={handleConfirm}
          showPinSection={wallets.length === 0 && !(settings.pinEnabled && settings.pin)}
        />
      )}
    </main>
  );
}

function Intro({ onNext, addMode }: { onNext: () => void; addMode: boolean }) {
  const t = useT();
  return (
    <div
      className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 py-8"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="rounded-3xl bg-bitcoin/10 p-5 mb-6 bitcoin-glow">
          <Bitcoin className="h-12 w-12 text-bitcoin" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
          {addMode ? (
            <>{t("intro.addAnother")}</>
          ) : (
            <>
              {t("intro.title.line1")}
              <br />
              <span className="text-bitcoin">{t("intro.title.line2")}</span>
              <br />
              {t("intro.title.line3")}
            </>
          )}
        </h1>
        <p className="mt-4 text-sm sm:text-base text-muted-foreground">
          {t("intro.subtitle")}
        </p>
        <div className="mt-8 grid w-full grid-cols-3 gap-3 text-xs">
          <Feature icon={Usb} label={t("intro.feat.ledger")} />
          <Feature icon={ShieldCheck} label={t("intro.feat.noKeys")} />
          <Feature icon={Activity} label={t("intro.feat.realtime")} />
        </div>
      </div>
      <button
        onClick={onNext}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bitcoin py-4 text-base font-semibold text-primary-foreground transition-all hover:opacity-95 active:scale-[0.99]"
      >
        {addMode ? t("intro.cta.add") : t("intro.cta.start")} <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function Feature({ icon: Icon, label }: { icon: typeof Eye; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-bitcoin" />
      <div className="font-medium">{label}</div>
    </div>
  );
}

function ImportScreen({
  value,
  onChange,
  onSubmit,
  onConnectLedger,
  connecting,
  error,
}: {
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onConnectLedger: () => void;
  connecting: boolean;
  error: string | null;
}) {
  const [mode, setMode] = useState<"choose" | "xpub">("choose");
  const hidSupported = isWebHidSupported();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <h2 className="text-2xl font-bold">Import wallet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pilih cara import yang paling nyaman.
      </p>

      {mode === "choose" && (
        <div className="mt-6 space-y-4">
          {hidSupported ? (
            <button
              onClick={onConnectLedger}
              disabled={connecting}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-bitcoin py-5 text-base font-semibold text-primary-foreground disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Waiting for Ledger…
                </>
              ) : (
                <>
                  <Usb className="h-5 w-5" /> Connect Ledger
                </>
              )}
            </button>
          ) : (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              Your browser does not support Ledger (WebHID). Use manual xpub
              import, or open in Chrome / Edge / Brave on desktop / Android.
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            onClick={() => setMode("xpub")}
            className="block w-full text-center text-sm text-muted-foreground underline"
          >
            Paste xpub manually
          </button>
        </div>
      )}

      {mode === "xpub" && (
        <>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            spellCheck={false}
            className="mt-6 w-full resize-none rounded-xl border border-border bg-card p-4 font-mono text-xs text-foreground focus:border-bitcoin focus:outline-none"
            placeholder="xpub6CX16S9FXgLZDr9D8pbiV..."
          />
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-4 rounded-xl border border-border bg-card/50 p-3 text-xs text-muted-foreground">
            Your xpub stays on this device. We only query public block explorers.
          </div>
          <div className="mt-auto flex gap-2 pt-6">
            <button
              onClick={() => setMode("choose")}
              className="flex-1 rounded-xl border border-border bg-card py-4 font-medium"
            >
              Back
            </button>
            <button
              onClick={onSubmit}
              disabled={!value.trim()}
              className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-bitcoin py-4 font-semibold text-primary-foreground disabled:opacity-40"
            >
              Detect <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DetectScreen({
  detected,
  scriptType,
  setScriptType,
  source,
  onBack,
  onNext,
}: {
  detected: ReturnType<typeof detectAndNormalize>;
  scriptType: ScriptType;
  setScriptType: (s: ScriptType) => void;
  source: "xpub" | "ledger";
  onBack: () => void;
  onNext: () => void;
}) {
  const options: { type: ScriptType; label: string; example: string }[] = [
    { type: "p2wpkh", label: "BIP84 · Native SegWit", example: "bc1q..." },
    { type: "p2sh-p2wpkh", label: "BIP49 · Nested SegWit", example: "3..." },
    { type: "p2pkh", label: "BIP44 · Legacy", example: "1..." },
    { type: "p2tr", label: "BIP86 · Taproot", example: "bc1p..." },
  ];
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <h2 className="text-2xl font-bold">Detected wallet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {source === "ledger"
          ? "xpub imported from Ledger."
          : "Confirm the script type."}
      </p>

      <div className="mt-6 rounded-xl border border-bitcoin/30 bg-bitcoin/5 p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Network</div>
        <div className="mt-1 font-semibold">
          Bitcoin {detected.network === "mainnet" ? "Mainnet" : "Testnet"}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {options.map((o) => {
          const active = o.type === scriptType;
          const disabled = source === "ledger";
          return (
            <button
              key={o.type}
              onClick={() => !disabled && setScriptType(o.type)}
              disabled={disabled && !active}
              className={`w-full rounded-xl border p-4 text-left transition-all ${
                active
                  ? "border-bitcoin bg-bitcoin/10"
                  : "border-border bg-card hover:border-muted-foreground/40"
              } ${disabled && !active ? "opacity-30" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{o.label}</div>
                  <div className="text-xs font-mono text-muted-foreground">{o.example}</div>
                </div>
                {active && <div className="h-2 w-2 rounded-full bg-bitcoin" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border border-border bg-card py-3.5 font-medium"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-[2] rounded-xl bg-bitcoin py-3.5 font-semibold text-primary-foreground"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function SecurityScreen({
  walletLabel,
  setWalletLabel,
  usePin,
  setUsePin,
  pin,
  setPin,
  pinConfirm,
  setPinConfirm,
  error,
  onConfirm,
  showPinSection,
}: {
  walletLabel: string;
  setWalletLabel: (s: string) => void;
  usePin: boolean;
  setUsePin: (v: boolean) => void;
  pin: string;
  setPin: (s: string) => void;
  pinConfirm: string;
  setPinConfirm: (s: string) => void;
  error: string | null;
  onConfirm: () => void;
  showPinSection: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <h2 className="text-2xl font-bold">Name {showPinSection ? "& lock" : "wallet"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Give this wallet a label{showPinSection ? ", then optionally set a 6-digit PIN." : "."}
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Wallet name
        </label>
        <input
          type="text"
          value={walletLabel}
          onChange={(e) => setWalletLabel(e.target.value)}
          maxLength={40}
          placeholder="e.g. Ledger, Cold Stack, Savings"
          className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-bitcoin focus:outline-none"
        />
        {error && /wallet name/i.test(error) ? (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            You can rename it anytime from the Wallet tab.
          </p>
        )}
      </div>

      {showPinSection && (
        <>
          <label className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div>
              <div className="font-semibold">Enable PIN</div>
              <div className="text-xs text-muted-foreground">Required on app open</div>
            </div>
            <input
              type="checkbox"
              checked={usePin}
              onChange={(e) => setUsePin(e.target.checked)}
              className="h-5 w-5 accent-[oklch(0.78_0.17_60)]"
            />
          </label>

          {usePin && (
            <div className="mt-4 space-y-3">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit PIN"
                className="w-full rounded-xl border border-border bg-card p-4 text-center font-mono text-xl tracking-[0.5em] focus:border-bitcoin focus:outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                placeholder="Confirm PIN"
                className="w-full rounded-xl border border-border bg-card p-4 text-center font-mono text-xl tracking-[0.5em] focus:border-bitcoin focus:outline-none"
              />
            </div>
          )}
        </>
      )}

      {error && !/wallet name/i.test(error) && (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      )}

      <button
        onClick={onConfirm}
        className="mt-auto rounded-xl bg-bitcoin py-4 font-semibold text-primary-foreground"
      >
        Finish setup
      </button>
    </div>
  );
}
