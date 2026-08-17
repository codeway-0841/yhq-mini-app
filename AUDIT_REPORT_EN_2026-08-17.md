# YHQ Mini App (KIWI) — Full Codebase Audit Report

> Date: 2026-08-17 · Audited state: working tree (including uncommitted changes)

**Scope:** 642 tracked files, ~57,000 lines of TypeScript across frontend (`src/`), backend (`server/`, `api/`), shared layer (`shared/`), 39 migrations, 67 test files, CI/CD configs. Method: direct file-by-file review of the core paths (backend core, auth, payments-adjacent code, frontend core, configs, schema, the in-flight referral work) plus a dedicated deep sub-audit of all 17 backend modules, `octagon.ts`, and `bot.ts`.

> ⚠️ **Important caveat:** the working tree was being actively edited *while the audit ran* — the referral feature moved from a "reward at 10 answers" (v2) design to a "welcome gift at signup + reward on phone link" (v3) design, and a new SMS-campaign feature appeared mid-audit (migration 0039, `sms-campaign.service.ts`, `AdminSmsTab.tsx`). Everything below reflects the **final observed state**, but the uncommitted code is a moving target.

---

## 1. FULL CODE REVIEW

### 1.1 Architecture & structure — **excellent**

This is a genuinely well-organized codebase for its stack:

- Clean layering with enforced boundaries: `src/shared/` and `src/platform/` never import from `features/`/`content/` (guarded by `tests/unit/config/import-boundaries.test.ts`). All `window.Telegram` access is confined to `src/platform/telegram.ts` with browser fallbacks.
- Single-source-of-truth configs done right: `shared/subjects.ts`, `shared/exam-presets.ts`, `shared/premium-plans.ts` are shared frontend↔backend, each with a desync test. i18n parity (UZ/RU) is *type-enforced* (`RU: Record<Keys, string>` in `src/shared/i18n/index.ts`) — both objects were mechanically diffed; zero real missing keys.
- Repository pattern consistently applied (`server/modules/<m>/{router,repository}.ts`), handlers wrapped in `wrap()` + `AppError`, zod validation on effectively all input endpoints.
- A distinctive strength: nearly all multi-step writes are **single atomic Postgres CTEs** (streaks, answer idempotency, promo redemption, payment activation, referral rewards) — a necessity given the neon-http driver's lack of interactive transactions, which `server/db/connection.ts:63-80` documents honestly.
- Security posture is above average: session tokens stored only as sha256 (`utils/token-hash.ts`), OTP as HMAC-peppered hashes, scrypt passwords with timing-safe compare and dummy-hash timing equalization (`utils/password.ts:21-39`), initData HMAC verified per Telegram spec with `timingSafeEqual` + auth_date freshness + future-skew rejection (`utils/telegram.ts:23-65`), fail-closed admin/cron/webhook gates, global anti-spoofing `:userId` path check (`middleware/auth.ts:220-241`), PII-stripped request logging and localStorage persistence.

### 1.2 Naming & style — **consistent**

Uzbek doc-comments are uniform and genuinely informative (they explain *why*, with invariant rationale). Dead `eslint-disable` comments exist (e.g. `src/App.tsx:69`) but **no ESLint config is installed at all** — the project relies on `tsc` strict mode only.

### 1.3 Dead code & repo hygiene — found

