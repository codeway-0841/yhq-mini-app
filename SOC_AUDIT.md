# Separation of Concerns (SoC) Audit Hisoboti — KIVVI Platformasi

Ushbu hujjat KIVVI platformasi kod bazasining **Separation of Concerns (SoC)** bo‘yicha to‘liq audit natijalarini jamlaydi.
Audit maqsadi: UI, business logic, API/data access, auth, database va utility logikalari bir-biriga qorishib ketgan nuqtalarni aniqlash, ularni overengineering qilmasdan va amaldagi behavior'ni o‘zgartirmasdan qanday ajratish mumkinligini ko‘rsatish.

---

## 📊 Qisqacha Xulosa (Overview)

| # | Fayl / Modul | Qatlamlar | Asosiy Muammo | Prioritet |
|---|---|---|---|:---:|
| 1 | `server/octagon.ts` | Backend | WS transport, matchmaker, state machine, auth va to‘g‘ridan-to‘g‘ri SQL bitta 1340+ qatorli faylda | **HIGH** |
| 2 | `src/App.tsx` | Frontend | Routing, auth bootstrap, deep-links, platform native APIs va prefetching bitta komponentda | **HIGH** |
| 3 | `src/shared/store/useAppStore.ts` | Frontend | Zustand store ichida API chaqiruvlari, offline outbox va native bildirishnomalar | **HIGH** |
| 4 | `src/features/test/TestPage.tsx` | Frontend | Test UI, 6 ta modal, audio, haptics, keep-alive ping va anti-cheat bitta joyda | **HIGH** |
| 5 | `server/modules/achievements/achievements.router.ts` | Backend | Repository yo‘q, to‘g‘ridan-to‘g‘ri 4 ta jadvalga `db.select` va biznes logikasi routerda | **HIGH** |
| 6 | `server/modules/payments/payment.router.ts` | Backend | Repository mavjud bo‘lsa-da, buyurtma yaratish va status tekshirish bevosita routerda SQL bilan yozilgan | **MEDIUM** |
| 7 | `server/modules/tutor/tutor.router.ts` | Backend | Router ichida to‘g‘ridan-to‘g‘ri DB so‘rovlari, AI prompt va Gemini SSE stream fetch | **MEDIUM** |
| 8 | `server/modules/users/users.router.ts` | Backend | Router 5 ta turli repository'larni o‘zi chaqirib, ma'lumotlarni birlashtirmoqda | **MEDIUM** |
| 9 | `server/modules/auth/auth.service.ts` | Backend | Zod, SMS OTP, Email tokenlar, Telegram widget va adopt-merge SQL tranzaksiyalari bitta ulkan servisda | **MEDIUM** |
| 10 | `server/modules/cron/cron.router.ts` | Backend | Cron routeri ichida Telegram Bot xabarlari va liga/boss davriy hisoblari mavjud | **MEDIUM** |
| 11 | `server/api-entry/bot.ts` | Backend | Buyruqlar, to‘lovlar, kanalga taklif havolalari va kontakt xabarlari bitta faylda | **MEDIUM** |
| 12 | `src/features/profile/Profil.tsx` | Frontend | 12 ta modal/sheet holati, API so‘rovlari va outbox monitoring UI ichida | **MEDIUM** |
| 13 | `src/features/auth/LoginPage.tsx` | Frontend | UI formalar, widget polling intervali va global sessiya/kesh reset qorishgan | **MEDIUM** |
| 14 | `src/features/shop/ShopPage.tsx` | Frontend | API xarid, audio, confetti va tangalar tarixi bevosita UI komponentda | **LOW** |
| 15 | `server/modules/admin/admin.router.ts` | Backend | Admin router to‘g‘ridan-to‘g‘ri Octagon WS xotirasini tozalaydi (tight coupling) | **LOW** |

---

## 🔴 1. YUQORI PRIORITET (HIGH)

### 1. `server/octagon.ts`
* **Fayl hajmi:** ~1343 qator (56.9 KB)
* **Nima noto‘g‘ri:**
  1. **WebSocket Transport:** connection lifecycle, IP flood limiter, message parsing, heartbeat ping/pong.
  2. **Auth:** `resolveWsUserId` orqali Mini App `verifyInitData` va DB orqali `sessionToken` tekshirish.
  3. **Matchmaker:** queue boshqaruvi, duel PIN yaratish (`joinDuelCreate`, `joinDuel`).
  4. **Game Loop / State Machine:** raund boshlash, taymerlar, to‘g‘ri javoblarni tekshirish, grace window, reconnect.
  5. **Data Access (SQL):** 256 va 370-qatorlarda Drizzle ORM to‘g‘ridan-to‘g‘ri chaqirilgan (`await db.select().from(users)...`). Repository chetlab o‘tilgan.
  6. **Broadcast & Presence:** onlayn o‘yinchilarni yig‘ish va hammaga tarqatish.
