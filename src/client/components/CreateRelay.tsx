import { useCallback, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Zap } from "lucide-react";
import { TurnstileWidget } from "@/client/components/TurnstileWidget";
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
  24: { label: "24 hours", hint: "standard" },
  48: { label: "48 hours", hint: "extended" },
  72: { label: "72 hours", hint: "max" },
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

  const handlePickSide = (address: string, token: string) => {
    if (!result) {
      return;
    }

    const session: InboxSession = {
      address,
      token,
      ttlHours: result.ttlHours as TempMailboxTtlHours,
      expiresAt: result.expiresAt,
    };

    storeInboxSession(session);
    onCreated(session);
  };

  if (result) {
    return (
      <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-zinc-900 to-zinc-900/80 p-6">
        <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-wider text-indigo-400">
          Relay Ready
        </span>
        <h2 className="text-lg font-semibold text-zinc-100">Choose your side</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Share the passphrase with your counterpart. They will join from the other side.
        </p>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-zinc-700/60 bg-zinc-800/80 px-4 py-3 text-left transition-colors hover:border-indigo-500/40 hover:bg-zinc-800"
            onClick={() => handlePickSide(result.addressA, result.token)}
          >
            <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-500/10 text-indigo-400">
              A
            </span>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm font-medium text-zinc-200">
                {result.addressA}
              </strong>
              <span className="text-xs text-zinc-500">{result.domainA}</span>
            </div>
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-zinc-700/60 bg-zinc-800/80 px-4 py-3 text-left transition-colors hover:border-indigo-500/40 hover:bg-zinc-800"
            onClick={() => handlePickSide(result.addressB, result.token)}
          >
            <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-500/10 text-indigo-400">
              B
            </span>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm font-medium text-zinc-200">
                {result.addressB}
              </strong>
              <span className="text-xs text-zinc-500">{result.domainB}</span>
            </div>
          </button>
        </div>

        <button
          type="button"
          className="mt-4 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          onClick={() => {
            setResult(null);
            setPassphrase("");
          }}
        >
          Start over
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-zinc-900 to-zinc-900/80 p-6">
      <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-wider text-indigo-400">
        Secure Relay
      </span>
      <h2 className="text-lg font-semibold text-zinc-100">Create a relay channel</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Two inboxes on different domains, linked by a shared passphrase. Each party uses one side.
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-400">
            <Lock className="h-3.5 w-3.5" />
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
              className="w-full rounded-xl border border-zinc-700/60 bg-zinc-800/80 px-4 py-2.5 pr-10 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
              onClick={() => setShowPassphrase(!showPassphrase)}
              tabIndex={-1}
            >
              {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <span className="block text-xs text-zinc-600">
            Minimum 8 characters. Both parties must use the exact same passphrase.
          </span>
        </label>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-zinc-400">Channel lifetime</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {TTL_OPTIONS.map((option) => {
              const selected = option.value === ttlHours;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTtlHours(option.value)}
                  className={[
                    "rounded-xl border px-4 py-3 text-left transition-colors",
                    selected
                      ? "border-indigo-500/50 bg-indigo-500/10 text-zinc-100"
                      : "border-zinc-700/60 bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800",
                  ].join(" ")}
                >
                  <strong className="block text-sm font-semibold">{option.label}</strong>
                  <span className="mt-1 block text-xs uppercase tracking-wider text-zinc-500">{option.hint}</span>
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
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
          type="submit"
          disabled={submitting || !passphrase.trim() || passphrase.trim().length < 8 || !turnstileToken}
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Creating relay...</>
          ) : (
            <><Zap className="h-4 w-4" /> Create relay</>
          )}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
