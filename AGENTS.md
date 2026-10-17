# KIVVI agent instructions

React/TypeScript/Vite frontend; Express/PostgreSQL/Drizzle backend; Telegram WebApp and Capacitor Android.
Repository commands and dependencies: package.json. Prefer existing components and tests.

## Working method
- State the acceptance condition; inspect the smallest relevant files, implement, verify, stop.
- Small fixes: one agent. Delegate only a separable investigation, implementation or high-risk review
  that saves repeated work. At most one helper by default; no recursive delegation.
- Delegate a short brief: goal, owned files, evidence, constraints, expected result.
  Workers share the checkout; never revert others' edits. Avoid full chat-history forks.
- Reuse existing bug-hunter, senior-code-reviewer, security-auditor and test-generator roles.
  kivvi-qa provides project-specific verification. Do not launch every role for every task.
- Use `$kivvi-lead` for cross-cutting scope and architecture, `$kivvi-frontend` or `$kivvi-backend`
  for domain implementation/review, and `$kivvi-security` only for sensitive trust boundaries.
- For a read-only, token-bounded task review, use `$task-auditor`; it audits the request or current
  implementation without making changes.
- Start with targeted rg searches. Bound tool output; do not print full bundles, databases or logs.
- Use scripts/agent-check.mjs for concise local checks (see --help). Full output stays local.
- Repeat passing checks only after relevant changes or new evidence. CI remains the release gate.
- After two identical tool failures, inspect the error and change approach; do not blindly retry.
- Report outcome, verification and remaining limitations briefly. Do not claim deployment from a push.
- Explicit /graphify uses the installed graphify skill. Other work starts with direct file searches.
- Consult installed types/current official docs for unfamiliar or version-sensitive APIs;
  use Context7 when available. Familiar local edits do not require a generic documentation search.

## Architecture and invariants
- shared/subjects.ts is subject SSOT; UI mapping: src/shared/config/subjects.tsx.
  Exam presets: shared/exam-presets.ts. Never duplicate configuration.
- src/shared and src/platform must not import features or content.
  Cross-feature imports use the target index.ts public API. src/content remains pure data.
- Telegram and Capacitor access goes through src/platform wrappers, with browser fallbacks.
- index.html is marketing; app.html is the app. Local preview entry: /app.html.
- Lazy routes require loader + route + routeChunkPrefetchers registration.
- New API input uses zod; handlers use wrap() and AppError.
- Server environment access belongs in server/config/index.ts. Never put NODE_ENV in .env files.
- Schema changes require generated migration; preserve monotonic journal and snapshots.
- Public question payloads contain no answers/explanations. Scoring, coins, payments and
  entitlements are server-authoritative, authorized and idempotent.
- Preserve Bearer/initData recovery, verified phone ownership and Telegram canonical identity.
- User-specific responses are private/no-store. Public content uses the deliberate public client.
- Account switching must clear all account-owned storage through the canonical reset registry.
- No eager full-bank DB reads. R2 is private; authenticate before cache; publish marker last.
- Browser bundle: npm run build. Android start path is /app.html (leading slash required).
- New behavior/bug fixes need meaningful regression coverage; use existing checks for cosmetic edits.
- Use design tokens and shared UI primitives. Add translations in both UZ and RU.
- Keep mathematical grid backgrounds unless the user asks to remove them.
- Safe areas come from index.css; mobile document scroll and desktop panel scroll must survive.
- Bottom navigation is an allowlist of four tab roots, governed by route-chrome.ts.

## Read only the relevant reference before changing a domain
Historical incident details are retained verbatim in these references. Verify dated deployment
claims against current code/state; references are not proof of current production configuration.
- Structure, build, APK, routes, caching: docs/agent-context/architecture.md.
- Auth, API, DB, coins/payments, content/R2, server env: search the matching numbered rule in
  docs/agent-context/backend.md and read that section.
- Components, themes, premium/payment UI, modal, sticky/safe-area, shop:
  docs/agent-context/design.md.
- QA task or release verification: .agents/skills/kivvi-qa/SKILL.md.
- Token-bounded task audit: .agents/skills/task-auditor/SKILL.md.
- Cross-cutting lead plan: .agents/skills/kivvi-lead/SKILL.md.
- Frontend implementation/review: .agents/skills/kivvi-frontend/SKILL.md.
- Backend implementation/review: .agents/skills/kivvi-backend/SKILL.md.
- Sensitive-flow security review: .agents/skills/kivvi-security/SKILL.md.
- Cross-session decisions/handoff: .agents/skills/kivvi-memory/SKILL.md.
- Parallel work or task decomposition: .agents/skills/kivvi-workflow/SKILL.md.
- Durable current decisions: docs/agent-context/memory.md (read when relevant, not every turn).

## Verification
- Unit: npx vitest run <specific-test-paths>; frontend: npx tsc -p tsconfig.json --noEmit.
- Backend: npx tsc -p tsconfig.server.json --noEmit; lint changed supported files.
- Shared architecture/config changes: related tests/unit/config guards plus relevant behavior tests.
- UI: inspect the affected state at mobile width; check close/back, overflow and readable text.
- Integration: explicit test DB only; check/migrate test schema first. Never use production fixtures.
- CI already runs lint, types, unit/API, builds and E2E; do not duplicate a green unchanged run.
