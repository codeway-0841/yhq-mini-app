# NEON POSTGRESQL EGRESS AUDIT — 1.95 GB / 3 days / 4 users

**Date:** 2026-09-24 · **Scope:** full codebase (server, client, background jobs, Render WS, Vercel lambdas) + live Neon measurements + Vercel production logs · **Status:** READ-ONLY — no code was modified.

---

## 0. Executive summary

The 1.95 GB is **not** caused by user-facing traffic volume. It is caused by **four architectural amplifiers** that each re-read entire question banks (0.6–11.8 MB) from Neon on triggers that fire dozens of times per day:

| # | Cause | Bytes per event | Events/day (est.) | Est. share of 1.95 GB |
|---|---|---|---|---|
| 1 | **Render free-plan sleep/wake → full pool reload of ALL 11 banks** (CRITICAL) | **52.7 MB** | 4–10 wakes + deploys | **~40–55%** |
| 2 | **`GET /api/questions/version` computes md5 by `SELECT *`-ing the whole bank** to return 40 bytes (CRITICAL) | 0.6–11.8 MB | 80–140 launches × ~50–70% cold-miss | **~20–30%** |
| 3 | **`GET /api/questions` full-bank `SELECT *`** on CDN miss / 30-min lambda TTL expiry / `_t` cache-bust (HIGH) | 0.8–13.5 MB | 5–15 | **~5–10%** |
| 4 | **Admin edit → `invalidateCache()` + client `reload()` with `_t=Date.now()`** — guaranteed origin full-bank read per edit (HIGH) | 5–12 MB (+ version bump for all users) | admin sessions on 09-21/22 | **~5–15%** |
| 5 | Everything else (AI scheduler payload reads, russian 5-min TTL, CamAi, cron, keepalive, profile sync) | KB–MB | continuous | **<2%** |

Model check: 0.9 GB (Render) + 0.5 GB (version) + 0.15 GB (questions) + 0.2 GB (admin) ≈ **1.75–2.0 GB — matches the observed 1.95 GB.**

### Measured ground truth (queried from production Neon, 2026-09-24)

```
questions table — 111,132 rows, 52.71 MB total row payload:
  adabiyot_db      23,181 rows  11.78 MB
  onatili_db       16,400 rows   8.08 MB
  history_db       11,728 rows   5.68 MB
  math_db          11,040 rows   5.09 MB
  physics_db        8,880 rows   5.02 MB
  biology_db       10,076 rows   4.82 MB
  english_db       12,957 rows   3.91 MB
  geography_db      7,887 rows   3.73 MB
  chemistry_db      6,734 rows   3.15 MB
  traffic_rules_db  1,249 rows   0.83 MB
  russian_db        1,000 rows   0.61 MB
topics: 2,291 rows / 342 KB · question_explanations: 89,589 rows / 24.75 MB (queried per-question, cached — NOT a driver)
ai_daily_tests: 8 rows / 77 KB · ai_courses: 0 rows · users: 4 · progress_questions: 70 · avatar blobs: 0
```

**Launch frequency (analytics_events `app_open`):** 09-21 = **142**, 09-22 = **84**, 09-23 = **11** launches. The heavy egress days exactly match the heavy launch/admin days.

**Live Vercel production log evidence (pulled via `vercel logs`):**
```
09:57:06  λ GET /api/questions/version   status:200  ms:1238   ← cold lambda re-read + re-hash whole bank
09:58:06  λ GET /api/questions           status:200  ms:270    ← origin hit (λ), not CDN (◇)
09:41:00  λ GET /api/topics              status:200  ms:117
09:56:58  λ HEAD /api/questions/version  status:401  ms:6      ← external prober, negligible
```
`λ` = origin/serverless (touches Neon when caches cold), `◇` = CDN/static. Both `/questions` and `/questions/version` were origin hits.

