# KIVVI — kompleks audit
Sana: 2026-09-05. Tekshirilgan commit: `1e1d19d` (`fix(auth): align login and splash UI`).

**Xulosa:** tekshirilgan doirada 18 ta amaliy topilma: **3 ta P1, 13 ta P2, 2 ta P3**. Build va asosiy testlar o'tdi, lekin integratsiya to'plami to'liq yashil emas. P1 muammolar yopilmaguncha loyihani xavfsizlik auditi muvaffaqiyatli tugagan deb belgilash tavsiya etilmaydi. Bu hisobot kodni tuzatish emas: mahsulot kodi o'zgartirilmadi.

P1 — birinchi navbatda tuzatish; P2 — keyingi release oldidan rejalash; P3 — pastroq ta'sirli sifat/config muammosi. Darajalar CVSS hisob-kitobi emas. “Statik” — kod oqimida aniqlangan, real foydalanuvchi yoki to'lov bilan ekspluatatsiya qilinmagan.

## Qamrov va tekshiruv natijalari

| Yo'nalish | Bajarilgan ish / natija |
|---|---|
| Arxitektura | Graphify xaritasi va joriy source; frontend/shared/platform chegaralari, route/config testlari |
| Auth / xavfsizlik | Telegram va Bearer, login/OTP/linking, self/admin middleware, limiter, upload, private/public cache, WebSocket |
| Backend / ma'lumotlar | Progress, javob kaliti, anti-farm/idempotency, coins ledger, premium/promo/payment holatlari, AI oqimlari va cron |
| Frontend | Boot/auth recovery, tushuntirishlar, stream lifecycle, account reset, SW/offline, lazy route va build chunklari |
| UI/UX | Chromium: landing, login, dashboard dark/light, biletlar, profil, premium; 320/390/1440 px; axe va screenshot |
| DevOps | CI/build konfiguratsiyasi, migratsiya guard, test DB migratsiyasi/seed, cron, HTTP headers, Android konfiguratsiyasi |
| Dependency / secrets | npm audit; tracked fayl nomlari va tanilgan secret formatlari bo'yicha scan |
| Lint | O'tdi, 5 warning: TestPage hook dependency'larida 4, test faylida 1 unused import |
| TypeScript | Frontend va backend typecheck o'tdi |
| Unit | **172 fayl, 1 148 test o'tdi** |
| Unit coverage | Statements **39.51%**, branches **31.93%**, functions **35.08%**, lines **40.43%** |
| API test | **5 fayl, 18 test o'tdi** |
| E2E | **26 test o'tdi**; desktop va Pixel 7 konfiguratsiyasi, mavjud mock'lar bilan |
| Build | Frontend, API va server build o'tdi |
| Integration | Alohida test DB tekshirildi, migratsiya va seed o'tdi. **35 fayl: 33 o'tdi, 2 yiqildi; 274 test: 271 o'tdi, 3 yiqildi** |
| Fokusli qayta test | Parallelizm o'chirilgan 2 fayl: **14 o'tdi, 4 yiqildi**. Tournament history o'tdi; security-critical ichidagi xatolar saqlandi |
| Dependency audit | **9 moderate package node; 0 high, 0 critical**. Production-only: **1 moderate package — qs** |
| Production smoke | Landing/app 200; app ildizi /app.html'ga redirect; health/ready 200; credentialsiz auth/me 401 |

Coverage foizi butun mahsulotning xavfsizlik kafolati emas. E2E va UI kuzatuvlari haqiqiy to'lov/Telegram/AI xizmatlarini end-to-end tasdiqlamaydi.

## P1 — avval tuzatiladigan muammolar

### 01. WebSocket xabar shakli tekshirilmasligi serverni to'xtatishi mumkin
**Dalil:** [octagon.gateway.ts:284](C:/Users/PC/Desktop/Bot/server/modules/octagon/octagon.gateway.ts:284), [index.ts:65](C:/Users/PC/Desktop/Bot/server/index.ts:65).

JSON parsing try/catch ichida, lekin parse natijasining obyekt ekanligi tekshirilmasdan `msg.type` o'qiladi. Bu autentifikatsiyadan oldingi handler qismida. Noto'g'ri shakldagi valid JSON uchun lokal, izolyatsiyalangan handler tekshiruvi TypeError berdi; serverning uncaughtException handler'i shutdown boshlaydi. Natijada shu jarayondagi duel va fon xizmatlari uzilishi mumkin.

