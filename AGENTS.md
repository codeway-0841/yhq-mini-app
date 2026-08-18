# AGENTS.md — YHQ Mini App

Telegram WebApp: Yo'l harakati qoidalari (+ kelajakda boshqa fanlar) uchun o'quv platformasi.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Zustand (persist) + React Router
- **Backend:** Express 5 + PostgreSQL (Neon, drizzle-orm) + WebSocket (`ws`) + grammy (Telegram bot)
- **Test:** Vitest (`vitest run`)

## Struktura

```
shared/            # Frontend ↔ backend UMUMIY kod (import ikkala tomondan)
  subjects.ts      #   Fanlar konfigi — YAGONA MANBA. Yangi fan FAQAT shu yerga!
src/
  App.tsx          #   Router + providers (composition root)
  features/<f>/    #   Feature modullar: Page + components/ + hooks/;
                   #   boshqa feature'ga eksport KERAK bo'lsa — index.ts barrel (public API)
  shared/          #   CANONICAL frontend shared qatlami (eski src/components|store|lib|hooks|config)
    components/    #     Toggle, SettingsModal, ErrorBoundary, PickerSheet, SubjectSheet, Confetti, ...
    store/         #     Zustand store'lar (persist middleware) — account.ts = YAGONA reset ro'yxati
    lib/           #     analytics, outbox, sentry, sounds, navigation, spaced-repetition, test-session,
                   #     session (Bearer token store — 'yhq-session' localStorage + expired/changed event'lar), ...
    api/           #     HTTP client (index.ts) — har so'rovga initData header
    i18n/          #     Tarjimalar (index.ts) — useT / t
    hooks/         #     useCountUp, usePullToRefresh
    config/        #     subjects.tsx (UI_MAP), themes.ts, achievements.ts, index.ts (runtime env)
  platform/        #   window.Telegram + Capacitor YAGONA kirish nuqtasi:
                   #     telegram.ts (WebApp), haptics.ts, native.ts (APK: yagona back, splash)
  content/         #   Statik kontent (eski src/data): lessons, modules, questions, signs, formulas + lessonMap.yhq.json
capacitor.config.ts # Android APK (Capacitor 8): appId uz.kiwi.yhq, webDir dist, server.url YO'Q (lokal bundle)
android/           #   Generate qilingan native loyiha — APK build uchun Android SDK kerak (gradlew)
server/
  config/
    subjects.ts    #   SubjectRegistry — shared'dan derive, ESKI soddalashtirmang
  modules/<m>/     #   <m>.router.ts + <m>.repository.ts (repository pattern)
  modules/auth/    #   multi-provider auth: sessiyalar, identity'lar, link/adopt-merge
  providers/       #   QuestionBankProvider — fan bazalari (strategy + registry)
  middleware/      #   auth (DUAL: initData YOKI Bearer session → req.userId), cron-auth,
                   #   validate (zod), rate-limiter (in-memory) + db-rate-limiter
                   #   (auth endpoint'lar: prod'da Neon counter — multi-instance), error-handler,
                   #   readiness (/api/ready — DB ping), request-logger (JSON + X-Request-Id)
  octagon.ts       #   PvP duel (WebSocket, reconnect grace window)
tests/
  unit/            #   middleware, lib, utils, config, platform + import-boundaries (qatlam qoidalari)
  integration/     #   API + WebSocket (real Neon DB kerak — .env da DATABASE_URL)
```

## Buyruqlar

```bash
npm run dev            # frontend dev (vite)
npm run server:dev     # backend dev (tsx watch)
npm test               # unit va api testlar (vitest run)
npm run lint           # ESLint flat config (CI'da check job qismi)
npm run test:integration  # integration (real DB) — DAN OLDIN test DB'ni migrate qiling:
                          # DATABASE_URL="$TEST_DATABASE_URL" npx tsx server/migrate.ts
                          # (aks holda "eskirgan" schema'da 500/404 bilan tushadi — state ham kir bo'ladi)
npm run build          # frontend build
npm run build:server   # backend bundle (esbuild)
npm run db:seed:explanations  # statik savol tushuntirishlari seed (idempotent)
npx tsx server/set-admin.ts   # admin huquqi: ro'yxat | <id> [true|false]
npx tsc -p tsconfig.json --noEmit        # frontend typecheck
npx tsc -p tsconfig.server.json --noEmit # backend typecheck
npx cap sync android       # dist → android/ web asset yangilash (build DAN KEYIN)
cd android && gradlew assembleDebug  # Debug APK → app/build/outputs/apk/debug/ (Android SDK + Java 17-21; JBR 25'da Gradle 8.14 xato)
```