* **Qanday ajratish kerak:**
  Ortiqcha klasslar kiritmasdan, faylni `server/modules/octagon/` papkasiga 3 ta pragmatik qismga ajratish:
  - `octagon.gateway.ts` — Faqat WS server, ulanish xavfsizligi va xabarlarni dispatch qilish.
  - `octagon.engine.ts` — O‘yin holati, raund taymerlari, matchmaker va qoidalar.
  - `octagon.repository.ts` — Foydalanuvchi ma'lumotlarini olish va natijalarni DB ga yozish (`db.select` so‘rovlarini shu yerga olish).

---

### 2. `src/App.tsx`
* **Fayl hajmi:** ~659 qator (30.9 KB)
* **Nima noto‘g‘ri:**
  1. **Routing & Lazy loading:** 30+ sahifalar, layout va 3 ta alohida `<HashRouter>` instansiyasi (`VerifyEmailPage`, `ResetPasswordPage` va asosiy App).
  2. **Auth Gateway & Bootstrap:** Telegram initData, Bearer token, `ensureAccountOwner`, session eventlar.
  3. **Data Prefetching:** savollarni yuklash, leaderboard/dashboard keshlarini isitish, outbox flush.
  4. **Platform & Hardware:** Telegram WebApp (mavzu, statusbar, back-button), Capacitor native splash screen (`hideSplashScreen`).
  5. **DOM manipulation:** `ThemeEffect` ichida `document.body.dataset` va shriftlar yuklash.
* **Qanday ajratish kerak:**
  - Bootstrap va auth tekshiruvini `src/shared/hooks/useAppBootstrap.ts` ga chiqarish.
  - Platform/DOM sinxronizatsiyasini (`ThemeEffect`, `StreakSaveToast`, back button) alohida `src/shared/components/AppProviders.tsx` ga o‘tkazish.
  - Takroriy `<HashRouter>` instansiyalarini olib tashlab, barcha sahifalarni yagona router daraxtiga kiritish.

---

### 3. `src/shared/store/useAppStore.ts`
* **Fayl hajmi:** ~475 qator (22.5 KB)
* **Nima noto‘g‘ri:**
  1. **Native Platform APIs:** `updateSettings` action ichida to‘g‘ridan-to‘g‘ri `scheduleDailyStreakReminder` chaqiriladi.
  2. **API & Asinxron operatsiyalar:** `api.patchSettings`, `api.updatePhone`, `api.uploadAvatar` bevosita actionlar ichida.
  3. **Offline Queue & Business Logic:** `submitAnswer` ichida `newId()` chaqirish, `api.postResult` qilish, xatoda `enqueueOutbox` ga yozish, `applyAnswer` orqali boshqa storelarni mutatsiya qilish.
  4. **Module-level Side Effect:** Fayl import qilinganda yuqori qatlamda `onResultSync` global obunasi yotadi.
* **Qanday ajratish kerak:**
  - `useAppStore` ni sof state va sinxron mutatsiyalarga qaytarish.
  - `submitAnswer` va uning outbox zanjirini `src/shared/services/answer.service.ts` yoki `useSubmitAnswer.ts` hook'iga chiqarish.
  - Native reminder hodisasini sozlamalar o‘zgarishini kuzatuvchi reaktiv subscriber orqali boshqarish.

---

### 4. `src/features/test/TestPage.tsx`
* **Fayl hajmi:** ~916 qator (44.3 KB)
* **Nima noto‘g‘ri:**
  1. **Test UI:** variantlar, taymer, savollar lentalari, rasm zoom.
  2. **Hardware/Media:** audio chalish (`playSound`), nutq sintezi (`speak`, `stopSpeaking`), native tebranish (`haptics.impact`).
  3. **Network & Connectivity:** `api.startKeepAlive()` (har 4 daqiqada Neon DB ni uyg‘otib turish), outbox listener.
  4. **Anti-cheat & Session Recovery:** ilovadan chiqish holatlarini aniqlash, sessiyani tiklash.
  5. **Modal State:** 6 ta alohida modal dialoglarining holati (`SettingsModal`, `ResultsModal`, `AiTutorModal`, `AntiCheatModal`, `ExamReviewModal`, `ImageZoomModal`) sahifada saqlanadi.
