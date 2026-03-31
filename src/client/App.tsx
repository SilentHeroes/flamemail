import { useMemo, useState } from "react";
import { BrowserRouter, Link, Route, Routes, useNavigate } from "react-router-dom";
import { Clock, Mail, Zap } from "lucide-react";
import { About } from "@/client/components/About";
import { AdminLogin } from "@/client/components/AdminLogin";
import { CreateInbox } from "@/client/components/CreateInbox";
import { CreateRelay } from "@/client/components/CreateRelay";
import { ExternalLinkRedirect } from "@/client/components/ExternalLinkRedirect";
import { Header } from "@/client/components/Header";
import { InboxView } from "@/client/components/InboxView";
import { Footer } from "@/client/components/Footer";
import { ToastContainer } from "@/client/components/Toast";
import { loadInboxSessions, storeInboxSession, type InboxSession, type InboxSessionSummary } from "@/client/lib/api";

function HomePage({
  sessions,
  onCreated,
}: {
  sessions: InboxSessionSummary[];
  onCreated: (session: InboxSession) => void;
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"inbox" | "relay">("inbox");

  const handleCreated = (session: InboxSession) => {
    onCreated(session);
    navigate(`/inbox/${encodeURIComponent(session.address)}`);
  };

  return (
    <main className="animate-slide-up pt-2">
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,440px)_minmax(0,1fr)]">
        <div>
          <div className="mb-3 flex gap-1 rounded-xl bg-zinc-900/50 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("inbox")}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                activeTab === "inbox"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
            >
              <Mail className="h-3.5 w-3.5" />
              Inbox
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("relay")}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                activeTab === "relay"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
            >
              <Zap className="h-3.5 w-3.5" />
              Secure Relay
            </button>
          </div>

          {activeTab === "inbox" ? (
            <CreateInbox onCreated={handleCreated} />
          ) : (
            <CreateRelay onCreated={handleCreated} />
          )}
        </div>

        <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            <Mail className="h-3.5 w-3.5" />
            Recent inboxes
          </h2>

          {sessions.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">
              No inboxes yet. Created addresses are saved on this device and removed when they expire.
            </p>
          ) : (
            <div className="mt-4 space-y-1.5">
              {sessions.map((session) => {
                const expires = new Date(session.expiresAt);
                const remaining = expires.getTime() - Date.now();
                const alive = remaining > 0;

                return (
                  <Link
                    key={session.address}
                    className="group flex items-center gap-3 rounded-xl border border-zinc-800/50 bg-zinc-800/30 px-4 py-3 transition-colors hover:border-flame-500/30 hover:bg-zinc-800/60"
                    to={`/inbox/${encodeURIComponent(session.address)}`}
                  >
                    <span className={`inline-grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                      alive ? "bg-flame-500/10 text-flame-400" : "bg-zinc-800 text-zinc-600"
                    }`}>
                      <Mail className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-medium text-zinc-200 group-hover:text-flame-400">
                        {session.address}
                      </strong>
                      <span className="flex items-center gap-1 text-xs text-zinc-500">
                        <Clock className="h-3 w-3" />
                        {alive
                          ? `expires ${expires.toLocaleString()}`
                          : "expired"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function AppShell() {
  const [sessions, setSessions] = useState<InboxSessionSummary[]>(() => loadInboxSessions());
  const sessionCount = useMemo(() => sessions.length, [sessions]);

  const handleCreated = (session: InboxSession) => {
    setSessions(storeInboxSession(session));
  };

  const handleDeleted = (_address: string) => {
    setSessions(loadInboxSessions());
  };

  return (
    <div className="relative z-10 min-h-screen">
      <Header sessionCount={sessionCount} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Routes>
          <Route path="/" element={<HomePage sessions={sessions} onCreated={handleCreated} />} />
          <Route path="/about" element={<About />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/link" element={<ExternalLinkRedirect />} />
          <Route path="/inbox/:address" element={<InboxView onDeleted={handleDeleted} />} />
        </Routes>
      </div>
      <Footer />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
