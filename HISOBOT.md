# Xato va kamchiliklar hisoboti

**Loyiha:** yhq-mini-app (Telegram Mini App — YHQ testlari)
**Sana:** 2026-08-01
**Tahlil qamrovi:** `server/`, `api/`, `src/`, `public/`, `migrations/`, konfiguratsiya fayllari
**Holat:** TypeScript kompilyatsiya toza (`tsc --noEmit` xatosiz) ✅
**Umumiy:** 40+ muammo aniqlandi, ularning ko'pi runtime testlar bilan tasdiqlangan

---

## Kirish

Statik tahlil (eslint-style) hech qanday sintaktik xato ko'rsatmagan — lekin chuqur mantiqiy tahlil va runtime testlar **kritik xavfsizlik zaifliklari**, **ishlamaydigan funksiyalar** va **barqarorlik muammolarini** aniqladi. Muammolar jiddiylik darajasi bo'yicha tartiblangan.

---

## 🔴 KRITIK (3 ta) — darhol tuzatish talab qiladi

### K1. Reyting sahifasi production'da umuman ishlamaydi

- **Fayl:** `src/features/leaderboard/LeaderboardPage.tsx:13`
- **Muammo:** `fetchLeaderboard` to'g'ridan-to'g'ri `fetch` qiladi va `x-telegram-init-data` headerini **yubormaydi**. Server auth middleware (`server/middleware/auth.ts`) production'da `GET /api/leaderboard` uchun initData talab qiladi → **doim 401**, reyting sahifasi bo'sh.
- **Yechim:** so'rovni `src/lib/api.ts` ichidagi `request()` orqali yuborish (u headerni avtomatik qo'shadi).

### K2. WebSocket: hujumchi istalgan foydalanuvchi matchini buzishi mumkin

- **Fayl:** `server/octagon.ts:254, 317-319`
- **Muammo:** `userId` o'zgaruvchisi **auth tekshiruvidan OLDIN** client yuborgan qiymat bilan saqlanadi. Auth muvaffaqiyatsiz bo'lsa server `ws.close(4001)` qiladi, lekin `close` event `handleDisconnect(userId)` ni SOXTA userId bilan chaqiradi → qurbon navbatdan chiqariladi yoki matchi yo'q qilinadi (raqib `opp_disconnected` oladi).
- **Tasdiq:** runtime test bilan tasdiqlangan (haqiqiy HMAC + yaroqsiz hujumchi).
- **Yechim:** `userId` ni faqat muvaffaqiyatli auth'dan keyin saqlash; socket→userId xaritasini faqat auth'langan socket uchun yozish.

### K3. Bitta katta WS freym butun serverni qulatadi

- **Fayl:** `server/octagon.ts` (`new WebSocketServer(...)` atrofida)
- **Muammo:** `maxPayload` belgilanmagan (`ws@8.21.1` default = **100 MB**) va `ws.on('error')` ham, `wss.on('error')` ham **yo'q**. 100 MB'dan oshgan xabar → ws `error` event → listener yo'qligi sababli Node `uncaughtException` → **process crash**.
- **Tasdiq:** 101 MB xabar bilan runtime test — `UNCAUGHT EXCEPTION: RangeError Max payload size exceeded`.
- **Yechim:** `new WebSocketServer({ maxPayload: 2048 })` + har socket va serverga `.on('error', () => {})`.

---

## 🟠 YUQORI (7 ta)

