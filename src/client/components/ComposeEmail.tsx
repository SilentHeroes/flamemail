import { useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { toast } from "@/client/components/Toast";
import { getErrorMessage, sendEmail } from "@/client/lib/api";

interface ComposeEmailProps {
  address: string;
  token: string;
  replyTo?: string;
  replySubject?: string;
  onClose: () => void;
  onSent: () => void;
}

export function ComposeEmail({ address, token, replyTo, replySubject, onClose, onSent }: ComposeEmailProps) {
  const [to, setTo] = useState(replyTo ?? "");
  const [subject, setSubject] = useState(
    replySubject ? (replySubject.startsWith("Re: ") ? replySubject : `Re: ${replySubject}`) : "",
  );
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTo = to.trim();
    if (!trimmedTo || !trimmedTo.includes("@") || !body.trim()) {
      return;
    }

    setSubmitting(true);

    try {
      await sendEmail(address, token, trimmedTo, subject, body);
      toast.success("Email sent");
      onSent();
      onClose();
    } catch (nextError) {
      toast.error(getErrorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-zinc-900/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Compose</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-500">From</label>
          <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-400">
            {address}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-500">To</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-500">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-500">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            rows={6}
            className="w-full resize-y rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-4 py-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-700/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !to.trim() || !to.includes("@") || !body.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-4 py-2 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
