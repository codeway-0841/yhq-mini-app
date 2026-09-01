/**
 * Premium holat tekshiruvi — umumiy helper (tutor, ai-tests va boshqalar uchun).
 * Effective premium: lifetime tariff YOKI premium_until muddati tugamagan.
 */
import { eq } from 'drizzle-orm'
import { db } from '../db/connection'
import { users } from '../schema'

export async function isPremiumUser(userId: string): Promise<boolean> {
  const [row] = await db.select({ tariff: users.tariff, premiumUntil: users.premiumUntil })
    .from(users).where(eq(users.id, userId))
  return !!row && (row.tariff === 'premium' || (row.premiumUntil != null && row.premiumUntil > new Date()))
}
