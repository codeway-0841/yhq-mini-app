# AGENTS.md — KIVVI (Universal ta'lim platformasi)

Telegram WebApp va Android APK: Barcha fanlar bo'yicha zamonaviy ta'lim va imtihonlarga tayyorgarlik platformasi (Rus tili, Yo'l harakati qoidalari, Fizika, Matematika, Kimyo, Ingliz tili, Tarix, Biologiya, attestatsiya va milliy sertifikatlar).

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Zustand (persist) + React Router
- **Backend:** Express 5 + PostgreSQL (Neon, drizzle-orm) + WebSocket (`ws`) + grammy (Telegram bot)
- **Test:** Vitest (`vitest run`)

## Struktura

```
shared/            # Frontend ↔ backend UMUMIY kod (import ikkala tomondan)
  subjects.ts      #   Fanlar konfigi — YAGONA MANBA. Yangi fan FAQAT shu yerga!
index.html +       # Marketing landing — DIRECTORY INDEX (Vercel `/` ni rewrites'dan OLDIN
landing/           #   filesystem'dan serve qiladi, shuning uchun landing AYNAN index.html!).
                   #   App kodini IMPORT QILMAYDI (faqat root shared/ sof-data) — ~18KB gzip.
                   #   landing/tailwind.config.js — LANDING-ONLY Tailwind (styles.css'dagi
                   #   `@config` orqali): app `src/**` utilitalari landing CSS'ga kirmaydi
                   #   (84KB→29KB, 2026-09-01); asosiy tailwind.config.js endi faqat app.html+src.
app.html           # ILOVA entry (eski index.html) — app.kivvi.uz `/` 307 redirect → /app.html,
                   #   deep-link'lar rewrite (vercel.json `has:host`); SW-unregister snippet
                   #   landing'da (eski www-app SW'lari tozalanadi).
src/
  App.tsx          #   Router + providers (composition root). Lazy sahifalar NOMLANGAN
                   #   chunk loader orqali — `prefetchRouteChunks` boot'dan keyin IDLE'da
                   #   HAMMASINI oldindan yuklaydi (2026-09-01 "navigatsiya flash" fix:
                   #   RR v7 startTransition'da eski sahifa chunk kelguncha ekranda qolardi).
                   #   Yangi lazy sahifa = loader + lazy + routeChunkPrefetchers'a QATOR —
                   #   desync'ni tests/unit/config/route-prefetch.test.ts ushlaydi.
  features/<f>/    #   Feature modullar: Page + components/ + hooks/;
                   #   boshqa feature'ga eksport KERAK bo'lsa — index.ts barrel (public API)
  shared/          #   CANONICAL frontend shared qatlami (eski src/components|store|lib|hooks|config)
    components/    #     Toggle, SettingsModal, ErrorBoundary, PickerSheet, SubjectSheet, Confetti, ...
    store/         #     Zustand store'lar (persist middleware) — account.ts = YAGONA reset ro'yxati
    lib/           #     analytics, outbox, sentry, sounds, navigation, spaced-repetition, test-session,
                   #     session (Bearer token store — 'yhq-session' localStorage + expired/changed event'lar),
                   #     question-bank-cache (IndexedDB persist — bank server VERSIYASI bilan saqlanadi;
                   #     launch'da faqat GET /questions/version ~40B, bir xil bo'lsa bank TORTILMAYDI;
                   #     HECH QACHON throw qilmaydi — IDB yo'q bo'lsa eski "har safar fetch" yo'li), ...
    api/           #     HTTP client (index.ts) — har so'rovga initData header;
                   #     UNDAN MUSTASNO: requestPublic() (questions/topics/ticket-catalog) —
                   #     public kontent ATAYLAB auth header'SIZ yuboriladi, chunki Vercel
                   #     edge cache Authorization'li GET'ni serve QILMAYDI (EGRESS fix
                   #     2026-09-21: headersiz → CDN hit → Neon tinch); user'ga bog'liq
                   #     endpoint'ga (explanation dah) requestPublic ISHLATILMAYDI;
                   #     warmUp() — serverless cold-start ping (GET /api/ready, fire-and-forget):
                   #     TestPage/SpeedPage MOUNT'da chaqiriladi, aks holda 1-javob Vercel fn +
                   #     Neon suspend uyg'onishiga (5-8s) urilib 8s timeout'dan "offline"ga tushardi
                   #     (AdaptivePage'da mount allaqachon serverga boradi — alohida ping shart emas);
                   #     startKeepAlive() — TestPage'da warmUp + 4 daqiqalik interval ping
                   #     (Neon autosuspend ~5 daq: uzoq o'qilgan savoldan keyingi javob ham
                   #     cold-start yemasligi uchun, 2026-08-31); POST /result timeout 20s —
                   #     cold start 8s default'dan oshib javob outbox'ga tushib qolmasligi uchun;
                   #     boot-path so'rovlar (POST /init, GET /auth/me, GET /profile) 20s timeout —
                   #     default 8s cold start'da yiqilib fallback zanjirini (~16s splash) keltirardi (2026-08-28)
    i18n/          #     Tarjimalar (index.ts) — useT / t
    hooks/         #     useCountUp, usePullToRefresh
    config/        #     subjects.tsx (UI_MAP), themes.ts, achievements.ts, index.ts (runtime env)
  platform/        #   window.Telegram + Capacitor YAGONA kirish nuqtasi:
                   #     telegram.ts (WebApp), haptics.ts, native.ts (APK: yagona back, splash,
                   #     applyNativeChrome — body[data-platform=native] marker + StatusBar
                   #     overlay/style). Tepa safe-area — index.css `--safe-top` YAGONA manba:
                   #     max(env(safe-area-inset-top), TG inject --tg-content-safe-area-inset-top)
                   #     → body padding-top (APK edge-to-edge VA TG fullscreen'ni qoplaydi)
  content/         #   Statik kontent (eski src/data): lessons, modules, questions, signs, formulas + lessonMap.yhq.json
capacitor.config.ts # Android APK (Capacitor 8): appId uz.kivvi.app, webDir dist, server.url YO'Q (lokal bundle), server.appStartPath='/app.html' (dist/index.html = landing!).
                   #   LEADING SLASH SHART (2026-08-31 APK incident): Capacitor 8 Bridge.java https
                   #   scheme'da "https://localhost" + startPath'ni slash'siz YOPISHTIRADI — 'app.html'
                   #   bo'lsa WebView "https://localhostapp.html" ochib ERR_NAME_NOT_RESOLVED berardi;
                   #   regression — tests/unit/config/capacitor-config.test.ts. Shuningdek: bu faylda
                   #   massiv `]'sini yangi qatorga tashimang — esbuild 0.28 parser bug'i (vitest import sinadi).
android/           #   Generate qilingan native loyiha — APK build uchun Android SDK kerak (gradlew)
server/
  config/
    subjects.ts    #   SubjectRegistry — shared'dan derive, ESKI soddalashtirmang
  modules/<m>/     #   <m>.router.ts + <m>.repository.ts (repository pattern)
  modules/content/ #   R2 savol banki delivery (qoida 8h): content-token (HMAC),
                   #   content.router (POST /content/token), qbank-export (sof
                   #   sanitize/chunk/manifest), qbank-publish (atomik publish)
workers/
  question-content/  # Cloudflare Worker (content.kivvi.uz): PRIVATE R2 →
                   #   auth'li kontent (paths/auth/rate-limit/index + wrangler.toml)
  modules/auth/    #   multi-provider auth: sessiyalar, identity'lar, link/adopt-merge
  providers/       #   QuestionBankProvider — fan bazalari (strategy + registry)
  middleware/      #   auth (DUAL: initData YOKI Bearer session → req.userId), cron-auth,
                   #   validate (zod), rate-limiter (in-memory) + db-rate-limiter
                   #   (auth endpoint'lar: prod'da Neon counter — multi-instance), error-handler,
                   #   readiness (/api/ready — DB ping), request-logger (JSON + X-Request-Id)
  octagon.ts       #   PvP duel (WebSocket, reconnect grace window). Savol pool'lari
                   #   FAQAT Render jarayoni xotirasida, LAZY yuklanadi (2026-09-24
                   #   EGRESS fix, AUDIT-NEON-EGRESS #1): boot'da 0 bank — birinchi duel
                   #   so'rovida FAQAT o'sha fan `ensurePool(subjectId)` orqali yuklanadi
                   #   (parallel so'rovlar bitta inflight Promise; xato → retry-safe).
                   #   Ilgari boot'da 11 bank (52.7MB) SELECT * qilinardi va Render free
                   #   plan har uyqu/uyg'onishda takrorlardi. Admin CRUD pool reload
                   #   QILMAYDI (2026-09-21 fix). Boot'da loadOctagonPools CHAQIRMAng —
                   #   regression: tests/unit/server/egress-regressions.test.ts
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
npm run build          # frontend build — scripts/build.mjs orqali (NODE_ENV=production MAJBURIY, qarang: qoida 7a)
npm run build:server   # backend bundle (esbuild)
npm run db:seed:explanations  # statik savol tushuntirishlari seed (idempotent)
npm run export:qbank -- --subject=fizika [--dry-run]  # fizika banki Neon→PRIVATE R2 publish (atomik: marker oxirida); dry-run = faqat validatsiya
                          # `--subject=<11 fandan biri> | --all` (barchasi ketma-ket; biri yiqilsa qolganlari davom etadi)
npx tsx server/set-admin.ts   # admin huquqi: ro'yxat | <id> [true|false]
npx tsx server/grant-coins.ts # test coin grant: admin'lar ro'yxati | <id> <summa> (ledger reason='admin', atomik CTE)
npx tsx server/grant-premium.ts # premium obuna grant: ro'yxat | <id|username> [days|lifetime|free]
npx tsc -p tsconfig.json --noEmit        # frontend typecheck
npx tsc -p tsconfig.server.json --noEmit # backend typecheck
npx cap sync android       # dist → android/ web asset yangilash (build DAN KEYIN)
cd android && gradlew assembleDebug  # Debug APK → app/build/outputs/apk/debug/ (Android SDK + Java 17-21; JBR 25'da Gradle 8.14 xato)
cd android && gradlew assembleRelease bundleRelease  # Release APK (kivvi-release.apk) + Play AAB (app-release.aab) —
                          # imzo android/keystore.properties'dan (GITIGNORED: keystore app/kivvi-upload.keystore,
                          # alias kivvi-upload — ZAXIRA qiling, yo'qolsa Play update bo'lmaydi!)
                          # Windows bash: JAVA_HOME=C:\Users\PC\.jdks\jdk-21.0.6+7, ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
```

APK build uchun prod API'ni `npm run build` DAN OLDIN `.env.local`ga yozing
(`VITE_API_BASE_URL`, `VITE_WS_URL`, `VITE_BOT_USERNAME` — na'muna `.env.example`da).
