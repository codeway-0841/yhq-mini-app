/**
 * Auth repository — `auth_identities` / `sessions` / `link_codes` DB access.
 * Business logic YO'Q — faqat SQL/Drizzle (boshqa repository'lar bilan bir xil).
 */

import { and, eq, sql } from 'drizzle-orm'
import { db, executeRows, type DB } from '../../db/connection'
import { authIdentities, sessions, linkCodes } from '../../schema'

export type AuthProvider = 'telegram' | 'phone'

export const authRepository = {
  async findIdentity(provider: AuthProvider, providerUid: string) {
    const [row] = await db.select().from(authIdentities)
      .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerUid, providerUid)))
    return row ?? null
  },

  /** Idempotent identity yaratish — borma bo'lsa sukut saqlaydi (ON CONFLICT DO NOTHING). */
  async ensureIdentity(provider: AuthProvider, providerUid: string, userId: string): Promise<void> {
    await db.insert(authIdentities).values({ provider, providerUid, userId }).onConflictDoNothing()
  },

  /**
   * Register/link'da identity + parol birga: ON CONFLICT DO NOTHING + RETURNING
   * orqali "yaratildimi?" aniqlanadi (false → raqam allaqachon band, 409).
   */
  async createIdentity(provider: AuthProvider, providerUid: string, userId: string, passwordHash: string | null): Promise<boolean> {
    const rows = await db.insert(authIdentities)
      .values({ provider, providerUid, userId, passwordHash })
      .onConflictDoNothing()
      .returning({ provider: authIdentities.provider })
    return rows.length > 0
  },

  /** Foydalanuvchiga ulangan provider'lar (Profil "Hisobni bog'lash" uchun). */
  async listUserProviders(userId: string): Promise<AuthProvider[]> {
    const rows = await db.select({ provider: authIdentities.provider })
      .from(authIdentities).where(eq(authIdentities.userId, userId))
    return rows.map((r) => r.provider as AuthProvider)
  },

  /** provider='phone' identity parol hash'ini yangilash (link/register oqimida). */
  async setPasswordHash(providerUid: string, passwordHash: string): Promise<void> {
    await db.update(authIdentities)
      .set({ passwordHash })
      .where(and(eq(authIdentities.provider, 'phone'), eq(authIdentities.providerUid, providerUid)))
  },

  async createSession(input: { token: string; userId: string; provider: AuthProvider; expiresAt: Date }): Promise<void> {
    await db.insert(sessions).values(input)
  },

  /**
   * Bearer token resolve — eskirgan sessiya TOPILSA o'chirib yuboriladi va null
   * (sessiya jadvali o'sib ketmasligi uchun opportunistik tozalash).
   */
  async resolveSession(token: string): Promise<{ userId: string; provider: AuthProvider } | null> {
    const [row] = await db.select().from(sessions).where(eq(sessions.token, token))
    if (!row) return null
    if (row.expiresAt <= new Date()) {
      await db.delete(sessions).where(eq(sessions.token, token))
      return null
    }
    return { userId: row.userId, provider: row.provider as AuthProvider }
  },

  /** Logout / revoke. */
  async deleteSession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, token))
  },

  async createLinkCode(input: { code: string; userId: string; expiresAt: Date }): Promise<void> {
    await db.insert(linkCodes).values(input)
  },

  /**
   * ATOMIK single-use: DELETE ... RETURNING — ikki parallel iste'molning bittasi
   * muvaffaqiyatli bo'ladi; eskirgan kod null qaytaradi.
   * @param txOrDb - Optional transaction for multi-step atomic operations
   */
  async consumeLinkCode(code: string, txOrDb?: DB): Promise<string | null> {
    const rows = await executeRows<{ user_id: string }>(sql`
      DELETE FROM link_codes WHERE code = ${code} AND expires_at > now() RETURNING user_id
    `, txOrDb)
    return rows[0]?.user_id ?? null
  },
}
