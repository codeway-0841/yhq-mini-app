# KIVVI Question Delivery Security v2

> Status: In progress — additive foundation and bounded random client implemented behind a default-off flag  
> Date: 2026-09-07  
> Scope: question-bank bulk extraction protection without degrading normal learning UX  
> Intended reader: senior coding agent or engineer performing audit, design, implementation, and rollout

## 0. Implementation checkpoint (2026-09-07)

Delivered without changing the legacy production path:

- authenticated `test-sessions` create/resume/answer/finish API;
- server-owned random 20/50/100, topic, exam-preset, YHQ mock, and authenticated saved selectors
  (topic is bank-scoped/capped at 100; exam preset is validated against the subject);
- server-side semantic deduplication (text + image + option texts), cached by bank content version;
- six-question rolling delivery window with no master IDs or pre-answer keys;
- HMAC delivery proof bound to user/session/subject/position/expiry;
- ACID attempt + progress/XP/coin commit and exact idempotent response replay;
- bank `content_version` invalidation on runtime admin CRUD;
- private/no-store responses, DB rate limits, expiry cleanup, schema and migrations;
- default-off `VITE_TEST_SESSIONS_V2` client for random 20/50/100 and saved practice with reload resume
  and server-owned 25/30/120-minute deadlines;
- unit, API, and real-Neon integration coverage for the security invariants.

Not yet delivered, so the bank is **not fully protected yet**:

- migration of curated lessons, tickets, mistakes, search, exams, marathon, adaptive, and duel consumers;
- retirement/restriction of public full-bank delivery and the arbitrary legacy result route;
- production migration, secrets, canary enablement, telemetry dashboard, and staged rollout.

## 1. Executive decision

KIVVI must move from **public full-bank delivery** to **authenticated, server-owned test sessions with bounded delivery**.

The primary security invariant is:

> An answer is accepted and its correct option is revealed only when the server can prove that the same authenticated user received that question in the same active test session.

This project is not a rewrite of authentication, progress, question providers, retry/outbox, or Octagon. Existing abstractions remain authoritative unless the audit proves they cannot satisfy the invariant.

The implementation must be incremental, feature-flagged, reversible, and measured. Risk scoring, device intelligence, fingerprints, parametric questions, canaries, and signed media are later layers; none may delay the delivery boundary.

## 2. Why this work is needed

### 2.1 Current strengths that must be preserved

The repository already has important controls:

- `GET /api/questions` strips `correctAnswer` in `server/modules/questions/questions.router.ts`.
- `POST /api/progress/:userId/result` loads the canonical question and validates the selected option server-side.
- `requireSelf` protects user progress routes.
- `clientToken` and `answer_tokens` provide idempotency for duplicate submissions.
- `progress_questions` prevents repeated rewards for an already-correct answer.
- explanations are post-answer gated and use `private, no-store`.
- admin question routes are behind `requireAdmin`.
- Octagon questions, timing, scoring, and winner resolution are server-authoritative.
- the frontend bundle contains no active static question bank; `src/content/questions.ts` is deprecated and empty.

These controls protect scoring better than they protect the content bank.

### 2.2 Confirmed critical attack chain

The current application exposes the following chain:

```text
Anonymous client
  -> GET /api/questions?subject=<subject>
  -> receives every question text, option, numeric question ID, topic ID, and media reference

Authenticated client
  -> POST /api/progress/:userId/result
     { questionId, subjectId, selectedAnswer, freshClientToken }
  -> receives correctAnswer after the submission
```

The result route verifies that the question exists, but it does not verify that the server delivered the question to that user as part of an active test session.

Consequences:

- public full-bank extraction is trivial;
- answer-key extraction needs one authenticated result request per question;
- sequential numeric IDs make automation convenient, although they are not the root cause;
- the current full-bank limit is observe-only and does not stop extraction;
- topic-filtered requests can also enumerate content;
- CDN and service-worker caching deliberately replicate the full public payload.

### 2.3 Existing offline design conflict

`docs/superpowers/specs/2026-08-24-offline-subject-download-design.md` proposes downloading an entire subject together with `correctAnswer`.

That proposal is incompatible with this security objective. Authentication, JavaScript encryption, obfuscation, or Cache API isolation cannot make an answer key secure once it is delivered to an attacker-controlled device.

Before implementing security v2, product ownership must choose one of these explicit policies:

1. **Recommended:** offline packs contain questions only; answers are queued and feedback is shown after reconnect.
2. Offline immediate feedback is allowed for a small, expiring pack, with documented acceptance that its answers are extractable.
3. Full-subject offline answer packages remain supported, and KIVVI explicitly accepts that the corresponding bank cannot be protected from extraction.

