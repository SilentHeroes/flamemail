# Disposable Mail + Secure Relay

Disposable email inboxes and covert two-way relay channels running on Cloudflare's edge. Inboxes auto-destruct after expiry. Relay channels create a single shared inbox accessible from two different domains via a shared passphrase — the two parties are never associated.

## Architecture

```
                        ┌─────────────────────────────────────────────────┐
                        │              Cloudflare Worker                  │
                        │                                                 │
Inbound Email           │   email() handler                               │
  → Email Routing       │     → postal-mime parse                         │
  → catch-all rule ────►│     → resolve relay aliases                     │
                        │     → D1: store metadata                        │
                        │     → R2: store raw .eml, body, attachments     │
                        │     → Durable Object: push WebSocket event      │
                        │     → (relay) send_email: notify subscriber     │
                        │                                                 │
Outbound Email          │   POST /api/inboxes/:addr/send                  │
  ← send_email binding ◄│     → mimetext: build MIME                      │
                        │     → EMAIL_SEND.send()                         │
                        │     → D1 + R2: store sent email                 │
                        │                                                 │
Browser                 │   fetch() handler                               │
  → HTTPS ─────────────►│     → Hono API routes (D1 Sessions middleware)  │
  ← WebSocket ◄────────►│     → Durable Object: hibernation WebSocket     │
                        │     → Static Assets: React SPA                  │
                        │                                                 │
Cron (hourly)           │   scheduled() handler                           │
                        │     → delete expired inboxes, R2 objects, KV    │
                        └─────────────────────────────────────────────────┘
```

## Cloudflare Products Used

| Product | Purpose |
|---------|---------|
| Workers | Runtime — fetch, email, and scheduled handlers |
| D1 (SQLite) | Inbox metadata, email records, relay aliases, attachments |
| R2 | Raw `.eml` files, parsed email bodies, attachment blobs |
| KV | Session tokens with TTL expiry, WebSocket tickets |
| Durable Objects | Per-inbox WebSocket connections (hibernation API) |
| Email Routing | Catch-all rules forward inbound mail to the Worker |
| Email Sending (`send_email`) | Outbound email from inboxes and relay notifications |
| Turnstile | Bot protection on inbox creation, relay creation, admin login |
| Static Assets | React SPA served from the Worker |

## Relay System

The relay creates a single shared inbox accessible via two different domain addresses. Both parties enter the same passphrase independently — the system derives the same inbox deterministically.

### How It Works

1. Party A enters a passphrase on `mail.example.com`
2. PBKDF2 derives a deterministic local part (e.g., `xk7f9m2q`)
3. One inbox is created: `xk7f9m2q@example.com` (primary)
4. An alias is registered: `yq3n8c1p@example.net` (routes to the same inbox — different local part per domain)
5. Party B enters the same passphrase on `relay.example.net` — gets access to the same inbox
6. Both addresses deliver to the same inbox. Both parties see all messages.
7. Either party can compose and send outbound email from the inbox.
8. Optional: register a notification email to get alerted when new messages arrive.

### What an Observer Sees

| Observer | Party A traffic | Party B traffic |
|----------|----------------|----------------|
| ISP A | Sends/receives email to/from `example.com` | — |
| ISP B | — | Sends/receives email to/from `example.net` |
| Cross-ISP | Two people using two unrelated email services. No link. | |

### Security Properties

- Passphrase is never stored — only `SHA-256(passphrase)` for idempotent creation
- Both parties get independent session tokens for the same inbox
- Relay aliases are resolved at the email handler level — the alias address maps to the real inbox
- Relay pairs cascade-delete when the inbox expires
- PBKDF2 with 100k iterations provides brute-force resistance on passphrase derivation

## Email Flow — Inbound

1. External sender → MX records → Cloudflare Email Routing (catch-all)
2. Worker `email()` handler receives `ForwardableEmailMessage`
3. Parse recipient: extract local part, domain, handle plus-addressing (`name+tag@domain` → `name@domain`)
4. Look up inbox by address. If not found, check relay alias table — resolve to the real inbox.
5. Validate: domain active, inbox exists, inbox not expired, size ≤ 10MB, ≤ 100 emails per inbox
6. Parse MIME with `postal-mime`, then validate ≤ 10 attachments
7. Batch insert to D1: email record + attachment records
8. Store to R2: raw `.eml`, parsed body JSON, individual attachment blobs
9. Notify Durable Object: `stub.notifyNewEmail()` broadcasts to all connected WebSocket clients
10. If this is a relay inbox and a notification email is registered, send alert via `send_email` binding

## Email Flow — Outbound

