import { useCallback, useEffect, useState } from "react";
import { Globe, Loader2, Plus } from "lucide-react";
import { TurnstileWidget } from "@/client/components/TurnstileWidget";
import {
  TEMP_MAILBOX_TTL_HOURS,
  createInbox,
  getErrorMessage,
  isTurnstileError,
  listDomains,
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

interface CreateInboxProps {
  onCreated: (session: InboxSession) => void;
}

export function CreateInbox({ onCreated }: CreateInboxProps) {
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [ttlHours, setTtlHours] = useState<TempMailboxTtlHours>(TEMP_MAILBOX_TTL_HOURS[0]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const handleTurnstileError = useCallback((turnstileError: string | null) => {
    if (turnstileError) {
      setError(null);
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const items = await listDomains();
        if (!active) {
          return;
        }

        setDomains(items);
        setSelectedDomain(items[0] ?? "");
      } catch (nextError) {
        if (active) {
          setError(getErrorMessage(nextError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDomain) {
      setError("No active domains are configured yet.");
      return;
    }
    if (!turnstileToken) {
      setError("Complete human verification to continue.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const session = await createInbox(selectedDomain, ttlHours, turnstileToken);
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
      onCreated(session);
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

  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
      <h2 className="text-[13px] font-semibold text-zinc-200">New disposable inbox</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
        Generate a temporary address. Emails arrive in real time.
      </p>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-400">Domain</span>
          <select
            value={selectedDomain}
            onChange={(event) => setSelectedDomain(event.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors focus:border-zinc-300/30 focus:ring-1 focus:ring-zinc-300/20"
          >
            {domains.length === 0 ? <option value="">No active domains</option> : null}
            {domains.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-zinc-400">Lifetime</span>
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
                      ? "border-zinc-300/30 bg-zinc-700/40 text-zinc-100"
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
          action="create_inbox"
          onError={handleTurnstileError}
          onTokenChange={setTurnstileToken}
          resetKey={turnstileResetKey}
        />

        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={loading || submitting || !selectedDomain || !turnstileToken}
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
          ) : (
            <><Plus className="h-4 w-4" /> Create inbox</>
          )}
        </button>
      </form>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading domains...
        </p>
      ) : null}
      {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
      {!loading && domains.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">No domains available. An admin needs to add one first.</p>
      ) : null}
    </section>
  );
}
