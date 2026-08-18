/**
 * Analytics repository — event yozuvi (repository pattern restavratsiyasi #20).
 */
import { db } from '../../db/connection'
import { analyticsEvents } from '../../schema'

export const analyticsRepository = {
  async insertEvent(userId: string | null, event: string, props: Record<string, unknown>): Promise<void> {
    await db.insert(analyticsEvents).values({ userId, event, props })
  },
}