APK build uchun prod API'ni `npm run build` DAN OLDIN `.env.local`ga yozing
(`VITE_API_BASE_URL`, `VITE_WS_URL`, `VITE_BOT_USERNAME` — na'muna `.env.example`da).

## Qoidalar

1. **Yangi fan qo'shish:** `shared/subjects.ts` ga 1 element + `src/shared/config/subjects.tsx` dagi `UI_MAP` ga 1 yozuv. Boshqa joyga TEGMANG.
1a. **Frontend qatlam chegaralari:** `src/shared/` va `src/platform/` HECH QACHON `features/` yoki `content/`ga import qilmaydi (yuqoriga qaram = inverted dep); `content/` sof statik ma'lumot (kod import qilmaydi); feature → BOSHQA feature FAQAT maqsad feature'ning `index.ts` barrel'i orqali. Buzilishni `tests/unit/config/import-boundaries.test.ts` ushlaydi.
1b. **Telegram/WebView API:** `window.Telegram` ga FAQAT `src/platform/` dan murojaat. Yangi Telegram API kerak bo'lsa — avval `src/platform/telegram.ts` (yoki `haptics.ts`) ga xavfsiz wrapper qo'shing (brauzer fallback bilan). Capacitor/Android (APK) plug-in'lari — FAQAT `native.ts` orqali (brauzerda no-op).
2. **Yangi fan BAZASI:** provider yozing (`server/providers/`), PROVIDERS map'ga qo'shing, `shared/subjects.ts` da `dataSourceId` ni almashtiring + migratsiyada `question_banks` ga yangi qator (`INSERT ... ON CONFLICT DO NOTHING`, id = dataSourceId). Savolning canonical identity'si: `(bank_id, external_id)` — har qanday insert `externalId` ni aniq berishi SHART (`uq_question_external`).
3. **API validation:** barcha yangi endpoint'da zod schema (`server/middleware/validate.ts` pattern'i).
3a. **Imtihon preset'lari:** `shared/exam-presets.ts` — YAGONA MANBA (savol soni/muddat), fanga bog'lash — `shared/subjects.ts` dagi `examPresets`. Desync'ni `tests/unit/config/exam-presets.test.ts` ushlaydi.
4. **Xatoliklar:** router handler'larini `wrap()` bilan o'rang, `AppError` tashlang — `try/catch` yozmang.
5. **DB o'zgarish:** `server/schema.ts` tahrirlang → `npm run db:generate` → migration faylini commit qiling.
6. **Testlar:** yangi feature/bugfix uchun `tests/` ga test qo'shing. Consistency testlar (masalan `tests/unit/config/subjects.test.ts`) konfig desync'larini ushlaydi.
7. **Env var:** barcha `process.env` FAQAT `server/config/index.ts` dagi zod schema orqali o'qiladi. Yangi env kerak bo'lsa — avval schema'ga qo'shing, keyin `config` orqali oling.
8. **Scoring trust boundary:** `GET /questions` HECH QACHON `correctAnswer` qaytarmaydi — client'da javob kaliti yo'q. Feedback FAQAT `POST /progress/:userId/result` javobidan (post-answer reveal) yoki Octagon `answer_ack` (`correctOptionId`) dan olinadi. To'liq qator kerak bo'lsa — `GET /api/admin/questions` (admin-only). `/result` idempotent: `clientToken` (`answer_tokens` jadvali) bilan. **Anti-farm (H-3):** kunlik javob krediti — `DAILY_ANSWER_CREDIT = 1000` (`server/modules/progress/progress.repository.ts`); cap'dan keyingi javoblar jimgina `duplicate` no-op (recordAnswer CTE'dagi `credit` gate).
8a. **Auth (multi-provider):** login = Telegram Mini App initData YOKI telefon+parol YOKI TG Login Widget; sessiya = opaque token `sessions` jadvalida (JWT EMAS) → `Authorization: Bearer`; DB'da FAQAT `sha256(token)` saqlanadi (M10, `utils/token-hash.ts`, hashing `auth.repository` ichida — caller'lar xom token beradi); OTP hash = HMAC-SHA256(`OTP_PEPPER`) yoki pepper'siz sha256 fallback (L6). Canonical user id = TEXT (TG raqam-string yoki `p_<digits>`); INVARIANT: `('telegram', T)` identity doim `user_id = T` — initData middleware'si DB lookup'siz shunga tayanadi, shuning uchun har qanday TG merge yakuniy id sifatida TG raqam id'ni SAQLAYDI (PK RENAME, FK'lar `ON UPDATE CASCADE`). Parollar `crypto.scrypt` (utils/password). Account linking: bo'sh tomon absorb/rename qilinadi, IKKALA tomoni to'liq akkaunt merge'iga 409 (v2). Mehmon (auth'siz) rejim YO'Q. PII minimal; auth endpoint'lar qattiq rate-limit'langan. CLIENT: token — `src/shared/lib/session.ts` (`yhq-session` localStorage; 401 → `yhq:session-expired` event → `resetAccountToLoggedOut`); LoginPage — `src/features/auth/` (App.tsx boot gate: initData YOKI Bearer YOKI cache); linking UI — Profil `LinkAccountSection`; hydrate = `useAppStore.hydrateFromProfile` (TG init va auth yo'llari BIR XIL). Parolni almashtirish/"unutdim" oqimi — v2. INVARIANT: `users.phone` FAQAT SMS OTP egalik isbotidan keyin yoziladi — `PATCH /users/:userId/phone {phone, otp}` → `consumeOTPWithLockout` (`server/modules/auth/otp.ts` — auth.service/users.service UMUMIY qatlami, import cycle'siz); client oqimi: Telegram requestContact → `api.requestOTP({phone})` → Profil OTPInput → PATCH.
9. **Kutubxona docs (Context7):** library/framework savollari va kod yozishdan OLDIN hujjatlarni Context7'dan oling — training data'ga tayanmang. Global opencode config'da `context7` MCP server sozlangan (`~/.config/opencode/opencode.jsonc`) — MCP tool'lari mavjud bo'lsa shularni ishlating:
   - `resolve-library-id` (libraryName + query) → rasmiy/eng yuqori trustScore'li `/owner/repo` ID'ni tanlang
   - `query-docs` (libraryId + bitta mavzu query)
   - MCP mavjud bo'lmasa HTTP API fallback: search `https://context7.com/api/v1/search?query=<lib>`, docs `https://context7.com/<owner>/<repo>/llms.txt?topic=<mavzu>&tokens=<n>`
   - Bitta query = bitta mavzu (ko'p mavzuli savolni alohida query'larga bo'ling); versiya muhim bo'lsa ID'dagi versiyani tanlang.

## Dizayn tizimi (v2 "KIWI Premium")

```
src/index.css          # Tokenlar: --p-* (yangi) + --theme-* (legacy alias, ikkalasi sinxron)
tailwind.config.js     # Klasslar tokenlarga bog'langan: pcanvas/pcard/psurface/pline/pfg/pmuted/psubtle/pprimary/ponprimary/pgold/ppurple/pblue/psuccess/pwarning/pdanger + duo.* (alias)
src/shared/config/themes.ts   # Aksent temalar — YAGONA MANBA (config + preview + premium flag)
shared/premium-plans.ts# Tarif rejalari — YAGONA MANBA (month/year/lifetime, bot invoice payload shu yerda)
src/shared/lib/sounds.ts      # UI ovozlar (Web Audio, faylsiz) — playSound(kind); chastota body[data-accent]'ga mos
src/shared/components/Confetti.tsx  # Nishonlash confetti; src/shared/hooks/useCountUp.ts — count-up animatsiya
```

- **Dark/light:** `body[data-theme]` (App.tsx `ThemeEffect`). **Aksent:** `body[data-accent]`.
- **Utilitilar:** `.btn-premium(+ -sm/-secondary/-outline/-ai/-gold)` · `.btn-neon` (legacy CTA) · `.card-premium`/`.card-neon` · `.progress-premium` · `.glow-accent-sm` · `.animate-premiumIn`.
- **Shrift:** Inter (`font-display`), Nunito faqat fallback.

## Dizayn qoidalari (v2)

8. **Rang intizomi:** ikonkalar NEYTRAL (`#94a3b8`). Aksent faqat: CTA, progress, active holat. Binafsha = AI/Premium. Semantik (success/warning/danger/gold) FAQAT ma'noli joylarda. Har joyni ranglamang!
9. **Yangi tema:** FAQAT `src/shared/config/themes.ts` ga 1 element + `src/index.css` ga 2 blok (`[data-theme='dark'][data-accent='<id>']` atmosfera + `[data-theme='light'][data-accent='<id>']` variant). `tests/unit/config/themes.test.ts` sinxronni tekshiradi. Boshqa joyga TEGMANG.
10. **Premium gating:** tema tanlovini `resolveAccent(id, isPremium)` orqali qo'llang — free user HECH QACHON premium tema olib qolmasligi shart.
11. **i18n:** yangi kalitlar FAQAT `src/shared/i18n/index.ts` ga — ham UZ, ham RU obyektiga (bittasi qolib ketsa tarjima tushib qoladi).
12. **UI ovoz:** yangi tovush `src/shared/lib/sounds.ts` dagi `playSound` kind'iga qo'shiladi; juda past volume (premium ASMR), AudioContext faqat user-gesture'dan keyin.