1. User clicks Compose or Reply in the UI
2. `POST /api/inboxes/:address/send` with `{ to, subject, body }`
3. Worker builds MIME message with `mimetext`
4. Sends via `env.EMAIL_SEND.send(new EmailMessage(...))` (Cloudflare Email Sending)
5. Stores sent email in D1 (with `is_sent = true`) and body in R2
6. Sent emails appear in the inbox timeline with a "Sent" indicator

## Database Schema

- **domains** — registered email domains with active/inactive status
- **inboxes** — temporary/permanent inboxes with optional relay flag and notification email
- **emails** — received and sent email metadata (`is_sent` flag distinguishes direction)
- **attachments** — file metadata with R2 storage keys
- **relay_pairs** — maps an alias address on a secondary domain to a primary inbox

## Authentication

- **Inbox access**: Bearer token created on inbox creation, stored in KV with TTL matching inbox expiry
- **Admin access**: Password-authenticated session (1-hour TTL). Password must be ≥ 16 chars with ≥ 3 character classes.
- **WebSocket**: One-time ticket (60s TTL) consumed on upgrade. Origin validation prevents CSRF.
- **Turnstile**: Required for inbox creation (`create_inbox`), relay creation (`create_relay`), and admin login (`admin_login`). Fails closed if not configured.

## Project Structure

```
src/
├── client/                  # React SPA (Vite + Tailwind CSS v4)
│   ├── components/          # CreateInbox, CreateRelay, InboxView, EmailDetail, ComposeEmail, etc.
│   ├── hooks/               # useInbox (state + polling), useWebSocket (auto-reconnect)
│   └── lib/                 # API client, HTML sanitization, time formatting
├── shared/
│   └── contracts/           # en-garde codecs for request/response validation
└── worker/                  # Cloudflare Worker
    ├── api/                 # Hono route handlers: inboxes, emails, relay, admin, config, domains
    ├── db/                  # Drizzle schema, relations, DB factory
    ├── durable-objects/     # InboxWebSocket (hibernation WebSocket)
    ├── services/            # inbox lifecycle, relay logic, R2 storage, Turnstile verification
    ├── middleware/           # requireAdmin, requireInboxAccess
    ├── email-handler.ts     # Inbound email processing pipeline with relay alias resolution
    └── index.ts             # Worker entry: fetch, email, scheduled
```

## Development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:local:init
npm run dev
```

Local dev uses Turnstile's always-pass test keys from `.dev.vars.example`. Fill in a real `ADMIN_PASSWORD` (≥ 16 chars, ≥ 3 character classes) before testing admin flows.

## Deployment

### 1. Configure your own domains

This project requires **two domains** for the relay feature — one acts as the "primary" and the other as the "alias". You must own both in Cloudflare (added as zones in your account).

Update the following files with your domains:

- **`wrangler.jsonc`** → the two `routes[].pattern` entries (e.g., `mail.yourdomain.com` and `relay.yourotherdomain.net`)
- **`src/worker/services/relay.ts`** → the `RELAY_DOMAINS` constant (the bare domains, e.g., `["yourdomain.com", "yourotherdomain.net"]`)

If you only want a single-domain deployment (no covert relay), remove the second route and both relay domains — the rest of the app works fine with one domain.

### 2. Create Cloudflare resources

`wrangler.jsonc` has placeholder IDs that must be replaced with real resource IDs from your account:

```bash
wrangler d1 create flamemail-db             # copy database_id → wrangler.jsonc
wrangler r2 bucket create flamemail-emails  # name must match bucket_name
wrangler kv namespace create SESSIONS       # copy id → wrangler.jsonc
```

### 3. Configure secrets

```bash
wrangler secret put ADMIN_PASSWORD       # ≥ 16 chars, ≥ 3 character classes
wrangler secret put TURNSTILE_SITE_KEY   # public site key from Turnstile dashboard
wrangler secret put TURNSTILE_SECRET_KEY # secret key from Turnstile dashboard
```

### 4. Build, migrate, and deploy

```bash
npm run build          # vite build → dist/client (static assets) + dist/flamemail (worker)
npm run deploy         # runs db:migrate (remote D1) then wrangler deploy
```

`npm run deploy` expands to `wrangler d1 migrations apply flamemail-db --remote && wrangler deploy`.

### 5. Cloudflare dashboard configuration

- **Email Routing**: enable on each sending domain; add a catch-all rule forwarding to the Worker
- **Email Sending**: verify the outbound addresses you want to send from (required by the `send_email` binding)
- **Turnstile**: add your deployed hostnames to the widget's allowed hostnames
- **Domains**: register each active domain in the admin UI (`/admin`) so the Worker accepts inbound mail for it

## License

[MIT](LICENSE)