**Neon `rate_limits` table evidence** (persistent counters): real full-bank fetches happening in prod — `qbank:ip:84.54.71.193 count=3`, plus `content:GET:/api/questions/version` hits from 3 different IPs within hours.

---

## 1. CRITICAL — Render boot/wake reloads all 11 banks: 52.7 MB per event

1. **File:** `server/index.ts:76` → `server/modules/octagon/octagon.engine.ts:159-174`
2. **Line:** `server/index.ts:76` (`loadOctagonPools()`), `octagon.engine.ts:161-162` (loop over all banks)
3. **Query:** 11 × `SELECT * FROM questions WHERE bank_id=$1 ORDER BY id` (via `getProvider(dsId).getAllQuestions()` → `questions.repository.ts:25-33`)
4. **Data transferred:** **52.71 MB** per event (measured; ~58 MB on the wire with protocol overhead). Physics alone 5.02 MB, adabiyot 11.78 MB.
5. **Why it repeats:** `render.yaml:6` = `plan: free` → **Render sleeps the service after 15 min without traffic** (comment at `render.yaml:7-9` acknowledges this). Every wake = full process boot = `loadOctagonPools()`. With 4 sporadic users the service sleeps/wakes many times per day. Every deploy also reloads (3 prod deployments in the last 2 days). Crash → `process.exit(1)` (`server/index.ts:88-91`) → Render auto-restart → another 52.7 MB.
6. **Severity:** CRITICAL
7. **Fix (two parts — do both):**

   **a) Stop the sleep/wake multiplier (ops):** upgrade `yhq-websocket-server` to Render **Starter ($7/mo)** — no sleep, pools loaded once. Free alternative: point an uptime monitor (e.g. cron-job.org) at `https://yhq-websocket-server.onrender.com/health` every 5 min — `/health` (`server/app.ts:103-107`) does **not** touch the DB, so keeping it awake is free.

   **b) Lazy per-subject pools (code)** — boot loads nothing; a bank is loaded only when a duel is actually queued for that subject:

```ts
// server/modules/octagon/octagon.engine.ts — replace boot-time loadOctagonPools
const poolInflight = new Map<string, Promise<QuestionPoolItem[]>>()

export function ensurePool(dsId: string): Promise<QuestionPoolItem[]> {
  const existing = QUESTION_POOLS.get(dsId)
  if (existing) return Promise.resolve(existing)
  let p = poolInflight.get(dsId)
  if (!p) {
    p = getProvider(dsId).getAllQuestions().then((rows) => {
      const pool = rows.map((r) => ({
        id: r.id, correct: r.correctAnswer,
        textUz: r.questionUz, textRu: r.questionRu,
        optionsUz: r.optionsUz as Record<string, string>,
        optionsRu: r.optionsRu as Record<string, string>,
        image: (r.image as string | null) ?? null,
      }))
      QUESTION_POOLS.set(dsId, pool)
      poolInflight.delete(dsId)
      return pool
    })
    poolInflight.set(dsId, p)
  }
  return p
}
```
   Queue join (`joinQueue`) does `await ensurePool(entry.dataSourceId)` before matchmaking; `server/index.ts:76` starts listening immediately without the blocking load. With 4 users playing 1–2 subjects, a wake costs 0–10 MB instead of 52.7 MB.

---

## 2. CRITICAL — `/questions/version` reads the ENTIRE bank to return 40 bytes