The old offline specification must be marked superseded or amended before the legacy full-bank route is retired.

## 3. Goals

### 3.1 Security goals

- Stop anonymous full-bank delivery.
- Prevent arbitrary `questionId` submissions from revealing answers.
- Bind every accepted online answer to user, subject, test session, delivered position, and expiry.
- Keep correct answers and explanations server-only until a valid answer is accepted.
- Make cross-user, cross-session, expired, tampered, and never-delivered submissions fail safely.
- Preserve idempotent retries without duplicating progress, XP, coins, streaks, attempts, or boss damage.
- Make mass extraction attributable to an account/session and observable.
- Protect admin bulk reads and exports.
- Avoid personalized responses entering CDN, browser, or service-worker shared caches.

### 3.2 Product goals

- Normal practice remains perceptibly instant after initial session creation.
- Unlimited practice remains available. Reward/progress caps may remain separate economic controls; they are not content-delivery limits.
- Exam, marathon, ticket, mistakes, saved, adaptive, speed, and topic modes remain functional.
- Resume and reconnect behavior remains reliable.
- Telegram Mini App, Android APK, and browsers use the same API semantics.
- Octagon behavior and latency remain unchanged unless a separately approved design says otherwise.

### 3.3 Operational goals

- Roll out by feature flag and subject/mode cohort.
- Keep a tested kill switch until all consumers are migrated.
- Measure p50/p95 latency, error rate, session completion, retry rate, and security signals before enforcement.
- Avoid one database write for every mere question render unless attribution requirements justify the cost.

## 4. Non-goals for the first release

The following are explicitly out of scope for the critical migration:

- making visible content impossible to copy;
- CAPTCHA for normal learners;
- permanent bans based on speed or IP;
- client-side encryption presented as content protection;
- migrating internal question primary keys from integers to UUIDs;
- rewriting `QuestionBankProvider` implementations;
- replacing authentication sessions;
- replacing `progressRepository.recordAnswer` with a parallel scoring system;
- routing Octagon through HTTP test sessions;
- parametric question generation;
- semantic text variants;
- canary/honeypot content;
- signed media URLs;
- full device-fingerprint or datacenter-IP intelligence;
- a general-purpose policy engine or enterprise RBAC system.

## 5. Mandatory invariants

1. The client is untrusted.
2. The server never accepts a client-provided correctness value.
3. A master question ID is not sufficient authorization to answer or reveal.
4. An unanswered question payload never contains the correct option, explanation, private difficulty data, source metadata, template data, or internal master ID.
5. A delivery proof is bound to exactly one user, session, subject, position, and expiry.
6. A session is owned by exactly one canonical user ID.
7. Cross-user access returns 404 or 403 consistently and reveals no session metadata.
8. The same logical answer retry returns the same canonical result and produces no duplicate side effects.
9. Two concurrent first submissions for the same session position produce one canonical attempt.
10. A crash cannot permanently consume an attempt while losing progress. Attempt persistence and progress effects must be atomic or recoverable through an explicit state machine.
11. Personalized question/session responses use `Cache-Control: private, no-store` and are bypassed by `public/sw.js`.
12. Public cacheable endpoints contain metadata only, never a complete usable question bank.
13. Security analytics failure must not break learning; authentication and ownership validation must never fail open.
14. Existing account switch, Bearer/initData recovery, outbox, and result semantics remain regression-tested.

## 6. Current architecture map

```text
CURRENT

App bootstrap / feature mount
  -> useQuestionsStore.load()
  -> GET /api/questions + GET /api/topics
  -> full subject held in module memory
  -> service worker may cache full public response
  -> feature selects/shuffles questions on client
  -> POST /api/progress/:userId/result with arbitrary questionId
  -> server validates option against DB
  -> progressRepository.recordAnswer()
  -> correctAnswer revealed
```

Primary consumers of the current full-bank store include:

- `src/features/test/TestPage.tsx`
- `src/features/test/hooks/useTestSession.ts`
- `src/features/tickets/Biletlar.tsx`
- `src/features/mistakes/XatolarPage.tsx`
- `src/features/adaptive/AdaptivePage.tsx`
- `src/features/speed/SpeedPage.tsx`
- `src/features/search/SearchPage.tsx`
- `src/features/stats/StatistikaPage.tsx`
- `src/features/lessons/Darslik.tsx`
- dashboard learning components
- parts of `src/features/octagon/OctagonPage.tsx`
- `public/sw.js`

The migration must not assume that replacing `TestPage` alone closes the legacy endpoint.

## 7. Target architecture

