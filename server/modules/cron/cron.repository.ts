import { and, eq, lt } from 'drizzle-orm'
import { db } from '../../db/connection'
import { jobRuns } from '../../schema'

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
}
