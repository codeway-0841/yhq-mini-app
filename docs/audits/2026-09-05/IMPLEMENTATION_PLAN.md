# KIVVI — audit topilmalarini tuzatish implementation plan

Manba: [2026-09-05 audit hisoboti](REPORT.md). Audit bazasi: commit `1e1d19d`. Reja: 18 topilmani qayta tekshirish, tasdiqlanganlarini tuzatish va regressiya dalillari bilan yopish. Joriy kod auditdan keyin o'zgargan bo'lishi mumkin.

## Boshqa AI uchun tayyor topshiriq

Quyidagi matnni shu repozitoriyga kirishi bor AI'ga yuboring:

> KIVVI loyihasida `docs/audits/2026-09-05/IMPLEMENTATION_PLAN.md` rejasini amalga oshir. Avval AGENTS.md va `docs/audits/2026-09-05/REPORT.md`ni o'qi. Audit topilmalarini joriy kodda qayta tekshir; hisobotdagi taxminni isbotlangan bug deb qabul qilma. Tasdiqlangan muammo uchun avval mahalliy regressiya dalili, keyin eng kichik to'g'ri patch va tegishli test yoz. Test assertion'larini yumshatib yoki testni skip qilib yashil natija yaratma. Mavjud foydalanuvchi o'zgarishlarini saqla. Bosqichlarni quyidagi tartibda bajargin; faqat reja bilan to'xtama. Production deploy/migratsiya, haqiqiy to'lov/SMS/AI xarajati yoki tashqi xabar yuborishni bu topshiriq qamramaydi. Lokal va alohida test DB'dagi ishlarni yakunla; tashqi tekshiruv talab qiladigan qismlarni aniq ko'rsat. Yakunda `IMPLEMENTATION_STATUS.md` yarat: har audit ID uchun status, sabab, o'zgargan fayllar, test natijasi va qolgan cheklovlar. Barcha 18 ID hisobga olinsin.

## Ish qoidalari

- Windows PowerShell; repo ildizi: `C:\Users\PC\Desktop\Bot`.
- Boshlanishda git status/HEAD va AGENTS.md'larni tekshir. Mavjud o'zgarishlarni revert qilma; kerak bo'lsa `codex/audit-remediation` kabi alohida branch ishlat.
- Kutubxona API'siga tegishli koddan oldin AGENTS.md bo'yicha Context7/rasmiy hujjatlarni o'qi.
- Arxitekturani qayta yozma. SSOT, frontend import chegaralari va platform wrapper'larini saqla.
- Public savollarga javob kaliti chiqmasin; explanation faqat post-answer gate bilan ochilsin.
- Telegram canonical user ID, hashed opaque token, coin ledger va idempotency invariantlari saqlansin.
- Server env faqat config schema orqali. `.env*`ga NODE_ENV yozma. Build uchun mavjud script ishlat.
- Schema kerak bo'lsa: schema → generate → migration va journal/snapshot tekshiruvi. Production migratsiyani bajarma.
- Haqiqiy secret/tokenlarni logga yoki hisobotga yozma. Test DB productiondan alohidaligini guard orqali tekshir.
- Har paket uchun alohida review qilinadigan diff saqla. Commit yaratish jamoaning mavjud ish tartibiga mos bo'lsin.
- Topilma joriy kodda tasdiqlanmasa: “tasdiqlanmadi” statusi, aniq dalil va tekshirilgan shartlarni yoz; sun'iy fix qo'shma.
- Unit test transaction atomikligini isbotlamaydi: DB muammolari haqiqiy alohida test DB'da ham tekshirilsin.

## Paketlar va bog'liqliklar