```text
TARGET

Authenticated user
  -> POST /api/test-sessions
  -> server validates mode/selector
  -> server stores session policy + deterministic seed/version
  -> server returns bounded question buffer with delivery proofs
  -> client renders current question instantly
  -> POST /api/test-sessions/:sessionId/answers
  -> server validates ownership, state, proof, position, expiry, option
  -> canonical attempt + existing progress effects
  -> response returns feedback + buffer top-up
  -> client continues without an extra question fetch
```

### 7.1 Server-owned selection

The client requests a supported selector, not arbitrary question IDs.

Supported selectors should map to existing product modes:

- `random`: count 20/50/100;
- `exam`: preset ID from `shared/exam-presets.ts`;
- `marathon`: deterministic rolling permutation;
- `ticket`: server-owned ticket ID;
- `topic`: validated topic ID;
- `mistakes`: server reads `progress_questions`/mistake state;
- `saved`: server reads the authenticated user's saved questions;
- `adaptive`: server-owned selection policy;
- `speed`: bounded server-owned pool;
- `single`: a server-authorized entry from search/lesson context.

The API must reject raw client-supplied master question arrays for normal users. Admin/test tooling, if needed, must use a separate privileged route.

### 7.2 Session manifest, not full materialized instances by default

For v2, prefer a scalable session manifest:

- random public session ID;
- canonical user ID;
- subject/data-source ID;
- mode and normalized selector;
- deterministic selection seed;
- question-bank content version;
- total count or rolling policy;
- highest issued position/cursor;
- status;
- created, last-active, and expiry timestamps.

The server derives the master question for a session position from its stored policy, seed, bank version, and provider data. Internal numeric question IDs remain server-side.

This avoids a database insert for every prefetched question. A materialized `question_instances` table may be introduced later only if forensic attribution, per-delivery tracking, or mutable content versions require it.

### 7.3 Delivery proof

Each delivered question includes a short-lived proof bound to:

```text
proofVersion
userId
sessionId
subject/dataSource
position
expiresAt
```

Recommended v2 representation:

- client receives `position`, `expiresAt`, and opaque-looking `deliveryToken`;
- `deliveryToken` is a MAC over canonical server values;
- the token contains no master question ID and no answer;
- the server reconstructs canonical values from the stored session and rejects any mismatch;
- comparison is constant-time;
- secret material is read only through `server/config/index.ts`;
- production secret rollout is completed before enforcement.

The MAC proves integrity and scope. Replay is controlled by the canonical attempt record, not by the MAC alone.

An alternative opaque random token hashed in the database is acceptable only if the team deliberately accepts one write per delivered question. Do not implement both mechanisms.

### 7.4 Question DTO

Example unanswered payload:

```json
{
  "position": 7,
  "deliveryToken": "opaque-value",
  "expiresAt": "2026-09-07T12:00:00.000Z",
  "text": "...",
  "options": [
    { "id": "F3", "text": "..." },
    { "id": "F1", "text": "..." }
  ],
  "media": null,
  "topic": { "id": 42, "name": "..." }
}
```

It must not contain:

```text
masterQuestionId
correctAnswer
correctOptionId
explanation
sourceId/externalId
bankId
internal difficulty/calibration
selection seed
option permutation metadata
generation template
```

Stable internal option IDs may remain `F1`, `F2`, etc. Option order is shuffled server-side per session position. Never score by visible array index.

### 7.5 Answer and top-up endpoint

```http
POST /api/test-sessions/:sessionId/answers
Authorization: Bearer ...
Content-Type: application/json
```

```json
{
  "position": 7,
  "deliveryToken": "opaque-value",
  "selectedOptionId": "F1",
  "clientToken": "uuid-or-existing-client-idempotency-token",
  "elapsedMs": 8200
}
```

Validation order:

1. validate request schema;
2. resolve authenticated canonical user;
3. load session without leaking another user's session;
4. verify session owner, subject, status, and expiry;
5. verify position was issued and is valid for the session policy;
6. verify delivery token and expiry;
7. derive/load the canonical master question server-side;
8. verify selected option belongs to that question;
9. create or load the canonical attempt by idempotency key and session position;
10. calculate correctness server-side;
11. apply existing progress/economy/boss hooks exactly once;
12. persist the canonical response;
13. return feedback plus enough new questions to restore the buffer.

Example response:

```json
{
  "attempt": {
    "position": 7,
    "correct": false,
    "correctOptionId": "F3",
    "duplicate": false,
    "xpEarned": 0,
    "coinsEarned": 0
  },
  "append": [
    { "position": 13, "deliveryToken": "...", "expiresAt": "...", "text": "...", "options": [] }
  ],
  "session": {
    "status": "active",
    "answered": 7,
    "total": 40
  }
}
```

