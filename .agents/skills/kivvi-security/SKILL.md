---
name: kivvi-security
description: Perform a read-only, evidence-based KIVVI security review for authentication, identity, payments, scoring, coins, entitlements, private content, account switching, or sensitive data flows.
---

# KIVVI security

Audit only; implement fixes only after a separate user request. Start from the task or diff, identify
assets and trust boundaries, then inspect the narrow request path and its tests. Read the matching
section of `docs/agent-context/backend.md`; expand beyond touched code only for a concrete exploit
path. Never request, expose, or test with production secrets or user data.

## Review boundaries

- Authentication and identity: authorization on every user-owned resource, Bearer/initData recovery,
  verified phone ownership, Telegram canonical identity, and cross-account isolation/reset.
- Money and authority: webhook verification, replay/concurrency safety, atomic state transitions,
  ledger consistency, idempotency, server-authoritative scoring, coins, payments, and entitlements.
- Data exposure: no answers or explanations in public question payloads, private/no-store user data,
  deliberate public-client boundaries, least-privilege response fields, and safe error messages/logs.
- Content and cache: private R2, path/token scope, authentication before cache, and publish marker last.
- Input and abuse: zod validation, injection/path traversal, rate-limit boundaries, malformed input,
  and fail-closed behavior when required configuration is missing.

Report only reproducible or strongly evidenced findings, ordered P0 to P2. Each finding includes
`file:line`, attacker prerequisites, trigger, impact, smallest safe fix, and a regression check.
Separate `unknown` from defects. Say `No findings` when appropriate; do not emit a generic checklist.
