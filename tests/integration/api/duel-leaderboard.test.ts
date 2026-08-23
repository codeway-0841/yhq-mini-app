/**
 * Duel (Oktagon) leaderboard — integration testlar (real test DB).
 *
 * Qamrov:
 *  - duelTop `duel_results` jadvalidan davr (kunlik/haftalik/oylik/all) bo'yicha
 *    agregatsiya qiladi, `progress.octagon_wins` (umrbod counter) EMAS
 *  - W-L-D va winRate to'g'ri hisoblanadi
 *  - davrdan tashqaridagi natijalar hisobga olinmaydi
 *  - faqat g'alabasi bor userlar ko'rinadi (draw/lose-only ro'yxatda yo'q)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { users, progress, duelResults } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'
import {
  leaderboardRepository, todayTashkent, weekStartTashkent, monthStartTashkent,
} from '../../../server/modules/leaderboard/leaderboard.repository'

const D1 = '990000009001'   // bugun 3 g'alaba, 1 mag'lubiyat
const D2 = '990000009002'   // bugun 1 g'alaba + kecha 1 g'alaba
const D3 = '990000009003'   // bugun faqat durang — reytingda YO'Q
const D4 = '990000009004'   // 60 kun oldin 5 g'alaba — faqat 'all' davrida
const IDS = [D1, D2, D3, D4]

/** 'YYYY-MM-DD' → shu Toshkent kuni soat 12:00 ga to'g'ri keladigan UTC vaqt */
function tashkentNoon(dateStr: string): Date {
  return new Date(`${dateStr}T07:00:00Z`)   // UTC+5 → 12:00 Tashkent
}

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

let seq = 0
async function seedDuel(
  userId: string,
  result: 'win' | 'lose' | 'draw',
  date: string,
  opponentId: string | null = null,
) {
  await db.insert(duelResults).values({
    matchId:   `test-duel-${++seq}`,
    userId,
    opponentId,
    result,
    selfScore: result === 'win' ? 3 : result === 'lose' ? 1 : 2,
    oppScore:  result === 'win' ? 1 : result === 'lose' ? 3 : 2,
    forfeit:   false,
    createdAt: tashkentNoon(date),
  })
}

async function cleanup() {
  for (const id of IDS) {
    await db.delete(users).where(eq(users.id, id))   // FK cascade: progress + duel_results
  }
}

const today      = todayTashkent()
const yesterday  = shiftDays(today, -1)
const weekStart  = weekStartTashkent()
const monthStart = monthStartTashkent()
// Dushanba bo'lsa "kecha" joriy haftaga kirmaydi — chegara shartini dinamik tekshiramiz
const yesterdayInWeek  = yesterday >= weekStart
const yesterdayInMonth = yesterday >= monthStart

beforeAll(async () => {
  await cleanup()
  for (const [i, id] of IDS.entries()) {
    await usersRepository.initAtomic({ id, firstName: 'Duel', lastName: `P${i + 1}`, username: '', photoUrl: '' })
  }
  // Umrbod counter ataylab teskari tartibda — duelTop unga QARAMASLIGI kerak
  await db.update(progress).set({ octagonWins: 999 }).where(eq(progress.userId, D4))

  await seedDuel(D1, 'win',  today, D2)
  await seedDuel(D1, 'win',  today, D3)
  await seedDuel(D1, 'win',  today, D2)
  await seedDuel(D1, 'lose', today, D2)

  await seedDuel(D2, 'win',  today, D3)
  await seedDuel(D2, 'win',  yesterday, D3)

  await seedDuel(D3, 'draw', today, D1)

  await seedDuel(D4, 'win', shiftDays(today, -60), D1)
  await seedDuel(D4, 'win', shiftDays(today, -60), D1)
  await seedDuel(D4, 'win', shiftDays(today, -60), D1)
  await seedDuel(D4, 'win', shiftDays(today, -60), D2)
  await seedDuel(D4, 'win', shiftDays(today, -60), D2)
})