An exact network retry with the same owner and `clientToken` must return the stored canonical attempt response. It must not return a different `correct`/`correctOptionId`, and it must not repeat side effects.

### 7.6 Buffer policy

- Practice default: configurable buffer, initially 6.
- Practice bounds: minimum 3, maximum 12 until production data justifies change.
- Every successful answer response tops the buffer back up, avoiding an extra fetch.
- Exam: the server may issue a larger buffer or the entire selected exam because unanswered answers remain server-only and reliability is more important than hiding a small exam set.
- Marathon: use a rolling deterministic permutation; never materialize the entire bank in the client.
- Resume: return only the active bounded window plus already-answered review metadata required by UX.
- Buffer sizes are configuration, not scattered constants.

### 7.7 Session lifecycle

Required states:

```text
active -> completed
active -> abandoned
active -> expired
```

Rules:

- only active sessions issue new questions;
- completed/abandoned sessions never reveal unanswered answers;
- expiry must allow realistic exam duration and reconnect grace;
- starting a new device session does not silently transfer ownership;
- concurrent sessions are allowed within a conservative configurable limit and initially only observed;
- cleanup is added to the existing cron suite and is idempotent.

## 8. Data model

Exact names may change during audit, but semantics and constraints must remain.

### 8.1 `test_sessions`

Minimum fields:

```text
id                  random UUID/ULID primary key
user_id             FK users(id), indexed
subject_id          registry subject ID
bank_id             resolved data source
mode                 normalized mode
selector             JSONB, server-validated normalized selector
selection_seed       random server value
bank_version         immutable version captured at creation
total_questions      nullable for rolling marathon
issued_through       highest issued position
answered_count       authoritative derived/counter value
status               active|completed|abandoned|expired
expires_at           indexed
created_at
last_active_at       indexed
```

Constraints:

- valid status check;
- non-negative counters;
- `answered_count <= issued_through + 1`;
- subject and bank consistency is validated through `SubjectRegistry` in service code;
- selectors are constructed server-side after zod validation.

### 8.2 `test_attempts`

Minimum fields:

```text
id                  bigserial/UUID primary key
session_id          FK test_sessions(id), cascade delete or retention policy
user_id             FK users(id)
position            integer
question_id         internal FK/reference
selected_option_id  text/nullable for skip if product allows
correct             boolean
client_token        text
result_payload      JSONB canonical response fields required for exact retry
elapsed_ms_client   optional untrusted telemetry
elapsed_ms_server   derived from issued/previous response time where possible
status              processing|completed|failed only if recovery state machine is chosen
answered_at
created_at
```

Required uniqueness:

```text
UNIQUE(session_id, position)
UNIQUE(user_id, client_token)
```

The implementation must define retention. Security telemetry must not become an unbounded permanent event store.

### 8.3 Atomicity decision gate

Before implementation, audit whether the current Neon driver path can pass one transaction object through attempt creation and `recordAnswer`.

Choose exactly one design:

1. **Preferred:** one database transaction creates the attempt, applies progress/economy effects, stores result, and commits.
2. A recoverable state machine where a `processing` attempt can be safely completed by retry/repair without duplicating effects.

Two independent non-recoverable commits are forbidden.

### 8.4 Bank versioning

Deterministic session selection requires stable content during the session. Audit `question_banks` and choose:

- explicit monotonic `content_version` incremented by admin mutations/imports; or
- immutable selected question IDs for bounded sessions; or
- a versioned snapshot mechanism.

Do not silently derive a session from a changed bank and serve a different question for an already-issued position.

## 9. API surface

Required v2 endpoints:

```text
POST /api/test-sessions
GET  /api/test-sessions/:sessionId
POST /api/test-sessions/:sessionId/answers
POST /api/test-sessions/:sessionId/finish
POST /api/test-sessions/:sessionId/abandon   # optional if finish supports status/reason
```

Supporting replacements for full-bank frontend use:

```text
GET /api/question-catalog?subject=<id>          # counts/topics/ticket metadata only
GET /api/question-search?subject=<id>&q=<text>  # paginated, authenticated
```

All new request inputs use zod validation. Handlers use `wrap()` and `AppError`. All user-owned routes perform explicit ownership checks even if global auth middleware also protects them.

### 9.1 Legacy endpoint policy

`GET /api/questions` must not be deleted until every consumer is migrated.

Transition states:

1. Existing behavior while v2 is dark/shadow tested.
2. Auth-required legacy endpoint with explicit telemetry.
3. Legacy endpoint disabled for migrated cohorts/subjects.
4. Legacy endpoint removed after at least one stable release and rollback window.

Do not describe the migration as secure while a production client can still fetch the same complete bank through the legacy route.

## 10. Frontend migration matrix

| Consumer | Current dependency | Required v2 behavior |
|---|---|---|
| TestPage | full `questions[]`, client mode selection | create/resume server session; bounded buffer |
| useTestSession | persists question IDs and client ordering | persist session ID, positions, answers, buffer; server is ordering authority |
| Biletlar | builds tickets from entire bank | load server catalog/ticket manifests; start by ticket ID |
| XatolarPage | resolves mistake IDs from full bank | server-owned `mistakes` selector; fetch bounded review data |
| AdaptivePage | selects from local questions/topics | server-owned adaptive selector; preserve spaced-repetition updates |
| SpeedPage | local question pool | bounded speed session with stricter prefetch tuning |
| SearchPage | searches full in-memory bank | authenticated paginated server-side search; start `single`/review session |
| StatistikaPage | derives counts/topic data from bank | use catalog/analytics aggregates, not question payloads |
| Darslik/LearningGuide | links lessons/topics to question arrays | use topic metadata/counts and server selectors |
| Dashboard | reads question count/store state | use cached catalog count only |
| OctagonPage | partly reads shared store for UI | decouple UI metadata; keep WS engine authoritative and unchanged |
| AdminQuestionsTab | full answer-bearing list | paginated list without answer keys; detail fetch for edit |
| Service worker | caches `/api/questions` | never cache personalized sessions/answers; cache public catalog/static assets only |

Account switch must clear any persisted v2 session belonging to the previous account through the canonical account reset list.

## 11. Admin protection

Current `isAdmin` authorization is acceptable as the starting boundary, but full answer-bearing reads need hardening:

- paginate `/api/admin/questions`;
- omit `correctAnswer` from list responses;
- fetch the full answer only for a single edit/detail operation;
- audit full-answer detail reads, bulk imports, destructive actions, and exports;
- add explicit export endpoint and permission only if export is a real product requirement;
- require recent reauthentication/step-up for bulk export when authentication UX supports it;
- rate-limit by authenticated admin identity, with IP as a secondary signal;
- use `Cache-Control: private, no-store` for every answer-bearing admin response;
- never log imported answer payloads or credentials.

Do not build five-role RBAC merely because the generic threat model lists roles. Add roles only when actual organizational responsibilities require them.

## 12. Caching and offline rules

### 12.1 Cacheable

- subject catalog;
- topic names and counts;
- ticket names/counts without question text;
- public static images/assets where enumeration risk is accepted;
- non-personalized app shell.

### 12.2 Never shared-cache

- test sessions;
- delivered question buffers;
- answer responses;
- explanations;
- mistake/saved/adaptive selections;
- admin answer-bearing responses;
- security/risk state.

Personalized endpoints must set `private, no-store`. `public/sw.js` must explicitly bypass them instead of relying only on response headers.

### 12.3 Offline security truth

If immediate offline correctness is required, the answer key exists on the device and is extractable. Encryption at rest only raises effort; it does not restore the server trust boundary.

The recommended offline v2 flow is:

```text
online -> download small expiring unanswered pack
offline -> answer locally, queue signed session submissions
reconnect -> server validates and returns feedback
```

Offline queue expiry and session expiry need an explicit grace policy. The server must distinguish genuine offline delay from forged client time; client timestamps remain untrusted.

## 13. Observability before risk enforcement

### 13.1 Trusted server-side signals

- sessions created per account/hour/day;
- questions issued per session/account;
- unique questions answered per account/day;
- accepted answers versus issued questions;
- server-observed time between delivery response and answer request;
- concurrent active sessions;
- expired/tampered/cross-user proof failures;
- repeated idempotency retries;
- legacy full-bank access;
- admin answer-detail and export volume.

### 13.2 Secondary/untrusted signals

- client `elapsedMs`;
- question viewed events;
- tab focus/blur;
- coarse device fingerprint;
- IP/network changes.

No secondary signal may independently cause a permanent ban.

### 13.3 Storage strategy

- keep canonical sessions/attempts for the defined retention period;
- aggregate security metrics into bounded hourly/daily rollups;
- write audit logs for anomalies, not every harmless UI event;
- reuse existing `audit_logs`, DB rate limiter, device/session data, and Sentry where appropriate;
- do not overload `analytics_events` with high-volume security events without a retention/cost review.

### 13.4 Rollout states