**Tuzatish:** xabar envelope'ini runtime schema orqali tekshirish, noma'lum shakllarni rad etish, butun callback exception chegarasini saqlash. **Qabul mezoni:** noto'g'ri xabarlar ulanish darajasida boshqariladi, process tirik qoladi, sog'lom ulanishlar ishlaydi. Productionga zararli xabar yuborilmadi.

### 02. Telefon akkauntini bog'lash victim account lockout'ini qo'llamaydi
**Dalil:** [auth.service.ts:438](C:/Users/PC/Desktop/Bot/server/modules/auth/auth.service.ts:438), [auth.service.ts:529](C:/Users/PC/Desktop/Bot/server/modules/auth/auth.service.ts:529).

Oddiy telefon login'i akkaunt lockout va failed-attempt hisoblagichini tekshiradi. Mavjud telefon akkauntini link qilish esa o'sha parolni to'g'ridan-to'g'ri tekshiradi; target akkauntning lock holati va hisoblagichi ishlatilmaydi. Endpoint limiter mavjudligi bu victim bo'yicha himoya bilan teng emas.

**Tuzatish:** login va linking uchun umumiy parol-verifikatsiya funksiyasi; target user bo'yicha lockout, xato hisoblash va bir xil javob semantikasi. **Qabul mezoni:** locklangan akkaunt link yo'lidan ham tasdiqlanmaydi, noto'g'ri linking parollari umumiy hisoblagichga tushadi. Statik topilma.

### 03. Neon'da “transactionBestEffort” haqiqiy transaction bermaydi
**Dalil:** [connection.ts:100](C:/Users/PC/Desktop/Bot/server/db/connection.ts:100), [auth.service.ts:534](C:/Users/PC/Desktop/Bot/server/modules/auth/auth.service.ts:534), [auth.service.ts:585](C:/Users/PC/Desktop/Bot/server/modules/auth/auth.service.ts:585), [auth.service.ts:208](C:/Users/PC/Desktop/Bot/server/modules/auth/auth.service.ts:208).

Neon yo'lida wrapper shunchaki `callback(db)` qiladi. Linking ichidagi FOR UPDATE qulfi keyingi mustaqil so'rovlargacha ushlanmaydi. Bundan tashqari, wrapper bergan db argumenti sabab adopt helper'dagi alohida Neon transaction shoxi tanlanmaydi. Kod consume/merge/identity bosqichlari orasidagi xato yoki parallel o'zgarishda qisman bajarilgan linking holatini qoldirishi mumkin.

**Tuzatish:** shu oqimni haqiqiy transaction-capable connection yoki to'liq atomik SQL operatsiyasiga ko'chirish. **Qabul mezoni:** har oraliq bosqichdagi sun'iy nosozlikda barcha o'zgarishlar rollback bo'ladi; parallel linking invariantlarni saqlaydi. Real akkauntlar ustida failure injection qilinmadi.

## P2 — xavfsizlik, biznes va ishlashdagi muammolar

### 04. Rate-limit kaliti canonical route o'rniga raw path'ga bog'langan
**Dalil:** [db-rate-limiter.ts:85](C:/Users/PC/Desktop/Bot/server/middleware/db-rate-limiter.ts:85).

Limiter `bucket + method + req.path + key` bilan hisoblaydi. Router bir xil handlerga moslashtiradigan URL shakllari va resurs ID'lari alohida hisoblagich ochadi. Natijada handler yoki foydalanuvchi uchun ko'zlangan umumiy limit bo'linib ketishi mumkin. Statik topilma; live bypass sinovlari o'tkazilmadi.

**Tuzatish:** barqaror endpoint/bucket identifikatori va kerakli user/IP/target dimension'lari; raw path'ni audit metadata sifatida saqlash. **Qabul mezoni:** bir handlerning ekvivalent yo'llari bitta limitni ishlatadi.

### 05. Promokod limiti pending buyurtmalarga rezerv qilinmaydi
**Dalil:** [payment.router.ts:65](C:/Users/PC/Desktop/Bot/server/modules/payments/payment.router.ts:65), [order-promo.ts:12](C:/Users/PC/Desktop/Bot/server/modules/payments/order-promo.ts:12).