| Tartib | Paket | Audit ID | Bog'liqlik |
|---|---|---|---|
| 0 | Baseline va test muhitini aniqlash | 15, 18 | Dastlab |
| 1 | WebSocket xabar himoyasi | 01 | 0 |
| 2 | Auth lockout va canonical rate limit | 02, 04 | 0 |
| 3 | Neon linking atomikligi | 03 | 2; auth.service'ni izchil tahrirlash |
| 4 | Payment/promo holatlari | 05, 06 | 0; alohida test DB |
| 5 | Private service worker cache | 09 | 0; 6-paketdan oldin |
| 6 | Tutor auth, cancellation va locale | 07, 08, 10, 17 | 5 |
| 7 | UI accessibility | 11, 12, 13 | 0; 6 dan keyin UI qayta test |
| 8 | Cron failure propagation | 14 | 0 |
| 9 | Dependency patch va yakuniy gate | 16, 15 | Barcha paketlar |

Bu reja ketma-ket bajarilishi mumkin. Alohida AI'larga bo'linsa, 2 va 3 bir egada, 5 va 6 kelishilgan ketma-ketlikda bo'lsin; package-lock, auth.service va global CSS'ga bir vaqtda qarama-qarshi tahrir kiritilmasin.

## 0-paket — baseline, deterministik testlar va env

### ID 15: integratsiya xatolarining sababini ajratish

Fayllar:
- `tests/integration/api/security-critical.test.ts`
- `tests/integration/api/tournament-history.test.ts`
- Tegishli fixture/seed helper'lari va `vitest.integration.config.ts`

Ishlar:
1. Guard bilan alohida test DB'ni tasdiqla. Mavjud migratsiya va test seed yo'lini o'qi; faqat shu DB'da tayyorla.
2. To'liq run va ikki muammoli faylni alohida ishga tushir; 404 response body'ni qayd et. “Question not found” va “Progress row not found”ni farqla.
3. `questions.limit(1)` va hardcoded `subjectId:yhq` mosligini tekshir. Test o'z bank/topic/question fixture'ini yaratib ishlatsin yoki canonical seed'ni aniq tanlasin.
4. Tournament tarixidagi umumiy season/prize holatini testga scope qil. Cleanup boshqa test ma'lumotini o'chirmasin.
5. Agar mahsulotdagi bug aniqlansa, fixture patch bilan yashirma; alohida kod fix va regression yoz.

Qabul mezoni:
- Bir xil seed bilan alohida va odatiy parallel suite bir xil natija beradi.
- Testlar auth/anti-farm assertion'larini saqlaydi.
- 404 ildiz sababi va uning fix'i status faylida aniq.
- Alohida run'dan keyin bitta to'liq parallel run yetarli; nosozlik yoki yangi o'zgarish bo'lmasa ortiqcha qayta run qilma.

### ID 18: optional test DB env

Fayllar: `.env.example`, `server/config/index.ts`, mavjud config testlari.

Example'dagi bo'sh TEST_DATABASE_URL'ni commented optional qator qilish eng kichik yechim. Agar bo'sh qiymatni normalizatsiya qilish tanlansa, faqat tegishli optional env uchun qil; required secret validation'ini yumshatma.

Qabul mezoni: example asosidagi sozlama keraksiz min-length xatosini bermaydi; integration guard yo'q yoki productionga teng test DB'ni baribir rad etadi.

## 1-paket — ID 01: WebSocket server barqarorligi

Fayllar:
- `server/modules/octagon/octagon.gateway.ts`
- Zarur bo'lsa shu moduldagi message schema/helper
- `tests/integration/ws/octagon-hardening.test.ts` va mos unit test

Ishlar:
1. JSON parsing natijasini `unknown` sifatida ol; type assertion bilan runtime validation o'rnini bosma.
2. Envelope obyektini, type discriminator'ni va ishlatiladigan xabar maydonlarini validatsiya qil.
3. Noto'g'ri xabar ulanishga tegishli boshqariladigan rad javobi/close bilan tugasin; process-level exception chiqmasin.
4. Callback ichidagi async vazifalarda ham rejection boundary'ni tekshir.
5. Max payload, rate limit, auth timeout va qonuniy ping/auth/reconnect oqimini saqla.

