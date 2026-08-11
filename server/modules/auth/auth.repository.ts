/**
 * Auth repository — `auth_identities` / `sessions` / `link_codes` DB access.
 * Business logic YO'Q — faqat SQL/Drizzle (boshqa repository'lar bilan bir xil).
 */

import { and, eq, sql, desc } from 'drizzle-orm'
import { db, executeRows, type DB } from '../../db/connection'
import {
  authIdentities, sessions, linkCodes, otpCodes,
  emailVerificationTokens, passwordResetTokens,
  userDevices, loginHistory, auditLogs,
} from '../../schema'

export type AuthProvider = 'telegram' | 'phone' | 'email' | 'google' | 'apple'

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
   * @param txOrDb — tashqi transaction ichida chaqirilganda (register flow)
   */
  async createIdentity(
    provider: AuthProvider, providerUid: string, userId: string, passwordHash: string | null, txOrDb?: DB,
  ): Promise<boolean> {
    const rows = await (txOrDb ?? db).insert(authIdentities)
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

  /** provider='phone' yoki 'email' identity parol hash'ini yangilash (link/register oqimida). */
  async setPasswordHash(provider: 'phone' | 'email', providerUid: string, passwordHash: string): Promise<void> {
    await db.update(authIdentities)
      .set({ passwordHash })
      .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerUid, providerUid)))
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

  /**
   * User'ning BARCHA sessiyalarini revoke qilish (parol almashtirilganda/tiklanganda) —
   * o'g'irlangan token 30 kunlik TTL tugaguncha yashab qolmasligi uchun.
   * @param exceptToken — joriy sessiyani saqlab qolish (change-password oqimi).
   */
  async deleteUserSessions(userId: string, exceptToken?: string): Promise<void> {
    await db.delete(sessions).where(exceptToken
      ? and(eq(sessions.userId, userId), sql`${sessions.token} <> ${exceptToken}`)
      : eq(sessions.userId, userId))
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

  /** OTP kod yaratish (hash saqlanadi, plain text SMS'da). Conflict'da eskisini replace qiladi. */
  async createOTP(phone: string, codeHash: string, expiresAt: Date, txOrDb?: DB): Promise<void> {
    // created_at HAM yangilanadi — resend cooldown (so'nggi yuborilgan vaqt) shunga tayanadi
    await (txOrDb ?? db).insert(otpCodes).values({ phone, codeHash, expiresAt })
      .onConflictDoUpdate({ target: otpCodes.phone, set: { codeHash, expiresAt, attempts: 0, createdAt: new Date() } })
  },

  /**
   * OTP holati — so'nggi kod qachon yuborilgan (resend cooldown tekshiruvi).
   * `created_at` yangi kod yozilganda yangilanadi (upsert).
   */
  async getOTPState(phone: string): Promise<{ attempts: number; createdAt: Date } | null> {
    const [row] = await db.select({ attempts: otpCodes.attempts, createdAt: otpCodes.createdAt })
      .from(otpCodes).where(eq(otpCodes.phone, phone))
    return row ?? null
  },

  /**
   * Noto'g'ri OTP verify urinishini ATOMIK sanash (+1) va joriy qiymatni qaytarish.
   * Race-safe: UPDATE ... RETURNING — parallel urinishlar ham aniq sanaladi.
   */
  async incrementOTPAttempts(phone: string): Promise<number> {
    const rows = await executeRows<{ attempts: number }>(sql`
      UPDATE otp_codes SET attempts = attempts + 1
      WHERE phone = ${phone} AND expires_at > now()
      RETURNING attempts
    `)
    return Number(rows[0]?.attempts ?? 0)
  },

  /**
   * OTP lockout — urinish limiti oshganda kodni butunlay o'chirish (yangi kod so'rash shart).
   * O'chirish atomic-consume'dan xavfsiz: faqt verify yo'lida chaqiriladi.
   */
  async deleteOTP(phone: string): Promise<void> {
    await db.delete(otpCodes).where(eq(otpCodes.phone, phone))
  },

  /**
   * OTP kodini tekshirish va konsumatsiya — ATOMIK single-use.
   * @returns true = kod to'g'ri va amal qiladi; false = noto'g'ri / eskirgan
   */
  async consumeOTP(phone: string, codeHash: string, txOrDb?: DB): Promise<boolean> {
    const rows = await executeRows<{ phone: string }>(sql`
      DELETE FROM otp_codes WHERE phone = ${phone} AND code_hash = ${codeHash} AND expires_at > now()
      RETURNING phone
    `, txOrDb)
    return rows.length > 0
  },

  /** Eskirgan OTP kodlarni tozalash (cron / opportunistic) */
  async cleanExpiredOTP(txOrDb?: DB): Promise<number> {
    const rows = await executeRows<{ cnt: number }>(sql`
      DELETE FROM otp_codes WHERE expires_at <= now() RETURNING 1 AS cnt
    `, txOrDb)
    return rows.length
  },

  // ── Email verification ──────────────────────────────────────────────────

  async createEmailVerificationToken(userId: string, email: string, token: string, expiresAt: Date, txOrDb?: DB): Promise<void> {
    await (txOrDb ?? db).insert(emailVerificationTokens).values({ token, userId, email, expiresAt })
  },

  /** Atomik single-use: DELETE...RETURNING (parallel consume → faqat bittasi success) */
  async consumeEmailVerificationToken(token: string, txOrDb?: DB): Promise<{ userId: string; email: string } | null> {
    const rows = await executeRows<{ user_id: string; email: string }>(sql`
      DELETE FROM email_verification_tokens
      WHERE token = ${token} AND expires_at > now()
      RETURNING user_id, email
    `, txOrDb)
    return rows[0] ? { userId: rows[0].user_id, email: rows[0].email } : null
  },

  async cleanExpiredEmailTokens(txOrDb?: DB): Promise<number> {
    const rows = await executeRows<{ cnt: number }>(sql`
      DELETE FROM email_verification_tokens WHERE expires_at <= now() RETURNING 1 AS cnt
    `, txOrDb)
    return rows.length
  },

  // ── Password reset ──────────────────────────────────────────────────────

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date, txOrDb?: DB): Promise<void> {
    await (txOrDb ?? db).insert(passwordResetTokens).values({ token, userId, expiresAt })
  },

  /** So'nggi `withinMinutes` ichida user uchun yaratilgan reset token'lar soni (per-email flood himoyasi). */
  async countRecentPasswordResetTokens(userId: string, withinMinutes: number): Promise<number> {
    const mins = Math.max(1, Math.min(1440, Math.floor(withinMinutes)))
    const rows = await executeRows<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt FROM password_reset_tokens
      WHERE user_id = ${userId} AND created_at > now() - (${mins} || ' minutes')::interval
    `)
    return Number(rows[0]?.cnt ?? 0)
  },

  /** Validate + mark used (NOT deleted — audit trail) */
  async consumePasswordResetToken(token: string, txOrDb?: DB): Promise<string | null> {
    const rows = await executeRows<{ user_id: string }>(sql`
      UPDATE password_reset_tokens
      SET used_at = now()
      WHERE token = ${token} AND expires_at > now() AND used_at IS NULL
      RETURNING user_id
    `, txOrDb)
    return rows[0]?.user_id ?? null
  },

  /** Clean expired tokens (used OR unused — all expired get deleted for storage efficiency) */
  async cleanExpiredPasswordTokens(txOrDb?: DB): Promise<number> {
    const rows = await executeRows<{ cnt: number }>(sql`
      DELETE FROM password_reset_tokens WHERE expires_at <= now()
      RETURNING 1 AS cnt
    `, txOrDb)
    return rows.length
  },

  // ── Device tracking ─────────────────────────────────────────────────────

  async upsertDevice(device: {
    id: string
    userId: string
    deviceName?: string
    deviceType?: string
    os?: string
    browser?: string
    ipAddress?: string
    userAgent?: string
    fingerprint?: string
  }, txOrDb?: DB): Promise<void> {
    await (txOrDb ?? db).insert(userDevices).values(device)
      .onConflictDoUpdate({
        target: userDevices.id,
        set: {
          lastActiveAt: sql`now()`,
          ipAddress: device.ipAddress,
          userAgent: device.userAgent,
        },
      })
  },

  async getDevicesByUser(userId: string, limit = 10): Promise<Array<{
    id: string
    deviceName: string | null
    deviceType: string | null
    lastActiveAt: Date
  }>> {
    return db.select({
      id: userDevices.id,
      deviceName: userDevices.deviceName,
      deviceType: userDevices.deviceType,
      lastActiveAt: userDevices.lastActiveAt,
    })
      .from(userDevices)
      .where(eq(userDevices.userId, userId))
      .orderBy(desc(userDevices.lastActiveAt))
      .limit(limit)
  },

  // ── Login history ───────────────────────────────────────────────────────

  async createLoginHistory(entry: {
    userId: string
    provider: AuthProvider
    deviceId?: string
    ipAddress?: string
    userAgent?: string
    success: boolean
    failureReason?: string
    location?: { country?: string; city?: string }
  }, txOrDb?: DB): Promise<void> {
    await (txOrDb ?? db).insert(loginHistory).values(entry)
  },

  async getLoginHistory(userId: string, limit = 20): Promise<Array<{
    id: number
    provider: string
    success: boolean
    failureReason: string | null
    createdAt: Date
  }>> {
    return db.select({
      id: loginHistory.id,
      provider: loginHistory.provider,
      success: loginHistory.success,
      failureReason: loginHistory.failureReason,
      createdAt: loginHistory.createdAt,
    })
      .from(loginHistory)
      .where(eq(loginHistory.userId, userId))
      .orderBy(sql`${loginHistory.createdAt} DESC`)
      .limit(limit)
  },

  async countRecentFailedLogins(userId: string, sinceMinutes = 15, txOrDb?: DB): Promise<number> {
    const minutes = Number(sinceMinutes)
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
      throw new Error('Invalid sinceMinutes: must be 0-1440')
    }
    const rows = await executeRows<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt FROM login_history
      WHERE user_id = ${userId}
        AND success = false
        AND created_at > now() - (${minutes} || ' minutes')::interval
    `, txOrDb)
    return Number(rows[0]?.cnt ?? 0)
  },

  // ── Audit logs ──────────────────────────────────────────────────────────

  async createAuditLog(entry: {
    userId?: string
    action: string
    resourceType?: string
    resourceId?: string
    changes?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
  }, txOrDb?: DB): Promise<void> {
    await (txOrDb ?? db).insert(auditLogs).values(entry)
  },

  // ── Account security ────────────────────────────────────────────────────

  async incrementFailedLoginAttempts(userId: string, txOrDb?: DB): Promise<number> {
    const rows = await executeRows<{ attempts: number }>(sql`
      UPDATE users
      SET failed_login_attempts = failed_login_attempts + 1
      WHERE id = ${userId}
      RETURNING failed_login_attempts AS attempts
    `, txOrDb)
    return Number(rows[0]?.attempts ?? 0)
  },

  async resetFailedLoginAttempts(userId: string, txOrDb?: DB): Promise<void> {
    await executeRows(sql`
      UPDATE users
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE id = ${userId}
    `, txOrDb)
  },

  async lockAccount(userId: string, lockUntil: Date, txOrDb?: DB): Promise<void> {
    await executeRows(sql`
      UPDATE users
      SET locked_until = ${lockUntil}
      WHERE id = ${userId}
    `, txOrDb)
  },

  /** Check if account locked. Returns false if user not found (non-existent users not locked). */
  async isAccountLocked(userId: string, txOrDb?: DB): Promise<boolean> {
    const rows = await executeRows<{ locked: boolean }>(sql`
      SELECT (locked_until IS NOT NULL AND locked_until > now()) AS locked
      FROM users WHERE id = ${userId}
    `, txOrDb)
    return Boolean(rows[0]?.locked)
  },

  async updateLastLogin(userId: string, txOrDb?: DB): Promise<void> {
    await executeRows(sql`
      UPDATE users
      SET last_login_at = now()
      WHERE id = ${userId}
    `, txOrDb)
  },

  async markEmailVerified(userId: string, txOrDb?: DB): Promise<void> {
    await executeRows(sql`
      UPDATE users
      SET email_verified_at = now()
      WHERE id = ${userId} AND email_verified_at IS NULL
    `, txOrDb)
  },

  async updatePasswordChangeTimestamp(userId: string, txOrDb?: DB): Promise<void> {
    await executeRows(sql`
      UPDATE users
      SET last_password_change_at = now()
      WHERE id = ${userId}
    `, txOrDb)
  },
}