Chegirma huquqi buyurtma yaratilishida tekshiriladi va arzon narx pending order'ga yoziladi. Settlement'da promo redemption keyin bajariladi, uning natijasi to'lov/entitlement qaroriga ta'sir qilmaydi. Bir vaqtda ochiq qolgan buyurtmalarda bir martalik yoki global limit mo'ljaldan ko'proq chegirmaga aylanishi mumkin.

**Tuzatish:** user/promo/order bo'yicha atomik rezerv, expiry va cancellation release qoidasi; to'lovga yuborilgan narx bilan mos settlement modeli. **Qabul mezoni:** parallel pending order'lar promo limitini oshirmaydi. Haqiqiy to'lov bajarilmadi.

### 06. Payment cancel va complete o'rtasida atomik status sharti yetishmaydi
**Dalil:** [click.service.ts:291](C:/Users/PC/Desktop/Bot/server/modules/payments/click.service.ts:291), [payme.service.ts:240](C:/Users/PC/Desktop/Bot/server/modules/payments/payme.service.ts:240).

Cancel qarori oldin o'qilgan statusdan olinadi, UPDATE esa faqat order ID bilan ishlaydi. Shu orada complete bo'lsa, yangi holat eski qaror asosida overwrite qilinishi mumkin. Payme'da refund'dan keyingi premium revoke ataylab manual; bu jarayon uchun tekshirilgan reconciliation zarur.

**Tuzatish:** transition'larni conditional UPDATE/row lock bilan boshqarish, refund va entitlement uchun idempotent hisob-kitob. **Qabul mezoni:** complete/cancel parallel testida order, provider state va premium mos qoladi. Race statik aniqlangan; providerda qayta yaratilmagan.

### 07. Bepul statik tushuntirish so'rovi auth headersiz yuboriladi
**Dalil:** [tutor.ts:21](C:/Users/PC/Desktop/Bot/src/shared/lib/tutor.ts:21), [questions.router.ts:178](C:/Users/PC/Desktop/Bot/server/modules/questions/questions.router.ts:178), [AiTutorModal.tsx:99](C:/Users/PC/Desktop/Bot/src/features/test/components/AiTutorModal.tsx:99).

Client oddiy fetch ishlatadi; Bearer/initData qo'shilmaydi. Server esa explanation uchun autentifikatsiya va oldingi javobni talab qiladi. Production auth yo'lida foydalanuvchi savolga javob bergan bo'lsa ham so'rov 401 bo'ladi; modal xatoni yutib premium upsell ko'rsatadi.

**Tuzatish:** umumiy autentifikatsiyalangan API client; 401/403/network holatini “premium kerak”dan ajratish. **Qabul mezoni:** free foydalanuvchiga javobdan keyin mavjud statik izoh ochiladi; javobdan oldin gate saqlanadi.

### 08. AI tutor valid Bearer o'rniga eskirgan initData'ni tanlaydi
**Dalil:** [tutor.ts:48](C:/Users/PC/Desktop/Bot/src/shared/lib/tutor.ts:48).

Stream client initData mavjud bo'lsa sessiya tokenini yubormaydi. Bu loyihaning asosiy HTTP client'idagi Bearer ustuvorligi va recovery siyosatiga zid. Telegram oynasi uzoq ochiq turganda asosiy API ishlasa ham AI tushuntirish 401 bilan yiqilishi mumkin.

**Tuzatish:** auth header tanlashni umumiy helper'ga o'tkazish; stream boshlanishidan oldingi 401 recovery'ni boshqarish. **Qabul mezoni:** eski initData + valid Bearer holatida tutor ishlaydi. Statik topilma.

### 09. Service worker private explanation yo'lini umumiy savol keshi sifatida oladi
**Dalil:** [sw.js:34](C:/Users/PC/Desktop/Bot/public/sw.js:34), [sw.js:40](C:/Users/PC/Desktop/Bot/public/sw.js:40), [account.ts:63](C:/Users/PC/Desktop/Bot/src/shared/store/account.ts:63).

`/api/questions` prefix'i explanation subroute'ini ham qamrab oladi; kesh helper'i Cache-Control'ni olib tashlaydi. Shu sabab muvaffaqiyatli private explanation javobi URL keshi orqali account almashtirilgandan keyin ham offline qaytishi mumkin; account reset CacheStorage'ni tozalamaydi. 07-topilmadagi client auth xatosi hozir bu yo'lni cheklaydi, lekin cache chegarasi mustaqil ravishda noto'g'ri.