```text
OFF       no collection/enforcement beyond required session records
OBSERVE   calculate and log signals; no learner-visible action
ENFORCE   progressive response using production-validated thresholds
```

Observe for at least one representative exam cycle or a product-approved period before enabling behavioral enforcement.

## 14. Progressive response policy

Thresholds are versioned configuration, not scattered constants.

```text
NORMAL
  normal buffer and latency

OBSERVE
  additional bounded telemetry only

SUSPICIOUS
  smaller buffer, conservative pacing, session concurrency restriction

HIGH RISK
  temporary cooldown, reauthentication, or manual review
```

Protections:

- never ban solely by IP;
- never ban solely by answering speed;
- allow intensive 500+ question study days;
- account for mobile IP changes, reconnects, Telegram/APK switching, shared school networks, and accessibility tools;
- permanent restrictions require multiple independent signals and a reviewable audit trail.

## 15. Performance requirements

- Baseline current production p50/p95 before changing behavior.
- Session creation and answer p95 must remain within an approved regression budget; use relative baselines before inventing absolute targets.
- A prefetched next question renders immediately.
- One answer request also replenishes the buffer.
- Deep risk analysis never blocks the request path.
- Provider reads continue through `QuestionBankProvider` and existing caching.
- Avoid N+1 database reads per option/question.
- Cold-start behavior is tested with the existing `warmUp()`/keepalive assumptions.
- Exam/reconnect reliability takes precedence over minimizing a buffer from 6 to 3.

## 16. Feature flags and rollback

Suggested flags:

```text
QUESTION_SESSION_V2
QUESTION_SESSION_V2_SUBJECTS
QUESTION_SESSION_V2_MODES
QUESTION_LEGACY_BANK_ENABLED
QUESTION_RISK_OBSERVE
QUESTION_RISK_ENFORCE
```

Rules:

- all environment access goes through `server/config/index.ts`;
- client-visible flags contain no secret;
- server remains authoritative even if the client flag is manipulated;
- flags may target internal users, subjects, or modes;
- rollback re-enables the last compatible read path without reverting a migration;
- schema additions are backward-compatible until legacy code is retired;
- destructive column/table removal is a separate later migration.

## 17. Implementation phases and stop conditions

### Phase 0 — Audit and acceptance baseline

Deliverables:

- current lifecycle diagram with exact file/line evidence;
- confirmed reproduction test for public bank + arbitrary answer reveal;
- consumer inventory;
- current latency/error/retry baseline;
- explicit offline product decision;
- transaction capability decision;
- schema/API proposal updated from audit findings.

Stop condition:

> No production behavior changes. Do not begin Phase 1 until the offline and atomicity decisions are recorded.

### Phase 1 — Server foundation, dark

Implement:

- additive schema and migration;
- test-session module using provider/registry abstractions;
- create/resume/answer/finish contracts;
- delivery proof;
- canonical attempt idempotency;
- existing progress integration exactly once;
- cache headers;
- cleanup/retention;
- unit and real-DB integration tests.

The feature remains unavailable to normal clients.

Stop condition:

> Cross-user, tamper, expiry, replay, concurrency, crash-safety, scoring, and cache tests pass.

### Phase 2 — One vertical slice

Migrate one low-risk practice mode for an internal cohort.

Validate:

- same question count/selection expectations;
- correct/wrong UX;
- retry after lost response;
- resume after app restart;
- account switch;
- Telegram, APK, and browser behavior;
- performance and database cost.

Stop condition:

> No material regression for the cohort and rollback is exercised successfully.

### Phase 3 — Product-mode migration

Migrate in controlled groups:

1. random practice and topic;
2. exam and mock;
3. tickets;
4. mistakes and saved;
5. adaptive and speed;
6. search, stats, lessons, dashboard metadata.

Octagon stays on its existing server-authoritative WS flow; only remove accidental full-bank UI dependencies.

Stop condition:

> Repository search proves no non-admin production consumer needs the legacy full question payload.

### Phase 4 — Close legacy delivery

- make legacy access authenticated during transition;
- stop service-worker caching of question banks;
- disable full-bank delivery for migrated cohorts;
- monitor rollback window;
- remove the endpoint only after compatible clients dominate and old APK policy is resolved.

Stop condition:

> A normal or modified client cannot obtain a complete bank through any non-admin API or shipped static asset.

### Phase 5 — Observe-only detection

- calculate trusted delivery/answer/session signals;
- create security dashboards/queries;
- validate false-positive rates;
- retain no unnecessary raw telemetry.

Stop condition:

> Thresholds are supported by real production distributions, including power learners and shared networks.

### Phase 6 — Progressive enforcement

