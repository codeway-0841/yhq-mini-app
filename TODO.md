# TODO — YHQ Mini App: audit keyingi ishlar (handoff)

> Senior audit natijalari (2026-08-11). Bu fayl keyingi sessiyada davom etish uchun.
> Buyruq: "TODO.md ni o'qib davom et" + istalganda "caveman ishlatib tur".

## ✅ 2026-08-21 — 4 yangi FEATURE (user tanlovi) — TUGADI

- **#12 Mavsumiy skin drop** — `shared/shop-items.ts` ga `seasonal:{from,until}` (MM-DD Tashkent oynasi, yillik takroriy) + `isShopItemAvailable/seasonalDaysLeft`; xarid guard 409 `ITEM_SEASON_EXPIRED` (coins.router); 2 ramka (`frame-navruz` 03-01..03-27, `frame-mustaqillik` 08-15..09-03) + CSS + ShopPage "Mavsumiy drop" bo'limi (countdown). Test: unit seasonal + coins integration +2.
- **#11 Lucky Spin** — `shared/lucky-spin.ts` (8 segment, og'irlik=100, EV≈17c/kun byudjet); `daily_spins` jadval (migratsiya 0050, 1/kun atomik claim); GET+POST `/api/coins/spin` (segment FAQAT server crypto RNG; premium yutuq C-1 GREATEST premium_until, audit daily_spins'da — delta=0 ledger'da bo'la olmaydi); `SpinModal` (g'ildirak server segmentiga "qonadi"), ShopPage bo'limi. Integration +2.
- **#2 Belgilar o'yini** — `/belgilar-oyini` CLIENT-ONLY: `src/content/signs-game.ts` (27 SXEMATIK SVG belgi — shakl/fon/ramka/piktogramma; `num` faqat ishonchli raqamlar), `SignIcon`, `game-logic.ts` (sof + rand inject), 2 rejim: Tezkor (60s×4 variant) + Juftlash (6 juft tile); rekordlar localStorage. DIQQAT: `signs.ts` katalogi MOCK — o'yin unga TAYANMAYDI. Test: unit +8.
- **#1 Boss Battle** — `boss_battles`+`boss_damage` (0051), zarar FAQAT /result gate-fresh to'g'ri javob hook'idan (`progress.router`, +5, best-effort+Sentry); `shared/boss-battle.ts` roster (deterministik rotatsiya, HP 200k, ishtirok 10+zarar/25c, top-3 100/60/40); cron `/api/cron/boss-rollover` (dushanba 00:35 UTC, vercel.json, jobRuns retry + ledger `boss:<id>:<user>` UNIQUE → idempotent mukofot; 'escaped' mukofotsiz); Dashboard `BossCard`. Integration `boss.test.ts` +5.
- **MIGRATION DRIFT incident (muhim dars):** drizzle migrator `folderMillis > jurnal MAX(created_at)` sharti bilan ishlaydi — 0048 meta `when`'i KELAJAK sanada edi (1787325600000) → 0049/0050 "Migrations done" deb JIMGINA SKIP bo'lgan. TEST+PROD journalda 0048 `created_at` 1787260000000 ga normallashtirildi + 0049 qatori qo'lda qo'shildi (avatar_webp allaqachon mavjud edi); `migrations/meta/_journal.json` 0048.when ham tuzatildi. Qoida: AGENTS.md №5'ga yozildi.
- **Verifikatsiya:** tsc ×2 ✓, unit 489/489 ✓, integration **153/153** ✓ (real Neon), lint 0 error ✓, vite build ✓. Migratsiyalar 0050+0051 TEST va PROD'da qo'llangan.


## ✅ P1 Xavfsizlik paketi (2026-08-17, audit sessiyasi) — TUGADI

- **P1-1 DB-limiter migratsiyasi:** `/questions`, `/topics` (bucket `content`, 60/min IP),
  `/progress/:userId/result` + `/cards/review` (`progress`, 120/min), `/promo/redeem`
  (`promo`, 5/min), `/tutor/explain` (`tutor`, 10/min), `+/payments/create-order`
  (`pay-order`, 10/min) — hammasi `dbRateLimit`ga o'tdi (Vercel'da in-memory no-op edi).
- **P1-2 fail-closed:** `db-rate-limiter.ts` DB xatosida endi 503
  `rate_limiter_unavailable` + Sentry (fail-open emas). Test: unit failclosed (2).
- **P1-3 login code log'dan chiqdi:** yangi `GET /auth/telegram-login` (kod
  `X-Login-Code` header'da, klient o'tdi); eski `:code` route keshlangan bundle'lar
  uchun qoldi; request-logger `/auth/telegram-login/:code`ni normalize qiladi.
