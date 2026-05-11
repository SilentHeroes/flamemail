import { Cloud, Database, Globe, HardDrive, Key, Mail, Radio, Shield, Timer } from "lucide-react";

const STACK = [
  { icon: Cloud, label: "Cloudflare Workers", desc: "Serverless runtime for API, email handling, and scheduled cleanup" },
  { icon: Database, label: "D1 (SQLite)", desc: "Inbox and email metadata with Drizzle ORM" },
  { icon: HardDrive, label: "R2", desc: "Object storage for email bodies and attachments" },
  { icon: Key, label: "KV", desc: "Session tokens with automatic TTL expiry" },
  { icon: Radio, label: "Durable Objects", desc: "WebSocket API for real-time push notifications" },
  { icon: Mail, label: "Email Routing + Sending", desc: "Inbound catch-all and outbound relay notifications" },
];

const FEATURES = [
  { icon: Timer, title: "Temporary inboxes", desc: "Self-destruct after 24, 48, or 72 hours. No sign-up required." },
  { icon: Radio, title: "Real-time delivery", desc: "Emails appear instantly via WebSocket push." },
  { icon: Globe, title: "Multi-domain relay", desc: "Two-way communication across separate domains via shared passphrase." },
  { icon: Shield, title: "Admin dashboard", desc: "Manage domains, inspect inboxes, and monitor permanent mailboxes." },
];

export function About() {
  return (
    <main className="animate-slide-up mx-auto max-w-3xl space-y-8 pt-2">
      <section>
        <h1 className="text-xl font-bold text-zinc-100">About</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          A disposable email service and secure relay system running entirely on Cloudflare's edge platform.
          Temporary inboxes with real-time delivery, two-way relay channels, sandboxed HTML rendering, and automatic cleanup.
        </p>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Features</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
              <f.icon className="h-4 w-4 text-zinc-300" />
              <h3 className="mt-2 text-sm font-semibold text-zinc-200">{f.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Technology stack</h2>
        <div className="mt-3 space-y-2">
          {STACK.map((s) => (
            <div key={s.label} className="flex items-start gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/50 px-4 py-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-700/40 text-zinc-300">
                <s.icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <strong className="block text-sm font-medium text-zinc-200">{s.label}</strong>
                <span className="text-xs text-zinc-500">{s.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">How it works</h2>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">
          {[
            ["Create an inbox", "Pick a domain and lifetime. You get a random address and an access token stored in your browser."],
            ["Receive email", "Cloudflare Email Routing forwards inbound mail to the Worker, which parses, stores the body in R2, and writes metadata to D1."],
            ["Instant notification", "A Durable Object pushes the new-email event over WebSocket, then hibernates."],
            ["Automatic cleanup", "An hourly cron purges expired inboxes, their emails, and all R2 objects."],
          ].map(([title, desc], i) => (
            <li key={i} className="flex gap-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-xs font-semibold text-zinc-300">{i + 1}</span>
              <span><strong className="text-zinc-200">{title}</strong> &mdash; {desc}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
