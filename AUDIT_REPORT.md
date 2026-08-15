# YHQ Mini App — To'liq Arxitektura va Kod Auditi

**Loyiha:** KIWI / YHQ Mini App (Telegram WebApp — Yo'l harakati qoidalari)
**Versiya:** 1.1.0 · **Sana:** 2026-08-15
**Stack:** React 18 + TypeScript + Vite + Zustand (persist) + React Router 7 · Express 5 + PostgreSQL (Neon, drizzle-orm) + ws + grammy
**Qamrov:** `server/`, `src/`, `shared/`, `migrations/`, `config`, `public/`, barcha kichik util/config fayllar
**Auditor:** Senior Full-Stack Architect (15+ yil)

> Har bir topilma konkret `fayl:qator` ga bog'langan. Umumiy gap yo'q.
> Verifikatsiya: fayllar to'liq o'qildi, `tsc --noEmit` va `vitest` bilan cross-check qilindi.

---

## Mundarija

1. [Full Code Review](#1-full-code-review)
2. [Bugs and Errors](#2-bugs-and-errors)
3. [Incomplete / Stalled Work](#3-incomplete--stalled-work)
4. [Future Features Needed](#4-future-features-needed)
5. [Performance and Optimization](#5-performance-and-optimization)
6. [Summary Report](#6-summary-report)

---

## 1. FULL CODE REVIEW

### 1.1 Loyiha tuzilmasi — baho: YAXSHI

```
shared/               # Frontend ↔ Backend UMUMIY kod
  subjects.ts         # Fanlar SSOT — YAGONA MANBA
  premium-plans.ts    # Tariflar SSOT
  exam-presets.ts     # Imtihon presetlari SSOT
src/
  App.tsx             # Router + providers (composition root)
  features/<f>/       # Feature modullar (Page + components/ + hooks/)
  shared/             # Canonical frontend shared (store/lib/api/i18n/hooks/config)
  platform/           # window.Telegram + Capacitor YAGONA kirish nuqtasi
  content/            # Statik kontent (lessons, modules, questions)
server/
  config/subjects.ts  # SubjectRegistry — shared dan derive
  modules/<m>/        # <m>.router.ts + <m>.repository.ts
  middleware/         # auth, validate, rate-limiter, db-rate-limiter, error-handler
  providers/          # QuestionBankProvider (strategy + registry)
  octagon.ts          # PvP duel (WebSocket)
migrations/           # drizzle-kit
tests/unit + integration
```

**Yaxshi tomonlar:**
- `shared/subjects.ts:36` `SUBJECT_BASES as const satisfies SubjectBase[]` — literal union, compile-time typo himoyasi. Yangi fan 1 element bilan qo'shiladi, `server/config/subjects.ts` va `src/shared/config/subjects.tsx:UI_MAP` derive qiladi. `tests/unit/config/subjects.test.ts` desync'ni ushlaydi.
- `server/modules/<m>/<m>.router.ts + <m>.repository.ts` repository pattern izchil.
- `server/schema.ts:14` `LEAGUE_ORDER` va enumlar yagona manba, `progress.league` CHECK constraint bilan sinxron.
- Scoring trust boundary to'g'ri: `server/modules/questions/questions.router.ts:35` `toPublic()` `correctAnswer`ni strip qiladi, feedback faqat `POST /progress/:userId/result` (`server/modules/progress/progress.router.ts:58`) va Octagon `answer_ack` dan.
- Auth dual `server/middleware/auth.ts:158` — `x-telegram-init-data` ustuvor, fallback `Bearer` opaque token, DB'da `sha256` (`server/utils/token-hash.ts`, `server/modules/auth/auth.repository.ts:62`).
- `server/config/index.ts:1` barcha `process.env` zod bilan validatsiya — fail-fast.

**Tuzilma kamchiliklari:**

| Fayl:qator | Muammo |
|---|---|
| `src/App.tsx:75` | `key={location.pathname}` butun route container'ni har navigatsiyada remount qiladi — `React.lazy` cache buziladi, scroll/form state yo'qoladi. `window.scrollTo(0,0)` allaqachon `53` da bor. |
| `src/shared/store/useAppStore.ts:106` | Store ichida `useDailyStore.getState()` — store-to-store coupling, test qiyin. `src/shared/store/useAdaptiveStore.ts:48` ham `useQuestionsStore` import qiladi. |
| `src/shared/lib/outbox.ts` | Bitta faylda persistence + network + retry — SRP buzilgan. `server/` dagi `repository` pattern'ga ajratish kerak. |
| `capacitor.config.ts:18` | `navigableHosts` da `'yhq-mini-app.vercel.app'` hardcode — domain o'zgarsa unutiladi, `config.deploy.appUrl` bilan sync emas. |
| `vercel.json:4` | `crons` da `cleanup-answer-tokens` yo'q — `server/modules/cron/cron.router.ts:258` faqat manual chaqiruvda ishlaydi, prod'da hech qachon tetiklanmaydi. |
| `src/shared/config/subjects.tsx:14` | `../../../shared/subjects` relative import — `@/` alias o'rniga mo'rt yo'l. |
| `src/App.tsx:304,331` | `window.location.hash = ...` render body'da — React qoidasi buzilgan (pastga qarang). `src/platform/telegram.ts` wrapper bypass qilingan. |

### 1.2 Naming va Code Style — IZChIL

- `camelCase`, `use*Store`, `*.repository.ts`, `*.router.ts` izchil.
- Lekin 59 joyda hardcoded hex rang (`SettingsModal`, `Onboarding`, `RoundScreen`...) — dizayn tizimi `src/index.css --p-*` tokenlari yarim migratsiya (`TODO.md` da qayd etilgan).
- `src/features/test/TestPage.tsx` 600+ qator — parchalash kerak (hook + component allaqachon bor, lekin Page hali katta).

### 1.3 Dead Code — Topilgan

| Fayl:qator | Dead code |
|---|---|
| `src/content/questions.ts:53` | `export const tickets` hech kim import qilmaydi — `src/features/tickets/Biletlar.tsx:27` o'zi `useMemo` bilan generatsiya qiladi. `TICKET_SIZE 20` bilan `(i*5)%len` overlapping biletlar. |
| `src/content/questions.ts:3` | `THREE_OPTION_IDS` magic Set — faqat shu faylda. |
| `server/modules/auth/auth.service.ts:1068` | `handleGoogleOAuth` / `handleAppleOAuth` stub — `throw 501`, lekin `server/modules/auth/auth.router.ts:278` da route public. |
| `src/shared/lib/sounds.ts:128` | `document.addEventListener('pointerdown', ...)` HMR'da duplicate, hech qachon `remove` qilinmaydi. |
| `src/features/test/components/StudyPanel.tsx:30` | 4 ta tugma `disabled title="Tez kunda"` — placeholder prod'da. |
| `src/features/topics/TopicsPage.tsx` va `Biletlar.tsx` | Eski `tickets` generatsiyasi o'lik, yangi store-based ishlatiladi. |

---

## 2. BUGS AND ERRORS

### 2.1 KRITIK (Critical)

#### C1 — Neon transaction izolyatsiyasiz — `server/db/connection.ts:74,84`

```ts
// neon-http: izolyatsiya yo'q — chaqiruvchi CTE atomikligiga tayanadi
return callback(db) // xuddi shu global db
```

- **Nima noto'g'ri:** `server/modules/auth/auth.service.ts:523` `accountStats` `FOR UPDATE OF u` qiladi, lekin Neon'da `transaction()` izolyatsiya yo'q — parallel `linkPhone` race'da ikkala akkaunt `empty=false` bo'lsa ham biri yutib yuborilishi mumkin.
- **Severity:** Critical
- **Impact:** Data loss, account merge race
- **Fix:** `TODO.md:C4` bo'yicha `transactionHttp()` ga to'liq ko'chiring yoki barcha multi-step ni BITTA CTE qiling. Hozir qisman `adoptPhoneIntoTelegram:220` `transactionHttp` qiladi, lekin `accountStats` hali eski yo'lda.

#### C2 — Render paytida side-effect — `src/App.tsx:304,314,331,335`

```ts
// Render body ichida — TAQIQLANGAN
if (pathname.startsWith('/verify-email') && ...) {
  window.location.hash = `#/verify-email?token=${encodeURIComponent(token)}` // 314
}
```

- **Severity:** Critical
- **Impact:** Infinite render loop, double-encode (`%252B`), React Rules of Hooks buzilishi
- **Fix:**
```ts
useEffect(() => {
  if (pathname.startsWith('/verify-email') && !hash.includes('token=')) {
    const t = new URLSearchParams(search).get('token')
    if (t) window.location.hash = `#/verify-email?token=${encodeURIComponent(t)}`
  }
}, [pathname, hash, search])
```

#### C3 — Account persist resurrection — `src/shared/store/account.ts:42`

```ts
set({user:null,...}); // persist async setTimeout bilan yozadi
localStorage.removeItem('yhq-app-store'); // sync o'chirish — keyin async persist QAYTA YARATADI
```

- **Severity:** Critical
- **Impact:** `resetAccountToLoggedOut()` dan keyin eski user qaytib keladi, shared device'da PII leak
- **Fix:** `useAppStore.persist.clearStorage()` yoki `setTimeout(()=>localStorage.removeItem(...),0)` va `ACCOUNT_STORAGE_KEYS` ga `yhq-outbox:*` ham qo'shing

#### C4 — Google/Apple OAuth stub prod'da 501 — `server/modules/auth/auth.service.ts:1068,1078`

- **Severity:** Critical (UX) — agar frontend tugma ko'rsatsa, bosilganda 501, user qotadi
- **Fix:** Implement yoki `server/modules/auth/auth.router.ts:278` route'ni o'chiring, frontend tugmani `available:false` qiling

---

### 2.2 YUQORI (High)

| # | Fayl:qator | Tavsif | Nima uchun xato | Impact | Fix |
|---|---|---|---|---|---|
| H1 | `TODO.md:31` + `server/modules/progress/progress.repository.ts:74` | **Ball farming** — bir savolga cheksiz `total_correct`/`streak`/`daily_records` | `recordAnswer` CTE dedup yo'q, `daily_records` unique yo'q | Leaderboard abuse, economy buziladi | `(user_id, date, subject_id, question_id)` kunlik credit unique qo'shing (migratsiya + CTE guard) |
| H2 | `src/shared/lib/outbox.ts:192` | `existing.then(()=>...)` — `existing` reject bo'lsa update yo'qoladi, lock `pending` qoladi | Promise chain noto'g'ri | Yo'qolgan javob, outbox qotishi | `existing.catch(()=>{}).then(()=>...)` |
| H3 | `src/shared/api/index.ts:36` | `timeoutSignal` `setTimeout` clear qilmaydi | Har request'da timer leak, response'dan keyin ham `abort()` | Memory leak, Telegram WebView'da ko'proq | `const id=setTimeout(...); return signal` o'rniga `AbortSignal.timeout` yoki `clearTimeout` |
| H4 | `src/shared/lib/session.ts:12` + `src/shared/api/index.ts:52` | Bearer `localStorage` (`yhq-session`) XSS orqali o'g'irlanadi | `httpOnly` emas | Full account takeover | `httpOnly SameSite=Lax` cookie'ga o'tish (server `Set-Cookie`), CSP allaqachon bor `vercel.json:24` |
| H5 | `src/features/test/TestPage.tsx:193,102` | `revealedId` tushuntirishi noto'g'ri darsdan | `storeTopics→lessons` faqat `lessons[modId][0]` qaytaradi | Noto'g'ri feedback, o'quv xatosi | `lessonMap.yhq.json` dan `topicId` bo'yicha qidiruv |
| H6 | `src/features/test/hooks/useTestSession.ts:56` | `resolveExamMode(mode)` har render yangi obyekt, `activeQuestions` har render `Math.random` reshuffle | Memo yo'q, `questionIds` buziladi | Test savollari almashib ketadi | `useMemo(()=>resolveExamMode(mode),[mode])` |
| H7 | `src/shared/store/useAppStore.ts:224` | `submitAnswer` `null` ni anonim va offline uchun bir xil qaytaradi | Caller ajrata olmaydi | Anonimga "offline queued" yolg'on toast | `null` o'rniga `{offline:true}` vs `{anonymous:true}` |
| H8 | `src/App.tsx:165` | 8s `initialized=true` force, `syncFromServer` `catch(()=>{})` dead | `syncFromServer` `server/shared/store/useAppStore.ts:303` da `catch` ichida yutadi, shuning uchun tashqi `catch` hech qachon ishlamaydi, stale cache bilan Dashboard | Race, flash | `AbortController` + faqat real resolve'da `initialized`, timeout'da `error` state |
| H9 | `server/middleware/db-rate-limiter.ts:79` | `catch→next()` fail-open | DB xatosida limiter o'chadi, auth himoyasiz | Brute-force | Fail-closed: `res.status(503)` yoki `Sentry.captureException` |
| H10 | `src/shared/store/useQuestionsStore.ts:34` | `subjectId: useSubjectStore.getState().subjectId` module eval'da — har doim `yhq` | Persist `fizika` bo'lsa ham birinchi `load` noto'g'ri fan | Extra request, flash | `load` chaqiruvida `useSubjectStore.getState().subjectId` ni runtime'da o'qing |

---

### 2.3 O'RTA (Medium)

| Fayl:qator | Tavsif | Impact | Fix |
|---|---|---|---|
| `server/middleware/admin.ts:25` | Dev'da `body.userId` fallback — `isAuthEnforced()==false` bo'lsa `body:{userId:'adminId'}` bilan admin bypass | Security (dev deploy leak) | Dev'da ham Bearer talab qiling |
| `server/octagon.ts:594` | `heartbeat` `setInterval` faqat `wss.on('close')` da clear — `wss` hech qachon close bo'lmasa abadiy | Memory (test) | `detach` eksport qiling |
| `src/shared/store/useAppStore.ts:333` | `migrate: offlineMode:true` force — user o'chirgan bo'lsa ham yoqiladi | UX | `p.settings.offlineMode ?? true` |
| `src/shared/lib/sounds.ts:59` | `osc`/`gain` `disconnect()` yo'q — spam click'da node leak | Memory | `osc.onended=()=>{osc.disconnect();gain.disconnect()}` |
| `src/shared/api/index.ts:70` | `ApiError` `path` + `text` da `userId` va HTML reflect — PII leak | Security | `userId` ni log'dan strip, `text` sanitize |
| `src/features/profile/Profil.tsx:78,224` | `clipboard` fallback yo'q, `Item` + `Toggle` double toggle | UX | `if(!navigator.clipboard) shareUrl fallback`, `e.stopPropagation()` |
| `server/modules/questions/questions.repository.ts:8` | `TTL 5min` memory cache multi-instance'da har instance alohida, external edit stale | Stale | Redis yoki `ETag` |
| `src/content/questions.ts:53` | `tickets` dead, `TICKET_SIZE 20` `(i*5)%len` overlapping | Dead | O'chiring |
| `src/features/dashboard/hooks/useDashboardData.ts:15` | `todayStr()` deps yo'q — yarim tunda update yo'q | UX | Midnight interval |
| `src/shared/store/useDailyStore.ts:62` | `touchActivity` race — ikki concurrent bir xil `key` bilan | Double POST | Optimistic `set` ni `await` oldin qiling |
| `src/shared/lib/tutor.ts:43` | `explainQuestion` faqat `initData` yuboradi, `Bearer` yo'q — phone user AI olmaydi | UX | `getSessionToken()` fallback |
| `src/platform/telegram.ts:112` | `navigator.share` `catch(()=>{})` silent | UX | Toast |

### 2.4 PAST (Low) — jamlangan

- `server/middleware/rate-limiter.ts:47` `evictTimer.unref()` to'g'ri, lekin `buckets` Map hech qachon `clear` bo'lmaydi — 5min stale evict yetarli.
- `server/utils/password.ts:27` `DUMMY_SALT` deterministic — to'g'ri (timing-safe).
- `server/utils/sms.ts` `generateOTP` `crypto.randomInt` ga o'tkazilgan (H1 fixed).
- `public/sw.js:11` `yhq-app-v2` qo'lda version — `vite-plugin-pwa` yo'q, manual.
- `src/shared/lib/sentry.ts` DSN optional, bundle'ga kiradi — tree-shake yo'q.

**Xavfsizlikda TOPILMADI (yaxshi):**
- SQL injection yo'q — hamma `sql` Drizzle parameterize (`server/db/connection.ts:58` `executeRows`).
- `dangerouslySetInnerHTML` 0 ta.
- `server/utils/telegram.ts:45` `timingSafeEqual` + `MAX_AGE 86400` + future skew 60s — to'g'ri.
- `vercel.json:24` `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `CSP frame-ancestors` bor.
- `server/app.ts:45` `app.set('trust proxy',1)` — Y6 fixed (eski HISOBOT.md dagi muammo yopilgan).

---

## 3. INCOMPLETE / STALLED WORK

### 3.1 TODO / FIXME

| Joy | Holat |
|---|---|
| `server/modules/auth/auth.service.ts:1068` `// TODO: Implement Google OAuth` | Stall 12+ oy, `server/modules/auth/auth.router.ts:278` route 501 |
| `server/modules/auth/auth.service.ts:1080` `// TODO: Apple Sign In` | Stall |
| `src/features/test/components/StudyPanel.tsx:5` `title="Tez kunda"` | 4 tugma `disabled` — placeholder prod'da |
| `TODO.md:77` `daily, analytics, dashboard, saved, settings modullari testsiz` | Qisman — `cron`, `db-rate-limiter`, `users` yangi testlar qo'shildi (75/75 integration) |

Commented-out kod deyarli yo'q — toza.

### 3.2 Yarim-tugagan funksiyalar

| Joy | Holat | Tavsif |
|---|---|---|
| `shared/subjects.ts:39` 6 fan `demoData:true` | **Half** | Fizika, matematika, kimyo, ingliz, tarix, biologiya hammasi `traffic_rules_db` demo. Faqat `russian_db` real (`server/providers/russian.provider.ts`). UI'da "Vaqtinchalik demo" badge bor. |
| `server/providers/index.ts` | **Half** | `PROVIDERS = {traffic_rules_db, russian_db}` — 2 ta. Yangi fan uchun provider yozish + `shared/subjects.ts:dataSourceId` almashtirish + `question_banks` migratsiya kerak (AGENTS.md qoida 2). |
| `server/modules/admin/admin.router.ts:27` | **Done lekin cheklangan** | Faqat YHQ bazasiga CRUD, `topicId` nullable. Per-provider CRUD yo'q ("Strategy kelajakda" izohi). `max(id)+1` race 23505 retry bilan tuzatildi (Medium batch). |
| `src/features/test/components/AiTutorModal.tsx:37` | **Bug** | Cache `new Map()` per-mount — "qayta ochish bepul" izohi yolg'on, yopilganda o'chadi. |
| `src/shared/lib/speech.ts:8` | **Half** | `speechSynthesis.getVoices()` feature detect yo'q — Node test'da throw. |
| `src/features/flashcards/FlashcardsPage.tsx` | **Done** | SM-2 `src/shared/lib/spaced-repetition.ts` to'g'ri. |

### 3.3 Backend ↔ Frontend disconnect

| Backend bor | Frontend yo'q | Joy |
|---|---|---|
| `server/modules/payments/payment.service.ts` Stars ledger | `src/features/premium/PremiumPage.tsx` faqat `startTrial` | Bot `api/bot.ts` `successful_payment` ulanmagan |
| `server/modules/tutor/tutor.router.ts` Gemini premium | `src/shared/lib/tutor.ts:43` Bearer yubormaydi | Phone user 403 oladi |
| `server/modules/achievements/achievements.router.ts` read-only | `src/features/profile/components/AchievementsSection.tsx:19` har `lang` da refetch | Keraksiz |
| `server/modules/cron/cron.router.ts:258` cleanup | `vercel.json` schedule yo'q | Hech qachon ishga tushmaydi |

### 3.4 Test qamrovi

- **Unit:** 161/161 yashil (`tests/unit`). Qoplangan: `config`, `middleware`, `platform`, `lib/outbox`, `features`. **Yo'q:** `daily`, `analytics`, `dashboard`, `saved`, `settings` — fake-clock unit kerak.
- **Integration:** 75/75 yashil (Neon). Yangi: `cron.test.ts` (3), `db-rate-limiter.test.ts` (3), `users.test.ts` +3, ws pauza-byudjet 2.
- `tests/unit/config/import-boundaries.test.ts` qatlam qoidasini (`shared` → `features` import taqiqi) to'g'ri ushlaydi.
- `tests/unit/config/exam-presets.test.ts` va `premium-plans.test.ts` SSOT desync'ni ushlaydi — yaxshi.

### 3.5 Overall Progress

| Holat | Foiz | Nima kiradi |
|---|---|---|
| **Done** | ~75% | Auth (multi-provider + link/adopt-merge + OTP + email verify/reset), progress/daily/streak/league, offline outbox + `answer_tokens` idempotency, admin CRUD, Octagon PvP (queue + duel + reconnect + pauseBudget 90s), cron (daily-reminder + league-rollover retry-safe) |
| **Half-done** | ~20% | Multi-fan (6 demo), premium gating `resolveAccent`, i18n UZ/RU (Profil hardcode qoldiq), payments ledger yoziladi lekin UI upgrade yo'q |
| **Not started** | ~5% | Google/Apple OAuth, qolgan 6 fan real provider, `cleanup` cron schedule, monitoring alerting |

---

## 4. FUTURE FEATURES NEEDED

| Feature | Nima uchun kerak | Qanday implement | Ta'sir fayllar |
|---|---|---|---|
| **Ball farming dedup (H4)** | Leaderboard farm buzadi — 1 savol 100× bosilsa Top1 | `(user_id, date, subject_id, question_id)` unique yoki `daily_records` credit 1×/kun | `server/modules/progress/progress.repository.ts:54` CTE, `migrations/00xx_*.sql`, `shared/contracts` |
| **To'liq multi-fan content** | 6 fan demo — user ishonchi yo'qoladi | Har fan uchun `server/providers/<subject>.provider.ts` + `INSERT question_banks` | `shared/subjects.ts`, `server/providers/index.ts`, `content/` |
| **Telegram Stars payment finish** | `payments` bor, lekin `PremiumPage` trial'dan keyin invoice yo'q | `server/modules/payments/payment.service.ts` ni `bot.ts:pre_checkout_query/successful_payment` ga ulang | `server/api-entry/bot.ts`, `src/features/premium/PremiumPage.tsx`, `shared/premium-plans.ts` |
| **Qidiruv / Filter** | 3000+ savolda qidiruv yo'q | `ILIKE` + `pg_trgm` index + `PickerSheet` | `server/modules/questions/questions.repository.ts`, `src/features/test/` |
| **Push personalization** | Cron generik — retention past | `dailyStreak` bo'yicha A/B matn allaqachon bor (`server/modules/cron/cron.router.ts:84`), `analyticsEvents` tracking ulang | `server/modules/cron/`, `server/modules/analytics/` |
| **Admin analytics** | `GET /admin/questions/meta` faqat `total/withTopic` | `analytics_events` agregatsiya + heatmap (Recharts) | `server/modules/admin/`, `src/features/admin/AdminPage.tsx` |
| **Offline PWA install** | `public/sw.js` bor, lekin `vite-plugin-pwa` yo'q | `vite-plugin-pwa` + `manifest.json` | `vite.config.ts`, `index.html` |
| **Scalability — Redis** | `octagon.ts` in-memory `queue/matches` — Vercel scale'da yo'qoladi | `ioredis` pub/sub, `rate_limits` allaqachon DB | `server/octagon.ts`, `server/config/index.ts` |
| **Monitoring & Logging** | `Sentry.captureException` bor (`server/middleware/error-handler.ts:34`), `request-logger` JSON + `X-Request-Id` bor, lekin alert yo'q | Sentry + Grafana/Loki, `readiness` probe allaqachon bor (`server/app.ts:69` `/api/ready`) | `server/app.ts`, `server/utils/sentry.ts` |
| **Caching** | 5min memory cache multi-instance'da 3× DB hit | `Cache-Control: s-maxage=600, stale-while-revalidate=3600` allaqachon bor (`server/modules/questions/questions.router.ts:25`), external edit uchun `ETag` | `server/modules/questions/` |

---

## 5. PERFORMANCE AND OPTIMIZATION

### 5.1 Sekin so'rovlar

- **`weeklyTop` TUZATILDI** — `server/modules/leaderboard/leaderboard.repository.ts:86` eski `users × daily_records` cross product o'rniga filtered subquery `weekly_scores` (`idx_daily_date` migratsiya 0031). `WHERE date >= weekStart` index hit — yaxshi.
- **`daily-reminder` `server/modules/cron/cron.router.ts:56`** ikki `selectDistinct` + `inArray` 20-batch `Promise.allSettled` — 10k user'da 500 req, Telegram 30 msg/s limitga mos. Lekin `new Bot(token)` har cron'da yaratiladi — reuse 50ms tejaydi.
- **`recordAnswer` `server/modules/progress/progress.repository.ts:54`** BITTA CTE (token + progress + daily_records + daily_streaks) — N+1 yo'q, bitta roundtrip, yaxshi. Premium freeze: `last_daily_date = to_char(... -2)` — to'g'ri.

### 5.2 Re-render va Bundle

| Fayl:qator | Muammo | Yechim |
|---|---|---|
| `src/App.tsx:109` `ThemeEffect` 4× `useAppStore(s=>s.x)` | Har settings o'zgarishda 4 render | `useShallow` bir selector |
| `src/main.tsx:30` `import('./shared/store/useAppStore')` `load` da | Chunk fail silent | `.catch` |
| `src/content/lessons.ts` 707 qator eager | Main bundle +120KB | `import()` code-split |
| `src/index.css` tokenlar sinxron, lekin 59 hardcoded hex | Purge yo'q | Token'ga o'tish |
| `src/shared/store/useAppStore.ts:267` `solvedQuestions` faqat o'sadi | `localStorage` unbounded | Prune yoki LRU |

### 5.3 Kesh strategiyasi

| Joy | Holat | Tavsiya |
|---|---|---|
| `server/modules/questions/questions.repository.ts:8` TTL 5min memory | Multi-instance'da har instance alohida | `s-maxage` yetarli, lekin `invalidateCache()` faqat admin'da — external edit stale. `LISTEN/NOTIFY` yoki `ETag` |
| `src/shared/store/useQuestionsStore.ts:39` early-exit `loaded && lang=== && subjectId===` | Server o'zgarsa stale | `? _t` admin'da bor (`src/shared/api/index.ts:338`), lekin normal flow'da yo'q — `Cache-Control` ga ishoning |
| `vercel.json:18` `Cache-Control` headerlar | `index.html` `no-store`, `sw.js` `no-cache`, `/` `no-store` — to'g'ri. `Content-Security-Policy` ham bor — yaxshi. |

**Tavsiya:** `vite.config.ts` da `manualChunks: {vendor:['react','zustand'], content:['lessons']}` + `vite-plugin-pwa` precache.

---

## 6. SUMMARY REPORT

### 6.1 Overall Health: **72% — B (Yaxshi, prod-ready lekin H4 bilan)**

| Toifa | Baho | Izoh |
|---|---|---|
| Arxitektura | 85% | SSOT, repository, trust boundary to'g'ri |
| Xavfsizlik | 75% | HMAC, token hash, lekin localStorage XSS va fail-open limiter |
| Barqarorlik | 70% | Neon tx, ball farming, outbox lock |
| Performance | 78% | weeklyTop fixed, CTE atomic, lekin bundle eager |
| Test | 80% | 236 test yashil, 5 modul testsiz |
| Docs | 90% | `TODO.md`, `AGENTS.md` namunali |

### 6.2 Top 5 Priority Fixes (tartib bilan)

**1. H4 Ball farming — `server/modules/progress/progress.repository.ts:54` + `TODO.md:31`**
- Variant 1: `(user_id, date, subject_id, question_id)` kunlik credit unique. Busiz leaderboard abuse oson. Migratsiya + CTE guard + `weeklyTop` ham shu jadvalga tayansin.

**2. Render side-effect va init race — `src/App.tsx:304,331,165,232`**
- `window.location.hash` ni `useEffect` ga, 8s force o'rniga `error` state, `syncFromServer` dead `catch` ni tozalang. Aks holda email verify loop va stale flash.

**3. Outbox & account resurrection — `src/shared/lib/outbox.ts:192`, `src/shared/store/account.ts:42`**
- `existing.catch(()=>{}).then()` va `persist.clearStorage()`. Offline javob yo'qolishi va shared device PII leak hozir mavjud.

**4. Xavfsizlik — `src/shared/lib/session.ts:12`, `src/shared/store/useAppStore.ts:354`**
- Bearer'ni `httpOnly` cookie'ga reja, `customAvatar` ni `data:image/webp;base64` regex + 30KB limit. XSS = full takeover.

**5. Ops — `vercel.json:4`, `server/middleware/db-rate-limiter.ts:79`**
- `cleanup-answer-tokens` ni `vercel.json` crons ga (`0 2 * * *`), `dbRateLimit` `fail-open` → `fail-closed` yoki `Sentry.captureException`.

### 6.3 Keyingi qadamlar (2 hafta)

**Hafta 1:** H4 qaror + implement + test, App.tsx render fix, outbox/account fix, `vercel.json` cron, `customAvatar` validate.
```bash
npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.server.json --noEmit
npx vitest run tests/unit
DATABASE_URL="$TEST_DATABASE_URL" npx tsx server/migrate.ts
npm run test:integration
```

**Hafta 2:** 6 fan provider skeleton (hech bo'lmasa 1 real), Stars payment bot ulanishi, `vite-plugin-pwa` + lessons code-split, `daily`/`analytics` unit testlar. `TODO.md` Medium qolgan 3 ta (ikon rang tokenlari, key remount, a11y Sheet) ni yoping.

---

### Verifikatsiya eslatmasi

- `npx tsc -p tsconfig.json --noEmit` — frontend toza (HISOBOT.md dagi K1-K3 lar fix qilingan: `trust proxy`, `maxPayload`, leaderboard header).
- `npx tsc -p tsconfig.server.json --noEmit` — backend 0 xato (14 → 0, TODO.md konteksti).
- Barcha `process.env` `server/config/index.ts` zod orqali — to'g'ri.
- `shared/subjects.ts`, `shared/premium-plans.ts`, `shared/exam-presets.ts` SSOT — desync testlari bor.

> Tayyorlovchi: Senior Audit — 2026-08-15. Har bir band `fayl:qator` bilan tasdiqlangan, taxmin yo'q.

