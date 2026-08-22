# Streak Coin-Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kunlik streak uzilganda coin balansidan avtomatik 50 coin yechib seriyani saqlash — premium'ning mavjud bepul 1-kunlik kechirimidan keyingi bosqich sifatida.

**Architecture:** Yangi `shared/streak-save.ts` (SSOT konstanta + sof qaror funksiyasi) va `server/modules/daily/streak-save-sql.ts` (drizzle SQL fragmentlari). Ikkala mavjud streak yozuvchi repository (`daily.repository.touchActivity`, `progress.repository.recordAnswer`) shu fragmentlarni interpolatsiya qiladi. Coin yechish `user_coins`ga BITTA yozuvda net delta bilan bo'ladi (Postgres bir statementda bir qatorga ikki CTE yozuvini jimgina yo'qotadi — spec'da tekshirilgan). Ledger (`coin_transactions`) alohida jadval bo'lgani uchun ikkita qator (`answer` + `streak_save`) muammosiz yoziladi.

**Tech Stack:** TypeScript, drizzle-orm 0.45 (`sql` template composability), PostgreSQL (Neon serverless HTTP driver — tranzaksiyasiz, shuning uchun BITTA CTE statement atomiklik manbai), vitest, React.

## Global Constraints

- **Coin narxi:** 50 coin (`STREAK_SAVE_COST`), `shared/streak-save.ts`da SSOT konstanta.
- **Neon HTTP driver'da drizzle tranzaksiya YO'Q** (CLAUDE.md/AGENTS.md C4 qoidasi) — multi-step oqim BITTA CTE bo'lishi SHART.
- **Bir qatorga bir statementda faqat BITTA UPDATE** — `user_coins` uchun net delta majburiy (spec: KRITIK CHEKLOV bo'limi).
- **i18n:** har yangi kalit UZ va RU ikkalasida (`src/shared/i18n/index.ts`, CLAUDE.md qoida 10).
- **Har bugfix/feature'ga test** (AGENTS.md qoida 6).
- **Migratsiya YO'Q** — bu feature yangi ustun/jadval talab qilmaydi.
- **Verifikatsiya (har task oxirida):** `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.server.json --noEmit`
- **Hech qachon `master`ga to'g'ridan-to'g'ri commit qilmang** — feature branch: `feat/streak-coin-save`.

---

## File Structure

| Fayl | Mas'uliyat |
|---|---|
| `shared/streak-save.ts` (yangi) | `STREAK_SAVE_COST` konstanta + `decideStreakOutcome()` sof funksiya (gapDays/premium/balans → qaror). Frontend ham narxni shu yerdan o'qiydi. |
| `server/modules/daily/streak-save-sql.ts` (yangi) | Drizzle SQL fragmentlari: `coinSaveEligibleSql()`, `streakValueSql()`, `coinNetDeltaSql()`. Ikkala repository shu yerdan oladi. |
| `server/modules/daily/daily.repository.ts` (o'zg.) | `touchActivity` CTE'siga coin-save fragmentlari; `{ dailyStreak, coinSaved }` qaytaradi. |
| `server/modules/progress/progress.repository.ts` (o'zg.) | `recordAnswer` CTE'siga coin-save; `coin_award` net delta bilan birlashadi; `coinSaved` qaytaradi. |
| `server/modules/cron/cron.repository.ts` (o'zg.) | Yangi `listStreakSaveWarnings()` — daily-reminder uchun batch so'rov. |
| `server/modules/cron/cron.router.ts` (o'zg.) | `daily-reminder` xabariga coin-save ogohlantirish qatori. |
| `src/shared/i18n/index.ts` (o'zg.) | `streakSavedToast` kaliti (UZ+RU). |
| `src/shared/store/*` + toast joyi (o'zg.) | `coinSaved` javobini toast'ga ulash. |
| `tests/unit/config/streak-save.test.ts` (yangi) | `decideStreakOutcome` sof funksiya testlari. |
| `tests/integration/api/streak-save.test.ts` (yangi) | Real DB: coin yechilishi, ledger, idempotentlik, net delta. |

---

## Task 1: `shared/streak-save.ts` — SSOT konstanta + sof qaror funksiyasi

**Files:**
- Create: `shared/streak-save.ts`
- Test: `tests/unit/config/streak-save.test.ts`

**Interfaces:**
- Consumes: hech narsa (yangi leaf modul).
- Produces:
  - `export const STREAK_SAVE_COST = 50`
  - `export type StreakOutcome = 'continue' | 'coin_save' | 'reset'`
  - `export function decideStreakOutcome(input: { gapDays: number; premium: boolean; balance: number }): StreakOutcome`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/config/streak-save.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { STREAK_SAVE_COST, decideStreakOutcome } from '../../../shared/streak-save'

describe('decideStreakOutcome', () => {
  const d = (gapDays: number, premium: boolean, balance: number) =>
    decideStreakOutcome({ gapDays, premium, balance })

  it('gapDays=0 — seriya oddiy davom etadi (coin tegilmaydi)', () => {
    expect(d(0, false, 0)).toBe('continue')
    expect(d(0, true, 0)).toBe('continue')
  })

  it('gapDays=1 + premium — BEPUL saqlanadi (coin yechilmaydi)', () => {
    expect(d(1, true, 0)).toBe('continue')
  })

  it('gapDays=1 + premium EMAS — balans yetsa coin bilan saqlanadi', () => {
    expect(d(1, false, STREAK_SAVE_COST)).toBe('coin_save')
    expect(d(1, false, STREAK_SAVE_COST + 10)).toBe('coin_save')
  })

  it('gapDays=1 + premium EMAS + balans yetmaydi — reset', () => {
    expect(d(1, false, STREAK_SAVE_COST - 1)).toBe('reset')
    expect(d(1, false, 0)).toBe('reset')
  })

  it('gapDays=2 + premium — bepul kun ishlatilgan, endi coin kerak', () => {
    expect(d(2, true, STREAK_SAVE_COST)).toBe('coin_save')
    expect(d(2, true, STREAK_SAVE_COST - 1)).toBe('reset')
  })

  it('gapDays=2 + premium EMAS — coin sinovi FAQAT 1-kunlik uzilishda, reset', () => {
    expect(d(2, false, 10_000)).toBe('reset')
  })

  it('gapDays>=3 — hech qanday holatda saqlanmaydi', () => {
    expect(d(3, true, 10_000)).toBe('reset')
    expect(d(10, true, 10_000)).toBe('reset')
    expect(d(3, false, 10_000)).toBe('reset')
  })

  it('narx 50 coin', () => {
    expect(STREAK_SAVE_COST).toBe(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/config/streak-save.test.ts`
Expected: FAIL — `Cannot find module '../../../shared/streak-save'`

- [ ] **Step 3: Write minimal implementation**

Create `shared/streak-save.ts`:

```ts
/**
 * Streak coin-save — kunlik seriya uzilganda coin evaziga saqlash qoidasi.
 *
 * Bosqichlar (ketma-ket o'tkazib yuborilgan kunlar soni = gapDays):
 *   gapDays 0                → oddiy davomiylik
 *   gapDays 1 + premium      → BEPUL saqlanadi (mavjud premium imtiyozi)
 *   gapDays 1 + premium emas → coin bilan saqlanadi (balans yetsa)
 *   gapDays 2 + premium      → coin bilan saqlanadi (bepul kun ishlatilgan)
 *   qolgan barcha holat      → reset
 *
 * Server SQL (streak-save-sql.ts) shu jadval bilan BIR XIL qaror beradi —
 * o'zgarish kiritilsa ikkalasi ham yangilanishi shart (test ikkalasini bog'laydi).
 */

export const STREAK_SAVE_COST = 50

export type StreakOutcome = 'continue' | 'coin_save' | 'reset'

export function decideStreakOutcome(input: {
  gapDays: number
  premium:  boolean
  balance:  number
}): StreakOutcome {
  const { gapDays, premium, balance } = input
  if (gapDays <= 0) return 'continue'
  if (gapDays === 1 && premium) return 'continue'

  const coinEligible = (gapDays === 1 && !premium) || (gapDays === 2 && premium)
  if (!coinEligible) return 'reset'
  return balance >= STREAK_SAVE_COST ? 'coin_save' : 'reset'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/config/streak-save.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.server.json --noEmit`
Expected: xatosiz (chiqishsiz)

- [ ] **Step 6: Commit**

```bash
git add shared/streak-save.ts tests/unit/config/streak-save.test.ts
git commit -m "feat(streak): add coin-save decision rule as shared SSOT"
```

---

## Task 2: `server/modules/daily/streak-save-sql.ts` — SQL fragmentlar

**Files:**
- Create: `server/modules/daily/streak-save-sql.ts`
- Test: (Task 4 integration testida real DB'da qoplanadi — bu fayl sof SQL matn quruvchi, izolyatsiyada sinash qiymatsiz)

**Interfaces:**
- Consumes: `STREAK_SAVE_COST` (`shared/streak-save.ts`, Task 1).
- Produces:
  - `export function coinSaveEligibleSql(a: { userId: string; subjectId: string; date: string }): SQL` — boolean ifoda: shu chaqiruvda coin-save qilinadimi.
  - `export function streakValueSql(a: { date: string; eligible: SQL }): SQL` — `ON CONFLICT DO UPDATE SET streak = <bu>` uchun CASE.
  - `export function coinSaveDeltaSql(eligible: SQL): SQL` — `- STREAK_SAVE_COST` yoki `0` (net delta hisobida qo'shiladi).

**Muhim kontekst (implementer uchun):**
- `daily_streaks.last_daily_date` — `'YYYY-MM-DD'` TEXT ustun (timestamp emas).
- `gapDays` = `(EXCLUDED.last_daily_date::date - daily_streaks.last_daily_date::date) - 1`.
- `entitlement` CTE ikkala repository'da allaqachon mavjud: `SELECT (tariff='premium' OR (premium_until IS NOT NULL AND premium_until > now())) AS premium FROM users WHERE id = <userId>`.
- Fragment ichida `daily_streaks.` prefiksli ustunlarga murojaat qilinadi — bu faqat `ON CONFLICT DO UPDATE` kontekstida ishlaydi (mavjud kod xuddi shunday qiladi).

- [ ] **Step 1: Write the implementation**

Create `server/modules/daily/streak-save-sql.ts`:

```ts
/**
 * Streak coin-save SQL fragmentlari — `daily.repository.touchActivity` va
 * `progress.repository.recordAnswer` IKKALASI shu yerdan oladi (qo'lda
 * sinxronlashtirilgan dublikat o'rniga bitta manba).
 *
 * Qaror jadvali `shared/streak-save.ts` `decideStreakOutcome` bilan BIR XIL
 * bo'lishi shart — integration test ikkalasini taqqoslaydi.
 *
 * Barcha fragmentlar `INSERT ... ON CONFLICT (user_id, subject_id) DO UPDATE`
 * kontekstida ishlatiladi: `daily_streaks.*` = mavjud qator, `EXCLUDED.*` = yangi.
 */
import { sql, type SQL } from 'drizzle-orm'
import { STREAK_SAVE_COST } from '../../../shared/streak-save'

/** Ketma-ket to'liq o'tkazib yuborilgan kunlar soni (0 = kecha faol bo'lgan) */
const GAP_DAYS = sql`((EXCLUDED.last_daily_date::date - daily_streaks.last_daily_date::date) - 1)`

/**
 * Shu chaqiruvda coin yechib streak saqlanadimi.
 * `entitlement` CTE (premium boolean) va `user_coins` balansiga tayanadi.
 * Chaqiruvchi CTE zanjirida `entitlement` alias MAVJUD bo'lishi shart.
 */
export function coinSaveEligibleSql(userId: string): SQL {
  return sql`(
    ${GAP_DAYS} > 0
    AND (
      (${GAP_DAYS} = 1 AND NOT COALESCE((SELECT premium FROM entitlement), false))
      OR (${GAP_DAYS} = 2 AND COALESCE((SELECT premium FROM entitlement), false))
    )
    AND COALESCE((SELECT balance FROM user_coins WHERE user_id = ${userId}), 0) >= ${STREAK_SAVE_COST}::int
  )`
}

/**
 * `streak` ustunining yangi qiymati.
 * `eligible` — `coinSaveEligibleSql()` natijasi (bir xil ifoda ikki joyda
 * ishlatilmasin uchun chaqiruvchi bir marta yaratib uzatadi).
 */
export function streakValueSql(eligible: SQL): SQL {
  return sql`CASE
    WHEN daily_streaks.last_daily_date >= EXCLUDED.last_daily_date
      THEN daily_streaks.streak
    WHEN ${GAP_DAYS} = 0
      THEN daily_streaks.streak + 1
    WHEN ${GAP_DAYS} = 1 AND COALESCE((SELECT premium FROM entitlement), false)
      THEN daily_streaks.streak + 1
    WHEN ${eligible}
      THEN daily_streaks.streak + 1
    ELSE 1
  END`
}
```

**DIQQAT (implementer):** `coinSaveDeltaSql` bu faylda YO'Q — coin delta
chaqiruvchi repository'da hisoblanadi, chunki `recordAnswer`da u mint bilan
BITTA ifodada birlashishi kerak (spec: KRITIK CHEKLOV). Har repository
o'z `coin_save` CTE natijasidan (`RETURNING`) foydalanadi.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: xatosiz

- [ ] **Step 3: Commit**

```bash
git add server/modules/daily/streak-save-sql.ts
git commit -m "feat(streak): add shared SQL fragments for coin-save"
```

---

## Task 3: `daily.repository.touchActivity` — coin-save ulash

**Files:**
- Modify: `server/modules/daily/daily.repository.ts` (`touchActivity`, ~134-183 qatorlar)
- Test: Task 4 integration testida

**Interfaces:**
- Consumes: `coinSaveEligibleSql`, `streakValueSql` (Task 2); `STREAK_SAVE_COST` (Task 1).
- Produces: `touchActivity(...): Promise<{ dailyStreak: number; coinSaved: boolean }>` — avval `{ dailyStreak }` edi, `coinSaved` qo'shildi.

- [ ] **Step 1: Replace the CTE**

`server/modules/daily/daily.repository.ts` faylida import qo'shing:

```ts
import { coinSaveEligibleSql, streakValueSql } from './streak-save-sql'
import { STREAK_SAVE_COST } from '../../../shared/streak-save'
```

`touchActivity` metodining butun tanasini shunga almashtiring:

```ts
  async touchActivity(
    userId:    string,
    date:      string,
    subjectId: string,
    answeredDelta = 0,
    correctDelta  = 0,
  ): Promise<{ dailyStreak: number; coinSaved: boolean }> {
    const eligible = coinSaveEligibleSql(userId)
    const rows = await executeRows<{ daily_streak: number; coin_saved: boolean }>(sql`
      WITH entitlement AS (
        SELECT (
          tariff = 'premium'
          OR (premium_until IS NOT NULL AND premium_until > now())
        ) AS premium
        FROM users
        WHERE id = ${userId}
      ), record_upsert AS (
        INSERT INTO daily_records (user_id, date, subject_id, answered, correct, fixed)
        VALUES (${userId}, ${date}, ${subjectId}, ${answeredDelta}, ${correctDelta}, 0)
        ON CONFLICT (user_id, date, subject_id) DO UPDATE SET
          answered = daily_records.answered + EXCLUDED.answered,
          correct = daily_records.correct + EXCLUDED.correct
        RETURNING id
      ), streak_upsert AS (
        INSERT INTO daily_streaks (user_id, subject_id, streak, last_daily_date, updated_at)
        VALUES (${userId}, ${subjectId}, 1, ${date}, now())
        ON CONFLICT (user_id, subject_id) DO UPDATE SET
          streak = ${streakValueSql(eligible)},
          last_daily_date = GREATEST(daily_streaks.last_daily_date, EXCLUDED.last_daily_date),
          updated_at = now()
        RETURNING streak, (${eligible}) AS saved
      ), coin_ledger AS (
        -- Ledger AVVAL: ON CONFLICT DO NOTHING idempotentlik gate'i.
        -- Bir kunda takroriy chaqiruvda qator yozilmaydi → debit ham bo'lmaydi.
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT ${userId}, ${-STREAK_SAVE_COST}, 'streak_save', ${`${subjectId}:${date}`}
        WHERE (SELECT saved FROM streak_upsert)
        ON CONFLICT (user_id, reason, ref_id) DO NOTHING
        RETURNING id
      ), coin_debit AS (
        UPDATE user_coins SET
          balance = balance - ${STREAK_SAVE_COST}::int,
          updated_at = now()
        WHERE user_id = ${userId} AND EXISTS (SELECT 1 FROM coin_ledger)
        RETURNING balance
      )
      SELECT
        (SELECT streak FROM streak_upsert)::int AS daily_streak,
        EXISTS (SELECT 1 FROM coin_ledger) AS coin_saved
    `)

    const value = Number(rows[0]?.daily_streak)
    if (!Number.isFinite(value)) throw new Error('Daily streak upsert returned no value')
    return { dailyStreak: value, coinSaved: rows[0]?.coin_saved === true }
  },
```

- [ ] **Step 2: Fix call sites**

Run: `npx tsc -p tsconfig.server.json --noEmit`

`touchActivity` chaqiruvchilari `{ dailyStreak }` destructuring qilsa, tsc xato bermaydi (yangi maydon qo'shilishi buzmaydi). Xato chiqsa — chiqqan joyni tuzating.

- [ ] **Step 3: Run existing daily tests**

Run: `npx vitest run tests/unit`
Expected: barcha testlar o'tadi (regressiya yo'q)

- [ ] **Step 4: Commit**

```bash
git add server/modules/daily/daily.repository.ts
git commit -m "feat(streak): wire coin-save into daily activity path"
```

---

## Task 4: Integration testlar (real DB) — daily yo'li

**Files:**
- Create: `tests/integration/api/streak-save.test.ts`

**Interfaces:**
- Consumes: `dailyRepository.touchActivity` (Task 3), `STREAK_SAVE_COST`/`decideStreakOutcome` (Task 1).
- Produces: hech narsa (test fayli).

**Kontekst:** Mavjud integration testlar naqshi — `tests/integration/api/leaderboard.test.ts`ga qarang: `beforeAll`da `usersRepository.initAtomic`, `afterAll`da `db.delete(users)` (FK cascade barcha bog'liq jadvallarni tozalaydi).

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api/streak-save.test.ts`:

```ts
/**
 * Streak coin-save — integration (real test DB).
 * Qamrov: coin yechilishi, balans yetmasligi, premium bepul kuni,
 * idempotentlik (kuniga 1 marta), ledger yozuvi.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { users, dailyStreaks, userCoins, coinTransactions } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { dailyRepository } from '../../../server/modules/daily/daily.repository'
import { STREAK_SAVE_COST } from '../../../shared/streak-save'

const U_FREE_RICH = '990000007001'   // premium emas, balans yetarli
const U_FREE_POOR = '990000007002'   // premium emas, balans yetmaydi
const U_PREMIUM   = '990000007003'   // premium
const IDS = [U_FREE_RICH, U_FREE_POOR, U_PREMIUM]

const SUBJ = 'yhq'

async function cleanup() {
  for (const id of IDS) await db.delete(users).where(eq(users.id, id))
}

/** Streak qatorini aniq holatga qo'yadi (last_daily_date = berilgan sana) */
async function seedStreak(userId: string, lastDate: string, streak: number) {
  await db.insert(dailyStreaks)
    .values({ userId, subjectId: SUBJ, streak, lastDailyDate: lastDate, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [dailyStreaks.userId, dailyStreaks.subjectId],
      set: { streak, lastDailyDate: lastDate, updatedAt: new Date() },
    })
}

async function seedCoins(userId: string, balance: number) {
  await db.insert(userCoins).values({ userId, balance, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userCoins.userId, set: { balance, updatedAt: new Date() } })
}

async function balanceOf(userId: string): Promise<number> {
  const [row] = await db.select({ b: userCoins.balance }).from(userCoins).where(eq(userCoins.userId, userId))
  return row?.b ?? 0
}

async function streakOf(userId: string): Promise<number> {
  const [row] = await db.select({ s: dailyStreaks.streak }).from(dailyStreaks)
    .where(and(eq(dailyStreaks.userId, userId), eq(dailyStreaks.subjectId, SUBJ)))
  return row?.s ?? 0
}

beforeAll(async () => {
  await cleanup()
  for (const id of IDS) {
    await usersRepository.initAtomic({ id, firstName: 'Streak', lastName: id.slice(-4), username: '', photoUrl: '' })
  }
  // U_PREMIUM — umrbod premium
  await db.update(users).set({ tariff: 'premium' }).where(eq(users.id, U_PREMIUM))
})

afterAll(cleanup)

describe('streak coin-save — daily yo\'li', () => {
  it('premium EMAS + 1 kun uzilish + balans yetarli → coin yechiladi, streak davom etadi', async () => {
    await seedStreak(U_FREE_RICH, '2026-08-10', 5)
    await seedCoins(U_FREE_RICH, 200)

    // 2026-08-12 = oxirgi faollik + 2 kun → gapDays = 1
    const res = await dailyRepository.touchActivity(U_FREE_RICH, '2026-08-12', SUBJ, 1, 1)

    expect(res.coinSaved).toBe(true)
    expect(res.dailyStreak).toBe(6)
    expect(await balanceOf(U_FREE_RICH)).toBe(200 - STREAK_SAVE_COST)
  })

  it('bir kunda takroriy chaqiruv coin\'ni IKKI marta yechmaydi (idempotent)', async () => {
    await seedStreak(U_FREE_RICH, '2026-08-20', 5)
    await seedCoins(U_FREE_RICH, 200)

    await dailyRepository.touchActivity(U_FREE_RICH, '2026-08-22', SUBJ, 1, 1)
    const balanceAfterFirst = await balanceOf(U_FREE_RICH)
    const second = await dailyRepository.touchActivity(U_FREE_RICH, '2026-08-22', SUBJ, 1, 1)

    expect(second.coinSaved).toBe(false)
    expect(await balanceOf(U_FREE_RICH)).toBe(balanceAfterFirst)
  })

  it('premium EMAS + balans yetmaydi → streak 1 ga tushadi, coin tegilmaydi', async () => {
    await seedStreak(U_FREE_POOR, '2026-08-10', 9)
    await seedCoins(U_FREE_POOR, STREAK_SAVE_COST - 1)

    const res = await dailyRepository.touchActivity(U_FREE_POOR, '2026-08-12', SUBJ, 1, 1)

    expect(res.coinSaved).toBe(false)
    expect(res.dailyStreak).toBe(1)
    expect(await balanceOf(U_FREE_POOR)).toBe(STREAK_SAVE_COST - 1)
  })

  it('premium + 1 kun uzilish → BEPUL saqlanadi (coin yechilmaydi)', async () => {
    await seedStreak(U_PREMIUM, '2026-08-10', 7)
    await seedCoins(U_PREMIUM, 200)

    const res = await dailyRepository.touchActivity(U_PREMIUM, '2026-08-12', SUBJ, 1, 1)

    expect(res.coinSaved).toBe(false)
    expect(res.dailyStreak).toBe(8)
    expect(await balanceOf(U_PREMIUM)).toBe(200)
  })

  it('premium + 2 kun uzilish → coin yechiladi (bepul kun ishlatilgan)', async () => {
    await seedStreak(U_PREMIUM, '2026-08-14', 7)
    await seedCoins(U_PREMIUM, 200)

    // 2026-08-17 = oxirgi + 3 kun → gapDays = 2
    const res = await dailyRepository.touchActivity(U_PREMIUM, '2026-08-17', SUBJ, 1, 1)

    expect(res.coinSaved).toBe(true)
    expect(res.dailyStreak).toBe(8)
    expect(await balanceOf(U_PREMIUM)).toBe(200 - STREAK_SAVE_COST)
  })

  it('3+ kun uzilish → hech qanday holatda saqlanmaydi', async () => {
    await seedStreak(U_PREMIUM, '2026-08-01', 20)
    await seedCoins(U_PREMIUM, 10_000)

    const res = await dailyRepository.touchActivity(U_PREMIUM, '2026-08-06', SUBJ, 1, 1)

    expect(res.coinSaved).toBe(false)
    expect(res.dailyStreak).toBe(1)
    expect(await balanceOf(U_PREMIUM)).toBe(10_000)
  })

  it('coin yechilganda ledgerga streak_save qatori yoziladi', async () => {
    await seedStreak(U_FREE_RICH, '2026-07-10', 3)
    await seedCoins(U_FREE_RICH, 500)

    await dailyRepository.touchActivity(U_FREE_RICH, '2026-07-12', SUBJ, 1, 1)

    const rows = await db.select({ delta: coinTransactions.delta, refId: coinTransactions.refId })
      .from(coinTransactions)
      .where(and(eq(coinTransactions.userId, U_FREE_RICH), eq(coinTransactions.reason, 'streak_save')))

    const hit = rows.find((r) => r.refId === `${SUBJ}:2026-07-12`)
    expect(hit).toBeDefined()
    expect(hit!.delta).toBe(-STREAK_SAVE_COST)
  })
})
```

- [ ] **Step 2: Run test to verify current state**

Run: `npx vitest run tests/integration/api/streak-save.test.ts --config vitest.integration.config.ts`
Expected: PASS agar Task 3 to'g'ri bajarilgan bo'lsa. FAIL bo'lsa — xato xabarini o'qing va Task 2/3 SQL'ini tuzating (eng ehtimoliy sabab: `GAP_DAYS` ifodasi `EXCLUDED`/`daily_streaks` prefikslari, yoki `coin_transactions.reason` ustunida enum cheklovi bo'lsa yangi qiymat qo'shish kerak).

- [ ] **Step 3: Verify reason column accepts 'streak_save'**

Run: `npx tsx -e "import 'dotenv/config'; import {executeRows} from './server/db/connection'; import {sql} from 'drizzle-orm'; executeRows(sql\`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='coin_transactions'\`).then(console.log)"`

Agar `reason` ustuni `text` bo'lsa — muammo yo'q. Agar enum bo'lsa — migratsiya kerak (`npm run db:generate` bilan, `server/schema.ts`da enum qiymat qo'shib).

- [ ] **Step 4: Commit**

```bash
git add tests/integration/api/streak-save.test.ts
git commit -m "test(streak): integration coverage for coin-save daily path"
```

---

## Task 5: `progress.repository.recordAnswer` — net delta bilan coin-save

**Files:**
- Modify: `server/modules/progress/progress.repository.ts` (`recordAnswer` CTE, ~69-207 qatorlar)
- Test: `tests/integration/api/streak-save.test.ts` (Task 4 fayliga qo'shimcha describe)

**Interfaces:**
- Consumes: `coinSaveEligibleSql`, `streakValueSql` (Task 2); `STREAK_SAVE_COST` (Task 1).
- Produces: `recordAnswer(...)` javobiga `coinSaved: boolean` qo'shiladi (mavjud maydonlar o'zgarmaydi).

**KRITIK:** `user_coins`ga BITTA yozuv bo'lishi shart — mavjud `coin_award` CTE'si mint qiladi, endi u NET delta yozadi (`mint - save`). Ikkita alohida UPDATE CTE yozilsa mint JIMGINA yo'qoladi (spec: KRITIK CHEKLOV, real DB'da tasdiqlangan).

- [ ] **Step 1: Modify the CTE**

`server/modules/progress/progress.repository.ts` faylida import qo'shing:

```ts
import { coinSaveEligibleSql, streakValueSql } from '../daily/streak-save-sql'
import { STREAK_SAVE_COST } from '../../../shared/streak-save'
```

Metod boshida (SQL'dan oldin):

```ts
    const eligible = coinSaveEligibleSql(userId)
```

`streak_upsert` CTE'sini shunga almashtiring (faqat `streak = CASE...END` qismi va `RETURNING`):

```ts
      ), streak_upsert AS (
        INSERT INTO daily_streaks (user_id, subject_id, streak, last_daily_date, updated_at)
        SELECT ${userId}, ${subjectId}, 1, ${date}, now()
        WHERE EXISTS (SELECT 1 FROM prog)
        ON CONFLICT (user_id, subject_id) DO UPDATE SET
          streak = ${streakValueSql(eligible)},
          last_daily_date = GREATEST(COALESCE(daily_streaks.last_daily_date, EXCLUDED.last_daily_date), EXCLUDED.last_daily_date),
          updated_at = now()
        RETURNING streak, (${eligible}) AS saved
      ), save_ledger AS (
        -- Idempotentlik gate'i: kuniga bitta streak_save (ON CONFLICT DO NOTHING).
        -- Debit shu CTE natijasiga bog'langani uchun takroriy javob coin yechmaydi.
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT ${userId}, ${-STREAK_SAVE_COST}, 'streak_save', ${`${subjectId}:${date}`}
        WHERE (SELECT saved FROM streak_upsert)
        ON CONFLICT (user_id, reason, ref_id) DO NOTHING
        RETURNING id
      )
```

**Muhim:** `streak_upsert` CTE'si `coin_award`dan KEYIN kelishi kerak emas —
CTE'lar tartibi ahamiyatsiz, lekin `coin_award` endi `save_ledger`ga
murojaat qilgani uchun `save_ledger` `coin_award`dan OLDIN e'lon qilinishi
shart (Postgres `WITH` zanjirida oldinga murojaat qilib bo'lmaydi).
Shuning uchun CTE tartibi: `... prog, q_write, streak_upsert, save_ledger,
coin_award, coin_ledger, record_upsert ...`

`coin_award` CTE'sini NET delta bilan almashtiring:

```ts
      ), coin_award AS (
        -- FIXPLAN #40 mint + streak-save debit BITTA yozuvda (net delta).
        -- SABAB: Postgres bir statementda bitta qatorga ikkita UPDATE CTE
        -- qo'llasa faqat BITTASI saqlanadi (ikkinchisi jimgina yo'qoladi) —
        -- alohida debit CTE mint'ni yo'q qilardi.
        INSERT INTO user_coins (user_id, balance, updated_at)
        SELECT ${userId},
          GREATEST(0,
            (CASE WHEN ${correct} AND EXISTS (SELECT 1 FROM prog) THEN ${COINS_PER_CORRECT_ANSWER}::int ELSE 0 END)
            - (CASE WHEN EXISTS (SELECT 1 FROM save_ledger) THEN ${STREAK_SAVE_COST}::int ELSE 0 END)
          ),
          now()
        WHERE (${correct} AND EXISTS (SELECT 1 FROM prog))
           OR EXISTS (SELECT 1 FROM save_ledger)
        ON CONFLICT (user_id) DO UPDATE SET
          balance = user_coins.balance
            + (CASE WHEN ${correct} AND EXISTS (SELECT 1 FROM prog) THEN ${COINS_PER_CORRECT_ANSWER}::int ELSE 0 END)
            - (CASE WHEN EXISTS (SELECT 1 FROM save_ledger) THEN ${STREAK_SAVE_COST}::int ELSE 0 END),
          updated_at = now()
        RETURNING balance
      )
```

`coin_ledger` CTE'sining sharti o'zgaradi (endi `coin_award` mavjudligi
mint bo'lganini bildirmaydi — save ham uni yaratishi mumkin):

```ts
      ), coin_ledger AS (
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT ${userId}, ${COINS_PER_CORRECT_ANSWER}, 'answer', COALESCE(${token}::text, ${qKey}::text)
        WHERE ${correct} AND EXISTS (SELECT 1 FROM prog)
        ON CONFLICT (user_id, reason, ref_id) DO NOTHING
        RETURNING id
      )
```

Yakuniy `SELECT`ga qo'shing:

```ts
        EXISTS (SELECT 1 FROM save_ledger) AS coin_saved
```

Return type va qaytarishni yangilang:

```ts
  }): Promise<{ updated: boolean; dailyStreak: number | null; duplicate: boolean; reason?: 'replay' | 'gate'; coinBalance: number | null; coinSaved: boolean }> {
```

Barcha `return` nuqtalariga `coinSaved` qo'shing:
- `{ updated: false, dailyStreak: null, duplicate: false, coinBalance: null, coinSaved: false }`
- `{ updated: true, dailyStreak: null, duplicate: true, reason, coinBalance: null, coinSaved: false }`
- `{ updated, dailyStreak, duplicate: false, coinBalance, coinSaved: row?.coin_saved === true }`

Va `executeRows` generikiga `coin_saved: boolean` qo'shing.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: xatosiz (chaqiruvchilar `coinSaved`ni ishlatmasa ham buzilmaydi)

- [ ] **Step 3: Add integration test for net delta**

`tests/integration/api/streak-save.test.ts` fayliga qo'shing:

```ts
describe('streak coin-save — javob yo\'li (net delta)', () => {
  it('to\'g\'ri javob + coin-save bir vaqtda → mint YO\'QOLMAYDI (net delta)', async () => {
    const { progressRepository } = await import('../../../server/modules/progress/progress.repository')
    const { COINS_PER_CORRECT_ANSWER } = await import('../../../shared/shop-items')

    await seedStreak(U_FREE_RICH, '2026-06-10', 4)
    await seedCoins(U_FREE_RICH, 500)

    // gapDays = 1 → coin-save; javob to'g'ri → mint
    const res = await progressRepository.recordAnswer({
      userId: U_FREE_RICH, correct: true, questionId: 987654,
      date: '2026-06-12', subjectId: SUBJ, clientToken: `streak-save-net-${Date.now()}`,
    })

    expect(res.coinSaved).toBe(true)
    // Net: 500 + mint - save (mint yo'qolmasligi SHART)
    expect(await balanceOf(U_FREE_RICH)).toBe(500 + COINS_PER_CORRECT_ANSWER - STREAK_SAVE_COST)
  })
})
```

- [ ] **Step 4: Run integration tests**

Run: `npx vitest run tests/integration/api/streak-save.test.ts --config vitest.integration.config.ts`
Expected: barcha testlar PASS

- [ ] **Step 5: Run full test suites (regressiya tekshiruvi)**

Run: `npx vitest run tests/unit && npm run test:integration`
Expected: barchasi o'tadi — ayniqsa mavjud `coins.test.ts` (mint qoidalari) va `security-critical.test.ts` (anti-farm) buzilmasligi shart.

- [ ] **Step 6: Commit**

```bash
git add server/modules/progress/progress.repository.ts tests/integration/api/streak-save.test.ts
git commit -m "feat(streak): coin-save in answer path with net-delta coin write"
```

---

## Task 6: Frontend toast — foydalanuvchi coin yechilganini bilishi

**Files:**
- Modify: `src/shared/i18n/index.ts` (UZ va RU bloklariga kalit)
- Modify: `src/shared/api/index.ts` (agar javob tipi qattiq yozilgan bo'lsa — `coinSaved` qo'shish)
- Modify: javob qabul qilinadigan store/hook (aniq fayl Step 1'da topiladi)

**Interfaces:**
- Consumes: server javobidagi `coinSaved: boolean` (Task 3, 5).
- Produces: foydalanuvchiga ko'rinadigan toast.

- [ ] **Step 1: Locate the response handling**

Run: `grep -rn "dailyStreak" src/shared/store/ src/shared/api/index.ts | head -20`

Bu `dailyStreak` javobi frontend'da qayerda o'qilishini ko'rsatadi — `coinSaved` xuddi shu yerda qo'shiladi.

Run: `grep -rn "toast\|showToast" src/shared/store/useAppStore.ts | head -10`

Bu loyihadagi toast chaqirish naqshini ko'rsatadi.

- [ ] **Step 2: Add i18n keys**

`src/shared/i18n/index.ts` — UZ blokiga (`streakSavedToast` kalitini mavjud streak kalitlari yoniga qo'ying):

```ts
  streakSavedToast: "🧊 50 coin evaziga seriyangiz saqlandi!",
```

RU blokiga:

```ts
  streakSavedToast: "🧊 Серия сохранена за 50 монет!",
```

- [ ] **Step 3: Wire the toast**

Step 1'da topilgan javob-qabul qiluvchi joyda, `dailyStreak` yangilanadigan
qatorning yonida:

```ts
if (res.coinSaved) {
  // toast chaqiruvi — Step 1'da topilgan loyiha naqshi bo'yicha
  showToast(t('streakSavedToast'))
}
```

- [ ] **Step 4: Typecheck + i18n consistency test**

Run: `npx tsc -p tsconfig.json --noEmit && npx vitest run tests/unit`
Expected: PASS — loyihada i18n UZ/RU kalitlar mosligini tekshiradigan test bor, u yangi kalitni ikkala tilda talab qiladi.

- [ ] **Step 5: Commit**

```bash
git add src/shared/i18n/index.ts src/shared/store src/shared/api/index.ts
git commit -m "feat(streak): toast when coins rescue the streak"
```

---

## Task 7: Bot eslatma — oldindan ogohlantirish

**Files:**
- Modify: `server/modules/cron/cron.repository.ts` (yangi metod)
- Modify: `server/modules/cron/cron.router.ts` (`daily-reminder`, `textFor` funksiyasi ~70-85 qatorlar)

**Interfaces:**
- Consumes: `STREAK_SAVE_COST` (Task 1).
- Produces: `cronRepository.listStreakSaveWarnings(userIds: string[], today: string): Promise<Map<string, { willCostCoins: boolean; hasEnoughCoins: boolean }>>`

**Kontekst:** `daily-reminder` FAQAT bugun hali faol bo'lmagan userlarga yuboriladi. Ogohlantirish mazmuni: agar user BUGUN ham mashq qilmasa, ertaga qaytganda coin yechiladimi yoki streak butunlay yo'qoladimi.

- [ ] **Step 1: Add repository method**

`server/modules/cron/cron.repository.ts` fayliga qo'shing (mavjud `topStreaksForUsers` yoniga, xuddi shu naqsh bilan):

```ts
  /**
   * daily-reminder ogohlantirishi uchun: bugun mashq qilinmasa ERTAGA
   * qaytganda coin yechiladimi (va balans yetadimi).
   * `gapDaysIfSkipToday` — bugun ham o'tkazib yuborilsa ertangi gapDays.
   */
  async listStreakSaveWarnings(
    userIds: string[],
    today: string,
  ): Promise<Map<string, { willCostCoins: boolean; hasEnoughCoins: boolean }>> {
    const out = new Map<string, { willCostCoins: boolean; hasEnoughCoins: boolean }>()
    if (!userIds.length) return out

    const rows = await executeRows<{
      user_id: string
      gap_if_skip: number
      premium: boolean
      balance: number
    }>(sql`
      SELECT
        s.user_id,
        ((${today}::date + 1) - s.last_daily_date::date - 1)::int AS gap_if_skip,
        (u.tariff = 'premium' OR (u.premium_until IS NOT NULL AND u.premium_until > now())) AS premium,
        COALESCE(c.balance, 0)::int AS balance
      FROM daily_streaks s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN user_coins c ON c.user_id = s.user_id
      WHERE s.user_id = ANY(${userIds})
      ORDER BY s.streak DESC
    `)

    for (const r of rows) {
      if (out.has(r.user_id)) continue   // eng yuqori streak'li fan (ORDER BY)
      const gap = Number(r.gap_if_skip)
      const premium = r.premium === true
      const willCostCoins = (gap === 1 && !premium) || (gap === 2 && premium)
      out.set(r.user_id, {
        willCostCoins,
        hasEnoughCoins: Number(r.balance) >= STREAK_SAVE_COST,
      })
    }
    return out
  },
```

Import qo'shing: `import { STREAK_SAVE_COST } from '../../../shared/streak-save'`

**DIQQAT:** `= ANY(${userIds})` neon-http'da massiv bilan muammo berishi mumkin
(loyiha izohida qayd etilgan: "neon-http driver JS massivni JSON string qilib
yuboradi"). Agar test paytida xato chiqsa — drizzle query builder `inArray()`
ishlatilgan variantga o'ting (`octagon.ts` `resolveAvatars` naqshi).

- [ ] **Step 2: Wire into the reminder message**

`server/modules/cron/cron.router.ts` — `streakOf` olinadigan joydan keyin:

```ts
    const saveWarnings = await cronRepository.listStreakSaveWarnings(targets, today)
```

`textFor` funksiyasiga qo'shing (mavjud matndan KEYIN qo'shimcha qator):

```ts
    const textFor = (uid: string) => {
      const s = streakOf.get(uid) ?? 0
      const warn = saveWarnings.get(uid)
      const saveLine = warn?.willCostCoins
        ? (warn.hasEnoughCoins
            ? `\n\n🧊 Bugun ham qoldirsangiz, ertaga 50 coin evaziga seriya saqlanadi.`
            : `\n\n⚠️ Bugun ham qoldirsangiz seriya 0 ga tushadi (coin yetarli emas).`)
        : ''

      if (s > 0) {
        return (
          `🔥 ${s} kunlik seriyangiz xavf ostida!\n\n` +
          `Bugun hali mashq qilmadingiz — 2 daqiqalik test seriyangizni saqlab qoladi. ` +
          `1 kun o'tkazilsa intizom 0 ga tushadi!` + saveLine
        )
      }
      return (
        `🔥 Bugungi mashqni qolmang!\n\n` +
        `2 daqiqalik kichik test — katta natijaga birinchi qadam. ` +
        `Har kuni 1 savol = intizom seriyasi!` + saveLine
      )
    }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: xatosiz

- [ ] **Step 4: Run cron integration tests**

Run: `npx vitest run tests/integration/api/cron.test.ts --config vitest.integration.config.ts`
Expected: mavjud cron testlar buzilmagan

- [ ] **Step 5: Commit**

```bash
git add server/modules/cron/cron.repository.ts server/modules/cron/cron.router.ts
git commit -m "feat(streak): warn about coin cost in daily reminder"
```

---

## Task 8: Yakuniy verifikatsiya va hujjat

**Files:**
- Modify: `FIXPLAN.md` (yangi feature qatori)

- [ ] **Step 1: Full verification**

```bash
npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.server.json --noEmit
npx vitest run tests/unit
npm run test:integration
npm run lint
```

Expected: hammasi toza. Har qanday xato — tuzatilishi shart (yashirilmasin).

- [ ] **Step 2: Document in FIXPLAN.md**

PART 7 (Featurelar) oxiriga qo'shing:

```markdown
- [x] **52. Streak coin-save** — kunlik seriya uzilganda coin balansidan
  avtomatik `STREAK_SAVE_COST`=50 yechib saqlash. Bosqichlar: premium 1-kun
  BEPUL (mavjud xulq), keyingi kun (premium) yoki 1-kun (bepul user) —
  50 coin; balans yetmasa yoki 3+ kun uzilsa reset. SSOT `shared/streak-save.ts`
  (`decideStreakOutcome`), SQL fragmentlar `server/modules/daily/streak-save-sql.ts`
  (ikkala streak yozuvchi repository bitta manbadan). **Muhim texnik topilma:**
  Postgres bir statementda bitta qatorga ikkita UPDATE CTE qo'llasa faqat
  BITTASI saqlanadi — shuning uchun `recordAnswer`da mint va save-debit BITTA
  `user_coins` yozuvida net delta bilan birlashtirildi (alohida CTE mint'ni
  jimgina yo'qotardi). Idempotentlik: `coin_transactions` `ON CONFLICT
  (user_id, reason, ref_id) DO NOTHING` debit gate'i sifatida. UI: toast +
  daily-reminder oldindan ogohlantirish.
```

- [ ] **Step 3: Commit + push**

```bash
git add FIXPLAN.md
git commit -m "docs(fixplan): record streak coin-save feature"
git push -u origin feat/streak-coin-save
```

---

## Self-Review Notes

**Spec coverage:**
- Mexanika jadvali (gapDays × premium × balans) → Task 1 (sof funksiya) + Task 2 (SQL) + Task 4/5 (testlar) ✓
- Yangi ustun/jadval kerak emas → hech qaysi taskda migratsiya yo'q ✓
- Umumiy SQL fragment (ikki repository) → Task 2, 3, 5 ✓
- Atomiklik + KRITIK CHEKLOV (net delta) → Task 5, aniq kod bilan ✓
- Ledger idempotentligi (`ref_id`) → Task 3, 5 + test Task 4 ✓
- Premium holati joriy o'qiladi → Task 2 `entitlement` CTE ✓
- API kontrakti `coinSaved` → Task 3, 5, 6 ✓
- Frontend toast → Task 6 ✓
- Bot eslatma → Task 7 ✓
- Testlar (unit + integration + race) → Task 1, 4, 5 ✓

**Ochiq risk (implementer diqqatiga):**
- `coin_transactions.reason` ustuni enum bo'lsa — Task 4 Step 3 buni tekshiradi, enum bo'lsa migratsiya kerak bo'ladi (rejada yo'q, chunki `text` deb taxmin qilingan — tekshiruv qadami qo'yilgan).
- `= ANY(${userIds})` neon-http massiv muammosi — Task 7 Step 1'da ogohlantirish va muqobil yechim ko'rsatilgan.
