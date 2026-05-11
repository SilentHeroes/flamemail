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
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Compose</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className="block text-xs font-medium text-zinc-500">From</label>
          <div className="mt-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
            {address}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500">To</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-300/30 focus:ring-1 focus:ring-zinc-300/20"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-300/30 focus:ring-1 focus:ring-zinc-300/20"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            rows={6}
            className="mt-1 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-300/30 focus:ring-1 focus:ring-zinc-300/20"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !to.trim() || !to.includes("@") || !body.trim()}
            className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
