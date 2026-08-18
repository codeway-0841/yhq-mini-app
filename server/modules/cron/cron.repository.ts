import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '../../db/connection'
import {
  analyticsEvents, answerTokens, dailyRecords, dailyStreaks, jobRuns,
  leagueRolloverLog, linkCodes, progress, rateLimits, telegramLoginCodes,
} from '../../schema'

const STALE_AFTER_MS = 60 * 60_000

export const cronRepository = {
  /** Completed period qayta ochilmaydi; faqat 1 soatdan eski running lease olinadi. */
  async tryStart(jobName: string, periodKey: string): Promise<boolean> {
    const staleBefore = new Date(Date.now() - STALE_AFTER_MS)
    const rows = await db.insert(jobRuns).values({ jobName, periodKey })
      .onConflictDoUpdate({
        target: [jobRuns.jobName, jobRuns.periodKey],
        set: { status: 'running', startedAt: new Date(), finishedAt: null, details: {} },
        where: and(eq(jobRuns.status, 'running'), lt(jobRuns.startedAt, staleBefore)),
      })
      .returning({ id: jobRuns.id })
    return rows.length > 0
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

  // ── league-rollover so'rovlar ─────────────────────────────────────────

  /** Jurnalga yozilgan reja (crash'dan keyin davom SHU yer'dan boshlanadi) */
  async loadRolloverPlan(periodKey: string) {
    return db.select({
      userId:     leagueRolloverLog.userId,
      fromLeague: leagueRolloverLog.fromLeague,
      toLeague:   leagueRolloverLog.toLeague,
    }).from(leagueRolloverLog).where(eq(leagueRolloverLog.periodKey, periodKey))
  },

  /** Hafta ballari (progress × daily_records, ligalari bilan) */
  async leagueWeekScores(prevWeekStart: string, thisWeekStart: string) {
    return db.select({
      userId: progress.userId,
      league: progress.league,
      score:  sql<number>`COALESCE(SUM(${dailyRecords.correct}), 0)`,
    }).from(progress)
      .leftJoin(dailyRecords, and(
        eq(dailyRecords.userId, progress.userId),
        gte(dailyRecords.date, prevWeekStart),
        lt(dailyRecords.date, thisWeekStart),
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

    return {
      deleted: result.rowCount ?? 0,
      rateLimitsDeleted: rlResult.rowCount ?? 0,
      analyticsDeleted: analyticsResult.rowCount ?? 0,
      tgCodesDeleted: tgCodesResult.rowCount ?? 0,
      linkCodesDeleted: linkCodesResult.rowCount ?? 0,
      cutoff: cutoff.toISOString(),
    }
  },
}
