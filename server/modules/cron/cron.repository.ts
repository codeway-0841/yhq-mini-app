import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '../../db/connection'
import {
  analyticsEvents, answerTokens, auditLogs, dailyLimits, dailyRecords, dailyStreaks, jobRuns,
  leagueRolloverLog, linkCodes, loginHistory, otpCodes, progress, rateLimits,
  sessions, telegramLoginCodes, userCoins,
  testSessions,
} from '../../schema'
import { authRepository } from '../auth/auth.repository'

const STALE_AFTER_MS = 60 * 60_000

export const cronRepository = {
  /** Completed period qayta ochilmaydi; faqat 1 soatdan eski running lease olinadi. */
  async tryStart(jobName: string, periodKey: string): Promise<boolean> {
    const staleBefore = new Date(Date.now() - STALE_AFTER_MS)
    const rows = await db.insert(jobRuns).values({ jobName, periodKey })
      .onConflictDoUpdate({
        target: [jobRuns.jobName, jobRuns.periodKey],
        // DIQQAT: details QAYTA YOZILMAYDI (audit H-6) — stale-lease RTY'da
        // oldingi run checkpoint'i ({offset, sent...}) saqlanib qoladi va job
        // shu nuqtadan davom etadi (dublikat yuborish himoyasi).
        set: { status: 'running', startedAt: new Date(), finishedAt: null },
        where: and(eq(jobRuns.status, 'running'), lt(jobRuns.startedAt, staleBefore)),
      })
      .returning({ id: jobRuns.id })
    return rows.length > 0
  },

  /** Stale-lease retry'da davom ettirish uchun saqlangan checkpoint (masalan {offset, sent...}). */
  async getRunDetails(jobName: string, periodKey: string): Promise<Record<string, unknown>> {
    const rows = await db
      .select({ details: jobRuns.details })
      .from(jobRuns)
      .where(and(eq(jobRuns.jobName, jobName), eq(jobRuns.periodKey, periodKey)))
    return (rows[0]?.details as Record<string, unknown> | undefined) ?? {}
  },

  /** Uzoq yuradigan job'ning oraliq checkpoint'i (har batch'dan keyin). */
  async saveCheckpoint(jobName: string, periodKey: string, checkpoint: Record<string, unknown>): Promise<void> {
    await db.update(jobRuns).set({ details: checkpoint })
      .where(and(eq(jobRuns.jobName, jobName), eq(jobRuns.periodKey, periodKey)))
  },

  async complete(jobName: string, periodKey: string, details: Record<string, unknown>): Promise<void> {
    await db.update(jobRuns).set({
      status: 'completed',
      finishedAt: new Date(),
      details,
    }).where(and(eq(jobRuns.jobName, jobName), eq(jobRuns.periodKey, periodKey)))
  },

  // ── daily-reminder so'rovlar (repository pattern #20) ─────────────────

  /** So'nggi N kunda faol bo'lgan user id'lar */
  async listRecentActiveUserIds(cutoffDate: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ userId: dailyRecords.userId })
      .from(dailyRecords)
      .where(gte(dailyRecords.date, cutoffDate))
    return rows.map((r) => r.userId)
  },

  /** Aynan shu kunda faol bo'lgan user id'lar */
  async listActiveOnDate(date: string): Promise<Set<string>> {
    const rows = await db
      .selectDistinct({ userId: dailyRecords.userId })
      .from(dailyRecords)
      .where(eq(dailyRecords.date, date))
    return new Set(rows.map((r) => r.userId))
  },

  /** Berilgan userlarning eng uzun streak'i (xabarga kiritish uchun) */
  async topStreaksForUsers(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map()
    const rows = await db
      .select({ userId: dailyStreaks.userId, streak: sql<number>`MAX(${dailyStreaks.streak})` })
      .from(dailyStreaks)
      .where(inArray(dailyStreaks.userId, userIds))
      .groupBy(dailyStreaks.userId)
    return new Map(rows.map((r) => [r.userId, Number(r.streak)]))
  },

  /**
   * Streak Zaryad / Coin-save ogohlantirishi uchun: har user "ENG SO'NGGI faollik
   * sanasi" + joriy zaryadlari (`charges`) + coin balansi.
   */
  async streakSaveRiskForUsers(userIds: string[], today: string): Promise<Map<string, {
    gapDaysTomorrow: number
    charges: number
    balance: number
  }>> {
    if (userIds.length === 0) return new Map()

    const lastActiveRows = await db
      .selectDistinctOn([dailyStreaks.userId], {
        userId: dailyStreaks.userId,
        lastActive: dailyStreaks.lastDailyDate,
        charges: dailyStreaks.charges,
      })
      .from(dailyStreaks)
      .where(inArray(dailyStreaks.userId, userIds))
      .orderBy(
        dailyStreaks.userId,
        sql`${dailyStreaks.lastDailyDate} DESC NULLS LAST`,
        sql`${dailyStreaks.updatedAt} DESC`,
        sql`${dailyStreaks.streak} DESC`,
      )
    const lastActive = lastActiveRows.filter((r): r is { userId: string; lastActive: string; charges: number } => r.lastActive != null)

    const balances = await db
      .select({ userId: userCoins.userId, balance: userCoins.balance })
      .from(userCoins)
      .where(inArray(userCoins.userId, userIds))

    const balanceOf = new Map(balances.map((r) => [r.userId, r.balance]))

    return new Map(lastActive.map((r) => [r.userId, {
      gapDaysTomorrow: Math.floor((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${r.lastActive}T00:00:00Z`).getTime()) / 86_400_000),
      charges: Number(r.charges ?? 0),
      balance: balanceOf.get(r.userId) ?? 0,
    }]))
  },

  // ── league-rollover so'rovlar ─────────────────────────────────────────

  /** Jurnalga yozilgan reja (crash'dan keyin davom SHU yer'dan boshlanadi) */
  async loadRolloverPlan(periodKey: string) {
    return db.select({
      userId:     leagueRolloverLog.userId,
      fromLeague: leagueRolloverLog.fromLeague,
      toLeague:   leagueRolloverLog.toLeague,
    }).from(leagueRolloverLog).where(eq(leagueRolloverLog.periodKey, periodKey))
  },

  /** Hafta ballari (progress × daily_limits.xp_earned, ligalari bilan) */
  async leagueWeekScores(prevWeekStart: string, thisWeekStart: string) {
    return db.select({
      userId: progress.userId,
      league: progress.league,
      score:  sql<number>`COALESCE(SUM(${dailyLimits.xpEarned}), 0)`,
    }).from(progress)
      .leftJoin(dailyLimits, and(
        eq(dailyLimits.userId, progress.userId),
        gte(dailyLimits.date, prevWeekStart),
        lt(dailyLimits.date, thisWeekStart),
      ))
      .groupBy(progress.userId, progress.league)
  },

  /** Hisoblangan reja BITTA atomik statement'da jurnalga (idempotent) */
  async persistRolloverPlan(rows: Array<{ userId: string; fromLeague: string; toLeague: string }>, periodKey: string): Promise<void> {
    if (rows.length === 0) return
    await db.insert(leagueRolloverLog)
      .values(rows.map((c) => ({ userId: c.userId, periodKey, fromLeague: c.fromLeague, toLeague: c.toLeague })))
      .onConflictDoNothing()
  },

  /** APPLY — guard: FAQAT hozirgi liga plan'dagi `from`ga teng bo'lsa (idempotent) */
  async applyLeagueChange(userId: string, fromLeague: string, toLeague: string): Promise<number> {
    const applied = await db.update(progress)
      .set({ league: toLeague, updatedAt: new Date() })
      .where(and(eq(progress.userId, userId), eq(progress.league, fromLeague)))
      .returning({ id: progress.userId })
    return applied.length
  },

  // ── cleanup-answer-tokens (retention) ─────────────────────────────────

  async cleanupExpired(): Promise<{
    deleted: number
    rateLimitsDeleted: number
    analyticsDeleted: number
    tgCodesDeleted: number
    linkCodesDeleted: number
    sessionsDeleted: number
    otpDeleted: number
    emailTokensDeleted: number
    pwdTokensDeleted: number
    loginHistoryDeleted: number
    auditLogsDeleted: number
    testSessionsDeleted: number
    cutoff: string
  }> {
    const cutoff = new Date(Date.now() - 7 * 86_400_000)
    const result = await db.delete(answerTokens).where(lt(answerTokens.createdAt, cutoff))

    // rate_limits counter'lari: oynasi 1 soat+ eskirganlar (multi-instance limiter)
    const rlCutoff = new Date(Date.now() - 3_600_000)
    const rlResult = await db.delete(rateLimits).where(lt(rateLimits.windowStart, rlCutoff))

    // analytics_events: 30 kundan eski yozuvlar (M-10 retention)
    const analyticsCutoff = new Date(Date.now() - 30 * 86_400_000)
    const analyticsResult = await db.delete(analyticsEvents).where(lt(analyticsEvents.createdAt, analyticsCutoff))

    // telegram_login_codes va link_codes: 24 soatdan eski eskirgan kodlar (L-10 cleanup)
    const codesCutoff = new Date(Date.now() - 86_400_000)
    const tgCodesResult = await db.delete(telegramLoginCodes).where(lt(telegramLoginCodes.createdAt, codesCutoff))
    const linkCodesResult = await db.delete(linkCodes).where(lt(linkCodes.createdAt, codesCutoff))

    // Auth retention (audit M): eskirgan sessiyalar, OTP kodlar, email/parol
    // token'lari — avval faqat resolve-payti opportunistic tozalanardi (o'suvchi jadvallar).
    const sessionsResult = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
    const otpCutoff = new Date(Date.now() - 86_400_000) // OTP TTL 5 daqiqa — 1 kunlik xavfsiz margin
    const otpResult = await db.delete(otpCodes).where(lt(otpCodes.expiresAt, otpCutoff))
    // auth.repository'dagi tayyor amallar (yagona implementatsiya)
    const emailTokensDeleted = await authRepository.cleanExpiredEmailTokens()
    const pwdTokensDeleted = await authRepository.cleanExpiredPasswordTokens()

    // 90 kunlik retention (schema.ts'dagi izohli shartnoma)
    const historyCutoff = new Date(Date.now() - 90 * 86_400_000)
    const loginHistoryResult = await db.delete(loginHistory).where(lt(loginHistory.createdAt, historyCutoff))
    const auditLogsResult = await db.delete(auditLogs).where(lt(auditLogs.createdAt, historyCutoff))

    // Test-session v2: canonical retry/forensics uchun 30 kun saqlanadi.
    // Parent o'chsa test_attempts FK CASCADE bilan birga tozalanadi.
    const testSessionCutoff = new Date(Date.now() - 30 * 86_400_000)
    const testSessionsResult = await db.delete(testSessions).where(lt(testSessions.expiresAt, testSessionCutoff))

    return {
      deleted: result.rowCount ?? 0,
      rateLimitsDeleted: rlResult.rowCount ?? 0,
      analyticsDeleted: analyticsResult.rowCount ?? 0,
      tgCodesDeleted: tgCodesResult.rowCount ?? 0,
      linkCodesDeleted: linkCodesResult.rowCount ?? 0,
      sessionsDeleted: sessionsResult.rowCount ?? 0,
      otpDeleted: otpResult.rowCount ?? 0,
      emailTokensDeleted,
      pwdTokensDeleted,
      loginHistoryDeleted: loginHistoryResult.rowCount ?? 0,
      auditLogsDeleted: auditLogsResult.rowCount ?? 0,
      testSessionsDeleted: testSessionsResult.rowCount ?? 0,
      cutoff: cutoff.toISOString(),
    }
  },
}
