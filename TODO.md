# TODO — YHQ Mini App: audit keyingi ishlar (handoff)

> Senior audit natijalari (2026-08-11). Bu fayl keyingi sessiyada davom etish uchun.
> Buyruq: "TODO.md ni o'qib davom et" + istalganda "caveman ishlatib tur".

## ⚠️ BIRINCHI: migratsiya + commit qilinmagan ish

Deploydan OLDIN prod DB'ni migrate qilish SHART:
`DATABASE_URL="$PROD_URL" npx tsx server/migrate.ts` (0028 phone-normalize + 0029 otp attempts + **0030 session token hash** — user'lar logout bo'lmasligi uchun 0030 mavjud sessiyalarni joyida hash'laydi).

Batch 3 (M10/L6 + frontend HIGH) workdir'da, COMMIT QILINMAGAN:
`git status` → server/{config,utils,modules/auth}, migrations/0030*, src/** (outbox, useAppStore, TestPage, SpeedPage, AdaptivePage, useDuelConnection, 14 komponent selector), tests/**, i18n, .env.example, AGENTS.md, TODO.md.

## ✅ Tugatilgan (kontekst)

- **Typecheck:** backend 14 → 0 xato; CI yashil bo'lishi kerak
- **C1** email-auth endpoint'lar public allowlist'da (+ router↔allowlist guard-test)
- **C2** `registerWithEmail` atomik (initAtomic/createIdentity tx param)
- **C3** `server/utils/phone.ts` normalizePhone yagona manba + 0028 data-heal
- **C4** Neon'da driver-level `transactionHttp()` (adopt-merge atomik); drizzle neon-http tx YO'Q — multi-step flow'lar BITTA CTE bo'lishi shart
- **C5** `telegram_login_codes` schema + snapshot 0027/0028 ratifikatsiya (`db:generate` endi ishlaydi)
- **H1** OTP `crypto.randomInt` · **H2** session revoke (reset: hammasi; change: joriydan tashqari) · **H3** `/result` duplicate'da correctAnswer/correct = null · **M8/M3** telefon login lockout + OTP attempts lockout (0029) · **M6** SMS 60s cooldown · **M7** reset email 3/soat (silent skip)
- **Journal tuzatildi:** 0027 bogus `when` 1786450000000 sababli keyingi migratsiyalar skip bo'lardi — zanjir tartiblangan (0028=...460000000, 0029=...470000000, 0030=...480000000)
- Test DB migrate qilingan (0030 ham); integration 64/64, unit 160/160 o'tadi
- **Batch 3 (2026-08-11, 2-sessiya):** M10 (session token sha256 → 0030) + L6 (`OTP_PEPPER` HMAC) + Frontend HIGH 5/5 + `.env.example` to'ldirildi (OTP_PEPPER/GEMINI_API_KEY/CRON_SECRET/TEST_DATABASE_URL)
- Muhit: headroom 0.34.0 (proxy :8787, Task Scheduler), graphify 0.9.39 (skill + `graphify-out/` qurilgan), ponytail OpenCode plugin, context7 ikkala config'da

## 🔴 Qolgan HIGH

### H4 — Ball farming (PRODUCT QARORI TALAB — avval variant tanlang)

Hozir bir savolga cheksiz javob → total_correct/streak/daily_records (liga balli) oshadi. Re-answer LEGIT (xatolar bo'limi, re-test) — to'liq bloklab bo'lmaydi.
Variantlar: 1) kunlik kredit `(user,date,subject,question)` — kuniga 1 marta hisob; 2) faqat `daily_records` dedup (liga himoyasi), wrong_by_ticket erkin; 3) hozircha rate-limit+monitoring.
Joy: `progress.repository.ts` recordAnswer CTE + ehtimol yangi jadval (migratsiya) + security-critical.test.

### ~~Session token hashing (M10)~~ ✅ TUGADI (Batch 3)

`utils/token-hash.ts` (sha256) — hashing `auth.repository` 4 metodida (caller'lar xom token beradi); migratsiya 0030 mavjud sessiyalarni joyida hash'laydi (pgcrypto). L6: `OTP_PEPPER` config'da (zod), `hashOTP` HMAC-SHA256 yoki pepper'siz fallback. Test: unit `token-hash.test.ts` (4), integration auth.test M10 assertion. Eslatma: `telegram_login_codes.session_token` xom qoladi (≤5daq tranzit, single-use) — hujjatlashtirilgan.

### ~~Frontend HIGH (frontend partiyasi)~~ ✅ TUGADI (Batch 3)

1. ✅ **Outbox offline data-loss** — attempts FAQAT server javobida (ApiError) sarflanadi; tarmoq/offline bepul + `navigator.onLine===false` flush'ni umuman o'tkazib yuboradi ('online' eventida davom). Test: `tests/unit/lib/outbox.test.ts` (4).
2. ✅ **TestPage dublikat session-save** — sahifadagi effect o'chirildi, save FAQAT `useTestSession.ts`da.
3. ✅ **Whole-store obuna** — 15 joy (13 fayl) `useAppStore((s)=>s.x)` selector'larga o'tkazildi.
4. ✅ **Fatal 4xx "offline" yutiladi** — `submitAnswer` `{ fatal: true, code }` qaytaradi (outbox'siz); TestPage: xato toast (`submitFailed`, UZ+RU) + tanlov rollback; Speed/Adaptive: reveal'siz o'tish. Test: `tests/unit/store/submit-fatal.test.ts` (3).
5. ✅ **Octagon WS heartbeat** — `useDuelConnection` unmount'da `destroyOctagonSocket()` (faqat phase idle/match_end; searching'da leave_queue'dan KEYIN).

## 🟠 MEDIUM (tanlangan, tartib bilan)

**Backend:**
- Admin savol qo'shish `max(id)+1` race → `INSERT ... RETURNING` yoki serial (admin.router.ts:58)
- `weeklyTop` umumiy scan → filtered join + `CREATE INDEX ON daily_records(date)` (leaderboard.repository.ts:83) — migratsiya bilan
- `achievements` GET write qiladi (ensureExists) → read-only (achievements.router.ts:38)
- `league-rollover` retry-safe emas → rollover journal/period guard (cron.router.ts)
- Octagon: disconnect-grace griefing → o'yinchi boshiga pauza byudjeti/cap; admin CRUD'da `reloadOctagonPools()` (pool staleness)
- Rate limiter multi-instance'da samarasiz → DB/Upstash counter (auth endpoint'lar birinchi)
- Referal mukofotiga referrer CAP (users.service.ts:117) + initReferral catch
- Link/adopt FOR UPDATE Neon'da soxta edi — qisman yengillashtirildi (C4), qolgani CTE-guard'larda

**Frontend/config:**
- SettingsModal ikonkalar hardcoded rangda (qoida №8: neytral #94a3b8); ~59 joyda hardcoded hex (Onboarding, RoundScreen, LeaderboardPage...) → token'lar
- Hardcoded matnlar → i18n: LoginPage.tsx:117,315,347,364,385 (`authTelegramLogin` kaliti BOR ishlatilmayapti!), Profil.tsx:70,93-101, useDuelConnection:48,164,205
- Modal a11y: `role="dialog" aria-modal`, Escape, focus-trap — umumiy Sheet komponent
- `yhq-session` `ACCOUNT_STORAGE_KEYS` ro'yxatiga (account.ts:25) yoki 401 && !initData → session-expired
- `App.tsx:75` key={pathname} remount — faqat CSS transition qoldiring
- Outbox getOutboxCount har render'da JSON.parse (Profil:38) — kesh

**Qurulma/gigiyena:**
- ~~`.env.example`: GEMINI_API_KEY, CRON_SECRET, TEST_DATABASE_URL qo'shish~~ ✅ (Batch 3, OTP_PEPPER bilan birga); `.env`'dagi REDIS_URL o'lik
- ~~`.gitignore`: `*.png` test skrinshotlari + `.playwright-mcp/`~~ ✅ (Batch 3)
- `themes.test.ts`: dark+light bloklarni ALOHIDA assert; `migrations/meta/0001_snapshot.json` yo'q
- Bo'sh test papkalari: tests/unit/lib|middleware|utils (middleware/ endi to'ldi)
- Dead code: ForgotPasswordModal.tsx (faylni o'chirish), SpeedPage.tsx:110 no-op effect, OAuth stub'lar (yoki implement)

**Test qamrovi:** `daily`, `cron`, `achievements`, `analytics`, `dashboard`, `saved`, `settings` modullari testsiz → daily service fake-clock unit + cron endpoint 401/503 integration minimal.

## 🔵 Tooling qoldig'i (ixtiyoriy)

- Ponytail Claude Code uchun: Claude Code sessiyasida `/plugin marketplace add DietrichGebert/ponytail` keyin `/plugin install ponytail@ponytail`
- Serena: `winget install astral-sh.uv` (uvx) keyin `headroom wrap claude` qayta
- SQL graph'lar: `uv tool install --force "graphifyy[sql]"`

## Verifikatsiya buyruqlari (har o'zgarishdan keyin)

```bash
npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.server.json --noEmit
npx vitest run tests/unit
DATABASE_URL="$TEST_DATABASE_URL" npx tsx server/migrate.ts   # test DB (faqat yangi migratsiya bo'lsa)
npm run test:integration
```

Analog audit qayd: AGENTS.md qoida 6 — har bugfix'ga test.