Qabul mezoni:
- Lokal testda noto'g'ri JSON, noto'g'ri JSON shakli, noma'lum type va buzilgan maydonlar jarayonni to'xtatmaydi.
- Alohida sog'lom ulanish ping/auth/join funksiyasini davom ettiradi.
- Global uncaughtException shutdown himoyasini olib tashlash yechim sifatida qabul qilinmaydi.
- Production WebSocket'ga zararli sinov yuborilmaydi.

## 2-paket — ID 02 va 04: auth va rate-limit izchilligi

Fayllar:
- `server/modules/auth/auth.service.ts`, auth repository/router
- `server/middleware/db-rate-limiter.ts` va uni chaqiruvchi routerlar
- `tests/unit/server/auth.service.test.ts`
- `tests/unit/middleware/rate-limit-keying.test.ts`
- `tests/integration/api/auth.test.ts`, `db-rate-limiter.test.ts`

### ID 02

Login va mavjud phone identity'ni link qilish uchun umumiy credential verifier ajrat. Target akkaunt lock holati, failed-attempt increment va muvaffaqiyatli tekshiruvdagi reset siyosati bir xil bo'lsin. Yangi raqamning OTP bilan tasdiqlanishini parol login bilan aralashtirma. Email/login'dagi mavjud semantikani tasodifan o'zgartirma.

Qabul mezoni:
- Locklangan target to'g'ri parol bilan linking orqali ham chetlab o'tilmaydi.
- Noto'g'ri linking paroli target hisoblagichini oshiradi.
- Yangi raqam OTP va oddiy muvaffaqiyatli linking regressiyasiz ishlaydi.
- Xato javoblari kerakmas account ma'lumotini oshkor qilmaydi.

### ID 04

Barcha limiter callsite'larini ro'yxatga ol: qaysi quota user/IP/target/endpointga tegishli ekanini belgilab chiq. Raw req.path o'rniga explicit barqaror endpoint/bucket identifikatori ishlat. Bitta bucket nomini ulashgan mustaqil endpoint'larni tasodifan bitta quota'ga qo'shib yuborma; resurs bo'yicha alohida quota kerak bo'lsa uni explicit dimension qil.

Qabul mezoni:
- Bir handlerga tushadigan ekvivalent URL shakllari bitta limitdan foydalanadi.
- Alohida user va haqiqatan mustaqil endpoint limitlari izolyatsiyada qoladi.
- Auth limiter fail-closed xulqi saqlanadi.
- In-memory fallback va DB key semantikasi mos.

## 3-paket — ID 03: Neon akkaunt linking transaction

Fayllar:
- `server/db/connection.ts`
- `server/modules/auth/auth.service.ts`, auth repository
- Linking/merge integration testlari; kerak bo'lsa yangi `auth-linking-atomicity.test.ts`

Ishlar:
1. transactionBestEffort va linking helper'larining barcha callsite'larini xaritala.
2. Joriy Neon/Drizzle driver imkoniyatini rasmiy hujjatdan tasdiqla. Mavjud transaction-capable helper'dan foydalan; bo'lmasa tor doiradagi yechim kirit.
3. Link code consume, identity move, user rename/delete va tegishli ma'lumotlar bitta haqiqiy atomik birlikda bo'lsin.
4. Barcha helper shu transaction context'da ishlasin; yashirin global db chaqirig'i transactiondan chiqmasin.
5. Conflictda kodni consume qilish/qayta ishlatish semantikasini oldingi contractga mos aniq belgila.
6. Transaction ichidagi tashqi network chaqiruvlarini olib kirma; yangi sessiya javobi faqat muvaffaqiyatli commit'dan keyin.

Qabul mezoni:
- Har muhim oraliq DB bosqichdagi injected failure rollback qiladi.
- Parallel linking double identity, orphan yoki noto'g'ri canonical user ID yaratmaydi.
- Telegram identity invariant'i, FK cascade, progress/premium/coins saqlanishi tekshiriladi.
- Productionga mos Neon yo'lidagi real integration dalili bor; faqat mock bilan “atomik” deyilmaydi.