1. **File:** `server/modules/questions/bank-version.ts` (+ `questions.router.ts:240-251`)
2. **Line:** `bank-version.ts:67-74` — specifically line **70**: `provider.getAllQuestions()`
3. **Query:** `SELECT * FROM questions WHERE bank_id=$1 ORDER BY id` (full bank, e.g. adabiyot = 11.78 MB) + full topics — just to md5-hash them in JS.
4. **Data transferred:** 0.6–11.8 MB Neon egress per cold computation. **Response is 40 bytes — a ~300,000:1 read-to-serve ratio.** Caught live in prod: `ms:1238` for this endpoint.
5. **Why it repeats:**
   - Client calls it **on every app launch, per active subject** — `src/shared/store/useQuestionsStore.ts:126` → `src/shared/api/index.ts:679-684`. 237 tracked launches in 3 days.
   - CDN cache only **60 s** (`questions.router.ts:90`: `s-maxage=60`).
   - Server cache is a **per-lambda Map with 30-min TTL** (`bank-version.ts:19-20`). Vercel scales lambdas to zero between sparse requests, so most launches hit a cold lambda or an expired TTL → full-bank re-read.
   - Two unsynchronized 30-min clocks (`bank-version.ts:19` vs `questions.repository.ts:11`) can each trigger a full read per window per lambda.
6. **Severity:** CRITICAL
7. **Exact fix — use the already-existing `content_version` counter** (`server/schema.ts:435`, already atomically bumped by admin CRUD at `server/modules/admin/admin.repository.ts:20`):

```ts
// server/modules/questions/bank-version.ts
import { db } from '../../db/connection'
import { questionBanks } from '../../schema'
import { eq } from 'drizzle-orm'

const TTL_MS = 30 * 60_000
const cache = new Map<string, { at: number; v: string }>()

export async function bankContentVersion(provider: QuestionBankProvider): Promise<string> {
  const hit = cache.get(provider.sourceId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v
  // ~50 BAYT — ilgari shu yerda BUTUN bank (0.6–11.8MB) SELECT * qilinib md5 olinardi.
  // Admin CRUD content_version'ni atomik oshiradi (admin.repository.ts:20) —
  // client kesh-invalidation semantikasi o'zgarmaydi (v — opaque string).
  const rows = await db
    .select({ v: questionBanks.contentVersion })
    .from(questionBanks)
    .where(eq(questionBanks.id, provider.sourceId))
  const v = `cv${rows[0]?.v ?? 1}`
  cache.set(provider.sourceId, { at: Date.now(), v })
  return v
}
```
   `hashBankContent` stays (used by tests). `invalidateBankVersions()` stays (called from `questionsRepository.invalidateCache()`, `questions.repository.ts:114-117`). Client needs **zero changes** — it compares an opaque string (`useQuestionsStore.ts:130`).
   **Savings: ~0.5 GB over this 3-day window.**

---

## 3. HIGH — `/questions` full-bank `SELECT *` (incl. `correct_answer`) on every origin hit

