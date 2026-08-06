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
  features/        # Feature-based modullar (dashboard, octagon, lessons, ...)
  config/
    subjects.tsx   #   UI qatlami: ikonka/rang (shared/subjects.ts dagi id bo'yicha UI_MAP)
  store/           # Zustand store'lar (persist middleware)
  lib/             # api.ts (fetch wrapper), i18n, tutor SSE client
server/
  config/
    subjects.ts    #   SubjectRegistry — shared'dan derive, ESKI soddalashtirmang
  modules/<m>/     #   <m>.router.ts + <m>.repository.ts (repository pattern)
  providers/       #   QuestionBankProvider — fan bazalari (strategy + registry)
  middleware/      #   auth, validate (zod), rate-limiter, error-handler
  octagon.ts       #   PvP duel (WebSocket, reconnect grace window)
tests/
  unit/            #   middleware, lib, utils, config
  integration/     #   API + WebSocket (real Neon DB kerak — .env da DATABASE_URL)
```

## Buyruqlar

```bash
npm run dev            # frontend dev (vite)
npm run server:dev     # backend dev (tsx watch)
npm test               # barcha testlar
npm run build          # frontend build
npm run build:server   # backend bundle (esbuild)
npx tsc -p tsconfig.json --noEmit        # frontend typecheck
npx tsc -p tsconfig.server.json --noEmit # backend typecheck
```

## Qoidalar

1. **Yangi fan qo'shish:** `shared/subjects.ts` ga 1 element + `src/config/subjects.tsx` dagi `UI_MAP` ga 1 yozuv. Boshqa joyga TEGMANG.
2. **Yangi fan BAZASI:** provider yozing (`server/providers/`), PROVIDERS map'ga qo'shing, `shared/subjects.ts` da `dataSourceId` ni almashtiring.
3. **API validation:** barcha yangi endpoint'da zod schema (`server/middleware/validate.ts` pattern'i).
4. **Xatoliklar:** router handler'larini `wrap()` bilan o'rang, `AppError` tashlang — `try/catch` yozmang.
5. **DB o'zgarish:** `server/schema.ts` tahrirlang → `npm run db:generate` → migration faylini commit qiling.
6. **Testlar:** yangi feature/bugfix uchun `tests/` ga test qo'shing. Consistency testlar (masalan `tests/unit/config/subjects.test.ts`) konfig desync'larini ushlaydi.
