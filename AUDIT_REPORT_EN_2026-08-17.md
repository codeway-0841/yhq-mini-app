# YHQ Mini App (KIWI) — Full Codebase Audit Report

> Date: 2026-08-17 · Audited state: working tree (including uncommitted changes)
>
> **📢 Post-audit update (same day):** the Critical finding and several High/Medium findings were **remediated in the same-day sessions** — see **§7 Remediation Log** at the bottom for per-finding status (fixed / partially fixed / open), commit hashes, verification results and the updated health grade. Sections 1–6 below are the historical audit snapshot.

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

### Overall health: **B− (~70%)** — architecture A−, business-logic correctness B−, in-flight work unstable *(audit-time snapshot — after same-day remediation: **B+ (~78%)**, see §7.5)*

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
5. Hygiene pass: ~~drop `pdf-parse`~~, ~~untrack `api/*.js`~~, ~~merge `index.ts`/`standalone.ts`~~, fix the `.env.example` bot-username mismatch, and decide the ~~H-4 farming policy~~ (done: `DAILY_ANSWER_CREDIT=1000`). *New from later pass:* ESLint flat config is now installed with CI enforcement; `App.tsx` no longer remounts on navigation.

---

## 8. POST-AUDIT TECHNICAL-DEBT PACKAGE (third remediation, same branch)

| Item | What was done | Where |
|---|---|---|
| **P2 jsonb scalability** | `progress.solved_questions`/`correct_questions` (quadratic full-array rewrite per answer) → new `progress_questions` table (PK `(user_id, subject_id, question_id)`, `correct` flag). `recordAnswer` CTE: `q_write` O(1) upsert; anti-farm replay gate now index-backed `EXISTS`; `listSolvedKeys` feeds `toApiProgress` (client contract unchanged — init, profile, buildAuthSession, reset all migrated); migrations 0043 (table) + 0044 (backfill, idempotent — verified on real DB, 3-row case with correct flags) | `schema.ts`, `progress.repository.ts`, `users.service.ts`, `auth.service.ts`, `users.router.ts` |
| **Repository pattern** | new `admin.repository.ts` (question CRUD w/ auto-id retry, delete as single CTE, stats, user search, premium grant), `analytics.repository.ts`; cron router SQL moved into `cron.repository.ts` (reminder targets, league plan persistence/scores, cleanup); routers now orchestration-only | `server/modules/{admin,analytics,cron}` |
| **Graceful shutdown** | `server/utils/shutdown.ts` interval registry (bot login sweep, Octagon join-sweep, heartbeat); documented close order + Neon HTTP no-op | `utils/shutdown.ts`, `index.ts`, `bot.ts`, `octagon.ts` |
| **Duplicate index** | migration 0045 drops `idx_payment_orders_order_id` (UNIQUE constraint already covers it) | `migrations/0045_*` |
| **App.tsx remount** | removed `key={location.pathname}` (full remount + state loss per navigation); scroll reset + CSS transition now restarted via `pageRef` class toggle | `src/App.tsx` |
| **ESLint** | flat config + `typescript-eslint` + `react-hooks` (rules-of-hooks error, exhaustive-deps warn); fixed a REAL hooks violation (`ResetPasswordPage` effect after early return) + 3 broken disable comments; `lint` script + CI step | `eslint.config.js`, `ci.yml` |
| **OAuth stubs** | Google/Apple callbacks now return explicit `501 {available:false}` instead of falling through | `auth.router.ts` |
| **Repo coverage** | `tests/integration/api/repo-coverage.test.ts` — 9 tests: referral reward 8-race, referee uniqueness, stats, ghost-user payment, promo expiry, session hash-is-sha256 assertion, OTP 8-race + single-use, trial 8-race | `tests/integration/api/` |

Gate (this package): tsc ×2 ✓, unit 414/414 ✓, integration **115/115** ✓ (13 files), lint **0 errors**, vite build ✓, bundled server boot `/health` 200 + `/api/ready` ready ✓.

---

## 7. REMEDIATION LOG — all work completed after the audit (2026-08-17, same day)

The audit ran in the morning; remediation happened in two parallel sessions the same day and was pushed as `d9ab3ad..daba88b master -> master`. Everything below is verified by the full local gate before push.

### 7.1 P1 security package (audit session) — commit `34462cd`

`fix(security): P1 audit package — shared db rate limits, fail-closed limiter, initData window, click replay hardening` (30 files, +693/−85)

