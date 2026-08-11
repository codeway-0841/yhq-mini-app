# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

YHQ Mini App — Telegram WebApp for studying Yo'l harakati qoidalari (traffic rules) and other academic subjects. Deployed on Vercel (API + SPA) with a separate WebSocket server on Render for real-time PvP duels.

## Commands

```bash
# Development
npm run dev              # Vite frontend dev server (:5173, proxies /api to :3001)
npm run server:dev       # Backend with hot reload (tsx watch, :3001)

# Build
npm run build            # Frontend production build → dist/
npm run build:api        # Vercel serverless functions → api/dist/
npm run build:server     # Standalone WS server bundle → server/dist/
npm run vercel-build     # Full deploy build (migrate + build:api + build)

# Database
npm run db:generate      # Generate drizzle migration from schema.ts
npm run db:migrate       # Run pending migrations
npm run db:studio        # Drizzle Studio (browser GUI)
npm run db:seed          # Seed base data
npm run db:seed:explanations  # Seed question explanations (idempotent)

# Type checking
npx tsc -p tsconfig.json --noEmit          # Frontend
npx tsc -p tsconfig.server.json --noEmit   # Backend

# Tests
npm test                 # Unit tests only
npm run test:unit        # Unit tests (tests/unit/)
npm run test:integration # Integration tests (needs TEST_DATABASE_URL in .env)
npm run test:watch       # Vitest watch mode

# Android (Capacitor)
npx cap sync android                      # Sync dist/ to native project
cd android && gradlew assembleDebug       # Build debug APK
```

## Architecture

**Monorepo, single package.json.** Three deployment targets from one codebase:

1. **Vercel Serverless** — `server/api-entry/index.ts` (Express app) + `server/api-entry/bot.ts` (Telegram webhook). Built via esbuild to `api/dist/`, re-exported from `api/index.js` and `api/bot.js`.
2. **Render WebSocket** — `server/standalone.ts` bundles the full Express + WS server. Used for Octagon PvP duels (`/ws/octagon`).
3. **Vite SPA** — `src/` React app served as static files. Capacitor wraps it for Android APK.

### Shared code

`shared/` at repo root — imported by both frontend and backend. Contains subject definitions, exam presets, premium plans. `shared/subjects.ts` is the single source of truth for all subjects.

### Frontend (`src/`)

- **Feature modules** (`src/features/<name>/`) — each feature has its own Page, components, hooks. Cross-feature imports only through `index.ts` barrel exports.
- **Shared layer** (`src/shared/`) — components, store (Zustand with persist), lib utilities, API client, i18n, config, hooks.
- **Platform** (`src/platform/`) — sole gateway to `window.Telegram` WebApp API and Capacitor native plugins. No other code touches these APIs directly.
- **Content** (`src/content/`) — static data (lessons, questions, signs). Pure data, no code imports.
- **Path alias:** `@/` resolves to `src/`.

### Backend (`server/`)

- **Modules** (`server/modules/<name>/`) — each module has `<name>.router.ts` + `<name>.repository.ts` (repository pattern).
- **Middleware** — auth (dual: Telegram initData OR Bearer session), validate (zod), rate-limiter, db-rate-limiter, cron-auth, error-handler, readiness, request-logger.
- **Config** (`server/config/index.ts`) — ALL env vars read here via zod schema. Never read `process.env` elsewhere.
- **Providers** (`server/providers/`) — question bank strategy pattern (per-subject data sources).
- **Octagon** (`server/octagon.ts`) — WebSocket-based PvP duel engine.
- **DB** — PostgreSQL (Neon serverless), Drizzle ORM. Schema in `server/schema.ts`, migrations in `migrations/`.

### Deploy flow

Vercel: `vercel.json` routes `/api/*` to serverless function, everything else to SPA. Crons: daily-reminder (14:00 UTC), league-rollover (Mon 00:15 UTC).

## Key Rules

1. **New subject:** Add to `shared/subjects.ts` + `src/shared/config/subjects.tsx` UI_MAP. Nothing else.
2. **Layer boundaries:** `src/shared/` and `src/platform/` never import from `features/` or `content/`. Enforced by `tests/unit/config/import-boundaries.test.ts`.
3. **Telegram API access:** Only through `src/platform/telegram.ts` or `src/platform/haptics.ts` (with browser fallbacks).
4. **API validation:** All endpoints use zod schemas via `server/middleware/validate.ts`.
5. **Error handling:** Wrap route handlers with `wrap()`, throw `AppError`. No manual try/catch in routes.
6. **DB changes:** Edit `server/schema.ts` → `npm run db:generate` → commit migration file.
7. **Env vars:** Add to zod schema in `server/config/index.ts` first, then access via `config` object.
8. **Scoring trust:** `GET /questions` never returns `correctAnswer`. Answer verification is server-side only (`POST /progress/:userId/result`).
9. **Auth:** Multi-provider (Telegram initData, phone+OTP, TG Login Widget). Sessions are opaque tokens (not JWT), stored as sha256 hash in DB. Canonical user ID = text string.
10. **i18n:** Keys in `src/shared/i18n/index.ts` — always add both UZ and RU.
11. **Design tokens:** Colors via CSS custom properties (`--p-*`), accent themes via `body[data-accent]`. Icons use neutral `#94a3b8` — accent color only for CTA/progress/active states.
12. **Tests:** Every bugfix needs a test. Consistency tests in `tests/unit/config/` catch config desync.

## Verification (run after changes)

```bash
npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.server.json --noEmit
npx vitest run tests/unit
# If migrations changed:
DATABASE_URL="$TEST_DATABASE_URL" npx tsx server/migrate.ts
npm run test:integration
```
