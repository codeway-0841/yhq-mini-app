**Qaror: NO-GO — hozirgi holatda production release uchun tayyor emas.**

Audit sanasi: 2026-09-03. Tekshirilgan commit: `da6f9d2`; boshlang'ich working tree toza edi. Ilova kodi o'zgartirilmadi. Audit skripti va dalillar qo'shildi. Quyidagi baho tekshirilgan kod va bajarilgan testlarga tegishli; barcha production konfiguratsiyalariga kafolat emas.

Asosiy to'siq — pulga teng qiymatga ega coin/premium operatsiyalarining parallel so'rovlarda noto'g'ri ishlashi. Mavjud testlarning yashil chiqishi bu holatlarni qoplamaydi.

| Tekshiruv | Natija |
|---|---|
| Frontend va server TypeScript | Ikkalasi o'tdi |
| ESLint | 0 error, 1 warning: `src/App.tsx:268`, ortiqcha eslint-disable |
| Unit | 146 fayl, 967 test o'tdi |
| API | 5 fayl, 18 test o'tdi |
| Integration, alohida Neon test DB | Migratsiyadan keyin 35 fayl, 266 test o'tdi |
| Frontend, Vercel API va server build | O'tdi; frontend chunk-size va plugin timing ogohlantirishlari bor |
| `npm audit --omit=dev` | 0 ma'lum vulnerability; bu biznes mantiq xavfsizligini tasdiqlamaydi |
| E2E, to'liq parallel run | 15 o'tdi, 3 Android profilida yiqildi |
| E2E, belgilar/biletlar, 1 worker | 4/4 o'tdi; birinchi xatolar deterministik funksional buzilish deb tasdiqlanmadi |
| Production read-only smoke | App 200; `/api/health` 200; `/api/ready` 200; credentials'siz `/api/auth/me` 401 |

**Amalda tasdiqlangan muammolar**

1. **[P1] Bitta xarid balansi bilan bir necha kun premium beriladi.** [coins.repository.ts:121](C:/Users/PC/Desktop/Bot/server/modules/coins/coins.repository.ts:121)

   600 coin balansi bor foydalanuvchidan sakkizta turli `purchaseId` bilan parallel `premium-days-1` xaridi yuborildi. Kutilgan: 1 kun premium va 600 coin debit. Natija: qariyb **8 kun premium**, balans 0, ledger jami **-4800**. `grant_premium` muvaffaqiyatli `debit`ga emas, `ledger` mavjudligiga qaraydi. Balans yetmay qolgan so'rovning ledger/granti statement bilan commit bo'ladi. Durable buyum claim'i ham debitdan oldin yoziladi; u yo'l alohida reproduksiya qilinmadi.

   Tuzatish: balans debit'i, egalik/grant va ledger bir tranzaksiyada muvaffaqiyatli debitga bog'lansin; yetarli mablag' bo'lmasa hech bir yon yozuv qolmasin. Test: turli purchaseId, aralash buyumlar, faqat bitta xaridga yetadigan balans.

2. **[P1] Kunlik vazifa mukofoti bir necha marta beriladi.** [coins.repository.ts:265](C:/Users/PC/Desktop/Bot/server/modules/coins/coins.repository.ts:265)

   `answers-20` uchun sakkiz parallel claim: kutilgan **20 coin**, haqiqiy balans **160 coin**, ledger esa atigi **20 coin**. Barcha javoblar `ok`. `award` avval bajariladi, unique ledger insert keyin `ON CONFLICT DO NOTHING` qiladi; bu avvalgi award'ni bekor qilmaydi.

   Tuzatish: unique claim/ledger insert birinchi bo'lsin, balans faqat uning `RETURNING` natijasi bo'yicha oshsin. Test: sakkiz parallel claim'da aynan bitta grant va balans/ledger tengligi.

3. **[P1] Bir savolning parallel to'g'ri javoblari anti-farm himoyasidan o'tadi.** [progress.repository.ts:152](C:/Users/PC/Desktop/Bot/server/modules/progress/progress.repository.ts:152)

   Bir foydalanuvchi, bir savol, sakkiz yangi `clientToken`: kutilgan **2 coin**, haqiqiy **16 coin**, kreditlangan so'rovlar **8 ta**. Token himoyasi bir tokenning replay'ini to'xtatadi; turli tokenlarda `gate` eski `progress_questions` snapshot'ini ko'radi. XP va kunlik limit hisoblari ham statement boshidagi o'qishga tayanadi.

   Tuzatish: javobning ruxsat etilgan holat o'tishini atomik claim qiling; mukofot/counterlar faqat g'olibga bog'lansin. Kunlik cap ham parallel so'rovda buzilmaydigan conditional update yoki to'g'ri tranzaksiya orqali yuritilsin. Test: ayni savol va cap chegarasidagi turli savollar.

