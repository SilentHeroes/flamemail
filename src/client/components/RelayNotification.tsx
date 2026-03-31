import { useState } from "react";
import { Bell, BellRing, Loader2, Mail } from "lucide-react";
import { toast } from "@/client/components/Toast";
import { getErrorMessage, setNotificationEmail } from "@/client/lib/api";

interface RelayNotificationProps {
  address: string;
  token: string;
  hasNotification: boolean;
}

export function RelayNotification({ address, token, hasNotification }: RelayNotificationProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enabled, setEnabled] = useState(hasNotification);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      return;
    }

    setSubmitting(true);

    try {
      await setNotificationEmail(address, token, trimmed);
      setEnabled(true);
      setEmail("");
      toast.success("Relay notifications enabled");
    } catch (nextError) {
      toast.error(getErrorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-indigo-500/20 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-2">
        {enabled ? (
          <BellRing className="h-4 w-4 text-indigo-400" />
        ) : (
          <Bell className="h-4 w-4 text-zinc-500" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
          Relay Notifications
        </span>
      </div>

      {enabled ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            <BellRing className="h-3 w-3" />
            Email notifications enabled
          </span>
          <button
            type="button"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            onClick={() => setEnabled(false)}
          >
            Update
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-xs text-zinc-500">
            Get notified at your personal email when a message arrives in this relay inbox.
          </p>
          <form className="mt-3 flex gap-2" onSubmit={handleSubmit}>
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your-email@example.com"
                autoComplete="off"
                className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/80 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !email.trim() || !email.includes("@")}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-500/20 px-4 py-2 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
              Enable
            </button>
          </form>
        </>
      )}
    </section>
  );
}