1. **File:** `server/modules/questions/questions.repository.ts` + `questions.router.ts`
2. **Line:** `questions.repository.ts:25-33` (`db.select()` = `SELECT *`), served at `questions.router.ts:111-182` (line 177 `provider.getAllQuestions()`)
3. **Query:** `SELECT * FROM questions WHERE bank_id=$1 ORDER BY id` — includes `correct_answer` (stripped only in JS at `questions.router.ts:100-102,181`, **after** Neon already transferred it)
4. **Data transferred:** 0.83 MB (traffic_rules) → 13.5 MB (adabiyot wire) per origin hit.
5. **Why it repeats:**
   - Repo cache is per-lambda, **TTL 30 min** (`questions.repository.ts:11`) — cold lambda or expiry = full re-read. CDN shields for `s-maxage=3600` (`questions.router.ts:77`), but only per region and only until expiry; sparse traffic = frequent cold lambdas.
   - **Guaranteed-miss path:** `api.getQuestions(subject, fresh=true)` appends `&_t=Date.now()` (`src/shared/api/index.ts:690`) — unique URL = CDN bypass (see issue #4).
   - `FULL_BANK_DAILY_CAP=20` (`questions.router.ts:82`) is **observe-only** since the 429 was removed (`questions.router.ts:130-145`) — nothing throttles repeated full-bank origin reads. `rate_limits` shows real prod counters (`qbank:ip:*`).
6. **Severity:** HIGH
7. **Exact fix — column-limit the public path** (octagon keeps its own full select):

```ts
// questions.repository.ts — public payload: correct_answer Neon'dan UMUMAN chiqmaydi
findAllPublic(bankId = 'traffic_rules_db') {
  return cached(`questions:public:${bankId}`, () =>
    db
      .select({
        id: questions.id, bankId: questions.bankId, externalId: questions.externalId,
        questionUz: questions.questionUz, questionRu: questions.questionRu,
        optionsUz: questions.optionsUz, optionsRu: questions.optionsRu,
        image: questions.image, topicId: questions.topicId,
      })
      .from(questions)
      .where(eq(questions.bankId, bankId))
      .orderBy(asc(questions.id)),
  )
},
```
   Router line 177 uses `findAllPublic` and drops `toPublic()`. Bigger win: once issue #2 is fixed, raise repo TTL to 6–12 h — content only changes via admin CRUD, which calls `invalidateCache()` anyway (`questions.repository.ts:114`), so the 30-min TTL is pure waste:

```ts
const TTL_MS = 6 * 3600_000 // admin CRUD invalidateCache() orqali darhol tozalaydi
```

---

## 4. HIGH — Admin edit ⇒ cache invalidation + client `_t` cache-busted full-bank re-download (per edit)

1. **File:** `src/features/admin/components/AdminQuestionsTab.tsx` + `src/shared/store/useQuestionsStore.ts` + `server/modules/admin/admin.router.ts`
2. **Line:** `AdminQuestionsTab.tsx:343` (create), **378** (delete), **406** (bulk import) → `useQuestionsStore.getState().reload()` → `useQuestionsStore.ts:184-187` → `api.getQuestions(subject, /*fresh*/ true)` → `_t=Date.now()` (`api/index.ts:690`). Server side: `admin.router.ts:99,152,186,203` → `questionsRepository.invalidateCache()`.
3. **Endpoint/query:** `GET /api/questions?subject=X&_t=<timestamp>` — unique URL ⇒ **guaranteed CDN miss + cold repo cache ⇒ full-bank Neon read (5–13.5 MB) per single question edit.** Server-side `invalidateCache()` additionally forces the next `/questions` **and** `/questions/version` in that lambda to re-read the full bank, and bumps the version so all 4 users re-download on next launch (via CDN: 1 more origin read per region/bank).
4. **Data transferred:** ~10–25 MB per single edit (admin's own fetch + version recompute + follow-on misses). A 20-edit session ≈ **200–500 MB**.
5. **Why it repeats:** every single CRUD action in the admin UI triggers the global reload. 09-21/22 were heavy admin days (physics import, explanations seed, 3 prod deploys).
6. **Severity:** HIGH
7. **Exact fix — admin UI must not reload the client bank at all:**

```ts
// AdminQuestionsTab.tsx:343 (va 378, 406) — reload() O'RNIGA faqat admin ro'yxatini yangilash:
await refetchAdminList() // mavjud paginated GET /admin/questions?limit=50 — ~80KB
// Client bank yangilanishi AVTOMATIK: keyingi launch'da /questions/version (~40B,
// fix #2 bilan ~50B DB read) farqni ko'rib IDB keshini yangilaydi.
```
   Bonus server-side: `invalidateCache()` is correct, but with fix #2 the version endpoint stops re-reading the bank, so the invalidation cost drops to one content re-read per edited bank instead of two.

---

## 5. MEDIUM — `CamAiPage` fetches the full bank directly, bypassing the IDB version cache

1. **File:** `src/features/camai/CamAiPage.tsx`
2. **Line:** `139` — `const raw = await api.getQuestions(subjectId)`
3. **Endpoint:** `GET /api/questions?subject=X` — full bank, no version pre-check (relies on CDN/browser cache only).
4. **Data:** 0.8–13.5 MB per cold fetch; one origin read per CDN miss per region.
5. **Why it repeats:** every CamAi session start re-fetches; unlike `useQuestionsStore.load()` it never consults IndexedDB, so even same-device repeats can miss the browser cache (WebView cache eviction).
6. **Severity:** MEDIUM
7. **Fix:** route through the store (version-checked, IDB-persisted):

```ts
// CamAiPage.tsx:139
await useQuestionsStore.getState().load(lang, subjectId)   // IDB + version-gated
const raw = useQuestionsStore.getState().questions          // allaqachon xotirada
```

---

## 6. MEDIUM — `russian.provider` cache TTL is 5 min (6× more refetches than every other bank)

1. **File:** `server/providers/russian.provider.ts`
2. **Line:** `8` — `const TTL_MS = 5 * 60_000` (own private Map; **not** cleared by `questionsRepository.invalidateCache()` → also a staleness bug)
3. **Query:** full `SELECT *` of `russian_db` (`russian.provider.ts:25-33`)
4. **Data:** 0.61 MB per refetch × up to 288/day/lambda vs 48 for others.
5. **Why it repeats:** TTL expires every 5 minutes while the lambda lives.
6. **Severity:** MEDIUM (small bank — absolute cost low, fix is one line)
7. **Fix:**

```ts
const TTL_MS = 30 * 60_000 // qolgan provider'lar bilan bir xil (yoki #3'dagi 6h)
```
   …and delete the private cache entirely in favor of `questionsRepository` (it already caches + invalidates correctly), or call `russianProvider.invalidateCache()` from `questionsRepository.invalidateCache()`.

---

## 7. LOW — AI-test scheduler reads full `payload` jsonb hourly just to check slot existence

1. **File:** `server/modules/ai-tests/scheduler.ts` + `ai-tests.repository.ts`
2. **Line:** `scheduler.ts:30` → `ai-tests.repository.ts:77-85` (`SELECT id, subject_id, date, slot, title, payload, created_at`)
3. **Query:** full 45-task payload (with answer keys) — code only reads `t.slot`.
4. **Data:** 24 ticks/day × 2 dates × ≤2 rows × ~10 KB = **~0.5–2 MB/day** (only 8 tests exist today).
5. **Why it repeats:** `TICK_MS = 1h` (`scheduler.ts:24`), forever, even with zero users.
6. **Severity:** LOW
7. **Fix:**

```ts
// ai-tests.repository.ts
getSlotsForDate(subjectId: string, date: string) {
  return db
    .select({ id: aiDailyTests.id, slot: aiDailyTests.slot })
    .from(aiDailyTests)
    .where(and(eq(aiDailyTests.subjectId, subjectId), eq(aiDailyTests.date, date)))
},
// scheduler.ts:30 → const existing = await aiTestsRepository.getSlotsForDate(...)
```
   Same pattern in `GET /api/ai-tests/today` (`ai-tests.router.ts:81` + `getAttemptsForTests` `SELECT *`): select `jsonb_array_length(payload->'tasks')` instead of the whole payload, and only the needed attempt columns.

---

## 8. LOW — Unbounded `listSolvedKeys` on every boot-path call

1. **File:** `server/modules/progress/progress.repository.ts`
2. **Line:** `406-413` — `SELECT subject_id || ':' || question_id FROM progress_questions WHERE user_id=$1` (no LIMIT)
3. **Callers:** `POST /init` (`users.service.ts:146-153`), `GET /auth/me` (`auth.service.ts:143-152`), `GET /profile/:id` (`users.router.ts:60-67`) → **2–3× per launch**, plus `visibilitychange → syncFromServer` on every foreground (`useAppBootstrap.ts:222-224`).
4. **Data:** today 70 rows ≈ ~1 KB. **Grows linearly forever** (5,000 solved ≈ 70 KB × 3 × launches).
5. **Severity:** LOW now, HIGH at scale.
6. **Fix:** cap or redesign (client only needs keys for offline "solved" markers — a per-subject count/hash would do):

```sql
SELECT subject_id || ':' || question_id AS k FROM progress_questions
WHERE user_id = ${userId} ORDER BY answered_at DESC LIMIT 5000
```

---

## 9. LOW (latent) — `GET /api/ai-courses` selects full course payloads to count lessons

1. **File:** `server/modules/ai-courses/ai-courses.repository.ts:136-152` (used at `ai-courses.router.ts:141-166`)
2. `payload` jsonb (50–500 KB/course) is selected, then only `aiCourseLessonCount(c.payload)` is read. No cache, `private, no-store` — **every hub visit = Σ(all payloads)**. 50 courses × 200 KB ≈ 10 MB per page view.
3. **Today:** `ai_courses` has **0 rows** — zero current cost, but this is the next incident the day the feature is used.
4. **Severity:** LOW now / CRITICAL-in-waiting.
5. **Fix:**

```sql
SELECT c.id, c.title, ..., jsonb_array_length(c.payload->'lessons')::int AS lesson_count,
       COUNT(p.id)::int AS completed_lessons
FROM ai_courses c LEFT JOIN ai_course_progress p ON ...
-- payload ustuni SELECT'dan OCHIRILADI
```
   Also delete dead `listMine` (`ai-courses.repository.ts:124-133`) and dead `adminRepository.listQuestionsByBank` (`admin.repository.ts:98-100`, full-bank `SELECT *`, no callers).

---

## 10. LOW — Chatty auth'd origin reads per launch + duplicate dashboard prefetch

1. **Files:** `src/shared/lib/ttl-cache.ts:74-78` (`fetch()` **always** calls the fetcher — TTL only gates `peek()`), `src/features/app/hooks/useAppBootstrap.ts:164-165` (boot prefetch) + `DailyTasksCard.tsx:37` / `BossCard.tsx:46` / `LeaguePreview.tsx:22` (mount refetch).
2. **Effect:** per launch ≈ 2× `GET /coins/tasks` + 2× `GET /boss/state` + 2× `GET /leaderboard?limit=3` + `/init` + `/daily` + analytics — ~8–10 KB-scale Neon round-trips each. Bytes trivial; pointless origin invocations.
3. **Severity:** LOW
4. **Fix:**

```ts
// ttl-cache.ts
fetch(key, fetcher, ttlMs) {
  const hit = this.peek(key)
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.data) // TTL fresh — tarmoqqa CHIQMAYDI
  ...
}
```

---

## 11. INFO — checked and exonerated (no Neon egress problem)

| Item | Verdict |
|---|---|
| `refetchOnWindowFocus` / React Query / SWR | **Not used anywhere** (grep-verified). No focus refetch except §10 profile sync. |
| `useEffect` infinite fetch loops | None found — `failedKey`/`inFlight`/`loaded` guards present (`useQuestionsStore.ts:95,112`). |
| `/api/ready` keepalive (4 min, TestPage) | `SELECT 1` ≈ <200 B (`readiness.ts` + `questions.repository.ts:68-80`, fixed 2026-09-21). KB/day. Byte-trivial (note: it does keep Neon compute awake — a *compute-hours* topic, not egress). |
| Leaderboards (all 5 modes) | All `LIMIT ≤100`, avatar via `(avatar_webp IS NOT NULL)` boolean — blobs never selected. GOOD. |
| `GET /admin/questions` | Paginated (≤200/page, default 50), excludes `correctAnswer`. GOOD. |
| `GET /admin/stats`, `/admin/users` | COUNT-only / `LIMIT 50`, no avatar blobs. GOOD. |
| Coins / payments history | `LIMIT 50–100`, column-subset. GOOD. |
| `GET /api/boss/state` | 4 small queries, top-3 LIMIT. <1 KB. GOOD. |
| `users.findById` | SlimUserRow — `avatar_webp` excluded. GOOD. (Also: 0 avatar blobs exist today.) |
| `POST /progress/result` | Single atomic CTE, ~1 KB response. GOOD. |
| Telegram bot commands | Single-row reads; `/daily` uses COUNT+OFFSET. KB/day. GOOD. |
| Cron daily/weekly suites | Time-predicated DELETEs + aggregates. Full-table id-scans (`leagueWeekScores`, vip-expired) are trivial at 4 users — flagged for scale only. |
| `question_explanations` (24.75 MB!) | Queried per-question, column-limited, 30-min cached (`questions.repository.ts:120-128`). NOT a driver. |
| `GET /api/ticket-catalog` | In-DB md5 dedup scan reads full bank *inside Postgres* but returns only ~60–90 KB of ids — egress small, compute heavy. Optional: cache result per bank. |
| `question-bank-cache.ts` IDB fallback | Design is correct (version-gated). Residual risk: WebViews where IndexedDB is blocked evict → full-bank refetch per launch (client-side, CDN-served — hurts *Vercel* egress more than Neon). |
| `HEAD /api/questions/version` 401s in prod log | External prober/uptime-bot without credentials. ~0 bytes. Ignore or block at edge. |

---

## 12. Vercel / API log analysis

**What was accessible:** `vercel logs` (CLI, authenticated) — Hobby plan retains only a short recent window (fetched 7 entries ≈ last hour). Sample above (§0) already proves both hot endpoints hit origin (`λ`), with `/questions/version` taking **1238 ms** — the signature of a cold-lambda full-bank md5.

**Persistent evidence inside Neon itself:**
- `rate_limits` table: `content:GET:/api/questions/version` (3 IPs within hours), `qbank:ip:*` full-bank counters, `auth:GET:/api/auth/telegram-login count=13` (2 s login polling — bounded, fine).
- `analytics_events`: launch counts per day (142 / 84 / 11) — direct correlation with egress days.
- `audit_logs`: zero `questions_fullbank_abuse` rows — no scraping attack; **the damage is self-inflicted by architecture, not abusers.**

**To get complete per-endpoint attribution (recommended):**
1. Neon Console → your project → **Monitoring → Network transfer** (hourly graph) + enable **`pg_stat_statements`** (`CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`) — then `SELECT query, calls, rows FROM pg_stat_statements ORDER BY rows DESC` gives exact per-query read volume.
2. Vercel Dashboard → yhq-mini-app → **Observability → Logs** (longer retention than CLI) or attach a **Log Drain** for full request history.
3. Render Dashboard → `yhq-websocket-server` → **Events/Logs** — count `Server :8080 (HTTP + WS) — 111132 questions (11 banks)` boot lines; each one = 52.7 MB.

---

## 13. Fix priority plan (ranked by MB saved per line changed)

| Priority | Fix | Effort | Est. savings |
|---|---|---|---|
| P0 | **#2** `bank-version.ts` → read `question_banks.content_version` (~50 B) instead of full-bank md5 | ~15 lines | **~0.5 GB / 3 days** |
| P0 | **#1a** Render Starter plan ($7) or free uptime-ping of `/health` | 0 code | **~0.9 GB / 3 days** |
| P1 | **#1b** Lazy per-subject octagon pools | ~40 lines | makes residual wakes ~0 MB |
| P1 | **#4** Remove `reload()` from AdminQuestionsTab (3 lines) + let version-check do its job | 3 lines | 10–25 MB per edit |
| P2 | **#3** `findAllPublic` column-limit + repo TTL 30 min → 6 h | ~15 lines | ~1 MB/read + fewer reads |
| P2 | **#6** russian provider TTL 5 → 30 min | 1 line | ~0.6 MB × refetches |
| P3 | **#5** CamAi via store; **#7** scheduler `SELECT slot`; **#10** ttl-cache respect TTL | ~20 lines | KB–MB/day |
| P3 | **#8/#9** projection fixes for solvedKeys / ai-courses list | ~10 lines | latent (0 rows today) |

After P0+P1: projected Neon egress ≈ **<50 MB/week** at current usage (a ~40× reduction).