* **Qanday ajratish kerak:**
  - `useTestSession` hook'ini boyitib, taymer, audio, haptics, keep-alive va anti-cheatni hook ichiga olish.
  - Modallarni bitta `components/TestModalsContainer.tsx` ga yoki o‘z alohida sub-komponentlariga ajratish.
  - Sahifa faqat foydalanuvchi interfeysi bilan shug‘ullansin.

---

### 5. `server/modules/achievements/achievements.router.ts`
* **Nima noto‘g‘ri:**
  - Modulda `achievements.repository.ts` mavjud emas.
  - Router ichida Drizzle ORM (`db.select`) orqali 4 ta jadvalga (`progress`, `dailyStreaks`, `dailyRecords`, `SUBJECT_REGISTRY`) to‘g‘ridan-to‘g‘ri SQL so‘rovlari yozilgan.
  - Aniqlik foizi (`accuracy`), 80%+ natijalar kabi biznes logikasi router callback ichida hisoblanadi.
* **Qanday ajratish kerak:**
  - `server/modules/achievements/achievements.repository.ts` yaratish va barcha SQL so‘rovlarni shu yerga olish.
  - Router faqat HTTP so‘rovni qabul qilib, repository ma'lumotini JSON qilib qaytarishi lozim.

---

## 🟡 2. O‘RTA PRIORITET (MEDIUM)

### 6. `server/modules/payments/payment.router.ts`
* **Nima noto‘g‘ri:**
  - Modulda `payment.repository.ts` bor, lekin u faqat tranzaksiyani yakunlashda (`complete`) ishlatilgan.
  - Router ichida to‘g‘ridan-to‘g‘ri:
    - 89-qator: `await db.insert(paymentOrders)...`
    - 129 va 161-qatorlar: `await db.select().from(paymentOrders)...` (buyurtma holati va tarixi).
* **Qanday ajratish kerak:**
  - Ushbu SQL operatsiyalarini `payment.repository.ts` dagi `createOrder`, `getOrderById`, `listUserOrders` metodlariga ko‘chirish.

---

### 7. `server/modules/tutor/tutor.router.ts`
* **Nima noto‘g‘ri:**
  - 38 va 96-qatorlarda to‘g‘ridan-to‘g‘ri DB so‘rovlari (`db.select().from(users)`, `db.select().from(questions)`).
  - Google Gemini API uchun prompt shakllantirish (`buildPrompt`), tashqi `fetch` chaqiruvi, SSE stream o‘qish va xatolarni boshqarish to‘g‘ridan-to‘g‘ri router ichida.
* **Qanday ajratish kerak:**
  - DB so‘rovlarini `usersRepository` va `questionsRepository` ga o‘tkazish.
  - AI bilan ishlash va stream yaratishni `tutor.service.ts` ga chiqarish. Router faqat parametr validatsiyasi va SSE uzatish bilan cheklansin.

---

### 8. `server/modules/users/users.router.ts` (`GET /profile/:userId`)
* **Nima noto‘g‘ri:**
  - Router 5 ta alohida repository'ni (`usersRepository`, `progressRepository`, `settingsRepository`, `savedRepository`, `coinsRepository`) o‘zi chaqirib, `Promise.all` orqali agregatsiya qiladi va DTO mapperlarni chaqiradi.
* **Qanday ajratish kerak:**
  - Profil ma'lumotlarini to‘plashni `users.service.ts` dagi `getFullProfile(uid)` metodiga o‘tkazish. Router bitta servis chaqiruvi bilan kifoyalanishi kerak.

---

### 9. `server/modules/auth/auth.service.ts`
* **Nima noto‘g‘ri:**
  - 1121 qatorlik faylda barcha autentifikatsiya turlari jamlangan: Zod schemalari, SMS OTP logikasi, Email shablonlari/tokenlari, Telegram Login Widget va murakkab adopt-merge SQL tranzaksiyalari (6 ta bog‘liq jadvalda PK rename).
* **Qanday ajratish kerak:**
  - Schemalarni `auth.schema.ts` ga chiqarish.
  - Xizmatlarni bo‘lish: `email-auth.service.ts`, `phone-auth.service.ts`, `telegram-auth.service.ts`.
  - Adopt-merge SQL tranzaksiyasini `auth.repository.ts` ichida inkapsulyatsiya qilish.

---

