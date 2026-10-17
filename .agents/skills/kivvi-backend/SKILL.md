---
name: kivvi-backend
description: Implement or review KIVVI Express, PostgreSQL, Drizzle, API, authentication, content, payment, scoring, and server-side behavior.
---

# KIVVI backend

Choose `implement` or `lead-review` from the request. Review mode is read-only unless fixes are
requested. Search the matching numbered rule in `docs/agent-context/backend.md` and read that
section before changing auth, API, database, coins, payments, content/R2, or server environment.

## Implementation rules

- Validate new input with zod. Express handlers use `wrap()` and `AppError`; follow the existing
  router/repository boundary.
- Read server environment only through `server/config/index.ts`. Never add `NODE_ENV` to env files.
- Keep scoring, coins, payments, entitlements, and identity changes server-authoritative,
  authorized, atomic where required, and idempotent under retries or concurrent requests.
- Preserve Bearer/initData recovery, verified phone ownership, Telegram canonical identity,
  private/no-store user responses, and the deliberate unauthenticated public-content client.
- Database changes require generated migration, monotonic journal and snapshot preservation.
  Integration checks use only an explicit isolated test DB after schema verification.
- Avoid eager full-bank reads. R2 remains private; authenticate before cache and publish marker last.

Add regression coverage for the affected contract, including denied/malformed/replayed requests when
relevant. Run targeted backend TypeScript and exact tests; use `$kivvi-qa` for wider verification.
Return changed files and checks, or prioritized `file:line` findings in review mode.