| # | Fayl:qator | Muammo | Yechim |
|---|------------|--------|--------|
| Y1 | `server/octagon.ts:285-307` | `answer` handler jo'natuvchining match a'zosi ekanini tekshirmaydi — matchId bilgan hujumchi javob "in'eksiya" qilib raundni erta yakunlaydi | `match.players.some(p => p.userId === userId)` tekshiruvi |
| Y2 | `server/octagon.ts:159, 176-203` | "Zombie" match: `setTimeout(startRound, 1000)` handle saqlanmaydi; raqib chiqqandan keyin ham o'lik match yuborishda davom etadi | timer handle saqlash va `cleanupMatch` da bekor qilish |
| Y3 | `src/features/test/TestPage.tsx:106,108` | Auto-next `setTimeout` tozalanmaydi → 800ms ichida qo'lda "Keyingi" bossa **1 savol o'tkazib yuboriladi** (double-advance race) | timeout'ni ref'da saqlash va unmount/manual navigatsiyada `clearTimeout` |
| Y4 | `src/features/test/TestPage.tsx:45-48,139` | "Qayta" tugmasi noto'g'ri savolni ochadi: URL index sifatida o'qiladi (`id-1`), lekin retry real question ID bilan navigate qiladi → filtrlangan ro'yxatlarda boshqa savol ochiladi | index va question ID'ni ajratish |
| Y5 | `public/sw.js:52` | Offline fallback umuman ishlamaydi: `caches.match()` Promise (doim truthy) + `??` → o'ng taraf hech qachon bajarilmaydi → `respondWith(undefined)` | `.catch(() => caches.match('/').then(r => r ?? caches.match('/index.html')))` |
| Y6 | `server/app.ts:45-48` + `server/middleware/rate-limiter.ts:47` | `trust proxy` yo'q → Vercel'da barcha userlar umumiy proxy IP'da → ommaviy 429 yoki 1 hujumchi hammaning limitini tugatadi | `app.set('trust proxy', 1)` (Vercel) |
| Y7 | `src/features/octagon/OctagonPage.tsx` (umumiy) | Match paytida sahifadan chiqish/qayta kirish → reducer `INIT`, lekin socket matchda davom etadi → `matchId=null` bo'lgan qotgan ekran, javob berib bo'lmaydi | unmount'da socket yopish yoki qayta kirishda holatni serverdan tiklash |

---

## 🟡 O'RTA (12 ta)

