# Codebase Audit

This document (last dated December 2025) described an architecture — Postgres/Neon via `drizzle-orm`, an OIDC auth module tied to a hosting provider that is no longer used — that no longer matches the codebase. It's stale and has been superseded rather than patched line-by-line.

The real, current architecture is documented in `README.md`: SQLite (`better-sqlite3`) storage, `passport-local` + `express-session` auth (`server/auth.ts`), local-machine-only deployment. Treat `README.md` as the source of truth going forward.
