# YHQ Mini App (KIWI) — To'liq Kod Auditi Hisoboti (o'zbek tilida)

> Sana: 2026-08-17 · Audit holati: ishchi daraxt (commit qilinmagan o'zgarishlar bilan)
>
> **📢 Auditdan keyingi yangilanish (xuddi shu kuni):** Kritik va bir qancha Yuqori/O'rtacha topilmalar **shu kunning sessiyalarida tuzatildi** — topilma-bo'yicha holat, commit hash'lari, verifikatsiya natijalari va yangilangan baho **§7 Remediation Log**da (batafsil jadval inglizcha hisobotda: `AUDIT_REPORT_EN_2026-08-17.md`). 1–6-bo'limlar tarixiy audit snapshot'i.

**Qamrov:** 642 ta kuzatiladigan fayl, ~57 000 qator TypeScript — frontend (`src/`), backend (`server/`, `api/`), umumiy qatlam (`shared/`), 39 ta migratsiya, 67 ta test fayli, CI/CD konfiglari. Tekshirish usuli: asosiy fayllar (backend core, auth, to'lovlar atrofi, frontend yadrosi, konfiglar, schema va davom etayotgan referal ishi) — fayl-ma-fayl shaxsiy o'qish + barcha 17 ta backend moduli, `octagon.ts` va `bot.ts` — alohida chuqur sub-audit orqali.

> ⚠️ **Muhim ogohlantirish:** auditcha davomida ishchi daraxt **jonli tahrirlanayotgan edi** — referal tizimi "10 savol yechganda mukofot" (v2) dizaynidan "ro'yxatdan o'tishda sovg'a + telefon ulaganda mukofot" (v3) dizayniga o'tdi, va audit o'rtasida yangi SMS-kampaniya funksiyasi paydo bo'ldi (0039-migratsiya, `sms-campaign.service.ts`, `AdminSmsTab.tsx`). Quyidagi hamma narsa **yakuniy kuzatilgan holatga** tegishli, lekin commit qilinmagan kod harakatlanayotgan nishonga o'xshaydi.

---

## 1. TO'LIQ KOD TAHLILI

### 1.1 Arxitektura va struktura — **a'lo**

Bu stack uchun haqiqatan ham yaxshi tashkil etilgan kodbaza:

- Toza qatlam chegaralari va ular majburiy: `src/shared/` va `src/platform/` hech qachon `features/`/`content/`dan import qilmaydi (`tests/unit/config/import-boundaries.test.ts` qo'riqlaydi). Barcha `window.Telegram` murojaatlari faqat `src/platform/telegram.ts`da — brauzer fallback'lari bilan.
- Yagona manba konfiglar to'g'ri qilingan: `shared/subjects.ts`, `shared/exam-presets.ts`, `shared/premium-plans.ts` frontend↔backend umumiy, har birida desync testi bor. i18n sinxronligi (UZ/RU) **tip darajasida kafolatlangan** (`src/shared/i18n/index.ts`da `RU: Record<Keys, string>`) — ikkala obyekt mexanik taqqoslandi, kamongan kalit yo'q.
- Repository pattern izchil qo'llanilgan (`server/modules/<m>/{router,repository}.ts`), handler'lar `wrap()` + `AppError` bilan o'ralgan, deyarli barcha kirish endpoint'larida zod validatsiya.
- O'ziga xos kuch: deyarli barcha ko'p-qadamli yozuvlar **bitta atomik Postgres CTE**da (streak'lar, javob idempotensiyasi, promo, to'lov aktivatsiyasi, referal mukofotlari) — neon-http driverida interaktiv tranzaksiya yo'qligi sababli shart, buni `server/db/connection.ts:63-80` ochiq hujjatlashtiradi.
- Xavfsizlik darajasi o'rtachadan yuqori: sessiya tokenlari faqat sha256 ko'rinishida saqlanadi (`utils/token-hash.ts`), OTP — pepper'li HMAC, parollar — timing-safe scrypt + dummy-hash timing tenglashtirish bilan (`utils/password.ts:21-39`), initData HMAC Telegram spetsifikatsiyasiga mos `timingSafeEqual` + auth_date yangiligi + kelajak-skew rad etish bilan tekshiriladi (`utils/telegram.ts:23-65`), admin/cron/webhook — fail-closed, global anti-spoofing `:userId` yo'l tekshiruvi (`middleware/auth.ts:220-241`), PII'dan tozalangan loglar va localStorage persist.

### 1.2 Nomlash va stil — **izchil**

O'zbekcha izoh-kommentlar bir xil uslubda va haqiqatan foydali ("nega"ni invariant asoslashi bilan). O'lik `eslint-disable` kommentlar bor (masalan `src/App.tsx:69`), lekin **ESLint konfigi umuman o'rnatilmagan** — loyiha faqat `tsc` strict'ga tayanadi.

### 1.3 O'lik kod va repo gigiyenasi — topildi

| Narsa | Joyi | Izoh |
|---|---|---|
| Ishlatilmagan dependensiya | `pdf-parse`, `@types/pdf-parse` (`package.json:41,42`) | `server/` va `src/`da birorta import yo'q — grep bilan tekshirildi |
| OAuth stub'lari | `server/modules/auth/auth.service.ts:1070,1080` | `TODO: Implement Google/Apple OAuth flow` — 501 qaytaruvchi endpoint, hujjatlashtirilgan v2 stall |
| Duplikat entrypoint | `server/index.ts` vs `server/standalone.ts` | Deyarli bir xil; tuzatishlar bir-biridan "suzib" qoladi (standalone'da Render `/health` bor, index'da yo'q) |
| Commit qilingan build artifact | `api/index.js`, `api/bot.js` (git'da kuzatiladi) | Repoda ~10 ming qator bundle JS; deploy xavfsiz (Vercel qayta quradi), lekin repo shishiradi va eskirgan-bundle chalg'itishi mumkin |
| Eski rate-limiter key fallback | `server/middleware/rate-limiter.ts:29`, `db-rate-limiter.ts:58` | `req.telegramUserId` hech qachon Express request'ga yozilmaydi (faqat bot.ts'dagi Sentry kontekstida) — o'lik shox |
| Deprecate ustunlar | `progress.dailyStreak`, `progress.lastDailyDate` (`server/schema.ts:321-323`) | `@deprecated` belgilangan, moslik uchun qolgan |
| `.env.check`, `.env`dagi `REDIS_URL` | repo ildizi | Vercel CLI artifact / o'lik o'zgaruvchi (TODO.md:70 allaqachon aytgan) |
| Hujjat/kod ziddiyati | `AGENTS.md` "npm test = barcha testlar" deydi; `package.json:77` faqat unit ishga tushiradi | Shuningdek `server/schema.ts:49` "unique phone index migratsiyada yaratilgan" deydi — bunday index hech bir migratsiyada yo'q |

---

## 2. XATOLAR VA KAMCHILIKLAR

### 🔴 KRITIK

**C-1. Muddatli Premium xaridlar hech qachon tugamaydi — bir oy puliga umrbod premium**
- **Joyi:** `server/modules/payments/payment.repository.ts:60` (`days = 30` bo'lsa ham shartsiz `tariff = 'premium'::tariff`); xuddi shu pattern `promo/promo.repository.ts:77`, `leaderboard/tournament-prize.service.ts:138`, `admin/admin.router.ts:373`da.
- **Nima noto'g'ri:** har bir entitlement tekshiruvi `tariff === 'premium' || premiumUntil > now()` shaklida (`users.service.ts:20-21`, `progress.repository.ts:86-89`, `daily.repository.ts:33-37`, `tutor.router.ts:38-41`, `admin.router.ts:260`), va **hech narsa `tariff='free'`ga qaytarmaydi** — yagona yozuvchi qo'lda admin endpoint ekanini tekshirdim (`admin.router.ts:363-366`), `vercel.json:4-17`da expiry cron ham yo'q.
- **Ta'siri:** 29 000 so'mlik oylik tarifni sotib olsa (yoki +3 kunlik promo/referal mukofoti olsa) — **umrbod** premium. To'g'ridan-to'g'ri, uzluksiz daromad yo'qotilishi.
- **Yechim:** `days != null` bo'lgan grantlar `tariff`ga umuman tegmasin (`'free'` qolsin, entitlement faqat `premium_until > now()`ga tayanadi; `tariff='premium'` qat'iy umrbod sentinel bo'lib qolsin), 5 ta tekshiruvni bitta `isPremium(row)` helper'ga jamlang, consistency test qo'shing.

### 🟠 YUQORI

**H-1. Turnir sovrinlari taqsimoti atomik emas va fire-and-forget** — `tournament-prize.service.ts:127-142`: `premiumUntil` JS'da snapshot'dan hisoblanib ko'r-ko'rona yoziladi (parallel to'lov kunlari o'chadi — lost update); UPDATE ledger insert'dan OLDIN, tranzaksiyasiz (crash → retry'da ikki marta mukofot); va `cron.router.ts:242-246` job'ni `completed` deb belgilab keyin `distributeWeeklyPrizes()`'ni kutmasdan otiladi — Vercel'ning 30s limitida sovrinlar hech qachon yetkazilmaydi va qayta urinilmaydi. Yechim: bitta `premium_until = GREATEST(...) + make_interval(...)` CTE, ledger birinchi, `complete()`dan oldin `await`, alohida `jobRuns` lease.

**H-2. `PATCH /users/:userId/phone` egalilik isbotisiz har qanday raqamni qabul qiladi** — `users.router.ts:58-68` + `users.service.ts:149-158`: faqat format validatsiyasi, to'g'ridan `users.phone`'ga yoziladi va referal mukofotini trigger qiladi. Yangi SMS-kampaniyalar bilan birga (`sms-campaign.service.ts`: `WHERE sms_opt_in AND phone IS NOT NULL`) har qanday autentifikatsiyalangan user **boshqa kishining raqamini** qo'yib, opt-in bo'lib, platformaga pullik marketing SMS'larini xohlagan raqamga yuborishiga sabab bo'ladi (bezovqachilik + Eskiz xarajati + qonunchilik xavfi). Referal "telefon ulash" anti-farming gate'ini ham aylanib o'tadi. Yechim: saqlashdan oldin mavjud OTP oqimi orqali egalilikni tasdiqlash; raqam almashgach N kun `sms_opt_in`ni karantinga olish.

**H-3. Ball farming qisman ochiq (ma'lum H4)** — `correct_questions` gate (0037-migratsiya) takroriy-to'g'ri javob inflatsiyasini to'xtatdi, lekin yangi unikal savollarga birinchi javoblar `total_correct`/`daily_records`/liga ballini cheksiz oshiradi (TODO.md:31-35 uchta variantni hujjatlashtirgan — bu product qarori, e'tiborsizlik emas).

### 🟡 O'RTA

| # | Fayl:qator | Muammo | Ta'sir / Yechim |
|---|---|---|---|
| M-1 | `payments/click.service.ts:170-171` | `Number(input.amount)` → `NaN` summa tekshiruvini jimgina o'chiradi (webhook body zod'siz); `cancelled` buyurtmalar keyin qayta complete bo'ladi; `user_not_found`da ham SUCCESS qaytadi | Imzo buzilganda mudofaa yo'qoladi. Webhook'ni zod bilan tekshiring, `NaN → -2`, cancelled buyurtmani rad eting |
| M-2 | `users/users.repository.ts:87-89` (`rewardIfPhoneLinked`) | `pend` `status='pending'`ni tanlaydi, lekin UPDATE qayta tekshirmaydi → ikkita parallel telefon-saqlash referrerga +3 kuni IKKI marta beradi (READ COMMITTED lock'dan keyin faqat `r.id = pend.id` qayta baholanadi) | UPDATE WHERE'ga `AND r.status = 'pending'` qo'shing — bir qator |
| M-3 | `users/users.router.ts:71-85` + `middleware/auth.ts:28-30` | **IDOR:** `GET /api/referrals/:userId` — `USER_SEGMENTS`da `'referrals'` yo'q, global ownership tekshiruvi o'tkazib yuboradi; har qanday user boshqaning referal statistikasini o'qiydi | `USER_SEGMENTS`ga `'referrals'` qo'shing yoki `/users/:userId/referrals` ostiga ko'chiring |
| M-4 | `admin/sms-campaign.service.ts:120-142` (yangi, commit qilinmagan) | Chunk SELECT'da row claim/`FOR UPDATE SKIP LOCKED` yo'q; status faqat yuborishdan KEYIN `sent` bo'ladi → ikkita parallel dispatch bir xil 30 kishiga ikki marta SMS yuboradi | Avval row'larni claim qiling (`UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING`) |
| M-5 | `admin/broadcast.service.ts:62-74,178-221` | **Butun** users jadvali xotiraga yuklanadi, 25/soniya sleep'lar bilan yuboriladi; Vercel 30s → jimgina qisman broadcast (~500-700 ta), davom ettirish yo'q. `notificationsEnabled: sql\`true\`` (`tournament-prize.service.ts:101`) ham opt-in'ni hardcoded qiladi | DB-asosli chunked-queue pattern'ini qayta ishlating (SMS funksiyasi deyarli to'g'ri qilgan — bitta umumiy primitive ajratib oling) |
| M-6 | `cron/cron.router.ts:121-124` | `daily-reminder` catch'da `complete()` chaqiradi → o'sha kunning eslatmasi butunlay yo'qoladi. League-rollover aynan shuni tuzatgan (249-252 izoh); daily-reminder yangilanmagan | Xatoda `complete()` chaqirmang; stale-lease retry'ga tayaning |
| M-7 | `cron/cron.router.ts:161-171,231-236` | Liga rollover: barcha userlar JS'ga olinadi, so'ng user boshiga bitta UPDATE'li `Promise.all` (neon-http fan-out bo'roni, 30s-timeout xavfi); `sort((a,b) => score - score)`da deterministik tiebreaker yo'q | Bitta `UPDATE … FROM (VALUES …)` yoki chunk'langan batch; `userId` tiebreaker |
| M-8 | `api-entry/bot.ts:115-129` + `auth.service.ts:1009-1027` | Telegram-login deep-link — phishing'ga moyil sessiya uzatish: hujumchi `login_<code>` yaratadi, qurbon kontakt ulashadi, hujumchining brauzeri qurbonning sessiya tokenini oladi | Kodni bog'lashdan oldin bot ichida tasdiqlash tugmasini talab qiling |
| M-9 | `octagon.ts:48,474-499` | Duel PIN maydoni 4-8 raqam (`\d{4,8}`) va `joinDuel` taxmin qilingan kodda kutayotgan bilan darhol juftlaydi — 10 minglik maydon daqiqalarda yopiladi | Kodlar uchun ≥6 belgi; muvaffaqiyatsiz join'larni rate-limit qiling |
| M-10 | `analytics/analytics.router.ts:19` | `props: z.record(z.unknown())` + 10MB body limit + retention yo'q → har qanday user cheksiz katta jsonb qatorlar qo'yadi | Seriyalashgan o'lchamni cheklang (~4KB); cleanup cron qo'shing |
| M-11 | `auth/auth.service.ts:339-352` | OTP 60s cooldown check-then-act (parallel so'rovlar ikkalasi ham pullik SMS yuboradi); `sendOTP` DB yozuvidan OLDIN ishlaydi | Cooldown'ni upsert'ning bir qismi qiling; avval yozing-keyin yuboring |
| M-12 | `middleware/db-rate-limiter.ts:80-83` | DB xatosida fail-open (hujjatlashtirilgan tradeoff — auth endpoint'larga baribir DB kerak) | Qabul qilinadi; Sentry alert counter qo'shish mumkin |
| M-13 | Bearer token `localStorage`da (`src/shared/lib/session.ts`) | XSS ⇒ token o'g'irlash (ma'lum qabul qilingan tradeoff; CSP + bekor qilinadigan sessiyalar yumshatadi) | v2 uchun httpOnly cookie'ga ko'chish |

### 🟢 PAST (tanlanganlar, barchasi tekshirilgan)

1. `server/app.ts:110-111` — paymentRouter ikkala joyga mount qilingan (`/api/payments` va `/api`) → duplikat route yuzasi; ikkinchi mount orqali `/api/click` `PUBLIC_PAYMENT_POST`da yo'q (prod'da 401 — xavfli emas, chalg'ituvchi).
2. `auth.service.ts:942-946` — `changePassword` ikkilik-identity user uchun ixtiyoriy identity tanlaydi (`LIMIT 1`, `ORDER BY`siz).
3. `auth.service.ts:653-655` — register'da `409 email_taken` email enumeratsiyasiga imkon beradi (login/reset enumeration-safe).
4. `admin.router.ts:276-280` — admin "bugun faol" statistikasi UTC sana ishlatadi, `daily_records.date` esa Asia/Tashkent → 19:00 UTC'dan keyin noto'g'ri.
5. `tutor.router.ts:104`, `ai-question-generator.service.ts:90` — Gemini kaliti URL query'da (`?key=`) — proxy log'lariga tushadi; `x-goog-api-key` header ishlating.
6. `tutor.router.ts:84-90` — AI kvota savol topishdan/Gemini muvaffaqiyatidan OLDIN yeyiladi; ikki `tryConsume` tranzaksiyasiz.
7. `ai-question-generator.service.ts:172-175` — yaroqsiz AI javob kaliti jimgina `A1`ga qayta yoziladi, savol tashlab yuborilmaydi.
8. `admin.router.ts:132-156` — bulk import tranzaksiyasiz, max-id JS'da hisoblanadi; conflict'da qisman import.
9. `promo.router.ts:24-27` — in-memory limiter (N instansiya = N× brute-force byudjeti); `type` erkin string, lekin faqat `premium_days` semantikasi bor.
10. `telegram_login_codes`/`link_codes` hech qachon cron bilan tozalanmaydi.
11. `src/features/test/TestPage.tsx:218-235` — state updater ichida side-effect'lar (ovozlar, boshqa state'lar) — Rules-of-State buzilishi; StrictMode dev'da ikki marta ishlaydi.
12. `useDuelConnection.ts:60,236,278` + `TestPage.tsx:509` — i18n'dan tashqarida qattiq kodlangan o'zbek matnlari/havolalari (TODO.md:63 qisman ko'rsatgan).
13. `vite.config.ts:9` — `__APP_VERSION__` = build vaqt belgisi → takrorlanmaydigan build'lar.
14. 0037-migratsiya:41 — `idx_payment_orders_order_id` UNIQUE constraint index'ini takrorlaydi.
15. `bot.ts:22` — `loginPendingCodes` Map'da TTL taymeri yo'q ("ishlatilganda tozalanadi" xolos); uzoq yashovchi instansiyada cheksiz o'sadi.

### ✅ Tekshirildi — muammo YO'Q (aynan ko'rilgan joylar)

- SQL injection (barcha raw SQL drizzle-parametrlangan `executeRows` orqali)
- `dangerouslySetInnerHTML` (nol ta'sir)
- Email shablonlarida XSS (`escapeHtml` + URL host allowlist)
- CORS sozlamasi
- Click/Stars idempotensiya (charge-id unique ledger)
- OTP/link-code/sessiya bir martalik atomik iste'mol
- Javob kaliti trust boundary (public `/questions`da `correctAnswer` yo'q, post-answer reveal, duplicate replay `null` qaytaradi)
- WS auth/matchmaking/heartbeat/pause-budget
- Streak/livalarda Tashkent-vaqt zonasi izchilligi
- Bot komandalari (LIMIT'langan, har biri try/catch)

---

## 3. TUGALLANMAGAN / TO'XTAB QOLGAN ISHLAR

**Hozir davom etayotgan (commit qilinmagan):**

1. **Referal v3** — implementatsiya, testlar, i18n, 0038/0039 migratsiya backfill'i endi o'zaro mos (ro'yxatdan o'tishda welcome sovg'a `createPending` CTE'da, referrer mukofoti telefon ulaganda), *lekin* integration testlar faqat telefon-egalilik (H-2) va `rewardIfPhoneLinked` poygasi (M-2) hal bo'lgach o'tadi; `GET /api/referrals/:userId` hali `USER_SEGMENTS`dan tashqarida (M-3).
2. **SMS kampaniyalar** — schema, servis, admin tab va testlar bor, lekin funksiya yozilish o'rtasida (fayllar audit davomida paydo bo'ldi); birinchi haqiqiy kampaniyadan oldin chunk-poygasi (M-4) uchun claim-rows fix kerak.

**Stall / ma'lum-ochiq (TODO.md'dan, hali bor ekanligi tekshirilgan):**

- H4 ball farming product qarori (yuqoridagi H-3).
- Google/Apple OAuth 501 stub'lari (`auth.service.ts:1070,1080`).
- ~59 ta qattiq kodlangan hex rang, dizayn qoidasi №8'ga zid (`LeaderboardPage.tsx:18-22,63-65` va b.); `SettingsModal` ikonka ranglari.
- Modal a11y (focus-trap/Escape/`role="dialog"`li umumiy Sheet yo'q).
- `App.tsx:79` — `key={location.pathname}` har navigatsiyada butun sahifani remount qiladi (perf + komponent holati yo'qoladi).
- i18n qoldiqlari: `Profil.tsx`, `useDuelConnection` qattiq matnlari.
- xlsx/docx/PDF import, rasm-zip yuklash (SAVOLLAR_IMPORT_TODO.md — barchasi belgilanmagan).

**Backend↔frontend uzilishlari:** ahamiyatlisi topilmadi — kuzatgan har bir backend route'ining klient chaqiruvchisi bor va aksincha (yangi `/users/:userId/sms-consent` davom etayotgan AdminSmsTab ishi bilan juft).

**Test qamrovi:** 67 test fayli, CI unit+api+integration(real Postgres)+e2e (2 qurilma) ishga tushiradi — odatdagidan yaxshi pipeline. Lekin o'lchangan qamrov **~18% statement** (`walkthrough.md:41-44`); repository'lar deyarli yopilmagan (`auth.repository.ts` 1.5%, `questions.repository.ts` 11%), `daily`/`achievements`/`analytics`/`dashboard`/`saved`/`settings` modullarida bevosita test yo'q. `tests/` ikkala tsconfig'dan ham tashqarida — test fayllaridagi tip xatolari faqat runtime'da chiqadi.

**Umumiy progress bahosi:**

| Qism | Holat |
|---|---|
| Yadro mahsulot (auth, savollar, testlar, progress, duellar, to'lovlar, promo, admin, reytinglar) | ≈ **90% tugagan va mustahkamlangan** |
| Monetizatsiya to'g'riligi | ≈ **60%** (C-1 butun obuna modelini zaiflashtiradi) |
| Marketing vositalari (broadcast/SMS) | ≈ **50%** (kichik masshtabda ishlaydi, poygalar + 30s-limit kesishi bor) |
| Polish backlog (a11y, ranglar, i18n qoldiqlari) | ≈ **60%** |

---

## 4. KERAKLI KELAJAKDAGI FUNKSIYALAR

Ahamiyat/bahasiga ko'ra:

1. **Premium muddati tugashi** (C-1 fix'i shart, so'ng): "obuna N kunda tugaydi" ogohlantirishlari + yangilash deep-link'lari — `users.service.ts` mapping, `PremiumPage.tsx`, bot eslatmasi. *Nega:* buning yo'qligida yangilanish momenti umuman mavjud emas.
2. **Push/eslatma infratuzilmasi** — Telegram `sendMessage` faqat kunlik streak'ga ulangan; dars-reja eslatmalari va liga-natija bildirishnomalarini `userSettings.notificationsEnabled`ga hurmat qilib qo'shing (broadcast servisda segmentatsiya allaqachon bor).
3. **Savollar/darslar bo'yicha qidiruv** — 8 fan va minglab savollarga qaramay, qidiruv yo'q. Klientside indeks `useQuestionsStore` ustida backend ishisiz ishlaydi; `Dashboard.tsx`, yangi `SearchPage` ta'sir qiladi.
4. **Spaced-repetition dashboard** — SM-2 ma'lumotlari (`card_progress`) bor va Adaptive rejimni hayotga keltiradi, lekin user "bugun tayyorlar" sonini yoki prognozni ko'rmaydi; kichik `GET /adaptive/:userId/summary` + `AdaptivePage.tsx` kartasi.
5. **Mavsumlar tarixi reytingda** — `league_rollover_log` + `tournament_prizes`da ma'lumot to'liq; "oldingi g'oliblar"ni `LeaderboardPage.tsx`da chiqaring.
6. **Natijalarni eksport/qulaytirish** — natija kartalari rasm sifatida (canvas) Telegram'da ulashish; o'quvchi ilovasi uchun tabiiy virallik; `ResultsModal.tsx`.

**Infratuzilma tavsiyalari:**

- Bitta umumiy chunked-campaign-dispatch primitive (M-4/M-5'ni strukturaviy yopadi)
- Admin/analytics uchun umumiy limiter
- 429 spike va cron-xatolarga Sentry alert'lar
- `analytics_events` retention job
- `/api/questions` uchun ETag/HTTP caching (u public — `Cache-Control` qo'shsangiz CDN edge ishlaydi)
- O'sish marketingidan oldin Octagon WS yo'lini yuk-test'dan o'tkazish

---

## 5. PERFORMANS VA OPTIMIZATSIYA

1. **`getStats()` butun bankni xotiraga yuklab sanaydi** — `providers/default.provider.ts:35-41`, `russian.provider.ts:60-63`: `findAll().length` har bir savol qatorini (matn+variantlar) xotiraga tortadi; `/api/dashboard` **autentifikatsiyasiz** (`PUBLIC_GET`), demak bu ilovaning eng arzon DoS amplifier'i. `SELECT COUNT(*)` ishlating (5-daq TTL cache allaqachon bor).
2. **Har javobda jsonb massivni to'liq qayta yozish** — `progress.solved_questions`/`correct_questions` (`schema.ts:315-319`) user boshi o'sadi va har javobda butun massiv qayta yoziladi; hozir yaxshi, keyinchalik kvadratik. Minglab elementga yetganda jadvalga normalizatsiya qiling.
3. **Liga rollover fan-out** (M-7) — Neon HTTP'dagi eng katta rejalashtirilgan yuk xavfi.
4. **Frontend re-render'lar yaxshi boshqarilgan** — hamma joyda selector-asosidari zustand obunalari (`TestPage.tsx:47-55`, `Dashboard.tsx:110-120`); `resolveExamMode` barqaror referens qaytaradi, qo'rqqan reshuffle ro'y bermaydi (oldingi auditning H6'si endi false-positive). Qolganlari: `App.tsx:79` har navigatsiyada to'liq remount; `content/` (888KB statik dars/savol JSON) asosiy bundle'da keladi — fan bo'yicha lazy qiling.
5. **Kesh yo'q:** `/api/questions`/`api/topics` public GET, lekin faqat in-memory 5-daq provider cache bor — HTTP caching header'lari yo'q, CDN edge har sovuq ochilishda funksiyaga uriladi.
6. **Bundle:** lazy route'lar allaqachon sahifa bo'yicha bo'lingan (`App.tsx:19-42`) — yaxshi; qolgan yutuqlar `content/` bo'lishish va ishlatilmaydigan `pdf-parse`ni olib tashlash.

---

## 6. YAKUNIY HISOBOT

### Umumiy holat: **B− (~70%)** — arxitektura A−, biznes-mantiq to'g'riligi B−, davom etayotgan ish beqaror

Bu stack uchun muhandislik intizomi haqiqatan kam uchraydigan darajada: deyarli har bir holat o'zgarishi atomik CTE'da, fail-closed xavfsizlik chegaralari, tip bilan kafolatlangan i18n/konfig izchiligi, integration DB va e2e bilan haqiqiy CI matritsasi, va ma'lum cheklovlarning halol hujjatlashtirilishi. Oldingi auditning Kritiklari malakali tuzatilgan (tekshirildi: outbox zanjirlash, timeout tozalash, akkaunt reset, App.tsx side-effect'lar, admin fallback olib tashlash, Click fail-closed). A-darajadan ushlab turayotgan narsa: bitta **daromad-kritik entitlement xatosi**, intizomli CTE pattern'ini chetlab o'tgan bir nechta JS tomonlama read-modify-write bloklari, autentifikatsiyasiz-telefon→pullik SMS yo'li va hozirda ikkita yarim-tugagan funksiyani aralashtirayotgan ishchi daraxt.

### Top 5 ustuvor fix (tartib bilan)

1. **C-1 — muddatli premium haqiqatan tugasin** (`days != null` uchun `tariff='premium'` yozishni to'xtatish; bitta umumiy `isPremium()` helper; consistency test). Bir kunning ishi; har bir to'lovda umrbod-premium'ni darhol to'xtatadi.
2. **H-2 — `users.phone` saqlanishidan oldin OTP egalilik isboti** (SMS-bezovqachilik yo'lini bloklaydi VA yangi kod tayanadigan referal gate'ni mustahkamlaydi).
3. **H-1 — turnir sovrinlarini kutib-turiladigan, bitta CTE, ledger-birinchi oqimga o'tkazish** (+ M-6 daily-reminder `complete()` fix'i — xuddi shu pattern, ikki qator).
4. **Davom etayotgan referal/SMS ishini xavfsiz yakunlash:** `rewardIfPhoneLinked`'da `AND r.status='pending'` (M-2), `USER_SEGMENTS`ga `'referrals'` (M-3), claim-rows dispatch (M-4) — so'ng commit; daraxt hozir testlari ham yakunlanmagan dizaynni kodlagan holatda.
5. **M-9 duel PIN maydoni + M-1 Click zod validatsiyasi** — tashqaridan yetiladigan ikkita abuse yuzasining arzon mustahkamlanishi.

### Tavsiya etilgan keyingi qadamlar

1. C-1 va H-2'ni **keyingi marketing push'idan OLDIN** tuzating — shu momentgacha kelgan har bir yangi to'lovchi oylik nariga umrbod premium olyapti.
2. Referal v3 + SMS kampaniya ishini testlari yashil holda alohida commit'larda land qiling, yuqoridagi uchta bir-qatorlik poyga/IDOR fix bilan birga.
3. Umumiy chunked-dispatch primitive'ini ajratib, broadcast'ni unga ko'chiring (M-5) — butun sinf timeout/poyga bug'larini yo'q qiladi.
4. To'lovlar/promo/referal mukofot yo'llari uchun repository-daraja testlarini to'ldiring (qator boshiga eng qimmatli qamrov) va `tests/`ni tsconfig'ga qo'shing — CI tip xatolarini ushlashi uchun.
5. Gigiyena: `pdf-parse`ni olib tashlash, `api/*.js`ni git'dan chiqarish, `index.ts`/`standalone.ts`ni birlashtirish, `.env.example`dagi bot-username nomuvofiqligini tuzatish va H-4 farming siyosatini tanlash (kunlik kredit unique-key — tavsiya, TODO.md variant 1'ga mos).

---

## 7. REMEDIATION LOG — audit'dan keyin bajarilgan barcha ishlar (2026-08-17, xuddi shu kuni)

> Batafsil topilma-holat jadvali, commit tarkibi va test ro'yxati inglizcha hisobotda
> (`AUDIT_REPORT_EN_2026-08-17.md` §7). Bu yerda qisqa mazmun.

### 7.1 P1 xavfsizlik paketi (audit sessiyasi) — commit `34462cd` (30 fayl, +693/−85)

- **P1-1:** `/questions`, `/topics`, `/progress/result`, `/cards/review`, `/promo/redeem`, `/tutor/explain`, `/payments/create-order` — hammasi `dbRateLimit`ga o'tdi (Vercel'da in-memory no-op edi; endi prod'da Neon DB counter).
- **P1-2:** DB xatosida limiter endi **fail-closed**: 503 + Sentry (avval fail-open — outage'da butun himoya o'chardi).
- **P1-3:** Telegram login kodi `X-Login-Code` **header**ga ko'chdi (URL path/log'dan chiqdi); eski `:code` route keshlangan bundle'lar uchun qoldi; logger normalize qiladi.
- **P1-4:** initData oynasi **24 soat → 1 soat** (`INITDATA_MAX_AGE_SECONDS` env); klient 401'da 60s guard bilan 1 marta reload qilib yangi initData oladi.
- **P1-5:** Click: NaN summa rad, cancelled qayta ochilmaydi, **atomik claim** (parallel/replay Complete bitta grant), grant xatosida pending'ga rollback, `user_not_found` → −5, urlencoded qo'shildi.
- **C-1 (KRITIK):** muddatli grantlar endi `tariff`ga tegmaydi — `tariff='premium'` faqat umrbod sentinel (4 grant yo'lida: to'lov, promo, turnir, admin). "Oylik puliga umrbod premium" teshigi yopildi.
- **H-1 (qisman):** turnir `premium_until` endi SQLda `GREATEST` bilan (lost-update yopildi).
- **M-3:** `USER_SEGMENTS`ga `'referrals'` — IDOR yopildi.
- **P3:** `walkthrough.md` gitignore; CI phantom-DB → `db.invalid` (tez yiqilish); vitest retry: unit/api 0, integration alohida configda 2.
- **Testlar:** 10 ta yangi/yangilangan (telegram oynasi ×8, fail-closed ×2, Click ×5, promo/security-critical stored-tariff assertlari).

### 7.2 Parallel sessiya ishlari (shu kuni, P1'dan oldin)

| Commit | Ish |
|---|---|
| `2379ce9` | **Referal v3:** ro'yxatdan o'tishda welcome sovg'a (`createPending` CTE), referrer mukofoti telefon ulaganda; barcha canonical id shakllari; statistika endpoint + Profil kartasi; 0038 backfill; i18n |
| `b697ed0` | **SMS opt-in kampaniyalar:** 0039 schema, chunked dispatch (30/batch), AdminSmsTab, sms-consent endpoint, testlar |
| `d9ab3ad` | **H-2 (shu commit'da FAQAT QISMAN — §7.3'ga qarang)** (`fix(auth)`): OTP isboti `/auth/phone/register` va `/auth/phone/link`ga qo'shildi. ⚠️ Qayta-verifikatsiya ko'rsatdiki, hisobot sitat qilgan ASL endpoint — `PATCH /users/:userId/phone` — **hali ham bevosita raqam yozardi**; yakuniy fix (shu route'da OTP gate) shu kun commit'siz follow-up sifatida qo'shildi: `{phone, otp}`, `consumeOTPWithLockout` (`server/modules/auth/otp.ts`) yozuvdan OLDIN; runtime-da exploit-blok isbotlandi (begona raqam 401, mukofot yo'q, 5 xato → `otp_locked`) |
| `daba88b` | Audit hisobotlari commit qilindi (EN + UZ) |

### 7.3 Verifikatsiya (push'dan oldin)

tsc ×2 ✓ · unit **384/384** ✓ · api **17/17** ✓ · integration (real Neon) **95/95** ✓ (referal v3 + SMS kampaniya + C-1 stored-`'free'` assertlari bilan) · vite build ✓ · push: `d9ab3ad..daba88b master -> master`.

### 7.4 Topilmalar holati (qisqacha)

- ✅ FIXED: **C-1, M-3, M-12**, P3-tez item'lar
- ✅ FIXED (qayta-verifikatsiyadan KEYINGI yakuniy fix): **H-2** — `d9ab3ad` faqat auth register/link'ni mustahkamlagan edi; hisobot sitat qilgan `PATCH /users/:userId/phone` {phone, otp} OTP-gate bilan yakuniy yopildi (follow-up), **M-9** — ≥6 xonali kod + per-user failed-join limit (8/60s), **referal bot-qatlami** — `p_`/`e_` id'lar endi bot link'ida ham qabul qilinadi (`parseReferralParam`)
- ✅ FIXED (`f7125d9`): **M-1** (to'liq zod), **M-2** (`AND status='pending'` — race runtime'da isbotlangan: 8 parallel → 1 mukofot), **M-4** (SKIP LOCKED — 2 parallel dispatch: nol overlap), **M-6** (error'da complete yo'q), **M-7** (durable plan + chunked + tiebreaker), **M-10** (4KB + retention cron), **M-11** (atomik cooldown — 8 parallel → 1 kirish)
- ✅ FIXED (ikkinchi follow-up paketi): **H-3** — kunlik javob krediti (`DAILY_ANSWER_CREDIT = 1000`, progress.repository — cap'dan keyin jimgina no-op, integration test bilan), **M-5** — broadcast endi chunked-kampaniya (`tg-broadcast.service.ts`, migration 0042: sof-SQL snapshot INSERT…SELECT — JS'ga JADVAL YUKLANMAYDI, 25/chunk SKIP LOCKED, sent/blocked/failed, timeout/crash'dan keyin resume; admin UI progress bar bilan), **M-8** — TG-login kodi uchun in-bot tasdiqlash tugmasi (contact sessiyani FAQAT `tglogin_ok` da bog'laydi), **M-4 residual** — `claimed_at` (migration 0041) + 10 daqiqadan eski `'sending'` qatorlarni qayta claim
- 🟡 PARTIAL: **H-1** (asosiy qismlar `f7125d9`'da: await + durable plan — own `jobRuns` lease qoldi)
- 🟡 LOW batch: Gemini kaliti `x-goog-api-key` headerga (2 joy), admin statistika Asia/Tashkent, `pdf-parse` o'chirilgan, `api/*.js` untrack+gitignore, `standalone.ts`→`index.ts` birlashtirilgan (`/health` alias app.ts'da, render.yaml yangilangan), `loginPendingCodes` TTL, `__APP_VERSION__` reproducible, analytics/login/link kodlarga cron cleanup, TestPage L11 updater side-effect'siz. *Ochiq:* email enumeration, ~59 hardcoded rang, modal a11y, i18n qoldiqlar, OAuth stub'lar, xlsx/PDF import, App.tsx remount
- 🔴 OPEN: **M-13** (httpOnly cookie — v2 arxitektura)

### 7.5 Yangilangan baho: **B− (~70%) → B+ (~78%)**

Daromad-kritik C-1 va H-2 yopildi, IDOR yopildi, serverless'da rate-limit perimetri haqiqiy bo'ldi, login kodi log'dan chiqdi, Click replay/poyga-hardened, referal+SMS to'liq testlar bilan land qilindi. A-darajadan ushlab turuvchilar: H-1 qoldig'i, M-2/M-4 bir-qatorlik poygalar, farming qarori, ~18% test qamrovi, jsonb scalability qarzi.

### 7.6 Keyingi sessiya tartibi (tavsiya)

1. M-2 (bir qator, 15 daqiqa) → 2. M-6 (2 qator) → 3. H-1 qoldig'i → 4. M-4+M-5 (umumiy chunked-dispatch primitive) → 5. H-3 farming qarori → 6. P2: jsonb→jadval, Octagon leak, repository pattern → 7. P3: 8 router + middleware testlari → 8. Featurelar: Marathon rejimi, sertifikat, Coins/Battle Pass.

> **Deploy eslatmasi:** P1 migratsiya talab qilmaydi; `INITDATA_MAX_AGE_SECONDS` ixtiyoriy (default 1 soat). Uzoq Telegram sessiyalari oyna tugagach bitta avto-reload ko'radi — kutilgan, loop-guard'li xatti-harakat.
