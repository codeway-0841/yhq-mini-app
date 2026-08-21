/**
 * Leaderboard — integration testlar (real test DB).
 *
 * Qamrov:
 *  - topN: totalCorrect DESC, streak DESC tartib; rank 1-based; isYou flag
 *  - progress qatorisiz user (bot invoice upsert yo'li) topN'da KO'RINMAYDI
 *    (audit fix: FROM users LEFT JOIN progress → FROM progress INNER JOIN
 *    users — bu userlar totalCorrect=0 bo'lgani uchun bu qasddan xulq).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { users, progress } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { leaderboardRepository } from '../../../server/modules/leaderboard/leaderboard.repository'

const U1 = '990000006001'   // totalCorrect 30
const U2 = '990000006002'   // totalCorrect 20
const U3 = '990000006003'   // progress'siz (upsert yo'li — bot invoice holati)
const IDS = [U1, U2, U3]

async function cleanup() {
  for (const id of IDS) {
    await db.delete(users).where(eq(users.id, id))   // FK cascade: progress
  }
}

beforeAll(async () => {
  await cleanup()
  await usersRepository.initAtomic({ id: U1, firstName: 'Lead', lastName: 'One', username: '', photoUrl: '' })
  await usersRepository.initAtomic({ id: U2, firstName: 'Lead', lastName: 'Two', username: '', photoUrl: '' })
  // U3: progress'siz — real "bot invoice" stub-user holatini simulyatsiya qiladi
  await usersRepository.upsert({ id: U3, firstName: 'Lead', lastName: 'Three', username: '', photoUrl: '' })

  await db.update(progress).set({ totalCorrect: 30, totalAnswered: 30, streak: 5 }).where(eq(progress.userId, U1))
  await db.update(progress).set({ totalCorrect: 20, totalAnswered: 20, streak: 2 }).where(eq(progress.userId, U2))
})

afterAll(cleanup)

describe('leaderboard — topN', () => {
  it('totalCorrect DESC tartibda qaytaradi; isYou callerUserId bo\'yicha to\'g\'ri', async () => {
    const rows = await leaderboardRepository.topN(100, U2)
    const r1 = rows.find((r) => r.userId === U1)!
    const r2 = rows.find((r) => r.userId === U2)!
    expect(r1).toBeDefined()
    expect(r2).toBeDefined()
    expect(r1.score).toBe(30)
    expect(r2.score).toBe(20)
    expect(r1.rank).toBeLessThan(r2.rank)
    expect(r2.isYou).toBe(true)
    expect(r1.isYou).toBe(false)
  })

  it('progress qatorisiz user (upsert yo\'li) topN natijasida yo\'q', async () => {
    const rows = await leaderboardRepository.topN(100, null)
    expect(rows.find((r) => r.userId === U3)).toBeUndefined()
  })
})
