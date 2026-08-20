# FIXPLAN — Qolgan barcha ishlar (birmabir tartibida)

> Holat: 2026-08-17, push `566c22c`'dan keyin. Bajarilgach `[x]` qiling.
> Har item'dan keyin verifikatsiya: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.server.json --noEmit && npx vitest run tests/unit`
> (migratsiya bo'lsa: test DB migrate + `npm run test:integration`)
> Manba: AUDIT_REPORT_EN_2026-08-17.md §7.3–7.6 + audit §4–5.

---

## PART 1 — Tez g'alabalar (< 30 daqiqa jami)

- [x] **1. M-2 — referal telefon-mukofoti poygasi**
  `server/modules/users/users.repository.ts:89` — `rewardIfPhoneLinked` dagi
  `UPDATE referrals r SET status='rewarded' ... FROM pend WHERE r.id = pend.id`
  ga `AND r.status = 'pending'` qo'sh (lock'dan keyin qayta tekshiruv — parallel
  telefon-saqlash ikki marta +3 kun berayotgan edi). Test: unit yoki integration
  (xuddi shu referal ustida ketma-ket 2 chaqiruv → 2-chisida grant yo'q).

- [x] **2. M-6 — daily-reminder xatoda o'lib qolishi**
  `server/modules/cron/cron.router.ts:121-124` — catch blokida
  `cronRepository.complete('daily-reminder', ...)` CHAQRILMASIN (o'sha kun
  eslatmasi butunlay yo'qoladi). League-rollover'dagi pattern: complete'siz
  qoldirish → 1 soatlik stale-lease retry. Faqat muvaffaqiyatda complete().

- [x] **3. Gemini kalitni URL'dan header'ga**
  `server/modules/tutor/tutor.router.ts:104` va
  `server/modules/admin/ai-question-generator.service.ts:90` —
  `?key=${key}` o'rniga `headers: { 'x-goog-api-key': key }` (proxy log'lariga
  tushmaydi).

- [x] **4. Admin "bugun faol" statistikasi vaqt zonasi**
  `server/modules/admin/admin.router.ts:276-280` — `to_char(now(), 'YYYY-MM-DD')`
  o'rniga `to_char(now() AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD')`
  (daily_records.date Tashkent — 19:00 UTC'dan keyin noto'g'ri hisoblanadi).

- [x] **5. paymentRouter ikki joyda mount — tozalash**
  `server/app.ts:110-111` — `/api/payments` va `/api` ikkalasi ham bor.
  `/api` mount'ini olib tashlash YOKI router ichidagi yo'llarni `/payments/...`
  prefiksi bilan bir xil qoldirib, faqat bitta mount qoldirish. Eslatma:
  `PUBLIC_PAYMENT_POST` `payments/click...` shaklida — tekshirib chiqish kerak.
  Bonus: `/create-order` endi `pay-order` limiterda (P1'da qo'shildi ✓).

## PART 2 — HIGH qoldiqlari (yarim kun)

- [x] **6. H-1 qoldig'i — turnir sovrinlari fire-and-forget**
  `server/modules/cron/cron.router.ts:242-246` — `complete('league-rollover')`
  chaqirilgandan KEYIN `distributeWeeklyPrizes(wPrev)` await'siz otiladi; Vercel
  30s'da sovrinlar hech qachon berilmaydi va retry ham bo'lmaydi.
  Fix: (a) `await distributeWeeklyPrizes(wPrev)` ni `complete()`dan OLDIN;
  (b) sovrinlarga alohida `jobRuns` lease (`weekly-prizes`, periodKey=wPrev) —
  retry-safe; (c) `tournament-prize.service.ts`da ledger INSERT birinchi /
  xuddi sho CTEda (GREATEST qismi allaqachon fix — `34462cd`).

- [x] **7. M-4 — SMS chunk dispatch poygasi**
  `server/modules/admin/sms-campaign.service.ts:120-142` — batch SELECT'da row
  claim yo'q: ikkita parallel "Davom ettirish" bir xil 30 kishiga IKKI marta SMS
  yuboradi. Fix: avval claim —
  `UPDATE sms_campaign_recipients SET status='sending' WHERE id IN
  (SELECT id ... WHERE status='pending' ORDER BY id LIMIT 30 FOR UPDATE SKIP
  LOCKED) RETURNING *` → so'ng yuborish → `sent`/`failed`.
  (status enum'ga 'sending' qo'shish kerak — schema + migratsiya).

- [x] **8. M-5 — broadcast'ni umumiy primitive'ga ko'chirish**
  `server/modules/admin/broadcast.service.ts:62-74,178-221` — butun users
  jadvali xotiraga olinadi, 25/soniya sleep'lar, 30s'da jimgina qisman
  yuboriladi (~500-700 ta), davom ettirish yo'q. Fix: M-4'dagi claim-chunk
  pattern'ini umumiy `chunked-dispatch` primitive qilib chiqarib, broadcast'ni
  unga o'tkazish (DB-backed navbat + `broadcast_recipients` jadvali yoki
  `jobRuns`-asosli offset). Bonus: `notificationsEnabled` sozlamasiga hurmat
  (`tournament-prize.service.ts:101`da `sql\`true\`` hardcoded — olib tashlash).