4. **[P1] Xato tuzatish endpoint'i javob isbotisiz coin olishga imkon beradi; oddiy oqimda ham ikki marta sanaydi.** [daily.router.ts:79](C:/Users/PC/Desktop/Bot/server/modules/daily/daily.router.ts:79)

   `addFixed` besh marta chaqirilgach, birorta savolga javob bermagan yangi test foydalanuvchisi `fix-5` vazifasidan **20 coin** oldi. Router faqat `subjectId` oladi, savol yoki tekshirilgan natijani talab qilmaydi. Bundan tashqari, [progress.repository.ts:244](C:/Users/PC/Desktop/Bot/server/modules/progress/progress.repository.ts:244) tuzatishni allaqachon sanaydi, [useAppStore.ts:176](C:/Users/PC/Desktop/Bot/src/shared/store/useAppStore.ts:176) esa yana `addDailyFix` yuboradi.

   Tuzatish: `fixed` faqat server tekshirgan `/result` operatsiyasida yozilsin. Eski client/outbox endpoint'ini moslik uchun no-op qilish yoki olib tashlash oqimi ishlab chiqilsin. Test: 0 javob → 0 fixed; 1 haqiqiy tuzatish → aynan 1 fixed.

Reproduksiya: [audit-production-probes.ts](C:/Users/PC/Desktop/Bot/scripts/audit-production-probes.ts), natija: [audit-probes.log](C:/Users/PC/Desktop/Bot/docs/audits/2026-09-03-evidence/audit-probes.log). Skript faqat alohida `TEST_DATABASE_URL` va `NODE_ENV=test` bilan ishlaydi. Parallel snapshotlarni deterministik qilish uchun o'zining vaqtinchalik foydalanuvchi balans qatorini 5 soniya lock qiladi. Barcha vaqtinchalik foydalanuvchilar yakunda o'chirildi. Lock'siz dastlabki parallel run birinchi ikkita raceni ko'rsatmadi — oddiy `Promise.all` race yo'qligini isbotlamaydi.

**Kod tahlilida aniqlangan qo'shimcha muammolar**

5. **[P1] Click/Payme to'lovi completed bo'lib, premium berilmay qolishi mumkin.** [click.service.ts:329](C:/Users/PC/Desktop/Bot/server/modules/payments/click.service.ts:329), [payme.service.ts:176](C:/Users/PC/Desktop/Bot/server/modules/payments/payme.service.ts:176)

   Order `completed`ga o'tishi va `paymentRepository.complete()` alohida DB operatsiyalari. O'rtada process o'lsa yoki serverless timeout bo'lsa, `catch` kompensatsiyasi ishlamaydi. Retry completed order uchun success qaytarib, yetishmayotgan entitlement'ni tiklamaydi. To'lov provayderida fault-injection bajarilmadi; xulosa koddagi aniq ketma-ketlikka asoslangan.

   Tuzatish: order + ledger + entitlement atomik tranzaksiyada saqlansin yoki durable `processing` holati va idempotent reconciliation bo'lsin. Test: claim'dan keyin, grant'dan oldin uzilish va keyingi retry.

6. **[P1] Payme CreateTransaction parallel chaqiriqda avvalgi tranzaksiyani almashtiradi.** [payme.service.ts:149](C:/Users/PC/Desktop/Bot/server/modules/payments/payme.service.ts:149)

   Ikki chaqiriq `providerTransId=null` deb o'qishi mumkin. UPDATE faqat `status='pending'`ni tekshiradi va statusni o'zgartirmaydi; demak ikkalasi ham o'tib, ikkinchisi birinchisining transaction ID'sini bosadi. Birinchi ID bilan Perform/Check endi buyurtmani topolmaydi.

   Tuzatish: claim predikatiga `provider_trans_id IS NULL` qo'shing, g'olib bo'lmagan so'rov saqlangan ID'ni qayta o'qisin; provider+transaction identifikatorining uniqueness invariantini ham tekshiring. Haqiqiy Payme callback'i bilan bu auditda sinov qilinmadi.

