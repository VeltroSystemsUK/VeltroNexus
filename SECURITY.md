# Access & Safeguards

What's actually in place, so this doesn't need to be re-derived from the code later.

## Authentication
- `passport-local` + `express-session` (`server/auth.ts`). Passwords hashed with `scrypt`.
- `SESSION_SECRET` is required in production — the server refuses to start without it (no silent fallback).
- Session store is SQLite-backed, same local database as the rest of the app.

## Network / request safeguards
- Hand-rolled security headers in `server/index.ts`: `X-Frame-Options`, CSP (relaxed in dev for Vite HMR), HSTS in production, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Rate limiting (`server/utils/rateLimit.ts`) — Redis-backed with in-memory fallback, per-endpoint-class limits (auth, uploads, AI, webhooks).
- IP/CIDR allowlist (`server/utils/ipAllowlist.ts`) gating `/api/broker-portal/*` and `/api/admin/*`. Configured via `IP_ALLOWLIST` in `.env.local` (comma-separated IPs/CIDRs) — unset means allow-all, so this is opt-in, not a default restriction.

## Data
- SQLite (`better-sqlite3`), local file only. No external database, no cloud hosting — this app runs on the local machine by design.
- Startup env-var check (`server/config.ts`) warns if `COMPANIES_HOUSE_API_KEY` / `GOOGLE_PLACES_API_KEY` are missing, so misconfiguration surfaces at boot instead of as a deep request failure.

## Known gaps (not built)
- No audit log of who accessed what beyond the existing underwriting-action audit (`logUnderwritingAudit`) — general access logging is request-level only (`server/index.ts`'s structured request log).
- The IP allowlist is a basic exact-match/CIDR check, IPv4 only.
