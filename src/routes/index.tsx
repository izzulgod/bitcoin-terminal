import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bitcoin, ArrowRight, ShieldCheck, Eye, Activity } from "lucide-react";
import { useAppStore } from "@/store/app";
import { detectAndNormalize, type ScriptType } from "@/lib/xpub";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Landing,
});

const STEPS = ["splash", "intro", "import", "detect", "security", "syncing"] as const;
type Step = (typeof STEPS)[number];

function Landing() {
  const navigate = useNavigate();
  const { hydrate, hydrated, wallet, setWallet, updateSettings } = useAppStore();
  const [step, setStep] = useState<Step>("splash");
  const [xpubInput, setXpubInput] = useState("");
  const [detected, setDetected] = useState<ReturnType<typeof detectAndNormalize> | null>(null);
  const [scriptType, setScriptType] = useState<ScriptType>("p2wpkh");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [usePin, setUsePin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && wallet) {
      navigate({ to: "/app", replace: true });
    } else if (hydrated && !wallet) {
      setStep((current) => (current === "splash" ? "intro" : current));
    }
  }, [hydrated, wallet, navigate]);

  function handleDetect() {
    setError(null);
    try {
      const d = detectAndNormalize(xpubInput);
      setDetected(d);
      setScriptType(d.scriptType);
      setStep("detect");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid xpub");
    }
  }

  function handleConfirm() {
    if (!detected) return;
    if (usePin) {
      if (pin.length !== 6) return setError("PIN must be 6 digits");
      if (pin !== pinConfirm) return setError("PINs do not match");
    }
    updateSettings({
      pinEnabled: usePin,
      pin: usePin ? pin : null,
    });
    setWallet({
      rawXpub: detected.normalizedXpub,
      normalizedXpub: detected.normalizedXpub,
      scriptType,
      derivationLabel: detected.derivationLabel,
      network: detected.network,
      label: "Ledger Wallet",
      createdAt: Date.now(),
    });
    setStep("syncing");
    setTimeout(() => navigate({ to: "/app" }), 800);
    toast.success("Wallet imported");
  }

  if (!hydrated) return <Splash />;

  return (
    <main className="min-h-screen overflow-hidden">
      {step === "splash" && <Splash />}
      {step === "intro" && <Intro onNext={() => setStep("import")} />}
      {step === "import" && (
        <ImportScreen
          value={xpubInput}
          onChange={setXpubInput}
          onSubmit={handleDetect}
          error={error}
        />
      )}
      {step === "detect" && detected && (
        <DetectScreen
          detected={detected}
          scriptType={scriptType}
          setScriptType={setScriptType}
          onBack={() => setStep("import")}
          onNext={() => setStep("security")}
        />
      )}
      {step === "security" && (
        <SecurityScreen
          usePin={usePin}
          setUsePin={setUsePin}
          pin={pin}
          setPin={setPin}
          pinConfirm={pinConfirm}
          setPinConfirm={setPinConfirm}
          error={error}
          onConfirm={handleConfirm}
        />
      )}
      {step === "syncing" && <Syncing />}
    </main>
  );
}

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="rounded-3xl bg-bitcoin/10 p-6 bitcoin-glow animate-pulse">
        <Bitcoin className="h-16 w-16 text-bitcoin" />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Bitcoin Terminal</h1>
      <p className="mt-1 text-sm text-muted-foreground">Watch-only · xpub powered</p>
    </div>
  );
}

function Intro({ onNext }: { onNext: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-12">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="rounded-3xl bg-bitcoin/10 p-5 mb-8 bitcoin-glow">
          <Bitcoin className="h-12 w-12 text-bitcoin" />
        </div>
        <h1 className="text-4xl font-bold leading-tight tracking-tight">
          Your Bitcoin.
          <br />
          <span className="text-bitcoin">Fully private.</span>
          <br />
          Fully visible.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          A Bloomberg Terminal for personal Bitcoin. Import your xpub from Ledger, monitor your
          stack — without ever exposing a private key.
        </p>
        <div className="mt-10 grid w-full grid-cols-3 gap-3 text-xs">
          <Feature icon={Eye} label="Watch-only" />
          <Feature icon={ShieldCheck} label="No keys" />
          <Feature icon={Activity} label="Real-time" />
        </div>
      </div>
      <button
        onClick={onNext}
        className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bitcoin py-4 text-base font-semibold text-primary-foreground transition-all hover:opacity-95 active:scale-[0.99]"
      >
        Import Wallet <ArrowRight className="h-5 w-5" />
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
  error,
}: {
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  error: string | null;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <h2 className="text-2xl font-bold">Import xpub</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste your extended public key (xpub / ypub / zpub). Supports Ledger, Trezor, Coldcard.
      </p>
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
        Your xpub stays on this device. We only query public block explorers (mempool.space) for
        balances and transactions.
      </div>
      <button
        onClick={onSubmit}
        disabled={!value.trim()}
        className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bitcoin py-4 font-semibold text-primary-foreground disabled:opacity-40"
      >
        Detect <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function DetectScreen({
  detected,
  scriptType,
  setScriptType,
  onBack,
  onNext,
}: {
  detected: ReturnType<typeof detectAndNormalize>;
  scriptType: ScriptType;
  setScriptType: (s: ScriptType) => void;
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
        Confirm the script type. We auto-detected based on the prefix.
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
          return (
            <button
              key={o.type}
              onClick={() => setScriptType(o.type)}
              className={`w-full rounded-xl border p-4 text-left transition-all ${
                active
                  ? "border-bitcoin bg-bitcoin/10"
                  : "border-border bg-card hover:border-muted-foreground/40"
              }`}
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
  usePin,
  setUsePin,
  pin,
  setPin,
  pinConfirm,
  setPinConfirm,
  error,
  onConfirm,
}: {
  usePin: boolean;
  setUsePin: (v: boolean) => void;
  pin: string;
  setPin: (s: string) => void;
  pinConfirm: string;
  setPinConfirm: (s: string) => void;
  error: string | null;
  onConfirm: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <h2 className="text-2xl font-bold">Lock your terminal</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Optional 6-digit PIN gates access on this device. Watch-only — no funds at risk.
      </p>

      <label className="mt-6 flex items-center justify-between rounded-xl border border-border bg-card p-4">
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

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <button
        onClick={onConfirm}
        className="mt-auto rounded-xl bg-bitcoin py-4 font-semibold text-primary-foreground"
      >
        Finish setup
      </button>
    </div>
  );
}

function Syncing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <Bitcoin className="h-12 w-12 animate-spin text-bitcoin" />
      <p className="mt-4 text-sm text-muted-foreground">Scanning blockchain…</p>
    </div>
  );
}