Enable small-buffer adaptation, pacing, cooldown, and reauthentication one control at a time. Each control needs an independent kill switch and before/after metric.

### Phase 7 — Optional advanced IP protection

Only after evidence shows value:

- materialized question instances;
- option-order fingerprints;
- parametric variants;
- canaries;
- signed media;
- advanced account-farm analysis.

Each is a separate proposal, threat justification, privacy review, and rollout.

## 18. Expected file impact

Audit must confirm final paths. Likely impact:

```text
shared/
  test-session-v2.ts                 shared zod contracts/types if pure and platform-neutral

server/schema.ts                     additive tables/indexes/checks
migrations/*                         generated migration + journal/snapshot
server/config/index.ts               flags and optional delivery secret
server/modules/test-sessions/
  test-sessions.router.ts
  test-sessions.service.ts
  test-sessions.repository.ts
  selection.ts
  delivery-proof.ts
server/modules/progress/*             reuse/refactor only as required for atomic integration
server/modules/questions/*            catalog/search and legacy transition
server/modules/admin/*                pagination/detail/audit
server/modules/cron/*                 expiry/retention cleanup
server/app.ts                         router mount/body/CORS review

src/shared/api/index.ts               v2 API contracts/client
src/shared/store/useQuestionsStore.ts legacy removal or metadata-only replacement
src/shared/store/useTestSessionStore.ts persisted v2 ownership/session state
src/features/test/*                   first consumer
src/features/tickets/*                server ticket catalog
src/features/mistakes/*               server selector
src/features/adaptive/*               server selector
src/features/speed/*                  server selector
src/features/search/*                 paginated server search
src/features/stats/*                  aggregate/catalog data
src/features/lessons/*                metadata-based links
src/features/octagon/*                remove full-bank UI dependency only
public/sw.js                           personalized endpoint bypass

tests/unit/server/test-sessions-*.test.ts
tests/unit/features/test-session-v2-*.test.tsx
tests/integration/api/test-sessions.test.ts
tests/integration/api/question-extraction.test.ts
tests/integration/ws/octagon*.test.ts  unchanged behavior regression
```

Do not edit all files in one phase. Each phase owns the narrowest responsible set.

## 19. Required tests

### 19.1 Security contract

- public/legacy endpoint cannot return a full bank after closure;
- unanswered DTO contains no answer/private fields;
- arbitrary master `questionId` cannot be submitted;
- never-issued position rejected;
- tampered token rejected;
- expired token/session rejected;
- User B cannot use User A session/token/clientToken;
- subject/bank mismatch rejected;
- completed/abandoned session cannot reveal unanswered content;
- list/search pagination bounds cannot be bypassed;
- personalized endpoints have `private, no-store`;
- service worker never stores personalized responses.

### 19.2 Idempotency and concurrency

- same `clientToken` returns identical canonical response;
- duplicate request does not duplicate progress, XP, coin, streak, daily record, boss damage, or audit event;
- two concurrent tokens for one position produce one canonical attempt;
- retry after simulated response loss succeeds;
- crash between attempt and progress cannot leave an unrecoverable state;
- token collision/cross-user conflict fails safely.

### 19.3 Selection correctness

- deterministic seed reproduces the same session ordering;
- no duplicate question in bounded sessions unless mode explicitly allows it;
- exam preset counts match `shared/exam-presets.ts`;
- ticket composition remains stable;
- topic selector cannot escape its topic/bank;
- mistakes/saved selectors only use authenticated user data;
- marathon advances without downloading the whole bank;
- bank version change does not mutate already-issued positions.

### 19.4 Learner scenarios

- 200–500 normal questions without security interruption;
- 500+ fast legitimate questions without false ban;
- wrong/correct/skip/retry flows;
- app close and resume;
- account switch;
- slow network and cold start;
- offline/reconnect according to the chosen policy;
- Telegram WebView;
- production-like Android build;
- desktop/mobile browser;
- exam completion;
- Octagon unchanged.

### 19.5 Abuse scenarios

- rapid session creation;
- continuous issue-without-answer;
- rapid unique question extraction;
- slow scraper;
- multi-account rotation;
- simultaneous sessions;
- repeated invalid/tampered proofs;
- admin bulk reads/exports.

Detection tests must distinguish logging in OBSERVE from blocking in ENFORCE.

## 20. Verification gates

Run the smallest relevant tests during each edit, then the full gates before phase completion:

```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.server.json --noEmit
npm run lint
npm test
npm run build
npm run build:server
```

For real DB integration:

```bash
DATABASE_URL="$TEST_DATABASE_URL" npx tsx server/migrate.ts
npm run test:integration
```