| Item | Location | Note |
|---|---|---|
| Unused dependencies | `pdf-parse`, `@types/pdf-parse` (`package.json:41,42`) | Zero imports anywhere in `server/` or `src/` — verified by grep |
| OAuth stubs | `server/modules/auth/auth.service.ts:1070,1080` | `TODO: Implement Google/Apple OAuth flow` — 501 endpoints, documented v2 stall |
| Duplicate entrypoints | `server/index.ts` vs `server/standalone.ts` | Near-identical; fixes drift between them (standalone has Render `/health`, index doesn't) |
| Committed build artifacts | `api/index.js`, `api/bot.js` (tracked in git) | ~10k lines of bundled JS in the repo; deployment is safe (Vercel rebuilds) but it's repo bloat and stale-bundle confusion risk |
| Legacy rate-limiter key fallback | `server/middleware/rate-limiter.ts:29`, `db-rate-limiter.ts:58` | `req.telegramUserId` is never set on Express requests (only in a bot.ts Sentry context) — dead branch |
| Deprecated columns | `progress.dailyStreak`, `progress.lastDailyDate` (`server/schema.ts:321-323`) | Marked `@deprecated`, kept for compat |
| `.env.check`, `REDIS_URL` in `.env` | repo root | Vercel CLI artifact / dead var (TODO.md:70 already notes REDIS) |
| Doc/code drift | `AGENTS.md` claims `npm test` = "all tests"; `package.json:77` runs unit only | Also `server/schema.ts:49` comments a unique-phone index "created in migration" — no such index exists in any migration |

---

## 2. BUGS AND ERRORS

### 🔴 CRITICAL

**C-1. Time-limited Premium purchases never expire — permanent premium for the price of one month**
- **Where:** `server/modules/payments/payment.repository.ts:60` (`tariff = 'premium'::tariff` unconditionally, even when `days = 30`); same pattern at `promo/promo.repository.ts:77`, `leaderboard/tournament-prize.service.ts:138`, `admin/admin.router.ts:373`.
- **What's wrong:** every entitlement check is `tariff === 'premium' || premiumUntil > now()` (`users.service.ts:20-21`, `progress.repository.ts:86-89`, `daily.repository.ts:33-37`, `tutor.router.ts:38-41`, `admin.router.ts:260`), and **nothing ever sets `tariff='free'` again** — verified that the only writer is the manual admin endpoint (`admin.router.ts:363-366`), and `vercel.json:4-17` has no expiry cron.
- **Impact:** buying the 29 000 UZS monthly plan (or redeeming a +3-day promo/referral reward) grants **lifetime** premium. Direct, ongoing revenue loss. Verified end-to-end first-hand.
- **Fix:** for `days != null` grants, don't touch `tariff` (leave `'free'`, rely on `premium_until > now()`; keep `tariff='premium'` strictly as the lifetime sentinel), centralize all 5 checks into one `isPremium(row)` helper, and add a consistency test. Alternative: a daily downgrade cron — but the sentinel approach needs no job.

### 🟠 HIGH

**H-1. Tournament prize distribution is non-atomic and fire-and-forget** — `tournament-prize.service.ts:127-142`: `premiumUntil` computed in JS from a snapshot and blindly overwritten (a concurrent payment's days get erased — lost update); UPDATE runs before the `tournament_prizes` ledger insert with no transaction (crash → double-award on retry); and `cron.router.ts:242-246` marks the job `completed` *before* firing `distributeWeeklyPrizes()` un-awaited — on Vercel's 30s limit the prizes are silently never distributed and never retried. Fix: single `premium_until = GREATEST(...) + make_interval(...)` CTE (pattern already used elsewhere), ledger-first, `await` before `complete()`, own `jobRuns` lease.

**H-2. `PATCH /users/:userId/phone` accepts any phone number with zero possession proof** — `users.router.ts:58-68` + `users.service.ts:149-158`: format-only validation, written straight to `users.phone`, and it triggers the referral reward. Combined with the new SMS campaigns (`sms-campaign.service.ts` selects `WHERE sms_opt_in AND phone IS NOT NULL`), any authenticated user can set a **victim's phone number**, opt in, and make the platform send paid marketing SMS to arbitrary numbers (harassment + Eskiz cost + compliance exposure). It also trivially satisfies the referral "phone-link" anti-farming gate. Fix: verify possession via the existing OTP flow before persisting to `users.phone`; quarantine `sms_opt_in` for N days after a phone change.

**H-3. Ball farming remains partially open (known H4)** — the `correct_questions` gate (migration 0037) stopped *repeat-correct* inflation, but first-time answers to arbitrary unique questions still increment `total_correct`/`daily_records`/league score without limit (TODO.md:31-35 documents the three candidate designs — this is a product decision, not an oversight).

### 🟡 MEDIUM

| # | File:line | Issue | Impact / Fix |
|---|---|---|---|
| M-1 | `payments/click.service.ts:170-171` | `Number(input.amount)` → `NaN` makes the amount guard a silent no-op (webhook body isn't zod-validated); `cancelled` orders can be re-completed later; `user_not_found` still returns SUCCESS | Defense-in-depth gap under signature compromise. Zod-validate webhook, `NaN → -2`, reject cancelled orders |
| M-2 | `users/users.repository.ts:87-89` (`rewardIfPhoneLinked`) | `pend` selects `status='pending'` but the UPDATE never re-checks it → two concurrent phone-saves double-grant the referrer +3 days (verified; READ COMMITTED re-evaluates only `r.id = pend.id` after the lock) | Add `AND r.status = 'pending'` to the UPDATE WHERE — one line |
| M-3 | `users/users.router.ts:71-85` + `middleware/auth.ts:28-30` | **IDOR:** `GET /api/referrals/:userId` — `USER_SEGMENTS` lacks `'referrals'`, so the global ownership check skips it; any authenticated user can read anyone's referral stats (verified) | Add `'referrals'` to `USER_SEGMENTS`, or move under `/users/:userId/referrals` |
| M-4 | `admin/sms-campaign.service.ts:120-142` (new, uncommitted) | Chunk SELECT has no row claim/`FOR UPDATE SKIP LOCKED`; status set to `sent` only after sending → two concurrent dispatch calls SMS the same 30 users twice | Claim rows first (`UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING`) |
| M-5 | `admin/broadcast.service.ts:62-74,178-221` | Loads the **entire** users table into memory, sends 25/s with sleeps; Vercel 30s cap → silent partial broadcast (~500-700 recipients), no resume, no persistence. Also `notificationsEnabled: sql\`true\`` (`tournament-prize.service.ts:101`) hardcodes opt-in | Reuse the DB-backed chunked-queue pattern (the SMS feature almost gets this right — extract one shared primitive) |
| M-6 | `cron/cron.router.ts:121-124` | `daily-reminder` catch calls `complete()` on failure → that day's reminder permanently suppressed. League-rollover fixed this exact pattern (comment at 249-252); daily-reminder wasn't updated | Don't complete on error; rely on the stale-lease retry |
| M-7 | `cron/cron.router.ts:161-171,231-236` | League rollover: all users selected into JS, then `Promise.all` of one UPDATE per user (neon-http fan-out storm, 30s-timeout risk); `sort((a,b) => score - score)` has no deterministic tiebreaker | Single `UPDATE … FROM (VALUES …)` or chunked batches; add `userId` tiebreaker |
| M-8 | `api-entry/bot.ts:115-129` + `auth.service.ts:1009-1027` | Telegram-login deep link is a phishable session hand-off: attacker generates `login_<code>`, victim shares contact, attacker's polling browser receives the victim's session token | Require an in-bot confirmation tap before binding the code |
| M-9 | `octagon.ts:48,474-499` | Duel PIN space is 4-8 digits (`\d{4,8}`) and `joinDuel` pairs instantly with whoever waits on a guessed code — 10k space sweepable in minutes at the message cap | Require ≥6 chars for codes; rate-limit failed joins |
| M-10 | `analytics/analytics.router.ts:19` | `props: z.record(z.unknown())` + 10MB body limit + no retention → unbounded jsonb row growth by any authenticated user | Cap serialized size (~4KB); add cleanup cron |
| M-11 | `auth/auth.service.ts:339-352` | OTP 60s cooldown is check-then-act (concurrent requests both send paid SMS); `sendOTP` runs *before* the DB write | Make the cooldown part of the upsert; write-then-send |
| M-12 | `middleware/db-rate-limiter.ts:80-83` | Fail-open on DB error (documented tradeoff — auth endpoints need the DB anyway) | Acceptable; consider a Sentry alert counter |
| M-13 | Bearer token in `localStorage` (`src/shared/lib/session.ts`) | XSS ⇒ token theft (known accepted tradeoff; CSP + revocable sessions mitigate) | httpOnly cookie migration for v2 |

### 🟢 LOW (selected, all verified)

1. `server/app.ts:110-111` — paymentRouter mounted at both `/api/payments` and `/api` → duplicate route surface; `/api/click` via the second mount isn't in `PUBLIC_PAYMENT_POST` (401s in prod — confusing, not exploitable).
2. `auth.service.ts:942-946` — `changePassword` picks an arbitrary identity (`LIMIT 1`, no `ORDER BY`) for dual-identity users.
3. `auth.service.ts:653-655` — `409 email_taken` on register enables email enumeration (login/reset are enumeration-safe).
4. `admin.router.ts:276-280` — admin "today active" stat uses UTC date while `daily_records.date` is Asia/Tashkent → wrong from 19:00 UTC.
5. `tutor.router.ts:104`, `ai-question-generator.service.ts:90` — Gemini key sent as URL query param (`?key=`) — leaks into proxy logs; use `x-goog-api-key` header.
6. `tutor.router.ts:84-90` — AI quota consumed before question lookup/Gemini success; two `tryConsume` calls aren't transactional.
7. `ai-question-generator.service.ts:172-175` — invalid AI answer key silently rewritten to `A1` instead of dropping the question.
8. `admin.router.ts:132-156` — bulk import non-transactional, JS-computed max-id; partial import on conflict.
9. `promo.router.ts:24-27` — in-memory limiter (N instances = N× brute-force budget); `type` free-form but only `premium_days` semantics exist.
10. `telegram_login_codes`/`link_codes` never cron-cleaned.
11. `src/features/test/TestPage.tsx:218-235` — side effects (sounds, setState of *other* state vars) inside the `setCheatViolations` updater — Rules-of-State violation; double-fires under StrictMode dev.
12. `useDuelConnection.ts:60,236,278` + `TestPage.tsx:509` — hardcoded Uzbek strings/links outside i18n (partially tracked in TODO.md:63).
13. `vite.config.ts:9` — `__APP_VERSION__` = build timestamp → non-reproducible builds.
14. Migration 0037:41 — `idx_payment_orders_order_id` duplicates the UNIQUE constraint's index.
15. `bot.ts:22` — `loginPendingCodes` Map has no TTL timer ("cleaned on use" only); unbounded on a long-lived instance.

### ✅ Verified-clean (explicitly checked, no issues)

SQL injection (all raw SQL is drizzle-parameterized through `executeRows`); `dangerouslySetInnerHTML` (zero occurrences); XSS in email templates (`escapeHtml` + URL host allowlist); CORS config; Click/Stars idempotency (charge-id unique ledger); OTP/link-code/session single-use atomic consumption; answer-key trust boundary (no `correctAnswer` in public `/questions`, post-answer reveal, duplicate replay returns `null`s); WS auth/matchmaking/heartbeat/pause-budget; Tashkent-timezone consistency in streaks/leagues; bot command handlers (LIMIT-bounded, per-command try/catch).

---

## 3. INCOMPLETE / STALLED WORK

**Actively in-flight (uncommitted right now):**

1. **Referral v3** — implementation, tests, i18n, migration 0038/0039 backfill are now mutually consistent (welcome gift at `/init` via `createPending` CTE, referrer reward on phone link), *but* the integration tests will only pass once the phone-ownership gap (H-2) and the `rewardIfPhoneLinked` race (M-2) are addressed; `GET /api/referrals/:userId` still misses `USER_SEGMENTS` (M-3).
2. **SMS campaigns** — schema, service, admin tab, and tests all exist but the feature is mid-write (files appeared during this audit); chunk-dispatch race (M-4) needs the claim-rows fix before the first real campaign.

**Stalled / known-open (from TODO.md, verified still present):**

- H4 ball farming product decision (see H-3).
- Google/Apple OAuth 501 stubs (`auth.service.ts:1070,1080`).
- ~59 hardcoded hex colors violating design rule №8 (`LeaderboardPage.tsx:18-22,63-65` etc.); `SettingsModal` icon colors.
- Modal a11y (no shared Sheet with focus-trap/Escape/`role="dialog"`).
- `App.tsx:79` — `key={location.pathname}` forces full page remount on every navigation (perf + lost component state).
- i18n stragglers: `Profil.tsx`, `useDuelConnection` hardcoded strings.
- xlsx/.docx/PDF import, image-zip upload (SAVOLLAR_IMPORT_TODO.md — all unchecked).

**Backend↔frontend disconnects:** none material found — every backend route traced has a client caller and vice versa (the new `/users/:userId/sms-consent` pairs with the in-flight AdminSmsTab work).

**Test coverage:** 67 test files, CI runs unit+api+integration (real Postgres)+e2e (2 devices) — an unusually good pipeline. But measured coverage is **~18% statements** (`walkthrough.md:41-44`); repositories are nearly uncovered (`auth.repository.ts` 1.5%, `questions.repository.ts` 11%), and `daily`/`achievements`/`analytics`/`dashboard`/`saved`/`settings` modules lack direct tests. `tests/` is excluded from both tsconfigs, so test-file type errors surface only at runtime.

**Progress assessment:**

| Area | Status |
|---|---|
| Core product (auth, questions, tests, progress, duels, payments, promo, admin, leaderboards) | ≈ **90% done and hardened** |
| Monetization correctness | ≈ **60%** (C-1 undermines the whole subscription model) |
| Marketing tooling (broadcast/SMS) | ≈ **50%** (works at small scale; races + 30s-cap truncation) |
| Polish backlog (a11y, colors, i18n stragglers) | ≈ **60%** |

---

## 4. FUTURE FEATURES NEEDED

Ranked by user expectation vs. effort:

1. **Premium expiry handling** (prerequisite fix C-1, then): "subscription ends in N days" warnings + renewal deep-links — `users.service.ts` mapping, `PremiumPage.tsx`, bot reminder. *Why:* without it there is literally no renewal moment.
2. **Push/reminder infrastructure** — Telegram `sendMessage` reminders are only wired for daily streak; add lesson-plan reminders and league-result notifications honoring `userSettings.notificationsEnabled` (the broadcast service already has the targeting segmentation).
3. **Search across questions/lessons** — with 8 subjects and thousands of questions, no search exists. A client-side index over `useQuestionsStore` would avoid backend work; affects `Dashboard.tsx`, new `SearchPage`.
4. **Spaced-repetition dashboard** — SM-2 data (`card_progress`) exists and drives Adaptive mode, but users can't see "due today" counts or forecast; a small `GET /adaptive/:userId/summary` + `AdaptivePage.tsx` card.
5. **Leaderboard season history** — `league_rollover_log` + `tournament_prizes` have all the data; expose "previous winners" in `LeaderboardPage.tsx`.
6. **Export/share results** — result cards as images (canvas) for Telegram sharing; natural virality for a student app; `ResultsModal.tsx`.

**Infrastructure recommendations:** one shared chunked-campaign-dispatch primitive (structurally retires M-4/M-5); a general limiter for admin/analytics; Sentry alerts on 429 spikes and cron-failure counters; `analytics_events` retention job; question-bank ETag/caching for `/api/questions` at the CDN edge (already public — add `Cache-Control`); load-test the Octagon WS path before any growth marketing.

---

## 5. PERFORMANCE AND OPTIMIZATION

1. **`getStats()` loads entire banks to count** — `providers/default.provider.ts:35-41`, `russian.provider.ts:60-63`: `findAll().length` pulls every question row (text+options) into memory; `/api/dashboard` is **unauthenticated** (`PUBLIC_GET`), so this is the app's cheapest DoS amplification. Use `SELECT COUNT(*)` (the 5-min TTL cache is already there).
2. **jsonb array read-modify-write per answer** — `progress.solved_questions`/`correct_questions` (`schema.ts:315-319`) grow per user and are fully rewritten on every answer; fine now, quadratic-ish later. Normalize to a table when a user's set reaches thousands.
3. **League rollover fan-out** (M-7) — the biggest scheduled-load risk on Neon HTTP.
4. **Frontend re-renders are well-controlled** — selector-based zustand subscriptions everywhere checked (`TestPage.tsx:47-55`, `Dashboard.tsx:110-120`); `resolveExamMode` returns stable references so the feared reshuffle doesn't occur (prior-audit H6 is a false positive now). Remaining: `App.tsx:79` full remount per navigation; `content/` (888KB static lessons/questions JSON) ships in the main bundle — lazy-load per subject.
5. **Missing caching:** `/api/questions`/`/api/topics` are public GETs with an in-memory 5-min provider cache only — no HTTP caching headers, so the CDN edge re-hits the function on every cold open.
6. **Bundle:** lazy routes already split per page (`App.tsx:19-42`) — good; the remaining wins are `content/` splitting and dropping the unused `pdf-parse` devDep from install time.

---

## 6. SUMMARY REPORT

### Overall health: **B− (~70%)** — architecture A−, business-logic correctness B−, in-flight work unstable

The engineering discipline here is genuinely rare for this stack: atomic CTEs for nearly every state change, fail-closed security boundaries, type-enforced i18n/config consistency, a real CI matrix with integration DB and e2e, and honest documentation of known limitations. The prior audit's Criticals were competently fixed (verified: outbox chaining, timeout cleanup, account reset, App.tsx side-effects, admin fallback removal, Click fail-closed). What keeps it out of A-range: one **revenue-critical entitlement bug**, several JS-side read-modify-write blocks that bypass the otherwise-disciplined CTE pattern, an unauthenticated-phone→paid-SMS pathway, and a working tree that currently mixes two half-finished features.

### Top 5 priority fixes (in order)

1. **C-1 — make time-limited premium actually expire** (stop writing `tariff='premium'` for `days != null`; one shared `isPremium()` helper; consistency test). One afternoon of work; directly stops permanent-premium-for-one-payment.
2. **H-2 — require OTP possession proof before `users.phone` is persisted** (blocks the SMS-harassment pathway *and* hardens the referral gate the new code depends on).
3. **H-1 — make tournament prizes an awaited, single-CTE, ledger-first flow** (plus M-6's daily-reminder `complete()` fix — same pattern, two lines).
4. **Ship the in-flight referral/SMS work safely:** `AND r.status='pending'` in `rewardIfPhoneLinked` (M-2), `'referrals'` in `USER_SEGMENTS` (M-3), claim-rows dispatch (M-4) — then commit; the tree currently encodes a not-yet-complete design in its tests.
5. **M-9 duel PIN space + M-1 Click zod validation** — cheap hardening of the two externally-reachable abuse surfaces.

### Recommended next steps

1. Fix C-1 and H-2 **before the next marketing push** — every new paying user between now and then is buying lifetime premium at monthly prices.
2. Land the referral v3 + SMS campaign work as separate commits with their tests green, including the three one-line race/IDOR fixes above.
3. Extract the shared chunked-dispatch primitive and retrofit broadcast to it (M-5) — this retires a whole class of timeout/race bugs.
4. Backfill repository-level tests for the payments/promo/referral reward paths (highest-value coverage per line) and add `tests/` to a tsconfig so type errors are caught in CI.
5. Hygiene pass: drop `pdf-parse`, untrack `api/*.js`, merge `index.ts`/`standalone.ts`, fix the `.env.example` bot-username mismatch, and decide the H-4 farming policy (daily credit unique-key is the recommendation, matching TODO.md variant 1).
