---
name: kivvi-frontend
description: Implement or review KIVVI React and TypeScript frontend behavior, UI, routes, state, platform integration, accessibility, and responsive presentation.
---

# KIVVI frontend

Choose `implement` or `lead-review` from the request. Review mode is read-only unless the user asks
for fixes. Start with the affected route or feature, its public API, and an existing nearby pattern.
Read the relevant section of `docs/agent-context/design.md` before changing UI structure, themes,
modals, safe areas, sticky behavior, premium UI, or the shop.

## Implementation rules

- Reuse shared UI primitives and design tokens. Preserve mathematical grid backgrounds unless the
  user explicitly removes them.
- Keep `src/shared` and `src/platform` independent of features/content. Cross-feature imports use
  the target feature's `index.ts`; Telegram and Capacitor access use platform wrappers.
- Add user-visible copy in both UZ and RU. Preserve mobile document scroll, desktop panel scroll,
  safe areas, close/back behavior, and the four-root bottom-navigation allowlist.
- Register every lazy route through its loader, route, and `routeChunkPrefetchers` entry.
- Add the smallest meaningful regression test for new behavior or a bug fix. Cosmetic-only changes
  may use existing guards and visual evidence.

Verify the affected mobile state, overflow, readable text, focus/close/back where relevant, targeted
Vitest coverage, and frontend TypeScript. Use `$kivvi-qa` for a broader requested verification pass.
Return changed files plus checks for implementation, or prioritized `file:line` findings for review.