**Tuzatish:** faqat aniq public collection endpoint'larini cache qilish; private/no-store'ni hurmat qilish; kerak bo'lsa account-scoped cache cleanup. **Qabul mezoni:** explanation CacheStorage'ga tushmaydi, user almashganda oldingi private javob qaytmaydi. Statik topilma.

### 10. AI modal yopilishi fetch/reader'ni haqiqatan bekor qilmaydi
**Dalil:** [AiTutorModal.tsx:52](C:/Users/PC/Desktop/Bot/src/features/test/components/AiTutorModal.tsx:52), [tutor.ts:57](C:/Users/PC/Desktop/Bot/src/shared/lib/tutor.ts:57), [tutor.ts:72](C:/Users/PC/Desktop/Bot/src/shared/lib/tutor.ts:72).

AbortController yaratiladi, lekin signal explainQuestion/fetch'ga uzatilmaydi. Flag faqat navbatdagi chunk kelgach tekshiriladi; reader cancel/release uchun finally yo'q. Modal yopilgach ham so'rov va stream resurslari davom etishi mumkin.

**Tuzatish:** signal uzatish, finally'da reader cleanup, server disconnect cancellation'ini tekshirish. **Qabul mezoni:** modal yopilganda network stream tugaydi; qayta ochish eskisi bilan parallel qolmaydi. AI provider xarajati miqdori o'lchanmadi.

### 11. Bir nechta sahifada matn kontrasti WCAG AA'dan past
**Dalil:** [ui-audit.json](ui-audit.json), [index.css:330](C:/Users/PC/Desktop/Bot/src/index.css:330), [themes.ts:38](C:/Users/PC/Desktop/Bot/src/shared/config/themes.ts:38).

Axe o'lchovi: ko'k CTA ustida oq matn **3.75:1** (kichik matn uchun 4.5:1 kerak); dark ikkilamchi matn **3.93–3.94:1**; landingdagi ayrim matn **4.17:1**. Login, dashboard, biletlar, profil va premiumda qayd etildi. Har bir sahifadagi node soni alohida JSON'da.

**Tuzatish:** primary/background va subtle tokenlarini kontrast bilan moslashtirish; dark/light hamda accent variantlarda qayta tekshirish. **Qabul mezoni:** kichik oddiy matn kamida 4.5:1, katta matn kamida 3:1.

### 12. Profil tahrirlash tugmasining bosish maydoni juda kichik
**Dalil:** [Profil.tsx:183](C:/Users/PC/Desktop/Bot/src/features/profile/Profil.tsx:183), [profile screenshot](screenshots/profile.png).

390 px ekranda “Profilni tahrirlash” target **16×16 px** o'lchandi. Profil ID/level va premium promo linklari ham 16–18 px baland; matn ichidagi link istisnolari alohida baholanishi kerak. Eng aniq muammo — alohida pencil tugmasi.

**Tuzatish:** ikonani saqlagan holda hit area'ni kengaytirish; mobil uchun 44×44 px amaliy maqsad. **Qabul mezoni:** klaviatura fokusli, yon element bilan ustma-ust tushmaydigan qulay touch target.

### 13. Premium ranglar karuseliga klaviatura orqali kirib bo'lmaydi
**Dalil:** [PremiumPage.tsx:134](C:/Users/PC/Desktop/Bot/src/features/premium/PremiumPage.tsx:134), [ui-audit.json](ui-audit.json).

Axe `scrollable-region-focusable` topdi: gorizontal overflow konteyner va uning ichki ko'rinadigan elementlari fokus olmaydi. Klaviatura foydalanuvchisi ko'rinmay qolgan qismni boshqarishda qiynaladi.

**Tuzatish:** nomlangan fokuslanuvchi scroll region yoki semantik/fokuslanuvchi control'lar. **Qabul mezoni:** Tab va klaviatura yordamida barcha variantlarni ko'rish/boshqarish mumkin.

### 14. Cron suite ichki xatoda ham HTTP 200 va ok:true qaytaradi
**Dalil:** [cron.router.ts:423](C:/Users/PC/Desktop/Bot/server/modules/cron/cron.router.ts:423), [cron.router.ts:445](C:/Users/PC/Desktop/Bot/server/modules/cron/cron.router.ts:445).