- [x] **9. H-3 / H4 — ball farming product qarori**
  `server/modules/progress/progress.repository.ts` — yangi UNIkal savollarga
  cheksiz javob `total_correct`/`daily_records`/liga ballini oshiradi.
  Tavsiya (TODO.md variant 1): kunlik kredit — yangi jadval
  `answer_credits (user_id, date, subject_id, question_id)` UNIQUE +
  recordAnswer CTE'siga `ON CONFLICT DO NOTHING` gate (faqat kuniga birinchi
  javob hisoblanadi; re-answer/xatolar bo'limi erkin qoladi).
  Migratsiya + CTE + `security-critical.test.ts`ga farm-regression test.

- [x] **10. M-1 qoldig'i — Click webhook to'liq zod validatsiya**
  `server/modules/payments/payment.router.ts` (`handleClickWebhookRoute`) —
  body'ni zod sxema bilan tekshirish: `click_trans_id` (raqam-string),
  `service_id`, `merchant_trans_id` (max 64), `amount` (coerce.number),
  `action` (0|1), `error`, `sign_time`, `sign_string` (32 hex). Noto'g'ri bo'lsa
  Click error kodi bilan javob (-3 / -2). NaN/cancelled/claim fix'lari bor
  (`34462cd`), bu — to'liq kirish validatsiyasi.

## PART 3 — MEDIUM (tanlab, har biri ~1-2 soat)