7. **[P2] Ertangi AI test ID orqali oldindan ochiladi.** [ai-tests.router.ts:108](C:/Users/PC/Desktop/Bot/server/modules/ai-tests/ai-tests.router.ts:108), [ai-tests.router.ts:145](C:/Users/PC/Desktop/Bot/server/modules/ai-tests/ai-tests.router.ts:145)

   Scheduler bugun va ertaga uchun variant yaratadi. GET/submit faqat ID, premium va attempt holatini tekshiradi; `test.date` uchun chiqarilish vaqti guard'i yo'q. Shuning uchun topilgan kelajak ID'sini oldindan ko'rish/topshirish mumkin. Hozirgi production DB'da kelajak test borligi tekshirilmadi.

   Tuzatish: kelajak sanani serverda GET va submit'da rad eting. Arxiv testlarining ruxsati alohida mahsulot qarori bo'lishi mumkin.

8. **[P2] AI baholash timeout'i Vercel funksiyasi byudjetini to'liq egallaydi.** [grader.ts:30](C:/Users/PC/Desktop/Bot/server/modules/ai-tests/grader.ts:30), [vercel.json:16](C:/Users/PC/Desktop/Bot/vercel.json:16)

   Gemini uchun 60 soniya, funksiyaning jami `maxDuration`i ham 60 soniya. Auth, rate-limit, DB read, kvota va natijani saqlash uchun zaxira yo'q; client'dagi 90 soniya server umrini uzaytirmaydi. Sekin grading'da javob saqlanmasdan timeout va qayta kvota sarfi xavfi bor.

   Tuzatish: server deadline'iga zaxira qoldiradigan qisqaroq grading timeout'i yoki durable background job. Test: sekin AI javobi, uzilish, retry, kvota va bitta attempt saqlanishi.

9. **[P2] E2E release gate barqaror emas.** [biletlar.spec.ts:11](C:/Users/PC/Desktop/Bot/tests/e2e/biletlar.spec.ts:11), [belgilar.spec.ts:11](C:/Users/PC/Desktop/Bot/tests/e2e/belgilar.spec.ts:11)

   Parallel run'da uchta Android test keyingi elementni kutishda yiqildi; artefaktlarda `Yuklanmoqda` qolgan. Shu fayllar bitta worker bilan 4/4 o'tdi. Demak buni production UI doim buzilgan deb ko'rsatish noto'g'ri, ammo release gate ishonchliligi hal qilinmagan. `.route-page` ko'rinishini tayyor kontent deb qabul qilish yetarli emas.

   Tuzatish: tayyor sahifaning mazmunli elementini kuting, dev-server yuklanishi/mock izolyatsiyasini aniqlang; CI retry'si sababni yashirmasin. [Birinchi log](C:/Users/PC/Desktop/Bot/docs/audits/2026-09-03-evidence/audit-e2e.log), [focused run](C:/Users/PC/Desktop/Bot/docs/audits/2026-09-03-evidence/audit-e2e-focused.log).

CTE — avtomatik ravishda barcha biznes invariantlari race-safe degani emas. Oddiy SELECT snapshot'i lock kutilgandan keyin yangilanmaydi; conditional UPDATE esa yangilangan qator predikatini qayta tekshirishi mumkin. Yuqoridagi tafovutlar shu semantikaga mos: [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [data-modifying CTE](https://www.postgresql.org/docs/current/queries-with.html#QUERIES-WITH-MODIFYING).

**Qamrov va cheklovlar.** Graphify arxitektura xaritasi, auth/ownership, admin mount tartibi, webhook imzo tekshiruvlari, coin/progress/daily SQL, payment lifecycle, AI testlar, frontend API/outbox/account reset, WS kirish cheklovlari, migration/CI/deploy konfiguratsiyalari ko'rildi. Auth fail-closed, token hashing, public javob kalitini yashirish, validation va ko'p regression testlar mavjud. Ular yuqoridagi iqtisodiy xatolarni bartaraf qilmaydi.

Production smoke faqat xavfsiz GET so'rovlari bilan o'tdi; production'da race/exploit, to'lov yoki broadcast bajarilmadi. Render/Vercel dashboard env'lari, haqiqiy Click/Payme checkout/refund, Telegram bot contact/login, native APK qurilmasi, backup-restore va yuklama sinovi bu auditda tasdiqlanmadi. Playwright Android profili haqiqiy APK tekshiruvi o'rnini bosmaydi. Report barcha fayllarning formal tekshiruvi yoki mustaqil pentest sertifikati emas.

**Release sharti.** Avvalo P1 1–6 ni tuzating va yuqoridagi reproduksiyalarni assertion'li regression testlarga aylantiring. Coin balansini ledger bilan solishtirish, debit/grant mosligi, parallel claim/javob va uzilgan payment retry testlari o'tishi shart. So'ng P2 holatlar, E2E barqarorligi, staging'da haqiqiy auth/to'lov oqimlari va backup tiklash tekshirilsin. Hozir yashil buildga asoslanib productionga tayyor deb tasdiqlash mumkin emas.