### 10. `server/modules/cron/cron.router.ts`
* **Nima noto‘g‘ri:**
  - 488 qatorlik routerda Telegram Bot instansiyasi (`new Bot(token)`) ochilib, eslatma xabarlari matni, tugmalari va yuborish oqimi boshqariladi.
  - Liga yakuni (league rollover) va Boss jangi sikllari hisob-kitobi routerda amalga oshirilgan.
* **Qanday ajratish kerak:**
  - Vazifalarni `reminder.service.ts`, `league.service.ts` va `boss.service.ts` ga ko‘chirish.
  - Router faqat `CRON_SECRET` ni tekshirib, tegishli servisni chaqirsin.

---

### 11. `server/api-entry/bot.ts`
* **Nima noto‘g‘ri:**
  - 814 qatorlik monolit bot webhook fayli. Ichida: bot buyruqlari (`/start`, `/help`, `/id`), dinamik invite-link yaratish, guruh a'zolarini unban qilish, Telegram to‘lovlari (invoice/pre_checkout/successful_payment), kontakt ulashish.
* **Qanday ajratish kerak:**
  - Handlerlarni alohida modullarga ajratish: `bot/commands/`, `bot/payments/`, `bot/handlers/contact.ts`.
  - `bot.ts` faqat konfiguratsiya va webhook handler sifatida qolsin.

---

### 12. `src/features/profile/Profil.tsx`
* **Nima noto‘g‘ri:**
  - 554 qator. 12 ta modal va sheet holati (`useState`), bevosita `api.getReferrals` chaqiruvi, outbox sinxronizatsiyasini `useSyncExternalStore` bilan kuzatish, mavzu o‘zgarish animatsiyalari bitta komponentda.
* **Qanday ajratish kerak:**
  - Ma'lumotlar va referal statistikasini `useProfileData` hook'iga chiqarish.
  - Sheet va modallarni o‘z bo‘limlariga inkapsulyatsiya qilish.

---

### 13. `src/features/auth/LoginPage.tsx`
* **Nima noto‘g‘ri:**
  - 568 qator. Telefon, email, OTP formalaridan tashqari widget polling intervali (`pollRef`) va `applyAuth` ichida local storage, sessiya, outbox va `window.location.hash` boshqaruvi aralashgan.
* **Qanday ajratish kerak:**
  - Autentifikatsiya oqimlarini `usePhoneAuth` va `useTelegramWidgetAuth` hook'lariga ajratish.

---

## 🟢 3. PAST PRIORITET (LOW)

### 14. `src/features/shop/ShopPage.tsx`
* **Nima noto‘g‘ri:**
  - Do‘kon UI komponentida `api.purchaseItem`, `api.getCoinHistory` to‘g‘ridan-to‘g‘ri chaqiriladi, `playSound`, `track` va confetti animatsiyasi xarid logikasi bilan aralashgan.
* **Qanday ajratish kerak:**
  - Xarid jarayoni va tangalar tarixini boshqaruvchi `useShop` custom hook'iga ajratish.

---

### 15. `server/modules/admin/admin.router.ts` ↔ `server/octagon.ts`
* **Nima noto‘g‘ri:**
  - Admin savol qo‘shganda yoki tahrirlaganda, `admin.router.ts` to‘g‘ridan-to‘g‘ri `import { reloadOctagonPools } from '../../octagon'` qilib WebSocket xotirasini tozalaydi (REST va WS qatlamlari o‘rtasida to‘g‘ridan-to‘g‘ri bog‘liqlik / tight coupling).
* **Qanday ajratish kerak:**
  - Kesh yangilanganda event emitter orqali hodisa chiqarish (`questionsRepository.on('invalidate')`), Octagon esa uni tinglab o‘z hovuzini avtomatik yangilashi maqsadga muvofiq.

---

## 🎯 Xulosa va Qadamlar

1. **Overengineering qilmaslik:** Loyihaga ortiqcha Clean Architecture yoki DDD qatlamlari (UseCase, Interactor, DTO classlar) kiritish shart emas. Loyihadagi mavjud `Router -> Service -> Repository` (backend) va `Component -> Custom Hook -> Store/Api` (frontend) modelini izchil qo‘llash kifoya.
2. **Keyingi amaliy qadamlar:**
   - **1-bosqich:** `server/octagon.ts` va `server/modules/achievements/achievements.router.ts` fayllarini tartibga solish (backend barqarorligi).
   - **2-bosqich:** `src/App.tsx` va `src/shared/store/useAppStore.ts` ni sof holatga keltirish (frontend maintainability).