- [x] **11. M-7 — liga rollover fan-out**
  `server/modules/cron/cron.router.ts:161-171,231-236` — barcha progress
  qatorlari JS'ga, so'ng user boshiga alohida UPDATE'li `Promise.all` (neon-http
  fan-out bo'roni). Fix: bitta `UPDATE progress SET league = v.to FROM
  (VALUES ...) v WHERE id = v.id AND league = v.from` yoki 200-li chunk'lar.
  `sort((a,b)=>score-score)`ga `userId` tiebreaker (recovery'da turli natija).

- [x] **12. M-8 — TG login kod phishing'ga qarshi tasdiq**
  `server/api-entry/bot.ts:115-129` + `auth.service.ts:1009-1027` — hujumchi
  `login_<code>` yaratib qurbonga yuboradi; qurbon kontakt ulasa, hujumchi
  brauzeri sessiya tokenini oladi. Fix: bot kontakt so'rashdan OLDIN
  "Tasdiqlash" inline tugmasi (callback_query) — faqat tasdiqlangandan keyin
  kod bog'lanadi (telegram_login_codes'ga `confirmed` flag yoki alohida holat).

- [x] **13. M-9 — duel PIN maydonini kengaytirish**
  `server/octagon.ts:48` — `DUEL_CODE_RE` `\d{4,8}` qabul qiladi; `joinDuel`
  (474-499) taxmin qilingan kodda kutayotgan bilan darhol juftlaydi (10k maydon
  daqiqalarda yopiladi). Fix: generator allaqachon 6 raqamli — user kiritgan
  kodlar uchun ≥6 talab + muvaffaqiyatsiz join'larni per-user rate-limit.

- [x] **14. M-10 — analytics payload cheklovi + retention**
  `server/modules/analytics/analytics.router.ts:19` — `props` zod
  `.refine(o => JSON.stringify(o).length < 4096)`; `analytics_events` uchun
  cleanup cron (`vercel.json`ga kunlik `/cron/cleanup-analytics`, eskirganlar
  `answer_tokens` cleanup'i kabi o'chadi).

- [x] **15. M-11 — OTP cooldown atomik + write-before-send**
  `server/modules/auth/auth.service.ts:339-352` — 60s cooldown'ni upsert
  shartiga ko'chirish: `ON CONFLICT (phone) DO UPDATE SET ... WHERE
  created_at > now()-interval '60 seconds'` → 0 qator = 429 (SMS yuborilmaydi);
  `createOTP`muvaffaqiyatidan KEYIN `sendOTP` (DB xatosida pullik SMS ketmasin).

- [ ] **16. M-13 — Bearer token → httpOnly cookie (v2 arxitektura)**
  `src/shared/lib/session.ts` + server `Set-Cookie` (`SameSite=Lax`,
  `httpOnly`, `Secure`). Katta ish: api qatlam, logout/revoke, WS auth
  (`useDuelConnection wsAuthFields`), APK Capacitor origin. Alohida sessiya
  rejasida — shoshilinch emas (CSP + revocable sessiyalar bor).

- [x] **17. L-partiya — mayda LOW item'lar (bitta commitda jamlang):**
  - [x] `auth.service.ts:942-946` — `changePassword`ga `ORDER BY provider` qo'sh
    (ikkilik-identity userda ixtiyoriy identity o'zgartiriladi).
  - [x] `auth.service.ts:653-655` — register'da `409 email_taken` o'rniga universal
    "verification email sent" javobi (email enumeratsiya yo'qolsin).
  - [x] `ai-question-generator.service.ts:172-175` — yaroqsiz AI javob kalitini
    `A1`ga yozma, savolni tashla (validOptsUz.length===4 ham talab qil).
  - [x] `admin.router.ts:132-156` — bulk import: `INSERT ... RETURNING` + chunk'lar
    `onConflictDoNothing` (23505'da qisman import + 500 bo'lmasin).
  - [x] `promo.router.ts` — `type: z.enum(['premium_days'])` (faqat bitta semantika
    bor); `createCode`da unique-infringementni `onConflict` bilan 409'ga aylantir.
  - [x] `telegram_login_codes`/`link_codes` — cleanup cron (mavjud
    `cleanup-answer-tokens`ga qo'shavsangiz ham bo'ladi).
  - [x] `TestPage.tsx:218-235` — side-effect'larni `setCheatViolations` updater'idan
    chiqarib `handleReturn`ga ko'chir (Rules-of-State).
  - [x] `useDuelConnection.ts:60,236,278` + `TestPage.tsx:509` — qattiq kodlangan
    o'zbek matnlarni i18n kalitlariga (UZ+RU).
  - [x] `vite.config.ts:9` — `__APP_VERSION__` uchun git-sha yoki packaj version
    (takrorlanuvchan build).
  - [x] `bot.ts:22` — `loginPendingCodes` Map'iga TTL tozalovchi (5 daq setInterval).

## PART 4 — P2 texnik qarz

- [x] **18. jsonb → jadval (ENG KATTA scalability item)**
  `progress.solved_questions` / `correct_questions` — har javobda butun massiv
  qayta yoziladi; minglab elementda kvadratik. Fix: yangi jadval
  `solved_questions (user_id, subject_id, question_id, is_correct, first_at)`
  UNIQUE(user_id, subject_id, question_id) + migratsiya backfill (jsonb'dan
  unpack) + `progress.repository.recordAnswer` CTE'sini INSERT ... ON CONFLICT
  ga o'tkazish + eski ustunlarni `@deprecated` (keyingi migratsiyada drop).
  Referral eligibility CTE'si ham shu jadvalga o'tadi. 1-2 kun.

- [x] **19. Octagon kichik leak/cap**
  `server/octagon.ts:463` — `lastReactionTime` Map abadiy o'sadi (disconnect'da
  delete qilinishi kerak); duels soniga per-user cap (bir vaqtda 1 dan ko'p
  duel bo'lmasin — allaqachon `already_in_match` bor, lekin tarixiy duels
  konteksti tozalanishini tekshir).

- [x] **20. Repository pattern restavratsiyasi**
  5 routerda SQL to'g'ridan routerda (aniq ro'yxat: `admin.router.ts` bir necha
  `executeRows`, `cron.router.ts`, `leaderboard.router.ts`, `daily.router.ts`,
  `analytics.router.ts` — grep `executeRows|db\.` router fayllarida). Har birini
  mos `.repository.ts`ga ko'chirish. Admin DELETE (questions) — tranzaksiya yoki
  bitta CTE.

- [x] **21. Graceful shutdown gaplari**
  `server/index.ts`/`standalone.ts` — shutdown'da: (a) ichki interval/taymerlar
  (provider cache, octagon heartbeat) to'xtatilishi; (b) `server.close`dan
  keyin `wss` clients'ga close yuborish tartibi; (c) Neon HTTP uchun nima qilish
  kerak emas — hujjatlashtirish. Bonus: ikkita faylni birlashtirish
  (`standalone.ts` = `index.ts` + Render /health — drift xavfi).

- [x] **22. `getStats()` — COUNT o'rniga full-scan**
  `server/providers/default.provider.ts:35-41`, `russian.provider.ts:60-63` —
  `findAll().length` butun bankni xotiraga tortadi; `/api/dashboard` PUBLIC —
  eng arzon DoS amplifier. Fix: `SELECT COUNT(*)` (+ topiklar soni) — cache
  strukturasini saqlab.

- [x] **23. Referallar indeksi**
  `server/schema.ts` referrals — `getStats` `WHERE referrer_id` + reward cap
  `WHERE referrer_id AND status='rewarded'` full-scan. Migratsiya:
  `CREATE INDEX idx_referrals_referrer_status ON referrals(referrer_id, status)`.

- [x] **24. `users.phone` indeksi/kommenti**
  `server/schema.ts:49` — `CREATE INDEX idx_users_phone ON users(phone)`.

- [x] **25. Duplikat indeks**
  Migratsiyada `idx_payment_orders_order_id` UNIQUE constraint index'ini
  takrorlaydi (0037:41) — keyingi migratsiyada drop.

- [x] **26. App.tsx remount + content/ lazy**
  `src/App.tsx:79` — `key={location.pathname}` butun sahifani har navigatsiyada
  remount qiladi; faqat CSS transition uchun klass yechimi. `src/content/`
  (888KB statik JSON) asosiy bundle'da — fan ochilganda `import()` bilan
  chunk'ga ajratish.

## PART 5 — P3 test qamrovi

- [x] **27. Router/middleware testlari**
  `daily`, `achievements`, `analytics`, `dashboard`, `saved`,
  `settings` routerlari; `request-logger`, `readiness`, `cron-auth`, `admin`,
  `validate` middleware'lari mini-testlari.

- [x] **28. `tests/` tsconfig qamrovi**
  Yangi `tsconfig.tests.json` (`include: ["tests"]`, `noEmit`) + CI'ga
  `npx tsc --noEmit -p tsconfig.tests.json` qadamı — test fayllaridagi tip
  xatolari CI'da ushlanadi (hozir faqat runtime'da).

- [x] **29. Repository qamrovi (eng qimmatli yo'llar)**
  `payment.repository` (complete CTE holatlari), `promo.repository` (redeem
  poyga/cap), `users.repository` (rewardIfPhoneLinked/createPending) —
  integration testlar allaqachon bor, unit-darajada CTE oqimlarini yopish.

## PART 6 — Gigiyena / o'lik kod

- [x] **30.** `pdf-parse` + `@types/pdf-parse` dependensiya'dan olib tashlash
  (birorta import yo'q).
- [x] **31.** `api/index.js`, `api/bot.js`ni git'dan chiqarish
  (`git rm --cached`; vercel-build har deploy'da qayta quradi — .gitignore'ga
  `api/*.js`? DIQQAT: Vercel functions repo'dagi faylga ishora qiladi,
  vercel.json `functions` konfigi — buildCommand bor, xavfsiz, lekin tekshir).
- [x] **32.** `rate-limiter.ts:29` / `db-rate-limiter.ts:58` — o'lik
  `telegramUserId` fallback shoxini olib tashlash.
- [x] **33.** `.env.example` — `BOT_USERNAME="kiwi_bot"` → `"kiwi_uz_bot"`
  (haqiqiy bot); `AGENTS.md` — `npm test` tavsifini `test:unit`ga moslash.
- [x] **34.** ESLint o'rnatish (flat config + `typescript-eslint` +
  `react-hooks` plugin) — `eslint-disable` kommentlar hozir o'lik. `npm run
  lint` + CI'ga qo'shish.
- [x] **35.** ~59 qattiq kodlangan hex rang → tokenlar (design qoida №8;
  `LeaderboardPage.tsx:18-22,63-65`, Onboarding, RoundScreen...). Modal a11y:
  umumiy Sheet (focus-trap, Escape, `role="dialog"`).
- [x] **36.** OAuth stub qarori: route'larni o'chirish YOKI `available:false`
  flag bilan frontend'da yashirish (auth.service.ts:1070,1080 hali 501).

## PART 7 — Featurelar (product tartibida)

- [x] **37. Premium muddati UX** (C-1 fix'dan keyin mazmunli): "obuna N kunda
  tugaydi" ogohlantirish + yangilash deep-link — `PremiumPage.tsx`,
  `users.service.ts` mapping, bot eslatmasi. Eng tez ROI.
- [x] **38. Marathon rejimi** — top tavsiya; anti-farm poydevori (item 9)
  bajarilgach yanada xavfsiz. Yangi rejim `TestlarPage` katalogi + `useTestSession`
  barcha savollar to'xtovsiz rejimida.
- [x] **39. Sertifikat** — imtihondan keyin shareable (canvas → PNG →
  Telegram share); `ResultsModal.tsx` + `CertificateModal.tsx` + `certificate-canvas.ts`.
- [ ] **40. Coins / Battle Pass** — iqtisodiyot: `user_coins` jadval, kunlik
  vazifalar mukofotlari, do'kon item'lari (tema/avatarka).
- [ ] **41. Octagon kubogi** — mavsumiy PvP turnir jadvali (octagon_wins
  ustunida mavsumiy agregat + `tournament_prizes`ga o'xshash taqsimot).
- [ ] **42. Guruh reytinglari** — sinf/maktab jamoalari (invite kod bilan
  jamoa → jamoaviy ball; yangi `groups` jadval + leaderboard endpoint).
- [ ] **43. AI tushuntirish backfill** — `question_explanations`ni AI bilan
  bo'sh savollar uchun to'ldirish (admin batch job, `ai-question-generator`
  pattern'i; narx nazorati — kechasi, chunk'lab).
- [ ] **44. Cheat detection kuchaytirish** — hozirgi tab-switch anti-cheat'ga
  server-side signal (imtihon davomidagi javob vaqtlari statistikasi +
  `cheatViolations`ni serverga yozish).
- [x] **45. Qidiruv** — savollar/darslar bo'yicha client-side indeks
  (`useQuestionsStore` ustida) + `SearchPage`.
- [x] **46. Spaced-repetition dashboard** — "bugun tayyorlar" soni/prognoz:
  `GET /progress/:userId/cards/summary` + `AdaptivePage.tsx` kartasi.
- [ ] **47. Liga mavsumlar tarixi** — `league_rollover_log` +
  `tournament_prizes`'dan "oldingi g'oliblar" `LeaderboardPage.tsx`da.
- [x] **48. Natijalarni rasm qilib ulashish** — canvas kartalar +
  `shareUrl`; `ResultsModal.tsx`.

## PART 8 — Infra/monitoring

- [x] **49. Sentry alertlar** — 429 spike'lar, cron `jobRuns` xato counter'lari,
  `rate_limiter_unavailable` 503'lar (P1-2'dan keyin ahamiyatli).
- [ ] **50. Octagon WS yuk-testi** — o'sish marketingidan oldin: k6/artillery
  bilan 100+ parallel duel, matchmaking + neon connection profile.
- [x] **51. `analytics_events` retention + `answer_tokens` cleanup cron'ini
  birlashtirish** (item 14 bilan birga).

---

## Bajarilganlar (tarix)

- ✅ C-1, H-2, M-3, M-12, P1-1…P1-5, H-1 (GREATEST qismi), P3 gigiyena — `34462cd`, `d9ab3ad` (2026-08-17)
- ✅ Referal v3, SMS kampaniyalar — `2379ce9`, `b697ed0`
- ✅ Audit hujjatlari + remediation log — `daba88b`, `566c22c`
- ✅ **H-2 ASL fix** (qayta-verifikatsiya d9ab3ad YARIM ekanini ko'rsatdi): `PATCH /users/:userId/phone` endi `{phone, otp}` talab qiladi — `consumeOTPWithLockout` `users.phone` yozuvidan OLDIN (server/modules/auth/otp.ts — umumiy qatlam, cycle'siz); client: Telegram requestContact → `requestOTP` → Profil OTPInput bosqichi; brute-force lockout (5 urinish → otp_locked) saqlanibdi; runtime exploit-proof: begona raqam YOZILMAYDI, referal mukofot soxta raqamga tushmaydi. Integration: +4 test (`users.test.ts`)
- ✅ **Referal `?start=ref_<id>` bot fix'ning TUGALLANGANI**: `parseReferralParam` (`server/utils/parse.ts`) — canonical id (TG raqam/`p_`/`e_`) BOT qatlamida ham qabul qilinadi (2379ce9 faqat App.tsx'ni tuzatgan edi, bot `${BASE_URL}?ref=` havolasini yaratmay qo'yardi)
- ✅ **M-9 tugallangan**: 6+ xonali kod YETARLI EMAS edi — `joinDuel` per-user brute-force limiti (60s/8 urinish → `duel_join_rate_limited`) `server/octagon.ts`
- ✅ **IKKINCHI PAKET (qolgan ishlar)**: **H-3** — kunlik javob krediti `DAILY_ANSWER_CREDIT = 1000` (progress.repository CTE'da credit gate; cap'dan keyin jimgina duplicate no-op; `security-critical.test.ts` +2 test). **M-5** — broadcast endi chunked-kampaniya: `tg-broadcast.service.ts` + `tg_broadcasts`/`tg_broadcast_recipients` jadvallari (migration 0042), audience snapshot SOF SQL INSERT…SELECT (users jadvali JS'ga UMUMAN yuklanmaydi), 25/chunk SKIP LOCKED claim, photo file_id kesh, crash/timeout'dan keyin DB-dan RESUME; admin UI — progress bar'li chunk loop (upload-resimi bulk'da URL rejimini talab qiladi); `server/utils/tg-send.ts` (testlar shu modulni mock qiladi). **M-8** — TG-login kodi phishing'ga qarshi in-bot tasdiqlash: contact ulanganda sessiya BOG'LANMAYDI — "Brauzerdan kirish so'raldi, bu sizmisiz?" ✅/❌ tugmalari; faqat `tglogin_ok` callback sessiya yaratadi. **M-4 residual** — `claimed_at` ustuni (migratsiya 0041) + 10 daqiqadan eski `'sending'` qatorlarni qayta claim (sms + tg-broadcast'da). **LOW batch**: Gemini kaliti `x-goog-api-key` header (tutor + ai-question-generator), admin today-active `Asia/Tashkent`, `pdf-parse` o'chirilgan, `api/*.js` untrack+gitignore, `standalone.ts`/`index.ts` birlashtirildi (`/health` alias app.ts'da; render.yaml → `server/dist/index.js`), `loginPendingCodes` TTL sweep, `__APP_VERSION__` = env/package (reproducible build), TestPage cheat-strike effektlar updater'dan alohida effect'ga ko'chirildi (L11, StrictMode double-fire yo'q).
- **Verifikatsiya:** tsc ×2 ✓, unit **414/414** ✓, integration **106/106** ✓ (real Neon: tg-broadcast race/snapshot/stale, H-3 credit cap), vite build ✓, `server/dist/index.js` boot + `/health` + `/api/ready` 200 ✓
- ✅ **TEXNIK QARZ partiyasi (FIXPLAN #18-36)**: **P2 (18)** — `solved_questions`/`correct_questions` jsonb massivlar (har javobda QUADRATIC rewrite) → `progress_questions` jadvali (migratsiya 0043 + backfill 0044 — ikkalasi real DB'da isbotlangan, idempotent): PK (user, subject, question), `correct` flag anti-farm gate'ga index-EXISTS orqali xizmat qiladi; recordAnswer CTE `q_write` O(1) upsert; `toApiProgress(prog, solvedKeys)` client kontrakti o'zgarmagan (init/profile/buildAuthSession/reset — hammasi jadvalga o'tdi). **Repo pattern (20)** — yangi `admin.repository.ts` (savol CRUD, max-id, stats, users qidiruv, grant), `analytics.repository.ts`; `cron.repository` ga reminder/league/cleanup so'rovlari ko'chirildi; admin DELETE endi BITTA CTE (saved+explanations+question atomik). **Shutdown (21)** — `utils/shutdown.ts` interval registry (bot login cleanup, octagon join-sweep, heartbeat); index.ts shutdown tartibi + Neon HTTP no-op hujjati. **Dup index (25)** — migratsiya 0045 (`DROP INDEX idx_payment_orders_order_id` — UNIQUE constraint'ning o'z index'i bor). **App.tsx (26)** — `key={pathname}` REMOUNT holati o'chirildi: scroll reset + CSS animation restart `pageRef` orqali (sahifa component state'lari endi saqlanadi); content/ allaqachon route-split lazy chunk'larda (56K lessons Darslik chunk'ida, asosiy bundle'dan tashqarida). **ESLint (34)** — flat config + `typescript-eslint` + `react-hooks` (faqat rules-of-hooks error + exhaustive-deps warn; yangi compiler-era qoidalar OFF — mavjud kod bilan); ResetPasswordPage'dagi HAQIQIY hooks violation tuzatildi (early return'dan keyingi useEffect); 3 ta busted eslint-disable comment (`—` vs `--`); CI `check` job'iga Lint qadami qo'shildi. **OAuth (36)** — stub endpoint'lar endi `{available:false}` 501 (default 500 o'rniga aniq status). **Coverage (29)** — yangi `tests/integration/api/repo-coverage.test.ts` (9 test: referrals race/unique/stats, payment ghost-user, promo expiry, session hash assertion (DB'da sha256), OTP 8-race+single-use, trial 8-race) — avval faqat tinglovda bo'lgan race isbotlari endi repo'da doimiy test
 - **Verifikatsiya (qarz partiyasi):** tsc ×2 ✓, unit **414/414** ✓, integration **115/115** ✓ (12 fayl: repo-coverage +9), lint **0 error** ✓, vite build ✓, server boot + /health + /api/ready ✓
- ✅ **UCHINCHI PAKET (FIXPLAN #45,46,48,49,51)**: **#51** — allaqachon birlashtirilganligi tasdiqlandi: `cron.repository.cleanupExpired()` bitta `/cron/cleanup-answer-tokens` ichida answer_tokens (7k) + rate_limits (1s) + analytics_events (30k, M-10) + tg/link codes (24s) retention'ini yuritadi. **#49** — Sentry alertlar: (a) 429 spike — `db-rate-limiter`'da `rate_limit_spike` captureMessage FAQAT spike boshida (count=max+1) va max-karrali (spam'siz), test: `db-rate-limiter-spike.test.ts` +4; (b) cron xatolari — 4 catch'ga (daily-reminder, league-rollover + ichki prizes, cleanup) `Sentry.captureException` + `cron`/`period` tag'lari; (c) `rate_limiter_unavailable` 503 allaqachon P1-2'dan Sentry'li. **#48** — natija rasm karta: `result-canvas.ts` (1080×1080 story karta: donut+foiz, status, ism/fan, statistika, streak pill, sana + bot CTA) + `buildResultShareText` sof builder (UZ/RU); `ResultsModal`'da "Rasm qilib ulashish" tugmasi — Web Share(files) → fallback shareUrl(matn) + auto-download; i18n ±2 kalit; test: `ResultCanvas.test.ts` +7. **#46** — SR dashboard: `GET /progress/:userId/cards/summary` (repository aggregate FILTER so'rovi; EKSKLYUZIV oynalar dueNow/+24h/+7d — yig'indi = 7 kunlik jami) + api.getCardsSummary + `AdaptivePage` bo'sh holat kartasi (jami/bugun/ertaga/hafta) + i18n ±4 kalit; integration `cards-summary.test.ts` +4 (chegara aggregate'lari real Postgres'da). **#45** — qidiruv: `features/search/search-index.ts` (SOF: normalize — lowercase + 8 xil apostrof varianti birlashtiriladi, substring + darslarda sarlavha-ustuvor + snippet; limitlar) + `SearchPage` (200ms debounce, savol→`/test/1` questionIds, dars→`/darslik` state) + `/qidiruv` route + Dashboard fake-search-bar + i18n ±4 kalit; test `search-index.test.ts` +9.
- **Verifikatsiya (uchinchi paket):** tsc ×2 ✓, unit **434/434** ✓ (73 fayl: +16), integration **119/119** ✓ (14 fayl: cards-summary +4), lint **0 error** ✓, vite build ✓