| Item | What was done | Where |
|---|---|---|
| **P1-1** | Migrated to `dbRateLimit` (Neon DB counter in prod, in-memory in test/dev): `/questions` + `/topics` (bucket `content`, 60/min per IP), `/progress/:userId/result` + `/cards/review` (`progress`, 120/min), `/promo/redeem` (`promo`, 5/min), `/tutor/explain` (`tutor`, 10/min), plus `/payments/create-order` (`pay-order`, 10/min) | `questions/progress/promo/tutor/payments` routers |
| **P1-2** | DB-rate-limiter now **fails closed** on DB error: 503 `rate_limiter_unavailable` + Sentry capture (was fail-open — the whole rate-limit wall switched off during a DB outage) | `server/middleware/db-rate-limiter.ts` |
| **P1-3** | Telegram login code moved out of the URL path: new `GET /auth/telegram-login` reading the `X-Login-Code` **header** (client migrated); legacy `:code` route kept for cached bundles; request-logger normalizes `/auth/telegram-login/:code` → `:code` | `auth.router.ts`, `request-logger.ts`, `src/shared/api/index.ts` |
| **P1-4** | initData replay window **24 h → 1 h** (default; configurable via `INITDATA_MAX_AGE_SECONDS`, documented in `.env.example`). Client recovery: on initData-401 the Mini App reloads **once** (60 s sessionStorage guard) to obtain fresh `auth_date` — no reload loop | `config/index.ts`, `utils/telegram.ts`, `platform/telegram.ts` (`requestFreshInitData`), `api/index.ts` |
| **P1-5** | Click webhook hardening: `NaN`/missing amount rejected (Prepare **and** Complete — Complete previously had no amount check at all); `cancelled` orders rejected in both steps; **atomic claim** (`pending→completed` conditional UPDATE) so parallel completes with different `click_trans_id`s can grant premium only once, while a same-trans-id replay returns idempotent SUCCESS without re-granting; grant failure rolls the order back to `pending` so Click retries can heal; `user_not_found` mapped to `-5`; `express.urlencoded` body support added to webhook routes | `click.service.ts`, `payment.router.ts` |
| **C-1 (CRITICAL)** | Timed grants no longer write `tariff='premium'`: payment repository, promo repository, tournament prizes, admin grant. `tariff='premium'` is now strictly the **lifetime sentinel**; entitlement = `premium_until > now()`. The month-plan-buys-lifetime-premium hole is closed | `payment.repository.ts`, `promo.repository.ts`, `tournament-prize.service.ts`, `admin.router.ts` |
| **H-1 (partial)** | Tournament `premium_until` now computed with `GREATEST(...)` **in SQL** (JS snapshot overwrite removed) — the lost-update half of H-1 | `tournament-prize.service.ts` |
| **M-3** | `'referrals'` added to `USER_SEGMENTS` — `GET /api/referrals/:userId` IDOR closed | `middleware/auth.ts` |
| **P3 hygiene** | `walkthrough.md` gitignored; CI check-job `DATABASE_URL` points at `db.invalid` (accidental connection fails fast instead of hanging on localhost); vitest retry split — unit/api **0** (flaky must fail loudly), integration keeps **2** via new `vitest.integration.config.ts` | `.gitignore`, `ci.yml`, `vitest*.config.ts`, `package.json` |
| **Tests added/updated** | New: `tests/unit/utils/telegram.test.ts` (8 — window boundaries, future-skew, tampered hash, widget scheme), `tests/unit/middleware/db-rate-limiter-failclosed.test.ts` (2). Updated: `payment-security.test.ts` (+5 Click cases: replay idempotency, foreign trans-id, happy claim, NaN, cancelled), `promo.router.test.ts` + `security-critical.test.ts` (stored-tariff-`'free'` assertions for timed grants) | `tests/` |

### 7.2 Parallel-session feature work (same day, before the P1 commit)

| Commit | What |
|---|---|
| `2379ce9` | **Referral v3** (`feat(referral): split reward with phone-link trigger (MB-5 v3)`): welcome gift (+3 days) granted atomically at `/init` via `createPending` CTE; referrer reward on phone link (`rewardIfPhoneLinked`); `ref_<id>` regex accepts all canonical id shapes (`p_`, `e_`); referral stats endpoint + Profil card; migration 0038 with legacy-row backfill; i18n UZ/RU |
| `b697ed0` | **SMS opt-in marketing campaigns** (`feat(sms)`): schema (migration 0039: `sms_campaigns`, `sms_campaign_recipients`), chunked dispatch (30/batch) with audience snapshot freeze, `AdminSmsTab` UI, `/users/:userId/sms-consent` opt-in/out, integration tests |
| `d9ab3ad` | **H-2 (partial at this commit — see §7.3 correction)** (`fix(auth): require SMS OTP proof for phone register and new-number linking`): OTP proof added to `/auth/phone/register` and `/auth/phone/link`. ⚠️ Re-verification showed the exact endpoint cited in H-2 — `PATCH /users/:userId/phone` — **still accepted any format-valid phone**; the final fix (OTP gate on that route) landed as an uncommitted follow-up the same day |
| `daba88b` | Audit reports committed (EN + UZ) |