afterAll(cleanup)

describe('leaderboard — duelTop', () => {
  it('kunlik: faqat bugungi natijalar, ball = bugungi g\'alabalar', async () => {
    const rows = await leaderboardRepository.duelTop(50, D1, 'daily')
    const mine = rows.filter((r) => IDS.includes(r.userId))

    expect(mine.map((r) => r.userId)).toEqual([D1, D2])   // D3 (durang) va D4 (eski) yo'q

    const first = mine[0]!
    expect(first.score).toBe(3)
    expect(first.wins).toBe(3)
    expect(first.losses).toBe(1)
    expect(first.draws).toBe(0)
    expect(first.winRate).toBe(75)                        // 3 / 4
    expect(first.isYou).toBe(true)
    expect(first.rank).toBe(1)

    const second = mine[1]!
    expect(second.userId).toBe(D2)
    expect(second.wins).toBe(1)
    expect(second.winRate).toBe(100)
  })

  it('haftalik: hafta boshidan beri, kunlikdan tashqaridagi natija ham qo\'shiladi', async () => {
    const rows = await leaderboardRepository.duelTop(50, null, 'weekly')
    const d2 = rows.find((r) => r.userId === D2)

    expect(d2?.wins).toBe(yesterdayInWeek ? 2 : 1)
    expect(rows.find((r) => r.userId === D4)).toBeUndefined()   // 60 kun oldingi natija emas
    expect(rows.find((r) => r.userId === D3)).toBeUndefined()   // g'alabasiz
  })

  it('oylik: oy boshidan beri', async () => {
    const rows = await leaderboardRepository.duelTop(50, null, 'monthly')
    const d1 = rows.find((r) => r.userId === D1)
    const d2 = rows.find((r) => r.userId === D2)

    expect(d1?.wins).toBe(3)
    expect(d2?.wins).toBe(yesterdayInMonth ? 2 : 1)
    expect(rows.find((r) => r.userId === D4)).toBeUndefined()
  })

  it('all: umrbod octagon_wins counteridan o\'qiydi (deploy oldingi tarix ham)', async () => {
    // D4'ning duel_results'da 5 qatori bor, counteri esa 999 — umumiy tab
    // counterni ko'rsatadi (davr jadvali #52 deploy'idan keyingini biladi xolos)
    const rows = await leaderboardRepository.duelTop(100, null, 'all')
    const d4 = rows.find((r) => r.userId === D4)

    expect(d4?.score).toBe(999)
    expect(d4?.wins).toBe(999)
    // Counterda mag'lubiyat/durang tarixi yo'q — UI bu tabda W-L-D ko'rsatmaydi
    expect(d4?.losses).toBe(0)
    expect(d4?.draws).toBe(0)
    expect(d4?.winRate).toBe(0)
  })

  it('all: octagon_wins = 0 bo\'lgan user ro\'yxatda yo\'q', async () => {
    const rows = await leaderboardRepository.duelTop(100, null, 'all')
    expect(rows.find((r) => r.userId === D3)).toBeUndefined()
  })

  it('teng g\'alabada sof farq (W−L) bo\'yicha saralaydi', async () => {
    await seedDuel(D3, 'win',  today, D1)
    await seedDuel(D3, 'win',  today, D1)
    await seedDuel(D3, 'win',  today, D1)
    // D3: 3 g'alaba, 0 mag'lubiyat, 1 durang; D1: 3 g'alaba, 1 mag'lubiyat
    const rows = await leaderboardRepository.duelTop(50, null, 'daily')
    const mine = rows.filter((r) => IDS.includes(r.userId))

    expect(mine[0]!.userId).toBe(D3)
    expect(mine[0]!.draws).toBe(1)
    expect(mine[0]!.winRate).toBe(75)   // 3 / 4
    expect(mine[1]!.userId).toBe(D1)
  })
})
