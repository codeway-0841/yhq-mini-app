# Fanni oflayn yuklab olish — dizayn

> Sessiya: 2026-08-24. Brainstorming orqali kelishilgan (skrinshot-mockup bilan
> tasdiqlangan). Implementatsiyadan oldin foydalanuvchi shu faylni ko'rib
> chiqishi kerak.

## Muammo va maqsad

Hozirgi oflayn arxitektura ikki qatlamdan iborat:

1. **Outbox navbat** (`src/shared/lib/outbox.ts`) — online seansda tasodifan
   tarmoq uzilsa, javob navbatga yoziladi, `online` event kelganda serverga
   yuboriladi. Bu ishlaydi (2026-08-24 sessiyasida live tekshirilgan).
2. **Service worker** (`public/sw.js`) — REAKTIV kesh: foydalanuvchi biror
   savol/rasmni bir marta ko'rgan bo'lsa, keyingi safar tarmoqsiz ham ochiladi.
   Faqat oldindan ko'rilgan narsa keshda bo'ladi — hech narsa OLDINDAN
   yuklab qo'yilmaydi.

**Muammo:** qishloq joylarda internet vaqti-vaqti bilan yo'qoladi yoki
umuman yo'q. Foydalanuvchi hali ochmagan savollarga (ayniqsa rasmli
savollarga) reaktiv kesh yordam bermaydi — birinchi marta o'sha savolni
internet YO'Q paytda ochsa, hech narsa ko'rinmaydi.