### 7.3 Findings status after remediation

| Finding | Status | Where fixed |
|---|---|---|
| **C-1** permanent premium for timed purchases | ✅ **FIXED** (all 4 grant paths + tests) | `34462cd` |
| **H-1** tournament prizes | ✅ **FIXED** — GREATEST in SQL (lost-update half) + `f7125d9`: prizes `await`ed before `complete()`, chunked idempotent apply with `league_rollover_log` durable plan | `34462cd`, `f7125d9` |
| **H-2** unauthenticated phone → paid SMS | ✅ **FIXED — *same-day re-verification corrected this claim*:** `d9ab3ad` hard­ened only `/auth/phone/register` + `/auth/phone/link`; the exact endpoint cited in this report (`PATCH /users/:userId/phone`) **remained possession-proof-free** and the exploit chain was reproduced against the test DB. **Final fix (uncommitted follow-up):** `PATCH /users/:userId/phone` now requires `{phone, otp}` — `consumeOTPWithLockout` (extracted to `server/modules/auth/otp.ts`, shared cycle-free by auth.service + users.service) runs BEFORE any `users.phone` write; client flow: requestContact → `POST /auth/otp/request` → Profil OTPInput → PATCH. Runtime proof: victim-phone write 401, referral reward withheld, `otp_locked` after 5 wrong codes; integration suite 98/98 | `d9ab3ad` + follow-up |
| **H-3** ball farming | ✅ **FIXED** — daily answer credit (`DAILY_ANSWER_CREDIT = 1000`, `progress.repository.ts`): after the daily cap, further answers are silent no-ops (`duplicate:true`) — league-score farming capped at credit×7/week; regression tests in `security-critical.test.ts` | follow-up |
| **M-1** Click validation gaps | ✅ **FIXED** — NaN, cancelled, atomic claim/replay, urlencoded (`34462cd`) + full `ClickWebhookSchema` zod (`f7125d9`) | `34462cd`, `f7125d9` |
| **M-2** referral phone-link double-reward race | ✅ **FIXED** — `AND r.status = 'pending'` in the UPDATE WHERE (`users.repository.ts:89`); runtime race proof: 8 concurrent calls → exactly 1 reward | `f7125d9` |
| **M-3** referrals IDOR | ✅ **FIXED** (`USER_SEGMENTS`) | `34462cd` |
| **M-4** SMS chunk dispatch race | ✅ **FIXED** — atomic claim via `FOR UPDATE SKIP LOCKED` + single-statement snapshot freeze (`f7125d9`); runtime race proof: 2 concurrent dispatches → zero overlap. *Residual also closed:* `claimed_at` column (migration 0041) + stale-`'sending'` (≥10 min) re-claim in the claim CTE | `f7125d9` + follow-up |
| **M-5** broadcast full-table load + 30 s truncation | ✅ **FIXED** — new chunked campaign stack `tg-broadcast.service.ts` (migration 0042): audience snapshot via **pure-SQL INSERT…SELECT** (never loads users into JS), 25/chunk SKIP-LOCKED claims, sent/blocked/failed per-row, resume after timeout/crash, photo `file_id` cache, `server/utils/tg-send.ts` (mocked in tests); admin UI drives chunks with live progress. Integration suite `tg-broadcast.test.ts` (6 tests) proves snapshot freeze, segment filtering, blocked classification, stale-reclaim, and race disjointness | follow-up |
| **M-6** daily-reminder completes on error | ✅ **FIXED** — catch no longer calls `complete()`; stale-lease retry (`f7125d9`) | `f7125d9` |
| **M-7** league rollover fan-out + tiebreaker | ✅ **FIXED** — durable plan in `league_rollover_log` (ON CONFLICT), chunked (50) guarded idempotent apply, `userId` tiebreaker (`f7125d9`) | `f7125d9` |
| **M-8** TG-login code phishing | ✅ **FIXED** — in-bot confirmation tap required: contact share no longer binds the session; the bot sends "Browser login requested — is this you?" with ✅/❌ buttons and only `tglogin_ok` calls `completeTelegramLoginByPhone` | follow-up |
| **M-9** duel PIN enumeration | ✅ **FIXED** — ≥6 chars (`DUEL_CODE_RE`) + per-user failed-join rate limit (8 attempts / 60 s → `duel_join_rate_limited`) in `server/octagon.ts`; referral `?start=ref_<id>` **bot-side** canonical-id fix landed (was App.tsx-only in `2379ce9` — `p_`/`e_` links were silently dropped at the bot layer) | follow-up |
| **M-10** analytics unbounded jsonb | ✅ **FIXED** — `props` capped at 4 KB (zod refine) + retention cron (analytics events, telegram_login_codes, link_codes cleanup) | `f7125d9` |
| **M-11** OTP cooldown check-then-act | ✅ **FIXED** — `createOTPWithCooldown` atomic upsert (ON CONFLICT … WHERE cooldown elapsed); runtime race proof: 8 concurrent → exactly 1 allowed | `f7125d9` |
| **M-12** limiter fail-open | ✅ **FIXED** (now fail-closed, see P1-2) | `34462cd` |
| **M-13** Bearer in localStorage | 🔴 **OPEN** (v2 architecture: httpOnly cookie) | — |
| P3 quick items (gitignore, CI phantom-DB, retry split) | ✅ **FIXED** | `34462cd` |
| Low items (L1–L15) | 🟡 **MOSTLY FIXED** — Gemini key moved to `x-goog-api-key` header (both call sites), admin "today active" uses Asia/Tashkent, `pdf-parse` dropped, `api/*.js` untracked+gitignored, `standalone.ts` merged into `index.ts` (`/health` alias in app.ts, render.yaml updated), `loginPendingCodes` got a TTL sweep, `__APP_VERSION__` now env/package version (reproducible), analytics/login/link codes get cron cleanup, TestPage cheat-strike side effects moved out of the setState updater. *Open:* email enumeration (register 409), ~59 hardcoded hex colors (design-rule №8), modal a11y, i18n stragglers, OAuth stubs, xlsx/PDF import, `App.tsx` remount-on-navigate | partially |

