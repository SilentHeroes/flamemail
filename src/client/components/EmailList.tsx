import { Loader2, Mail, Paperclip, Send } from "lucide-react";
import type { EmailSummary } from "@/client/lib/api";
import { fullDate, relativeTime } from "@/client/lib/time";

interface EmailListProps {
  inboxAddress: string;
  emails: EmailSummary[];
  selectedEmailId: string | null;
  loadingEmailId: string | null;
  loading: boolean;
  onSelect: (emailId: string) => void;
}

export function EmailList({ inboxAddress, emails, selectedEmailId, loadingEmailId, loading, onSelect }: EmailListProps) {
  return (
    <aside className="flex max-h-[calc(100vh-220px)] min-h-[560px] flex-col rounded-xl border border-zinc-800/60 bg-zinc-900/50">
      <div className="flex items-center justify-between gap-3 p-4 pb-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Messages</h2>
        <span className="inline-flex min-w-[24px] items-center justify-center rounded-md bg-zinc-700/40 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-300">
          {emails.length}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-4 pt-3 text-sm text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Refreshing...
        </div>
      ) : null}

      {!loading && emails.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/60">
            <Mail className="h-5 w-5 text-zinc-600" />
          </span>
          <p className="text-sm text-zinc-500">No emails yet.</p>
          <p className="text-xs text-zinc-600">New messages will appear here automatically.</p>
        </div>
      ) : null}

      <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {emails.map((email) => {
          const active = email.id === selectedEmailId;
          const unread = !email.isRead;
          const showRecipientAddress = email.recipientAddress && email.recipientAddress !== inboxAddress;

          return (
            <button
              key={email.id}
              type="button"
              className={`group relative w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                active
                  ? "bg-zinc-700/40"
                  : "hover:bg-zinc-800/50"
              }`}
              onClick={() => onSelect(email.id)}
            >
              {unread ? (
                <span className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-zinc-100" />
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <strong className={`truncate text-sm ${unread ? "font-semibold text-zinc-100" : "font-medium text-zinc-300"}`}>
                  {email.isSent ? (
                    <span className="inline-flex items-center gap-1">
                      <Send className="inline h-3 w-3 text-zinc-300" />
                      To: {email.recipientAddress}
                    </span>
                  ) : (
                    email.fromName || email.fromAddress
                  )}
                </strong>
                {loadingEmailId === email.id ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-zinc-300" />
                ) : (
                  <span className="shrink-0 text-xs text-zinc-500" title={fullDate(email.receivedAt)}>
                    {relativeTime(email.receivedAt)}
                  </span>
                )}
              </div>
              <div className={`mt-0.5 truncate text-sm ${unread ? "text-zinc-200" : "text-zinc-400"}`}>
                {email.subject}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                {email.isSent ? (
                  <span className="inline-flex items-center rounded-md bg-zinc-700/40 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300">
                    Sent
                  </span>
                ) : (
                  <span className="truncate">{email.fromAddress}</span>
                )}
                {!email.isSent && showRecipientAddress ? (
                  <span className="inline-flex items-center rounded-md bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                    {email.recipientAddress}
                  </span>
                ) : null}
                {email.hasAttachments ? (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                    <Paperclip className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
