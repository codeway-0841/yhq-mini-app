# Streak Coin-Save — dizayn

> Sessiya: 2026-08-23. Brainstorming orqali kelishilgan. Implementatsiyadan oldin
> foydalanuvchi shu faylni ko'rib chiqishi kerak.

## Muammo va maqsad

Hozir streak (kunlik ketma-ket faollik seriyasi) faqat PREMIUM userlar uchun
1 kunlik "kechirim"ga ega: agar premium user aynan 1 kun mashq qilmasa, streak
saqlanib qoladi ("muzlatilgan" holat); 2+ kun uzilsa yoki user premium bo'lmasa —
streak darhol 0 ga tushadi (`server/modules/daily/daily.repository.ts` —
`isFrozenDay`/`calcNextStreak`/`effectiveStreak`, faqat `isPremiumUser()`).

Bepul (premium bo'lmagan) userlar uchun bironta himoya yo'q — 1 kunlik uzilish
ham darhol streak'ni nolga tushiradi. Bu ochilish (retention) nuqtai nazaridan
qattiq jazo va coin iqtisodini (allaqachon qurilgan: `user_coins`,
`coin_transactions`, FIXPLAN #40) yanada mazmunli ishlatish imkoniyati.

**Maqsad:** coin balansidan avtomatik foydalanib, bepul userlarga ham cheklangan
himoya berish — sotib olish/zaxira qilish qadamisiz, to'liq avtomatik.

## Tanlangan mexanika (brainstorming natijasi)

Ketma-ket o'tkazib yuborilgan kunlar soniga (`gapDays`) qarab bosqichma-bosqich:

```
gapDays == 0                         → normal davomiylik (kecha faol bo'lgan) — o'zgarishsiz
gapDays == 1 AND premium             → BEPUL saqlanadi (hozirgi xulq, o'zgarishsiz)
gapDays == 1 AND NOT premium         → 50 coin avtomatik yechiladi (balans yetsa) → saqlanadi
                                         balans YETMASA → streak = 0
gapDays == 2 AND premium             → 50 coin avtomatik yechiladi (balans yetsa) → saqlanadi
                                         (bepul kunidan KEYINGI 2-kun uchun endi coin kerak)
                                         balans YETMASA → streak = 0
gapDays == 2 AND NOT premium         → streak = 0 (coin sinovi FAQAT 1-kunlik uzilishda bo'ladi)
gapDays >= 3 (har qanday holatda)    → streak = 0, coin URINISH QILINMAYDI
```

Ya'ni: premium userga ikkita bosqich beriladi (bepul kun + pullik kun), bepul
userga bitta bosqich beriladi (pullik kun). Coin miqdori: **50** (sobit qiymat,
konfiguratsiyalanadigan konstanta sifatida).

**Nega bu qiymat:** `premium-days-1` narxi 300 coin (`shared/shop-items.ts:73`),
o'rtacha faol o'yinchi kuniga ~80 coin ishlaydi (`COINS_MONTH_OF_PLAY` izohi,
`shared/merch-items.ts:6`). 50 coin — kunlik o'rtacha daromadning ~62%i —
"his qilinadigan, lekin halokatli bo'lmagan" narx.

**Rad etilgan alternativalar (jarayon davomida ko'rib chiqilgan, keyin YAGNI
asosida olib tashlangan):**
- Oldindan sotib olinadigan "freeze charge" zaxirasi (yangi `freeze_charges`
  ustuni, xarid CTE, ko'p kunlik stacking formula) — foydalanuvchi buni ortiqcha
  murakkab deb hisobladi, avtomatik-yechish yetarli.
- Coin-save premium uchun ham "hammaga bir xil" (bepul imtiyozni olib tashlash)
  — premium tarif qiymatini pasaytiradi, rad etildi.

## Ma'lumot modeli

**Yangi ustun/jadval KERAK EMAS.** Mavjud jadvallar yetarli:
- `daily_streaks (user_id, subject_id, streak, last_daily_date)` — streak holati.
- `users (tariff, premium_until)` — premium tekshiruvi (mavjud `entitlement` CTE).
- `user_coins (user_id, balance)` + `coin_transactions (user_id, delta, reason, ref_id)` —
  coin yechish va audit (mavjud ledger naqshi, FIXPLAN #40'dagi kabi).

## SQL joylashuvi — umumiy fragment

Streak+coin-save mantig'i ikkita joyda ishlatiladi:
- `server/modules/daily/daily.repository.ts` — `touchActivity()` (dars/faollik yo'li)
- `server/modules/progress/progress.repository.ts` — `recordAnswer()` (test javobi yo'li)

Ikkalasida ham bir xil `streak_upsert` CTE mavjud (fayl boshida izoh: "o'zgarish
kiritilsa ikkalasini ham yangilash shart" — qasddan hujjatlashtirilgan
duplikatsiya). Yangi mantiq eskisidan murakkabroq (coin balansini shartli
yechish) — qo'lda ikki joyda sinxronlashtirish xato xavfini oshiradi.

**Qaror:** yangi `server/modules/daily/streak-coin-save.ts` — SQL fragment
funksiyalari (drizzle `sql` composability — real DB'da tekshirilgan, ishlaydi):

```ts
export function streakCaseSql(entitlementAlias: string): SQL   // streak qiymati CASE
export function coinDebitCaseSql(entitlementAlias: string): SQL // user_coins.balance dan yechish sharti/miqdori
export function coinSavedFlagSql(entitlementAlias: string): SQL // RETURNING uchun: shu safar coin yechildimi (bool)
```

Har ikkala repository o'z CTE zanjiriga shu fragmentlarni interpolatsiya qiladi;
o'zining mavjud `entitlement` CTE'sidan (`premium` boolean) foydalanadi.
`user_coins`ga yozish uchun CTE zanjiriga yangi qadam qo'shiladi (mavjud
`coin_award`/`coin_ledger` naqshiga o'xshash — `progress.repository.ts:148-171`).

**Atomiklik:** coin yechish va streak yangilanishi BITTA statement (CTE) ichida
bo'lishi kerak — aks holda parallel so'rov yoki xatoda balans va streak
divergensiyaga tushishi mumkin (masalan coin yechilib, streak reset bo'lib
qolishi). Ledger yozuvi: `reason='streak_save'`, `ref_id` = `${userId}:${subjectId}:${date}`,
bu yerda `date` — FAOLLIK QAYTGAN kun (gap tugagan kun), gap necha kunlik
bo'lishidan qat'iy nazar bitta. Shu tufayli bir kunda bir necha marta
`touchActivity`/`recordAnswer` chaqirilsa ham (masalan bir nechta savol
javobi) — coin FAQAT bitta marta yechiladi (`ON CONFLICT (user_id, reason,
ref_id) DO NOTHING`, mavjud naqsh bilan bir xil).

**Premium holati qachon tekshiriladi:** `entitlement` CTE har doim JORIY
`users.tariff`/`premium_until`ni o'qiydi — ya'ni gap qachon boshlanganidan
qat'iy nazar, foydalanuvchi FAOLLIKKA QAYTGAN paytdagi premium holati
hisobga olinadi (hozirgi premium-freeze xulqi bilan bir xil — alohida
"gap boshlanganda premium edimi" tarixi saqlanmaydi, bu yangi murakkablik
kiritmaydi).

## API kontrakti o'zgarishi

`touchActivity()` va `recordAnswer()` javobiga yangi maydon qo'shiladi:

```ts
{ dailyStreak: number, coinSaved: boolean }  // coinSaved=true bo'lsa shu chaqiruvda 50 coin yechildi
```

Frontend (`useDailyStore` yoki javob qabul qiluvchi joy — `Dashboard.tsx`/
`TestPage.tsx`, aniq joy implementatsiya rejasida aniqlanadi) `coinSaved===true`
bo'lsa toast ko'rsatadi: **"🧊 Kecha 50 coin evaziga seriyangiz saqlandi!"**
(UZ+RU i18n kaliti).

## Bot eslatma (oldindan ogohlantirish)

`server/modules/cron/cron.router.ts` — `daily-reminder` cron xabari (hozir
faqat streak soniga qarab shaxsiylashtirilgan, `textFor()` funksiyasi) kengaytiriladi:

- `cronRepository.topStreaksForUsers(targets)` o'rniga/qo'shimcha, target
  userlar uchun premium holati + shu kungi `gapDays` allaqachon 1 ga
  yetganmi (ya'ni ular KECHA HAM faol bo'lmagan, bugun ikkinchi o'tkazib
  yuborilgan kun bo'ladi) + coin balansi olinadi (yangi repository metodi,
  mavjud so'rovlar bilan bir xil naqsh — batch `IN` so'rov).
- Agar user ENDI coin-save bosqichida bo'lsa (ya'ni bugun ham o'tkazib
  yuborilsa, coin yechiladigan holat) — xabarga qo'shimcha qator: *"Bugun
  ham mashq qilmasangiz, 50 coin evaziga seriyangiz saqlanadi (agar
  yetarli bo'lsa) yoki 0 ga tushadi."*
- Agar user ALLAQACHON coin-save doirasidan chiqib ketgan bo'lsa (gapDays
  cron paytida allaqachon >=2 bo'lib, hech qanday variant qolmagan) —
  qo'shimcha ogohlantirish YO'Q (hech narsa saqlab bo'lmaydi, foydasiz xabar).

**Qamrov eslatmasi:** streak per-(user,subject) saqlanadi; cron xabari bitta
umumiy xabar (ko'p fanli userlar uchun soddalashtirish sifatida, mavjud
`topStreaksForUsers` ham xuddi shunday — eng yuqori streak'ni oladi). Yangi
so'rov ham xuddi shu soddalashtirish bilan ishlaydi: ENG YUQORI streak'ga ega
fan bo'yicha hisoblanadi.

## Testlar

- Unit: `streak-coin-save.test.ts` — sof funksiyalar (agar CASE mantig'i sof
  funksiyaga chiqarilsa, mavjud `calcNextStreak`/`effectiveStreak` naqshiga
  o'xshab) — gapDays 0/1/2/3+ × premium/notPremium × yetarli/yetarsiz balans
  kombinatsiyalari.
- Integration: `daily.repository`/`progress.repository` testlariga qo'shimcha —
  real DB'da coin balansi yechilishi, ledger yozuvi, `ON CONFLICT DO NOTHING`
  replay himoyasi (bir xil kunga ikki marta chaqiruv coin'ni ikki marta
  yechmasligi).
- `security-critical.test.ts` yoki mos joyga: parallel ikkita so'rov bir xil
  kun uchun faqat BIR marta coin yechishi (race condition himoyasi, atomik
  CTE orqali kafolatlanadi — mavjud `recordAnswer` idempotency naqshi bilan
  bir xil).

## Implementatsiya tartibi (keyingi bosqich — writing-plans skill'ga o'tadi)

1. `server/modules/daily/streak-coin-save.ts` — SQL fragment funksiyalari + sof
   yordamchi funksiyalar (test uchun ajratilgan).
2. `daily.repository.ts` va `progress.repository.ts` — fragmentlarni
   interpolatsiya qilish, `coinSaved` qaytarish.
3. Frontend: `coinSaved` javobini qabul qilish + toast + i18n kalitlar (UZ+RU).
4. `cron.router.ts` — `daily-reminder` xabariga coin-save ogohlantirish qatori
   (yangi repository so'rovi bilan).
5. Testlar (yuqoridagi ro'yxat).
6. Verifikatsiya: `tsc` ×2, `vitest unit`, `vitest integration` (real Neon).

## Ochiq savollar (implementatsiya paytida hal qilinadi, blokermas)

- Toast frontend'da aniq qaysi komponentda ko'rsatiladi — `Dashboard.tsx` ochilganda
  (streak yuklanganda) yoki `TestPage`/`Darslik` javob yuborilgan zahoti?
  Tavsiya: streak yangilangan har qanday javobda (`useDailyStore` markazida),
  chunki `coinSaved` ikkala yo'ldan (`touchActivity` va `recordAnswer`) kelishi
  mumkin.