## 4-paket — ID 05 va 06: payment va promo yaxlitligi

Fayllar:
- `server/modules/payments/payment.router.ts`, `payment.repository.ts`
- `order-promo.ts`, `click.service.ts`, `payme.service.ts`
- `server/modules/promo/promo.repository.ts`
- Zarur bo'lsa `server/schema.ts` va yangi migration
- Mavjud payment-security/click-payment/promo testlari va DB concurrency testlari

### ID 05: chegirma rezervi

Implementatsiyadan avval reserve → pending → settled/cancelled/expired state jadvalini yoz. Promo user limiti va global maxUses atomik rezerv qilinsin. Retry bir order uchun qo'shimcha rezerv yaratmasin. TTL tugashi va cancel rezervni qanday bo'shatishi aniq bo'lsin.

Eski pending order'lar va to'langan buyurtmalar uchun moslik yo'lini belgila. To'lovga yuborilgan narxni callback paytida shunchaki oshirma; eski order'larni yashirin invalidatsiya qilma. Zarur migration additive va rollback bilan mos bo'lsin.

Qabul mezoni:
- Parallel pending order'larda bir martalik/global limit buzilmaydi.
- Settlement va callback retry faqat bitta redemption beradi.
- Cancel/expiry qayta ishlanishi double release yaratmaydi.
- Eski pending order va allaqachon to'langan order uchun regressionlar o'tadi.
- Haqiqiy pul o'tkazilmaydi; provider callback'lari mahalliy fixture/sandbox contract orqali test qilinadi.

### ID 06: complete/cancel transition

Click va Payme transition'larini conditional UPDATE yoki transaction lock bilan atomik qil. Oldin o'qilgan snapshot asosida yangi statusni overwrite qilma. Provider qaytarishi kerak bo'lgan status DB'dagi yakuniy holatdan olinsin.

Refund siyosatida amaldagi manual revoke ni o'zboshimchalik bilan avtomatik revoke'ga aylantirma: stacked premium/oldingi grantlarga ta'sirni hisobla. Manual qolsa, operator uchun durable reconciliation holati va aniq tekshiriladigan qayd bo'lsin.

Qabul mezoni:
- Parallel complete/cancel, takroriy callback, cancel-before-complete va refund-after-complete alohida tekshirilgan.
- Payment status, provider transaction state va entitlement mos.
- Signature/auth/amount validation va mavjud idempotency saqlanadi.

## 5-paket — ID 09: service worker private cache chegarasi

Fayllar: `public/sw.js`, `src/shared/store/account.ts` faqat zarur bo'lsa; `tests/unit/lib/sw-image-cache.test.ts` va browser SW test.

Ishlar:
1. Savol/topic collection allowlist'ini aniq route bilan chekla.
2. Private/no-store javobni umumiy cache helper saqlamasin; landing shell uchun mavjud maxsus ehtiyojni API'dan ajrat.
3. Oldingi SW versiyasi yozgan private explanation yozuvlarini ham chiqaradigan cache version/migration yo'lini qo'sh.
4. Offline fallback eski private cache'dan o'qimasin. Offline public bank va avatar siyosatini asossiz buzma.
5. Account reset'dagi CacheStorage o'zgarishi zarur bo'lsa faqat app cache'lariga tegishli bo'lsin.

Qabul mezoni:
- Authenticated explanation javobi CacheStorage'ga yozilmaydi.
- Eski cache bilan SW upgrade qilinganda private explanation qaytmaydi.
- Logout/account switch + offline holatida avvalgi private javob ochilmaydi.
- Public savollar uchun mo'ljallangan offline fallback saqlanadi.

## 6-paket — ID 07, 08, 10, 17: tutor frontend oqimi

Fayllar:
- `src/shared/lib/tutor.ts`, `src/shared/api/index.ts`
- `src/shared/lib/session.ts`, zarur bo'lsa shared auth helper
- `src/features/test/components/AiTutorModal.tsx`
- Tegishli unit/component testlari va mavjud API 401 regressionlari