| # | Fayl:qator | Muammo |
|---|------------|--------|
| O1 | `server/octagon.ts:184-236, 311` | Socket-identity kuzatilmaydi: 2 tab ochilsa, eski tabni yopish yangi navbat/matchni buzadi; `leave_queue` qaysi socketdan ekanini tekshirmaydi |
| O2 | `server/octagon.ts` | Heartbeat (ping/pong) yo'q — tarmoq uzilganda "ghost" socketlar abadiy qoladi (xotira oqishi); ulanish/navbat limiti ham yo'q |
| O3 | `server/middleware/error-handler.ts:25-33` | `err.status` e'tiborga olinmaydi: buzqunash JSON → 500 (400 kerak), katta body → 500 (413 kerak) — barcha body-parser xatolari monitoring'da 500 ko'rinadi |
| O4 | `server/modules/questions/questions.router.ts:15-17` | `topicId` validatsiyasi yo'q: `topicId=abc`/`1.5` → DB parse xatosi → 500 (400 kerak); har noyob soxta `topicId` in-memory cache'ga yoziladi (o'sish vektori) |
| O5 | `server/api-entry/bot.ts:246-260` | Webhook secret fail-open: `BOT_WEBHOOK_SECRET` bo'lmasa HAR QANDAY soxta update qabul qilinadi (spam vektori). Production'da fail-close kerak |
| O6 | `src/features/profile/Profil.tsx:298-302` | Ichma-ich `<button>`: Toggle bosilganda event parent'ga bubble qiladi → `updateSettings` 2 marta + 2 ta server PATCH; HTML ham yaroqsiz |
| O7 | `src/store/useAppStore.ts:82-86,150` | Rollback faqat `' 400'` substring bilan aniqlanadi (mo'rt heuristik); persist namespacelanmagan → **akkauntlar aralashuvi** (eski user's state ko'rinadi) |
| O8 | `src/lib/api.ts` (umumiy) | Retry mexanizmi yo'q → bo'ronli tarmoqda `postResult/addSaved` jim yo'qoladi → progress yo'qolishi |
| O9 | `src/components/SettingsModal.tsx` + `TestPage` | **Soxta sozlamalar**: `shuffleOptions`, `noAnimation`, `offlineMode` serverga saqlanadi, lekin test mantiqida hech qayerda qo'llanmaydi |
| O10 | `src/features/adaptive/AdaptivePage.tsx:54-56` | Mount race: savollar hali yuklanmagan paytda `startSession()` → `allIds=[]` → foydalanuvchi bo'sh ekranda qotadi |
| O11 | `src/features/dashboard/Dashboard.tsx:85,293` | Savollar soni `const total = 1237` hardcode; "Xatolarni tuzatish" tugmasi xato test o'rniga `/mavzular`'ga yuboradi |
| O12 | `src/features/leaderboard/LeaderboardPage.tsx:13` | `userId` query param yuborilmaydi → `isYou` har doim `false` → "(Siz)" highlight hech qachon ishlamaydi, "Top-50 da emassiz" bloki har doim chiqadi |

---

## 🟢 PAST (15+ ta)

### Server

| # | Fayl:qator | Muammo |
|---|------------|--------|
| P1 | `migrations/meta/_journal.json` | Journal nomuvofiq: `0000_initial.sql` (dublikat) va `0004_leaderboard_index.sql` journal'da yo'q → fresh DB'da `idx_progress_total_correct` qo'llanmaydi (schema/drift) |
| P2 | `server/middleware/validate.ts:25` | Express 5'da `req.query` read-only (getter-only) → `query` sxemasini ishlatgan birinchi route 500 oladi (latent xato) |
| P3 | `server/modules/users/users.service.ts:62-68,85` | `InitInputSchema.id` `z.string().min(1)` → `BigInt('abc')` throw → 500; `.regex(/^\d+$/)` kerak |
| P4 | `server/modules/saved/saved.repository.ts:18-20` | FK buzilishi (mavjud bo'lmagan questionId) → umumiy 500 (404/400 kerak) |
| P5 | `server/api-entry/bot.ts:142,178` | `/daily` har chaqiruvda BUTUN questions jadvalini o'qiydi; `/random` `ORDER BY random()` — ikkalasi full scan |
| P6 | `server/api-entry/bot.ts:127` + `progress.repository.ts:42` | Semantika nomuvofiq: bot `streak`'ni "kun" deb ko'rsatadi, aslida u ketma-ket to'g'ri javoblar soni |
| P7 | `server/app.ts:37` | Security header'lar yo'q (helmet o'rnatilmagan); `ALLOWED_ORIGIN` default localhost |
| P8 | `server/index.ts` | `server.on('error')` yo'q (EADDRINUSE → unhandled); har join'da queue'da `find()` → O(n) |
| P9 | `server/utils/sentry.ts` + serverless | `Sentry.captureException` javobdan keyin flush'siz → xatolar yo'qolishi mumkin (`Sentry.flush(2000)`) |

### Frontend

| # | Fayl:qator | Muammo |
|---|------------|--------|
| P10 | `src/features/profile/Profil.tsx:170` | `navigator.clipboard.writeText()` `?.`siz — secure-context bo'lmasa TypeError crash |
| P11 | `src/features/profile/Profil.tsx:143` | `phoneError` state yoziladi, lekin UI'da hech qayerda render qilinmaydi → xato foydalanuvchiga ko'rinmaydi |
| P12 | `src/features/lessons/Darslik.tsx:271` | Selector har render yangi `{}` qaytaradi → zustand v5'ga o'tganda "Maximum update depth" infinite loop bo'ladi (kelajak xavfi) |
| P13 | `src/App.tsx:128` + ko'plab joylar | Hardcode o'zbekcha matnlar ("Foydalanuvchi", Octagon xabarlari) — RU tilida ham o'zbekcha chiqadi; `tt()` kalitlari bor-u ishlatilmaydi |
| P14 | `src/lib/api.ts:14-18,37,131` | Timeout timer tugagach tozalanmaydi; `patchProgress` o'lik metod; `config.apiBaseUrl` e'lon qilingan-u hardcode `'/api'` ishlatiladi |
| P15 | `src/store/useAppStore.ts:150` | `persist` da `version`/`migrate`/`partialize` yo'q → schema o'zgarishida eski localStorage to'qnashuvi; cross-tab sync yo'q |
| P16 | O'lik kod | `src/data/questions.ts` (`tickets` — hech kim import qilmaydi), `finalStages`, `t()` eksporti, `src/shared/*` — 8 ta ortiqcha re-export qatlami (dual import tizimi) |
| P17 | `src/features/leaderboard/LeaderboardPage.tsx:7-10,44-51` | `Entry` va `LeaderEntry` — bir xil interface ikki marta e'lon qilingan |
| P18 | `src/features/dashboard/Dashboard.tsx:62-69,287-290` | Search tugmasida `onClick` yo'q (o'lik UI); Trophy'da doimiy soxta "!" badge; toast timer'lari tozalanmaydi (bir nechta joyda) |
| P19 | `src/features/topics/TopicsPage.tsx:61` + `TestPage.tsx:120-130` | "ta" suffix hardcode (RU'da ham o'zbekcha); `handleYakunlash` deps'da `tt` yo'q (stale matn) |
| P20 | `public/sw.js:11,60-63` | Cache versiyasi qo'lda (`yhq-app-v2`); cache-miss asset'lar uchun offline fallback yo'q |

### Qo'shimcha eslatmalar (bug emas)

- "Chalg'ituvchi" (`tricky`) rejimi aslida oddiy random 30 savol — maxsus saralash yo'q
- `React.StrictMode` dev'da `/api/init` dublikat chaqiruv (prod'da yo'q)
- `@sentry/react` DSN bo'lmasa ham main bundle'ga kiradi (bundle hajmi)
- `addResult` qayta yechilganda statistika 2 marta sanaladi (dizayn bo'lishi mumkin — hujjatlashtirish kerak)

---

## ✅ Tekshirildi — muammo TOPILMADI

- **Telegram initData:** HMAC tekshiruvi + `timingSafeEqual` + 24 soatlik replay himoyasi to'g'ri (`server/utils/telegram.ts`)
- **Maxfiy ma'lumotlar:** kodda hardcode yo'q; `.env` git'ga tushmagan (faqat `.env.example` tracked)
- **SQL injection:** barcha so'rovlar Drizzle parametrlangan
- **Stack trace:** clientga umumiy xabar qaytariladi, ichki detallar oshkor bo'lmaydi
- **Auth middleware:** barcha `/api` routerlardan oldin, anti-spoofing bilan; CORS preflight auth'dan oldin (to'g'ri)
- **ErrorBoundary** mavjud va `main.tsx`'da o'ragan
- **404 marshruti** mavjud

---

## 📌 Tavsiya etilgan tuzatish tartibi

| Bosqich | Muammolar | Taxminiy hajm |
|---------|-----------|---------------|
| 1 | K1 (leaderboard header) | 1 qatorlik o'zgarish |
| 2 | K3 (maxPayload + error handler) | ~5 qator |
| 3 | Y6 (trust proxy) | 1 qator |
| 4 | K2 + Y1 + Y2 (WS security paket) | ~30 qator |
| 5 | Y3 + Y4 (TestPage race + retry) | ~20 qator |
| 6 | Y5 (sw.js Promise bug) | 1 qator |
| 7 | Qolgan o'rta/pastlar | bosqichma-bosqich |

---

*Hisobot avtomatik tahlil asosida tayyorlangan. Har bir bandda fayl va qator raqami ko'rsatilgan — kodni o'qib tasdiqlangan muammolar.*