Child natijasining status'i tashlab yuboriladi; exception JSON ichiga yoziladi, lekin suite yakuni doim muvaffaqiyatli. HTTP statusga tayanadigan scheduler/monitor cleanup yoki weekly rollover buzilganini sezmaydi. Sentry catch bor, ammo child body orqali qaytgan xato ham top-level muvaffaqiyat bo'lib qoladi.

**Tuzatish:** stage natijalaridan aggregate success/status hisoblash, failed stage uchun alert va idempotent retry. **Qabul mezoni:** bitta stage yiqilganda top-level failure aniq ko'rinadi; muvaffaqiyatli stage qayta ishga tushganda dubl mukofot yo'q.

### 15. Integratsiya testlari barqaror yashil holatda emas
**Dalil:** [security-critical.test.ts:391](C:/Users/PC/Desktop/Bot/tests/integration/api/security-critical.test.ts:391), [tournament-history.test.ts:68](C:/Users/PC/Desktop/Bot/tests/integration/api/tournament-history.test.ts:68).

To'liq run'da H-3 testlari kutilgan 200 o'rniga 404 oldi; tournament tarixida 2 o'rniga 3 season chiqdi. Parallelizm o'chirilganda tournament o'tdi, ammo security faylida 4 test yiqildi: topic filter bo'sh natija, replay va ikki H-3 404.

Savol fixture'i bankni cheklamasdan `questions.limit(1)` tanlaydi, so'rov esa `subjectId:yhq`; bu data/seedga bog'lanishning aniq belgisi. **404 ning yakuniy ildiz sababi bu auditda to'liq ajratilmadi**; uni anti-farm ishlamaydi deb talqin qilish mumkin emas. Tournament farqi parallel fixture interference'iga mos keladi, lekin bu ham alohida tekshirilishi kerak.

**Tuzatish:** har testga o'z bank/topic/question/season fixture'i, deterministik seed va scope'li cleanup; 404 body'ni assertion diagnostikasiga qo'shish. **Qabul mezoni:** to'liq CI parallel run va alohida run bir xil natija beradi.

### 16. Lockfile'da moderate dependency advisory'lari bor
**Dalil:** npm audit va production-only audit. Production node — `qs`; qolganlar build/CLI zanjirlarida: Capacitor/xcode/uuid, xmldom, drizzle-kit/esbuild-kit/esbuild.

`qs` uchun GHSA-4mjr-xmp4-gh2g va GHSA-x5fp-wj9c-mxmx qaytdi. **Ilovada exploit reachability tasdiqlanmadi**; Express query/parser konfiguratsiyasi ta'sirni kamaytirishi mumkin. Bu “productionda 9 ta exploitable zaiflik” degani emas.

**Tuzatish:** avval qs'ni advisory'dan tashqaridagi mos versiyaga lockfile orqali ko'tarish, keyin dev dependency yangilashlarini alohida tekshirish. `npm audit fix --force`ni ko'r-ko'rona ishlatmaslik. **Qabul mezoni:** audit, typecheck, build va parser/payment regression testlari o'tadi.

## P3 — sifat va sozlama

### 17. AI tushuntirish keshi tilni hisobga olmaydi
**Dalil:** [AiTutorModal.tsx:56](C:/Users/PC/Desktop/Bot/src/features/test/components/AiTutorModal.tsx:56).

Kesh kaliti questionId va isCorrect'dan iborat, language yo'q. Til o'zgargach shu savolning avvalgi tildagi izohi qaytishi mumkin. **Tuzatish:** tilni kalitga qo'shish, kesh hajmi/umrini cheklash; UZ → RU ketma-ketligini tekshirish.

### 18. .env.example bo'sh TEST_DATABASE_URL bilan schema'ga mos emas
**Dalil:** [.env.example:18](C:/Users/PC/Desktop/Bot/.env.example:18), [config/index.ts:15](C:/Users/PC/Desktop/Bot/server/config/index.ts:15).

Example'dagi `TEST_DATABASE_URL=""` qiymati `z.string().min(1).optional()`dan o'tmaydi; optional bo'sh stringni yo'q deb hisoblamaydi. Example'dan yangi env yaratgan foydalanuvchi config xatosiga duch keladi. **Tuzatish:** optional qatorni kommentga olish yoki schema'da bo'sh qiymatni undefined sifatida normalizatsiya qilish.