### ID 07: statik izoh

fetchStaticExplanation umumiy authenticated request/recovery'dan foydalansin. 404 “izoh yo'q”; 401/403/network esa alohida holat sifatida ishlansin. Texnik xato free user'ni yolg'on premium upsell'ga olib bormasin. Post-answer gate yumshatilmasin.

### ID 08: streaming auth

Bearer ustuvorligini umumlashtir; initData fallback asosiy API contractiga mos bo'lsin. Retry faqat server so'rovni bajarmaganini bildiruvchi auth xatosida va cheklangan marta; boshlangan stream yoki umumiy 5xx uchun ko'r-ko'rona qayta POST qilma.

### ID 10: cancellation

AbortSignal'ni fetch va generatorgacha uzat. Generator finally'da reader'ni kerakli tarzda cancel/release qilsin; cancellation foydalanuvchiga tarmoq xatosi sifatida ko'rsatilmasin. Server disconnect propagation'ini tekshir, ammo allaqachon sarflangan kvotani avtomatik refund qilish yangi siyosatini kiritma.

### ID 17: locale cache

Kesh kalitiga language qo'sh; bit shift o'rniga collision bo'lmaydigan aniq tuple/string ma'qul. Javob kontekstiga ta'sir qiladigan boshqa qiymatlarni ham tekshir. Keraksiz yangi global cache qatlamini yaratma.

Umumiy qabul mezoni:
- Free + answered + izoh mavjud → izoh; unanswered → gate.
- Eskirgan initData + valid Bearer → muvaffaqiyat.
- 401 recovery cheksiz aylanishsiz; boshlangan stream dubl bo'lmaydi.
- Modal close, unmount va reopen → eski request tugaydi, stale state yozilmaydi.
- UZ → RU bir savolda tegishli tildagi matn chiqadi.
- Account switch va token expiry regressionlari o'tadi.

## 7-paket — ID 11, 12, 13: UI/UX accessibility

Fayllar:
- `src/index.css`, `src/shared/config/themes.ts`, landing rang tokenlari
- `src/features/profile/Profil.tsx`
- `src/features/premium/PremiumPage.tsx`
- Dalil: `docs/audits/2026-09-05/ui-audit.json`, `ui-probe.mjs`

Ishlar:
- **11:** primary/on-primary va subtle ranglarini WCAG kontrastiga mosla; dark/light va tanlanadigan accent'lar uchun tekshir. Kichik matn 4.5:1, katta matn 3:1. Shunchaki fontni kattalashtirib butun dizaynni buzma.
- **12:** pencil ikonka ko'rinishini saqlab touch target'ni taxminan 44×44 px qil; overlay yoki qo'shni tugma bilan to'qnashmasin.
- **13:** premium scroll region'ni nomlangan fokuslanuvchi region yoki semantik control'lar bilan klaviaturaga och. Accessible name va ko'rinadigan focus holati bo'lsin.

Qabul mezoni:
- 320/390/1440 px, dark/light, login/dashboard/profile/premium/landing qayta ko'rilgan.
- Tegishli axe kontrast va scroll-focus topilmalari yopilgan.
- Tab/focus/scroll qo'lda tekshirilgan; focus trap va safe-area buzilmagan.
- Screenshot dalillari saqlangan. Layout-only o'zgarish uchun implementationni takrorlaydigan unit testlar yozilmaydi.

## 8-paket — ID 14: cron status va retry kuzatuvi

Fayllar: `server/modules/cron/cron.router.ts`, `tests/unit/server/cron-suite.test.ts`, `tests/integration/api/cron.test.ts`.

Ishlar:
1. Child return status/body va thrown exception'ni yagona stage result'ga normalizatsiya qil.
2. Muvaffaqiyatsiz stage bo'lsa suite ok:false va tegishli non-2xx qaytarsin.
3. “Already ran”, “lease busy” kabi kutilgan no-op'larni haqiqiy failure'dan farqla.
4. Failure stage nomi bilan kuzatiladigan log/Sentry signaliga ega bo'lsin. Internal stack/secretlarni public javobga chiqarmagin.
5. Retry xavfsizligini mavjud jobRuns lease va ledger idempotency bilan tekshir; platforma avtomatik retry qiladi deb taxmin qilma.

