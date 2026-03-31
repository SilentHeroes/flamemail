import { useCallback, useState } from "react";
import { Copy, Eye, EyeOff, Loader2, Lock, Zap } from "lucide-react";
import { TurnstileWidget } from "@/client/components/TurnstileWidget";
import { toast } from "@/client/components/Toast";
import {
  TEMP_MAILBOX_TTL_HOURS,
  createRelay,
  getErrorMessage,
  isTurnstileError,
  storeInboxSession,
  type CreateRelayResponse,
  type InboxSession,
  type TempMailboxTtlHours,
} from "../lib/api";

const TTL_OPTION_DETAILS: Record<TempMailboxTtlHours, { hint: string; label: string }> = {
  24: { label: "24 hours", hint: "Standard" },
  48: { label: "48 hours", hint: "Extended" },
  72: { label: "72 hours", hint: "Maximum" },
};

const TTL_OPTIONS = TEMP_MAILBOX_TTL_HOURS.map((value) => ({
  ...TTL_OPTION_DETAILS[value],
  value,
}));

interface CreateRelayProps {
  onCreated: (session: InboxSession) => void;
}

export function CreateRelay({ onCreated }: CreateRelayProps) {
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [ttlHours, setTtlHours] = useState<TempMailboxTtlHours>(TEMP_MAILBOX_TTL_HOURS[0]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const handleTurnstileError = useCallback((turnstileError: string | null) => {
    if (turnstileError) {
      setError(null);
    }
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateRelayResponse | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passphrase.trim() || !turnstileToken) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const relay = await createRelay(passphrase.trim(), ttlHours, turnstileToken);
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
      setResult(relay);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      if (isTurnstileError(nextError)) {
        setTurnstileToken(null);
        setTurnstileResetKey((value) => value + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenInbox = () => {
    if (!result) {
      return;
    }

    const session: InboxSession = {
      address: result.inboxAddress,
      token: result.token,
      ttlHours: result.ttlHours as TempMailboxTtlHours,
      expiresAt: result.expiresAt,
    };

    storeInboxSession(session);
    onCreated(session);
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied");
    } catch {
      toast.error("Could not copy address");
    }
  };

  if (result) {
    return (
      <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
        <h2 className="text-[13px] font-semibold text-zinc-200">Relay channel ready</h2>
        <p className="mt-1 text-[13px] text-zinc-500">
          One shared inbox, two addresses. Both domains route to the same mailbox.
        </p>

        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <span className="text-[11px] font-medium text-zinc-500">Primary address</span>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="truncate text-sm font-medium text-zinc-200">{result.inboxAddress}</code>
              <button type="button" onClick={() => handleCopyAddress(result.inboxAddress)} className="shrink-0 text-zinc-500 hover:text-zinc-300">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <span className="text-[11px] font-medium text-zinc-500">Secondary address</span>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="truncate text-sm font-medium text-zinc-200">{result.aliasAddress}</code>
              <button type="button" onClick={() => handleCopyAddress(result.aliasAddress)} className="shrink-0 text-zinc-500 hover:text-zinc-300">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Share the passphrase with the other party. They enter it on the other domain and get access to the same inbox.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            onClick={handleOpenInbox}
          >
            Open inbox
          </button>
          <button
            type="button"
            className="rounded-lg border border-zinc-800 px-3 py-2.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
            onClick={() => {
              setResult(null);
              setPassphrase("");
            }}
          >
            Reset
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
      <h2 className="text-[13px] font-semibold text-zinc-200">Secure relay channel</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
        One shared inbox accessible from two different domains. Both parties enter the same passphrase.
      </p>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <Lock className="h-3 w-3" />
            Shared passphrase
          </span>
          <div className="relative">
            <input
              type={showPassphrase ? "text" : "password"}
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Enter a memorable passphrase..."
              minLength={8}
              maxLength={256}
              autoComplete="off"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 pr-10 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
              onClick={() => setShowPassphrase(!showPassphrase)}
              tabIndex={-1}
            >
              {showPassphrase ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <span className="block text-[11px] text-zinc-600">
            Minimum 8 characters. Both parties must enter the exact same passphrase.
          </span>
        </label>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-zinc-400">Channel lifetime</span>
          <div className="grid grid-cols-3 gap-2">
            {TTL_OPTIONS.map((option) => {
              const selected = option.value === ttlHours;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTtlHours(option.value)}
                  className={[
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-blue-500/50 bg-blue-500/10 text-zinc-100"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300",
                  ].join(" ")}
                >
                  <strong className="block text-sm font-semibold">{option.label}</strong>
                  <span className="text-[11px] text-zinc-500">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <TurnstileWidget
          action="create_relay"
          onError={handleTurnstileError}
          onTokenChange={setTurnstileToken}
          resetKey={turnstileResetKey}
        />

        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={submitting || !passphrase.trim() || passphrase.trim().length < 8 || !turnstileToken}
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
          ) : (
            <><Zap className="h-4 w-4" /> Create relay</>
          )}
        </button>
      </form>

      {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
    </section>
  );
}