## Performance va ijobiy dalillar

- Frontend build: asosiy app chunk taxminan **193 KB / 67 KB gzip**, landing **66 KB / 18 KB gzip**. Katta chunklar: content-signs **565 KB / 105 KB gzip**, HEIC fallback **1 352 KB / 345 KB gzip**; HEIC lazy holati odatiy boot yukiga teng emas.
- App boot'dan keyin barcha route chunklarini idle'da prefetch qiladi. Sekin mobil internetda tarmoq/energiya narxi bor; bu auditda real qurilmada LCP/INP/traffic budget o'lchanmadi. Save-Data/connection shartlari va eng zarur route'largagina prefetch qilishni o'lchov bilan baholash kerak.
- Ko'rilgan 8 UI holatda hujjat darajasida gorizontal overflow va pageerror qayd etilmadi. Bu boshqa route, modal yoki real Telegram safe-area holatlari uchun umumiy kafolat emas.
- Javob kalitini public payload'dan ajratish, server scoring, idempotency/ledger va sessiya tokenlarini hash saqlash kabi muhim himoya qatlamlari mavjud.
- Production smoke'da CSP, HSTS va nosniff headerlari bor. CSP'da unsafe-inline va keng connect-src mavjud; ularning toraytirilishi integratsiyalar bilan sinovdan o'tishi kerak, header mavjudligi XSS yo'qligini isbotlamaydi.
- Tracked source scan'da tanilgan real secret/private key formatiga mos topilma chiqmadi. Git history, cloud secret store yoki barcha custom credential formatlari to'liq tekshirilmagan.

## Tuzatish tartibi

1. **P1:** WebSocket schema/exception; umumiy account lockout; Neon linking atomikligi.
2. **To'lov va cache:** promo rezerv, payment transitions, private SW boundary.
3. **Foydalanuvchi oqimi:** statik izoh auth, tutor Bearer va cancellation; kontrast, touch va keyboard.
4. **Release ishonchliligi:** integration fixture/seed diagnostikasi, cron failure propagation, dependency patchlar.
5. **Yakuniy qayta audit:** regressionlar + to'liq test gate; keyin quyidagi tashqi tekshiruvlar.

## Tekshirilmagan / tashqi muhit talab qiladigan qismlar

- Render/Vercel dashboard'laridagi haqiqiy env parity, RBAC, alert routing, backup retention va restore drill.
- Real payment provider sandbox/production reconciliation, refund operator jarayoni va webhook retry SLA.
- Haqiqiy SMS/Telegram contact/login yetkazilishi va pullik Gemini generatsiyasi/kvota xarajati.
- Real Android qurilmasida release APK, signing/keystore recovery, OS backup qoidalari, WebView va safe-area/accessibility.
- Uzoq muddatli load/soak, cold-start p95/p99, barcha foydalanuvchi rollari va barcha sahifalarda screen-reader manual audit.
- To'liq pentest, dependency exploitability tahlili va Git tarixining keng secrets auditi.

Bu qismlar “o'tdi” deb belgilanmadi. Alohida test DB migratsiya va seed bilan yangilandi; production DB migratsiyasi, deployment yoki haqiqiy to'lov bajarilmadi.

## Dalillar va qayta ishlatish

- [UI o'lchovlari va axe natijalari](ui-audit.json)
- [UI probe skripti](ui-probe.mjs) — mavjud E2E fixture'lari; ishga tushirish talablari fayl boshida.
- [Landing](screenshots/landing.png), [login](screenshots/login.png), [dashboard dark](screenshots/dashboard.png), [dashboard light](screenshots/dashboard-light.png), [biletlar](screenshots/tickets.png), [profil](screenshots/profile.png), [premium](screenshots/premium.png), [desktop](screenshots/dashboard-desktop.png).
- Oddiy browser tekshiruvlari mock API bilan bajarilgan; screenshots real foydalanuvchi ma'lumotlarini ko'rsatmaydi.

Mezonlar: [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) — message validation va ulanish himoyalari; [GitHub qs advisory](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) — dependency advisory tafsiloti. Kontrast natijalari mahalliy axe o'lchovidan olingan.