Qabul mezoni: barcha muvaffaqiyat, child error body, exception, no-op va partial success scenariylari testlangan; retry double reward bermaydi.

## 9-paket — ID 16: dependency va yakuniy gate

Fayllar: `package.json`, `package-lock.json`; zarur bo'lsa faqat update ta'sir qilgan config.

1. `npm audit --json` va `npm audit --omit=dev --json`ni yangidan ol; audit sanasidagi sonlarni hozirgi haqiqat deb qabul qilma.
2. `npm explain qs` bilan zanjirni tekshir. Advisory'dan tashqaridagi mos patch'ni joriy rasmiy ma'lumotdan tanla.
3. Avval production dependency, keyin dev zanjirlar. Majburiy major upgrade/downgrade'ni alohida asosla.
4. `npm audit fix --force` ishlatma; regeneratsiya qilingan lockfile'ni ko'rib chiq.
5. Parser/payment validation regressionlari va quyidagi yakuniy gate'ni bajar.

Yakuniy buyruqlar:
~~~powershell
npm run lint
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.server.json --noEmit
npm run test:unit -- --coverage
npm run test:api
npm run test:e2e
npm run build
npm run build:api
npm run build:server
npm run test:integration
npm audit --json
npm audit --omit=dev --json
~~~

Integration uchun oldindan alohida TEST_DATABASE_URL, guard, shu DB migratsiyasi va seed tayyor bo'lsin. Unit/API testda ham tasodifan production DB'ga ulanilmasin. `npm run test:all` integration'ni o'z ichiga olmaydi.

Qabul mezoni:
- Tegishli xavfsizlik/business regressionlari va yakuniy testlar yashil.
- Yangi lint/type warning yo'q; oldingi 5 warning holati qayd etilgan. Mavzuga tegishli hook warning tuzatilsa stale closure/loop regressiyasi tekshiriladi.
- Dependency qolgan advisory'lari bo'lsa package, chain, reachability holati va update blokeri yozilgan.
- Coverage raqami sun'iy oshirilmaydi; yangi muhim branch'lar regression bilan qoplangan.

## Yakuniy deliverable va tugash mezoni

`docs/audits/2026-09-05/IMPLEMENTATION_STATUS.md`da quyidagi jadval bo'lsin:

| Audit ID | Status | Dalil / fix fayllari | Test va natija | Qolgan ish |
|---|---|---|---|---|
| 01–18, har biri alohida qator | Tuzatildi / Tasdiqlanmadi / Bloklangan / Bajarilmadi | Aniq yo'l va sabab | Haqiqiy bajarilgan buyruq | Yo'q yoki aniq to'siq |

Qo'shimcha:
- Joriy HEAD va tekshirilgan working tree holati.
- O'zgargan xulq va compatibility/migration qarorlari.
- Testlar soni, pass/fail, coverage va dependency audit natijasi.
- Yangilangan UI screenshot/axe dalillari.
- Agar migration bo'lsa oldingi versiyaga qaytish tartibi; ma'lumotni yo'qotuvchi rollback yo'q.
- Deployment tartibi: zarur additive schema → backend/WS → client/SW cache upgrade; eski client/backend mosligi tekshirilgan bo'lsin.
- To'lov/SMS/Telegram/Gemini sandbox, Render/Vercel env/alerts/backups va real Android tekshiruvlari uchun alohida manual checklist. Ularni bajarmasdan “o'tdi” deyilmasin.

**Tugatish:** barcha 18 ID dalil bilan hisobga olingan, tasdiqlangan fix'lar testlangan, qolgan muammolar yashirilmagan, productionga tasdiqlanmagan o'zgarish kiritilmagan. Faqat build o'tishi butun rejani yakunlangan deb hisoblash uchun yetarli emas.

