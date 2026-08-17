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

- [ ] **8. M-5 — broadcast'ni umumiy primitive'ga ko'chirish**
  `server/modules/admin/broadcast.service.ts:62-74,178-221` — butun users
  jadvali xotiraga olinadi, 25/soniya sleep'lar, 30s'da jimgina qisman
  yuboriladi (~500-700 ta), davom ettirish yo'q. Fix: M-4'dagi claim-chunk
  pattern'ini umumiy `chunked-dispatch` primitive qilib chiqarib, broadcast'ni
  unga o'tkazish (DB-backed navbat + `broadcast_recipients` jadvali yoki
  `jobRuns`-asosli offset). Bonus: `notificationsEnabled` sozlamasiga hurmat
  (`tournament-prize.service.ts:101`da `sql\`true\`` hardcoded — olib tashlash).

- [ ] **9. H-3 / H4 — ball farming product qarori**
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

- [ ] **12. M-8 — TG login kod phishing'ga qarshi tasdiq**
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

- [ ] **18. jsonb → jadval (ENG KATTA scalability item)**
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

- [ ] **20. Repository pattern restavratsiyasi**
  5 routerda SQL to'g'ridan routerda (aniq ro'yxat: `admin.router.ts` bir necha
  `executeRows`, `cron.router.ts`, `leaderboard.router.ts`, `daily.router.ts`,
  `analytics.router.ts` — grep `executeRows|db\.` router fayllarida). Har birini
  mos `.repository.ts`ga ko'chirish. Admin DELETE (questions) — tranzaksiya yoki
  bitta CTE.

- [ ] **21. Graceful shutdown gaplari**
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

- [ ] **25. Duplikat indeks**
  Migratsiyada `idx_payment_orders_order_id` UNIQUE constraint index'ini
  takrorlaydi (0037:41) — keyingi migratsiyada drop.

- [ ] **26. App.tsx remount + content/ lazy**
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

- [ ] **29. Repository qamrovi (eng qimmatli yo'llar)**
  `payment.repository` (complete CTE holatlari), `promo.repository` (redeem
  poyga/cap), `users.repository` (rewardIfPhoneLinked/createPending) —
  integration testlar allaqachon bor, unit-darajada CTE oqimlarini yopish.

## PART 6 — Gigiyena / o'lik kod

- [x] **30.** `pdf-parse` + `@types/pdf-parse` dependensiya'dan olib tashlash
  (birorta import yo'q).
- [ ] **31.** `api/index.js`, `api/bot.js`ni git'dan chiqarish
  (`git rm --cached`; vercel-build har deploy'da qayta quradi — .gitignore'ga
  `api/*.js`? DIQQAT: Vercel functions repo'dagi faylga ishora qiladi,
  vercel.json `functions` konfigi — buildCommand bor, xavfsiz, lekin tekshir).
- [x] **32.** `rate-limiter.ts:29` / `db-rate-limiter.ts:58` — o'lik
  `telegramUserId` fallback shoxini olib tashlash.
- [x] **33.** `.env.example` — `BOT_USERNAME="kiwi_bot"` → `"kiwi_uz_bot"`
  (haqiqiy bot); `AGENTS.md` — `npm test` tavsifini `test:unit`ga moslash.
- [ ] **34.** ESLint o'rnatish (flat config + `typescript-eslint` +
  `react-hooks` plugin) — `eslint-disable` kommentlar hozir o'lik. `npm run
  lint` + CI'ga qo'shish.
- [x] **35.** ~59 qattiq kodlangan hex rang → tokenlar (design qoida №8;
  `LeaderboardPage.tsx:18-22,63-65`, Onboarding, RoundScreen...). Modal a11y:
  umumiy Sheet (focus-trap, Escape, `role="dialog"`).
- [ ] **36.** OAuth stub qarori: route'larni o'chirish YOKI `available:false`
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
- [ ] **45. Qidiruv** — savollar/darslar bo'yicha client-side indeks
  (`useQuestionsStore` ustida) + `SearchPage`.
- [ ] **46. Spaced-repetition dashboard** — "bugun tayyorlar" soni/prognoz:
  `GET /progress/:userId/cards/summary` + `AdaptivePage.tsx` kartasi.
- [ ] **47. Liga mavsumlar tarixi** — `league_rollover_log` +
  `tournament_prizes`'dan "oldingi g'oliblar" `LeaderboardPage.tsx`da.
- [ ] **48. Natijalarni rasm qilib ulashish** — canvas kartalar +
  `shareUrl`; `ResultsModal.tsx`.

## PART 8 — Infra/monitoring

- [ ] **49. Sentry alertlar** — 429 spike'lar, cron `jobRuns` xato counter'lari,
  `rate_limiter_unavailable` 503'lar (P1-2'dan keyin ahamiyatli).
- [ ] **50. Octagon WS yuk-testi** — o'sish marketingidan oldin: k6/artillery
  bilan 100+ parallel duel, matchmaking + neon connection profile.
- [ ] **51. `analytics_events` retention + `answer_tokens` cleanup cron'ini
  birlashtirish** (item 14 bilan birga).

---

## Bajarilganlar (tarix)

- ✅ C-1, H-2, M-3, M-12, P1-1…P1-5, H-1 (GREATEST qismi), P3 gigiyena — `34462cd`, `d9ab3ad` (2026-08-17)
- ✅ Referal v3, SMS kampaniyalar — `2379ce9`, `b697ed0`
- ✅ Audit hujjatlari + remediation log — `daba88b`, `566c22c`
- ✅ **H-2 ASL fix** (qayta-verifikatsiya d9ab3ad YARIM ekanini ko'rsatdi): `PATCH /users/:userId/phone` endi `{phone, otp}` talab qiladi — `consumeOTPWithLockout` `users.phone` yozuvidan OLDIN (server/modules/auth/otp.ts — umumiy qatlam, cycle'siz); client: Telegram requestContact → `requestOTP` → Profil OTPInput bosqichi; brute-force lockout (5 urinish → otp_locked) saqlanibdi; runtime exploit-proof: begona raqam YOZILMAYDI, referal mukofot soxta raqamga tushmaydi. Integration: +4 test (`users.test.ts`)
- ✅ **Referal `?start=ref_<id>` bot fix'ning TUGALLANGANI**: `parseReferralParam` (`server/utils/parse.ts`) — canonical id (TG raqam/`p_`/`e_`) BOT qatlamida ham qabul qilinadi (2379ce9 faqat App.tsx'ni tuzatgan edi, bot `${BASE_URL}?ref=` havolasini yaratmay qo'yardi)
- ✅ **M-9 tugallangan**: 6+ xonali kod YETARLI EMAS edi — `joinDuel` per-user brute-force limiti (60s/8 urinish → `duel_join_rate_limited`) `server/octagon.ts`