Also perform production-like smoke checks for Web, Telegram, and APK. Do not report those platforms as PASS based only on unit tests.

Migration requirements:

- edit `server/schema.ts`;
- generate migration through the repository command;
- inspect SQL, snapshot, and journal;
- run the migration pre-flight guard;
- verify upgrade from the current production schema;
- verify rollback means disabling behavior, not destructive schema reversal;
- never hand-renumber an existing migration to work around journal drift.

## 21. Definition of done

### Security

- [ ] No non-admin endpoint or static asset returns a complete subject bank.
- [ ] Correct answers are absent from every unanswered payload.
- [ ] Every online answer is bound to a server-issued user/session/position proof.
- [ ] Arbitrary/sequential master IDs cannot reveal content or answers.
- [ ] Cross-user/session access is blocked.
- [ ] Exact retries are idempotent and return the canonical result.
- [ ] Personalized responses are not shared-cached.
- [ ] Admin answer reads/exports are bounded, audited, and non-cacheable.
- [ ] Observe-only extraction telemetry exists with retention limits.
- [ ] Logs contain no credentials, raw session/delivery tokens, secrets, or unnecessary PII.

### UX and compatibility

- [ ] Normal practice has an instant prefetched next question.
- [ ] Unlimited practice works independently from reward caps.
- [ ] Exam, mock, marathon, ticket, topic, mistakes, saved, adaptive, speed, and search flows work.
- [ ] Resume and reconnect work after response loss.
- [ ] Account switching cannot expose the previous account's session.
- [ ] Web, Telegram, and APK are tested explicitly.
- [ ] Octagon behavior and latency remain within baseline.
- [ ] Offline behavior matches the explicit product decision.

### Quality and operations

- [ ] Frontend/server typechecks pass.
- [ ] Lint passes.
- [ ] Unit and real-DB integration suites pass.
- [ ] Frontend/server production builds pass.
- [ ] Security abuse tests pass.
- [ ] Feature flags and rollback are exercised.
- [ ] Production dashboards expose latency, errors, retries, legacy access, and security signals.
- [ ] Remaining extraction limits are documented honestly.

## 22. Explicit remaining risks

Even after completion:

- a user can copy or photograph a visible question;
- a slow automation system can imitate human behavior;
- multiple real accounts can distribute extraction;
- offline immediate feedback exposes whatever answer key is shipped;
- compromised admin credentials may expose privileged content;
- screenshots and manual transcription cannot be prevented technically.

The objective is to make bulk extraction bounded, attributable, detectable, and interruptible without harming legitimate learners.

## 23. Instructions to the implementing coding AI

### First response: audit only

Do not modify code in the first response. Provide:

1. exact current question lifecycle with file and line evidence;
2. confirmed or disproved attack chain;
3. full-bank consumer inventory;
4. existing controls that will be reused;
5. offline-spec conflict and requested product decision;
6. database transaction capability finding;
7. proposed schema/API deltas;
8. migration and backward-compatibility risks;
9. phase-by-phase implementation plan with file ownership;
10. tests and rollback gates.

Do not assume this specification is perfectly synchronized with the repository. Repository code and tests are evidence; discrepancies must be reported before implementation.

### Implementation discipline

- implement one approved phase at a time;
- preserve existing unrelated worktree changes;
- use `QuestionBankProvider`, `SubjectRegistry`, auth, zod validation, `wrap()`, `AppError`, DB rate limiting, audit logs, outbox, and progress abstractions where sound;
- do not create parallel auth, scoring, reward, or analytics systems;
- add regression tests before or with each behavior change;
- keep schema migrations additive and compatibility-safe;
- do not activate enforcement before production observation;
- stop when the phase acceptance conditions pass;
- request a decision when offline policy or atomicity cannot be resolved from the repository.

### Final report format

```text
Changed
  each file and reason

Security before/after
  exact closed attack paths

API
  old and new lifecycle/contracts

Database
  schema, migration, indexes, retention, atomicity

Compatibility
  Web / Telegram / APK / Exam / Octagon / Offline
  PASS, FAIL, or NOT TESTED — never inferred

Tests
  exact commands and outcomes

Metrics
  latency/error/retry/security signal changes

Remaining risks
  honest residual exposure

Production rollout
  flags and OFF/OBSERVE/ENFORCE state

Rollback
  exact kill switch and compatibility path
```

Do not finish with only “Done”.

## 24. Final principle

```text
Do not try to make a visible question impossible to copy.

Make mass extraction:
  bounded,
  account-bound,
  session-bound,
  attributable,
  detectable,
  progressively stoppable.

Keep normal learning fast and quiet.
```
