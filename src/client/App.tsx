import { useMemo, useState } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { Mail, Zap } from "lucide-react";
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
  onCreated,
}: {
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
      <div className="mx-auto w-full max-w-md">
        <div className="mb-3 flex rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className={[
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "relay"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            <Zap className="h-3.5 w-3.5" />
            Relay
          </button>
        </div>

        {activeTab === "inbox" ? (
          <CreateInbox onCreated={handleCreated} />
        ) : (
          <CreateRelay onCreated={handleCreated} />
        )}
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
          <Route path="/" element={<HomePage onCreated={handleCreated} />} />
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
