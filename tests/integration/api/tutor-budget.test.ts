/**
 * Integration test: AI Tutor kunlik kvota ledger (tutor_usage).
 * Atomik upsert + limit tekshiruvi — parallel requestlar limitni
 * chetlab o'tmasligi shart.
 * Run with: npm run test:integration
 */

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { tutorUsage, users } from '../../../server/schema'
import { tutorUsageRepository, TUTOR_GLOBAL_USER_ID } from '../../../server/modules/tutor/tutor.repository'

const USER_ID = 998877660010n
const DATE = '2026-08-07'

async function cleanup() {
  await db.delete(tutorUsage).where(eq(tutorUsage.userId, USER_ID))
  await db.delete(tutorUsage).where(eq(tutorUsage.userId, TUTOR_GLOBAL_USER_ID))
  await db.delete(users).where(eq(users.id, USER_ID))
}

beforeAll(cleanup)
afterAll(cleanup)

describe('tutorUsageRepository.tryConsume', () => {
  it('limit ichida true, limitdan keyin false qaytaradi', async () => {
    const limit = 3
    expect(await tutorUsageRepository.tryConsume(USER_ID, DATE, limit)).toBe(true)   // 1
    expect(await tutorUsageRepository.tryConsume(USER_ID, DATE, limit)).toBe(true)   // 2
    expect(await tutorUsageRepository.tryConsume(USER_ID, DATE, limit)).toBe(true)   // 3
    expect(await tutorUsageRepository.tryConsume(USER_ID, DATE, limit)).toBe(false)  // 4 — limitdan oshdi
  })

  it('limitdan oshsa ham count oshib boradi (abuse ko\'rinadi)', async () => {
    await tutorUsageRepository.tryConsume(USER_ID, DATE, 3) // 5
    const [row] = await db.select().from(tutorUsage)
      .where(eq(tutorUsage.userId, USER_ID))
    expect(row.count).toBe(5)
  })

  it('boshqa sana mustaqil hisoblanadi', async () => {
    expect(await tutorUsageRepository.tryConsume(USER_ID, '2026-08-08', 1)).toBe(true)
    await db.delete(tutorUsage).where(eq(tutorUsage.date, '2026-08-08'))
  })

  it('global byudjet (user_id=0) user kvotasidan mustaqil', async () => {
    expect(await tutorUsageRepository.tryConsume(TUTOR_GLOBAL_USER_ID, DATE, 2)).toBe(true)
    expect(await tutorUsageRepository.tryConsume(TUTOR_GLOBAL_USER_ID, DATE, 2)).toBe(true)
    expect(await tutorUsageRepository.tryConsume(TUTOR_GLOBAL_USER_ID, DATE, 2)).toBe(false)
    // User kvotasi (oldingi testlarda 5) global hisobga kirmaydi
    const [row] = await db.select().from(tutorUsage)
      .where(eq(tutorUsage.userId, TUTOR_GLOBAL_USER_ID))
    expect(row.count).toBe(3)
  })
})