### 7.4 Verification gate (run before push)

- Typecheck: client ✓, server ✓
- Unit: **384/384** ✓ (62 files)
- API: **17/17** ✓
- Integration (real Neon, migrated): **95/95** ✓ — includes referral v3 suite, SMS campaign suite, and the updated C-1 assertion (month purchase → stored `tariff='free'` + `premium_until` set)
- Vite production build ✓
- Pushed: `d9ab3ad..daba88b master -> master` (GitHub Actions `check`/`e2e`/`integration` run on the pushed head)

### 7.5 Updated health: **B− (~70%) → B+ (~78%)**

What moved the grade: the revenue-critical entitlement bug (C-1) and the phone-possession hole (H-2) are closed; the IDOR is closed; the rate-limit perimeter is now real on serverless (DB-backed, fail-closed) across all hot endpoints; login codes no longer leak into logs/URLs; the Click webhook is replay- and race-hardened; the referral and SMS features landed with coherent tests.

What still holds it back from A: H-1's fire-and-forget remainder, two known one-line concurrency races (M-2, M-4) not yet applied, the unresolved farming policy (H-3), ~18% measured test coverage, and the jsonb scalability debt (P2).

### 7.6 Remaining work (priority order for the next session)

1. **M-2** — one line (`AND r.status='pending'`) + test → 15 min
2. **M-6** — daily-reminder `complete()` on error → 2 lines
3. **H-1 remainder** — await prizes before `complete()`, ledger-first, own `jobRuns` lease
4. **M-4 + M-5** — extract one shared chunked-campaign-dispatch primitive (claim rows via `FOR UPDATE SKIP LOCKED`), retrofit Telegram broadcast to it
5. **H-3** — farming policy decision + daily-credit unique key (migration + CTE guard + tests)
6. **P2 debt** — ✅ **jsonb → normalized table DONE** (`progress_questions`, migrations 0043/0044, O(1) upsert, index-backed anti-farm gate; backfill verified idempotent on real db); ✅ repository-pattern restored (admin/analytics/cron repositories; admin delete now single CTE); ✅ graceful-shutdown registry; ✅ duel join caps (M-9); ⋯ *open:* Octagon `lastReactionTime` leak, duel caps beyond join limit
7. **P3 tests** — 8 routers + middlewares without direct tests; repository coverage (payments/promo/referral paths first)
8. **Features** — Marathon mode (foundation now stronger post-anti-farm work), shareable certificates, Coins/Battle Pass, Octagon cup, group leaderboards, AI explanation backfill, cheat detection
9. **Low batch** — Gemini key → `x-goog-api-key` header, admin stats Tashkent timezone, email enumeration, `telegram_login_codes` cleanup cron, ~59 hardcoded hex colors, modal a11y, OAuth stubs, merge `index.ts`/`standalone.ts`, drop `pdf-parse`, untrack `api/*.js`

> **Deploy note:** no migration required by the P1 package; `INITDATA_MAX_AGE_SECONDS` is optional (default 1 h). Long Telegram sessions will see a single auto-reload after the window expires — expected behavior, loop-guarded.