**Maqsad:** foydalanuvchi internet BOR paytda, o'zi bir marta bosib,
o'qiyotgan fanining barcha savollarini (matn + variantlar + rasmlar)
qurilmasiga oldindan yuklab qo'ya oladi. Shundan keyin internet umuman
bo'lmasa ham, o'sha fan bo'yicha to'liq mashq qila oladi — darhol
to'g'ri/xato ko'rib, lekin bu **hisobga (XP/coin/streak/liga) yozilmaydi**
(sababi pastda, "Xavfsizlik" bo'limida).

## UI oqimi (skrinshot-mockup asosida tasdiqlangan)

Profil sahifasidagi hozirgi "Oflayn rejim" qatori (`Profil.tsx:354-355`,
hozir oddiy yoqish/o'chirish `Toggle`) **shu ekranga o'tuvchi qatorga
almashtiriladi** — bare toggle emas, alohida ekran:

```
[Orqaga]                              Oflayn rejim
Internet bo'lmaganda ham ishlashi uchun kerakli narsalarni
telefoningizga saqlab qo'ying.

┌─────────────────────────────────────────────────┐
│ [rasm ikonkasi] Oflayn rasmlarni yuklash          │
│                 <FAN NOMI> uchun savollar va      │
│                 rasmlarni yuklab oling (~N MB)     │
│                                    [Yuklab olish]  │  ← hali yuklanmagan
└─────────────────────────────────────────────────┘
```

Holatlar (bitta kartaning 3 ko'rinishi, skrinshotdagidek):

- **Yuklanmagan:** yashil "Yuklab olish" tugmasi.
  Bosilsa → pastdan sheet: "Oflayn rejimda foydalaning — Barcha savol
  rasmlarini yuklab oling va internetga ulanmasdan test yeching" +
  ["Rasmlarni yuklash"] / ["Hozir emas"]. Faqat "Rasmlarni yuklash"
  bosilsa — yuklash boshlanadi.
- **Yuklanmoqda:** progress-bar + foiz (masalan "50%"), tugma hali
  "Yuklab olish" (bosib bo'lmaydigan holatda yoki qayta bosilsa bekor
  qiladi — implementatsiya paytida hal qilinadi, blokermas).
- **Yuklangan:** yashil belgi (✓) + qizil "O'chirish" tugmasi.
  Bosilsa → pastdan sheet: "Oflayn rejimni o'chirish — Yuklab olingan
  barcha rasmlar qurilmangizdan o'chiriladi. Keyingi testlarda rasmlar
  internet orqali yuklanadi." + ["Ha, o'chirish"] / ["Bekor qilish"].

**Qamrov:** faqat `useSubjectStore`dagi HOZIRGI faol fan (masalan `yhq`).
Boshqa fanga o'tilsa, shu ekranga qaytilganda o'sha fan uchun holat
alohida ko'rsatiladi (har fan — alohida yuklangan/yuklanmagan holat).
Darslik (`src/content/lessons.ts`, video/modul kontenti) **kirmaydi** —
faqat test savollari + ularning rasmlari.

## Arxitektura

### 1. Yangi endpoint — javob kaliti bilan

`GET /api/questions/offline-package?subject=<id>` (`questions.router.ts`ga
qo'shiladi, mavjud `/questions`ning yonida).

```ts
router.get('/questions/offline-package', requireAuth, contentLimit, wrap(async (req, res) => {
  const entry    = resolveSubject(req.query.subject)
  const provider = getProvider(entry.dataSourceId)
  const rows     = await provider.getAllQuestions()
  res.json(rows)   // DIQQAT: toPublic() CHAQIRILMAYDI — correctAnswer qoladi
}))
```

Farqi `/api/questions`dan: **`toPublic()` qo'llanilmaydi** — `correctAnswer`
javobda qoladi. Kodda aniq izoh: *"Bu YAGONA joy repo bo'ylab — correctAnswer
ataylab client'ga yuboriladi. Xavfsiz, chunki oflayn-mashq javoblari HECH
QACHON serverga yuborilmaydi (pastga qarang) — kalitni bilish reyting/coin
ni aldash uchun ishlatib bo'lmaydi."*

`requireAuth` qo'shiladi (hozir `/questions`da yo'q — u chinakam public).
Bu endpoint faqat tizimga kirgan foydalanuvchiga ochiq, mavjud
`contentLimit` (60/min IP bo'yicha) qayta ishlatiladi.

### 2. Saqlash — mavjud Cache API kengaytiriladi

Yangi mexanizm (IndexedDB va h.k.) KERAK EMAS — `public/sw.js`dagi Cache
API infratuzilmasi qayta ishlatiladi:

- Savol paketi JSON'i — `offline-package?subject=<id>` URL'i o'zi kalit
  sifatida keshlanadi (`caches.open(CACHE).put(request, response)`,
  mavjud `putInCache()` funksiyasi).
- Rasmlar — paket JSON'idagi har bir noyob rasm URL'ini ASOSIY THREAD'dan
  navbat bilan `fetch()` qilamiz (shunchaki fetch qilish kifoya — SW'ning
  mavjud `isStaticAsset` cache-first qoidasi `/images/`ni avtomatik
  ushlab, keshlaydi, alohida SW o'zgarishi shart emas).

`sw.js`ga FAQAT bitta o'zgarish kerak: hozir `isQuestionData()` faqat
`/api/questions` va `/api/topics`ni taniydi — `offline-package` yo'lini
ham shu ro'yxatga qo'shish kerak (aks holda u umuman keshlanmaydi, SW
`fetch` handler'ida `return`siz o'tib ketadi).

### 3. Yuklash jarayoni (frontend)

Yangi `src/shared/lib/offlinePackage.ts`:

```ts
export interface DownloadProgress { done: number; total: number; percent: number }

export async function downloadSubjectOffline(
  subjectId: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  const res  = await fetch(`/api/questions/offline-package?subject=${subjectId}`)
  const rows = await res.json()
  const images = [...new Set(rows.map(r => r.image).filter(Boolean))]
  const total = images.length + 1   // +1 — paketning o'zi
  onProgress({ done: 1, total, percent: Math.round(100 / total) })
  for (const [i, url] of images.entries()) {
    await fetch(url).catch(() => {})   // xato bo'lsa ham davom etadi — pastga qarang
    onProgress({ done: i + 2, total, percent: Math.round(((i + 2) / total) * 100) })
  }
}

export async function isSubjectDownloaded(subjectId: string): Promise<boolean> { /* caches.match bilan tekshirish */ }
export async function deleteSubjectOffline(subjectId: string): Promise<void>   { /* caches.delete bilan tozalash */ }
```

Progress-bar shu `onProgress` orqali Profil ekranidagi local state'ga
yoziladi (React state, global store shart emas — faqat shu ekranda
kerak).

**Eslatma:** `subjectId` bu yerda har doim `useSubjectStore`dagi FIKSATSIYALANGAN
qiymat (`SUBJECT_BASES` ro'yxatidan, erkin matn emas) — server ham
`resolveSubject()` orqali shu ro'yxat bilan qayta tekshiradi. Bitta rasm
`fetch` muvaffaqiyatsiz bo'lsa ham (`.catch(() => {})`) yuklash TO'XTAMAYDI
— qolgan rasmlar bilan davom etadi va progress 100%ga yetadi (ba'zi
rasmlar keshsiz qolishi mumkin). Bu ataylab: bitta rasm xatosi butun
yuklashni buzmasligi kerak; "Yuklab olish" qayta bosilsa faqat yetishmagan
rasmlar qayta so'raladi (`caches.match` orqali allaqachon borlarini
tekshirib o'tkazib yuborish — implementatsiya tafsiloti).

### 4. Oflayn yechish oqimi

`TestPage.tsx` (yoki savol yuklaydigan umumiy joy) savol so'rashda:

1. Avval **online** urinadi (hozirgi xulq — `GET /api/questions`).
2. Xato bo'lsa (tarmoq yo'q) — `isSubjectDownloaded(subjectId)`ni
   tekshiradi. **Ha** bo'lsa — keshdagi `offline-package` javobidan
   (correctAnswer BILAN) savollarni oladi.
3. Bu holatda ekranda doimiy kichik banner: **"📴 Oflayn mashq — natija
   hisobga yozilmaydi"** (i18n: `offlinePracticeMode` kaliti).
4. Javob tanlanganda: `submitAnswer()`/`enqueueOutbox()` **CHAQIRILMAYDI**.
   To'g'ri/xato taqqoslash to'liq LOKAL (`selectedAnswer === q.correctAnswer`),
   `useState` bilan darhol ko'rsatiladi — xuddi hozirgi online-reveal
   vizual holatiga o'xshab (`getOptionState`), lekin serverga hech narsa
   ketmaydi va `xp`/`coins`/`streak` store maydonlariga tegilmaydi.
5. Test oxirida oddiy lokal xulosa ("12/20 to'g'ri") — server progress'iga
   YOZILMAYDI, faqat shu seans uchun ko'rsatiladi.

**Muhim chegaralanish:** agar foydalanuvchi ONLAYN boshlagan testni
davom ettirayotganda birdan tarmoq uzilsa (paket oldindan yuklanmagan
bo'lsa ham) — bu YANGI oqimga kirmaydi, hozirgi outbox xulqi ishlaydi
(javob navbatga yoziladi, "pending" ko'rinadi, keyin serverda hisoblanadi).
Yangi oflayn-mashq oqimi FAQAT paket avvaldan yuklab olingan fan uchun,
va FAQAT test navbatdan BOSHLANGANDA online urinish muvaffaqiyatsiz
bo'lganda ishga tushadi.

## Xavfsizlik — nega bu xavfsiz

CLAUDE.md qoida #8: *"GET /questions never returns correctAnswer. Answer
verification is server-side only."* Yangi endpoint bu qoidani buzayotganday
ko'rinadi, lekin:

- Oflayn-mashq javoblari **hech qachon** `/progress/:userId/result`ga
  yuborilmaydi (yuqoridagi 4-band) — demak, hatto kimdir `offline-package`
  javobini web-inspector orqali o'qib olsa ham, buni reytingni/coinni
  aldash uchun ISHLATIB BO'LMAYDI (aldash uchun kerak bo'lgan yagona yo'l —
  `/result`ga to'g'ri javobni yuborish — butunlay yopiq qoladi).
- Yagona qoldiq xavf: onlayn test paytida "ochiq kitob" kabi foydalanish
  (boshqa qurilmada keshni ochib, javobga qarab onlaynda javob berish).
  Bu ta'lim ilovalarida odatiy amaliyot muammosi (masalan chop etilgan
  javob kalitlari), YHQ'ning haqiqiy maqsadi ham — foydalanuvchi qoidani
  o'rganishi, shuning uchun past-xavf deb baholanadi.
- `requireAuth` + mavjud rate-limit — anonim/ommaviy scraping'dan himoya.

## Testlar

- Unit: `offlinePackage.test.ts` — `downloadSubjectOffline()` progress
  hisobini to'g'ri yuritishi (mock fetch), `isSubjectDownloaded()`/
  `deleteSubjectOffline()` Cache API mock bilan.
- Unit: yangi `/questions/offline-package` endpoint — `requireAuth`siz
  401, javobda `correctAnswer` borligini tasdiqlash (mavjud
  `toPublic()` testlariga qarama-qarshi holat sifatida).
- Unit: oflayn-mashq javob tanlash yo'lida `submitAnswer`/`enqueueOutbox`
  **chaqirilmasligini** tasdiqlovchi test (spy/mock) — bu eng muhim
  regressiya himoyasi (kelajakda kimdir noto'g'ri ravishda bu yo'lni
  hisoblovchi yo'l bilan bog'lab qo'ymasligi uchun).
- Mavjud `outbox.test.ts`/`outbox-resilience.test.ts` — o'zgarishsiz
  qolishi kerak (bu oqim ularga tegmaydi).

## Implementatsiya tartibi (keyingi bosqich — writing-plans skill'ga o'tadi)

1. `server/modules/questions/questions.router.ts` — `offline-package`
   endpoint (`requireAuth` bilan).
2. `public/sw.js` — `isQuestionData()`ga yangi yo'lni qo'shish.
3. `src/shared/lib/offlinePackage.ts` — download/check/delete funksiyalari.
4. Profil ekrani — yangi "Oflayn rejim" sahifasi (hozirgi Toggle qatori
   shu sahifaga navigatsiyaga almashtiriladi), 3 holat (yuklanmagan/
   yuklanmoqda/yuklangan) + 2 ta tasdiqlash sheet (yuklash/o'chirish).
5. `TestPage.tsx` (yoki savol-yuklash umumiy joyi) — offline-fallback
   mantiqi + banner + lokal scoring.
6. i18n: `offlinePracticeMode`, sheet matnlari, tugma matnlari (UZ+RU).
7. Testlar (yuqoridagi ro'yxat).
8. Verifikatsiya: `tsc` ×2, `vitest unit`, brauzerda live-check (fetch
   patch bilan oflayn simulyatsiya, xuddi shu sessiyada outbox uchun
   qilingani kabi).

## Ochiq savollar (implementatsiya paytida hal qilinadi, blokermas)

- Progress-bar "Yuklab olish" tugmasi yuklanish DAVOMIDA yana bosilsa
  nima bo'ladi — bekor qiladimi yoki e'tiborsiz qoldiriladimi? Tavsiya:
  bekor qilish (`AbortController`), lekin blokermas — implementatsiyada
  eng sodda variant (tugmani vaqtincha o'chirib qo'yish) bilan boshlash
  mumkin.
- `TestPage.tsx`dagi aniq fallback nuqtasi (qaysi hook/funksiya online
  urinishni ushlaydi) — implementatsiya paytida kod o'qib aniqlanadi.
- Rasm URL'lari orasida takrorlanuvchilar bo'lsa (`[...new Set(...)]`
  bilan hal qilingan) — provider qatlamida rasm maydoni nomi (`image`
  deb faraz qilindi) real schema bilan tekshirilishi kerak.