- **P1-4 initData oynasi:** 24 soat → 1 soat (default; `INITDATA_MAX_AGE_SECONDS`
  env). Klient recovery: initData-401 → Mini App 60s guard bilan 1 marta reload
  (`platform/telegram.ts requestFreshInitData`). Test: unit telegram (8).
- **P1-5 Click mustahkamlash:** Prepare/Complete'da NaN amount rad (+test), cancelled
  buyurtma qayta ochilmaydi (+test), ATOMIK claim (pending→completed conditional
  UPDATE) — parallel/replay Complete premiumni ikki marta berolmaydi; xuddi shu
  click_trans_id replay'i idempotent SUCCESS; grant xatosida order pending'ga
  rollback (Click retry davom etadi); `user_not_found` → -5. Webhook route'ga
  `express.urlencoded` ham qo'shildi (form-encoded integratsiya uchun).
- **C-1 (CRITICAL, bonus):** muddatli grantlar endi `tariff`ga TEGMAYDI —
  payment.repo / promo.repo / tournament-prize / admin grant. `tariff='premium'`
  faqat umrbod sentinel. Integration test yangilandi (oylik → stored 'free' +
  premium_until). Tournament'da premium_until endi GREATEST SQLda (H-1 qisman).
- **M-3:** `USER_SEGMENTS`ga `'referrals'` qo'shildi (GET /referrals/:userId IDOR yopildi).
- **P3 gigiyena:** `walkthrough.md` gitignore'da; CI check job DATABASE_URL endi
  `db.invalid`ga ishora qiladi (tasodifiy ulanish tez yiqiladi, localhost'da osilmaydi);
  vitest retry: unit/api 0 (flaky ochiq), integration alohida configda 2.
- **Verifikatsiya:** tsc ikkalasi ✓, unit 384/384 ✓, api 17/17 ✓, integration 95/95 ✓
  (real Neon), vite build ✓.

## ⚠️ Holat: deploy uchun tayyor

Batch 3 commit+push EDILDI (3b2bca0 + c76f9fa). PROD DB 0028→0033 migrate qilingan
(0031 idx_daily_date, 0032 league_rollover_log, 0033 rate_limits). 0028 residue (1 ta
dublikat phone identity, bir xil user'dagi) ham tozalandi — endi 0 taalan qoldiq.

Medium batch workdir'da, COMMIT QILINMAGAN (davomiylik sessiyasi — quyida bajarilganlar).

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
- **Medium batch (2026-08-11, 2-sessiya davomi):** backend MEDIUM 7/8 + frontend/config 4/6 + gigiyena 4/5. Migratsiyalar 0031 (idx_daily_date), 0032 (league_rollover_log), 0033 (rate_limits) — PROD+TEST migrate qilingan. Yangi testlar: cron 3, users/referal 3, ws pauza-byudjet 2, db-rate-limiter 3. Integration: 75/75, unit: 161/161.
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
- ✅ Admin savol qo'shish `max(id)+1` race → `INSERT ... RETURNING` + 23505 qayta urinish (Medium sessiya)
- ✅ `weeklyTop` umumiy scan → filtered subquery join + `CREATE INDEX idx_daily_date` (0031, prod+test'da)
- ✅ `achievements` GET write (`ensureExists`) O'CHIRILDI → read-only (progress yo'q bo'lsa `?? 0`)
- ✅ `league-rollover` retry-safe: REJA jurnali `league_rollover_log` (0032, prod+test'da) + `league = from` guard + catch'da complete YO'Q (stale-lease retry) — kaskad bo'lmaydi. Test: 3 integration (`cron.test.ts`)
- ✅ Octagon: pauza byudjeti o'yinchi boshi (OctagonLimits.pauseBudgetMs=90s; churn'da grace qisqarib forfeit, test 2 ta) + admin CRUD'da `reloadOctagonPools()`
- ✅ Rate limiter multi-instance: `db-rate-limiter.ts` — auth router'ning BARCHA limiter'lari prod'da Neon atomik counter (`rate_limits` 0033), test/dev'da in-memory fallback; cron cleanup tozalaydi. Test: `db-rate-limiter.test.ts` (3). Qolgan limiter'lar (admin/analytics) hali in-memory — zarurat kam.
- ✅ Referal mukofotiga referrer CAP=50 (`REFERRAL_MAX_REWARDED`, CTE'da count gate) + initReferral try/catch (init sindilmaydi). Test: users.test +3
- Link/adopt FOR UPDATE Neon'da soxta edi — qisman yengillashtirildi (C4), qolgani CTE-guard'larda

**Frontend/config:**
- ✅ Hex → token partiyasi (hex-token sessiyasi): SettingsModal ikonkalar `var(--p-subtle)` + color-mix, GridCards/Section `iconColor` default token + color-mix (hex-alpha konkat bekor — `var()26` ishlamaydi!), Carousel/Onboarding/Testlar/Speed/Donut/Statistika/Streak/Profil/LinkAccount/Dashboard/PremiumPage tokenlashtirildi; PasswordStrengthMeter semantik rampa token-asosida; yangi tokenlar: `--p-gold-deep/--p-on-gold/--p-gold-rgb/--p-success-rgb` (+tailwind `pgolddeep`/`pongold`), `.btn-premium-gold` token'li. ISTISNOLAR (hujjatli): subjects.tsx UI_MAP + themes.ts + achievements.ts + content/* (canonical config), Google/Telegram/Click brend ranglari, canvas .ts (var ishlamaydi).
- ✅ Modal a11y — umumiy Sheet (`DialogOverlay`): nested stack (faqat eng yuqori Escape/Tab), body scroll-lock + focus restore, Tab dinamik trap, zIndex/className/backdropClassName — SettingsModal×2/ResultsModal/EditSheets×2/PromoCode/Payment/Belgilar/Celebrations×2/Certificate/ExamReview/CustomRoom/AdminPromo/Users/Questions×2/BulkImport×2/Broadcast/ImageZoom. ISTISNO: AntiCheatModal — `role="alertdialog"` (qasddan Escape/backdrop YO'Q, "Tushundim" majburiy), Darslik fullscreen (sahifa-view, modal emas). Test: `DialogOverlay.test.tsx` 8/8. (2026-08-20)
- ✅ LoginPage i18n (6 matn: `authTelegramLogin` + yangi authCodeExpired/authTelegramNotConfigured/authSmsCodeSent/authBack/authTgSharePhone, UZ+RU). ✅ Profil i18n qoldig'i (2026-08-20): `Profil.tsx` — `guestName` fallback, `resetProgressConfirm`, `profileAddPhoneCta` (Qo'shish), `payHistoryEmpty`, `shareAppText`, `installAppPrompt`/`Unsupported`, `profileNameSaved`, `avatarRemovedToast` + `useAvatarUpload` (`avatarSavedToast`/`avatarUploadFailed`) + `useDuelConnection` (60,236,278: `duelOpponentBack`/`duelConnectError`/`duelAnswerFailed`) — barcha UZ+RU kalitlari qo'shildi
- ✅ `yhq-session` `ACCOUNT_STORAGE_KEYS` ro'yxatida (reset'da eski session ham o'chadi; event'siz — xavfsizlik tahlili bilan, MF-3)
- `App.tsx:75` key={pathname} remount — faqat CSS transition qoldiring
- ✅ Outbox load() raw-string keshi — getOutboxCount har render'da JSON.parse QILMAYDI (MF-2)

**Qurulma/gigiyena:**
- ~~`.env.example`: GEMINI_API_KEY, CRON_SECRET, TEST_DATABASE_URL qo'shish~~ ✅ (Batch 3, OTP_PEPPER bilan birga); `.env`'dagi REDIS_URL o'lik
- ~~`.gitignore`: `*.png` test skrinshotlari + `.playwright-mcp/`~~ ✅ (Batch 3)
- ✅ `themes.test.ts`: DARK va LIGHT bloklar ALOHIDA assert (sakura light-only = shartsiz canonical blok istisnosi hujjatlangan)
- `migrations/meta/0001_snapshot.json` yo'q — MA'LUMOT: hand-made 0001 ni drizzle restore qilib bo'lmaydi; mid-chain snapshot hech qayerda o'qilmaydi (generate=tip, migrate=journal+sql). Soxta qo'lda yasash YO'Q — known-gap sifatida shu yerda hujjatlashtirilgan. AMALDA ZARARISIZ.
- tests/unit/lib/ endi to'ldi (outbox.test.ts); bo'sh: —
- Dead code: ~~ForgotPasswordModal.tsx (o'chirildi)~~, ~~SpeedPage.tsx:110 no-op effect (o'chirildi)~~; OAuth stub'lar (yoki implement — v2 stall)

**Test qamrovi (qolgan):** `daily`, `achievements`, `analytics`, `dashboard`, `saved`, `settings` modullari testsiz → daily service fake-clock unit. ~~cron 401 minimal~~ ✅ (`cron.test.ts`: rollover + auth guard).

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
