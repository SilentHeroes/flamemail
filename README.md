# Disposable Mail + Secure Relay

Disposable email inboxes and covert two-way relay channels running on Cloudflare's edge. Inboxes auto-destruct after expiry. Relay channels link two inboxes on separate domains via a shared passphrase — the two parties are never associated.

## Architecture

```
                        ┌─────────────────────────────────────────────────┐
                        │              Cloudflare Worker                  │
                        │                                                 │
Inbound Email           │   email() handler                               │
  → Email Routing       │     → postal-mime parse                         │
  → catch-all rule ────►│     → D1: store metadata                        │
                        │     → R2: store raw .eml, body, attachments     │
                        │     → Durable Object: push WebSocket event      │
                        │     → (relay) send_email: notify partner        │
                        │                                                 │
Outbound Email          │   POST /api/inboxes/:addr/send                  │
  ← send_email binding ◄│     → mimetext: build MIME                      │
                        │     → EMAIL_SEND.send()                         │
                        │     → D1 + R2: store sent email                 │
                        │                                                 │
Browser                 │   fetch() handler                               │
  → HTTPS ─────────────►│     → Hono API routes (D1 Sessions middleware)  │
  ← WebSocket ◄────────►│     → Durable Object: hibernation WebSocket    │
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
| D1 (SQLite) | Inbox metadata, email records, relay pairs, attachments |
| R2 | Raw `.eml` files, parsed email bodies, attachment blobs |
| KV | Session tokens with TTL expiry, WebSocket tickets |
| Durable Objects | Per-inbox WebSocket connections (hibernation API) |
| Email Routing | Catch-all rules forward inbound mail to the Worker |
| Email Sending (`send_email`) | Outbound email from inboxes and relay notifications |
| Turnstile | Bot protection on inbox creation, relay creation, admin login |
| Static Assets | React SPA served from the Worker |

## Relay System

The relay enables two-way communication between two parties who cannot be associated together. Each party uses a different domain.

### Flow

1. Both parties independently enter the same passphrase on different domains
2. PBKDF2 derives two deterministic inbox addresses — one per domain
3. Party A picks side A (`user@easydemo.org`), Party B picks side B (`user@orangeclouded-tmn.net`)
4. The `relay_pairs` table links both inboxes; neither party knows the other's identity
5. When Party A's inbox receives an email, the Worker looks up the relay partner
6. If the partner has a notification email registered, an outbound email is sent via `send_email` FROM the partner's domain
7. Both parties can also send outbound email directly from their inbox using the compose UI

### What an observer sees

| Observer | Party A traffic | Party B traffic |
|----------|----------------|----------------|
| ISP A | Sends/receives email to/from `easydemo.org` | — |
| ISP B | — | Sends/receives email to/from `orangeclouded-tmn.net` |
| Cross-ISP | Two people using two unrelated email services. No link. | |

### Key properties

- Passphrase is never stored — only `SHA-256(passphrase)` for idempotent pair creation
- Both inboxes get independent session tokens — accessing one does not grant access to the other
- Notification emails are sent FROM the partner's domain, not the inbox that received the email
- Relay pairs cascade-delete when either inbox expires
- PBKDF2 with 100k iterations provides brute-force resistance on passphrase derivation

## Email Flow — Inbound

1. External sender → MX records → Cloudflare Email Routing (catch-all)
2. Worker `email()` handler receives `ForwardableEmailMessage`
3. Parse recipient: extract local part, domain, handle plus-addressing (`name+tag@domain` → `name@domain`)
4. Validate: domain active, inbox exists, inbox not expired, size ≤ 10MB, ≤ 10 attachments, ≤ 100 emails per inbox
5. Parse MIME with `postal-mime`
6. Batch insert to D1: email record + attachment records
7. Store to R2: raw `.eml`, parsed body JSON, individual attachment blobs
8. Notify Durable Object: `stub.notifyNewEmail()` broadcasts to all connected WebSocket clients
9. (Relay inboxes) Look up relay partner → send notification email via `send_email` binding

## Email Flow — Outbound

1. User clicks Compose or Reply in the UI
2. `POST /api/inboxes/:address/send` with `{ to, subject, body }`
3. Worker builds MIME message with `mimetext`
4. Sends via `env.EMAIL_SEND.send(new EmailMessage(...))` (Cloudflare Email Sending)
5. Stores sent email in D1 (with `is_sent = true`) and body in R2
6. Sent emails appear in the inbox timeline with a "Sent" badge

## Database Schema

**domains** — active email domains
**inboxes** — temporary/permanent inboxes with optional relay flag and notification email
**emails** — received and sent email metadata (linked to inbox, `is_sent` flag)
**attachments** — file metadata with R2 storage keys
**relay_pairs** — links two inboxes via `passphrase_hash` (unique)

## Authentication

- **Inbox access**: Bearer token created on inbox creation, stored in KV with TTL matching inbox expiry
- **Admin access**: Password-authenticated session (1-hour TTL). Password must be ≥ 16 chars with ≥ 3 character classes.
- **WebSocket**: One-time ticket (60s TTL) consumed on upgrade. Origin validation prevents CSRF.
- **Turnstile**: Required for inbox creation (`create_inbox`), relay creation (`create_relay`), and admin login (`admin_login`). Fails closed if not configured.

## Project Structure

```
src/
├── client/                  # React SPA (Vite + Tailwind CSS v4)
│   ├── components/          # UI: CreateInbox, CreateRelay, InboxView, EmailDetail, ComposeEmail, etc.
│   ├── hooks/               # useInbox (state), useWebSocket (auto-reconnect)
│   └── lib/                 # API client, HTML sanitization, time formatting
├── shared/
│   └── contracts/           # en-garde codecs for request/response validation
└── worker/                  # Cloudflare Worker
    ├── api/                 # Hono route handlers: inboxes, emails, relay, admin, config, domains
    ├── db/                  # Drizzle schema, relations, DB factory
    ├── durable-objects/     # InboxWebSocket (hibernation WebSocket)
    ├── services/            # inbox lifecycle, relay logic, R2 storage, Turnstile verification
    ├── middleware/           # requireAdmin, requireInboxAccess
    ├── email-handler.ts     # Inbound email processing pipeline
    └── index.ts             # Worker entry: fetch, email, scheduled
```

## Development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:local:init
npm run dev
```

## Deployment

```bash
npm run db:migrate
npx wrangler deploy
```

### Required secrets

```bash
wrangler secret put ADMIN_PASSWORD       # ≥ 16 chars, ≥ 3 char classes
wrangler secret put TURNSTILE_SITE_KEY   # from Turnstile dashboard
wrangler secret put TURNSTILE_SECRET_KEY # from Turnstile dashboard
```

### Required Cloudflare configuration

- Email Routing enabled on each domain with catch-all → Worker
- Email Sending enabled for outbound email from inbox addresses
- Turnstile widget configured with deployed hostnames
- D1, R2, KV resources created (wrangler handles this on first deploy)

## License

[MIT](LICENSE)
