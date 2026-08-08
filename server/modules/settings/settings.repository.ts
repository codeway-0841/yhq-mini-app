/**
 * Settings repository + Zod patch schema.
 */

import { z }            from 'zod'
import { eq }           from 'drizzle-orm'
import { db }           from '../../db/connection'
import { userSettings } from '../../schema'

type SettingsPatch = Omit<Partial<typeof userSettings.$inferInsert>, 'id' | 'userId'>

export const settingsRepository = {
  async ensureExists(userId: string): Promise<void> {
    await db.insert(userSettings).values({ userId }).onConflictDoNothing()
  },

  async findByUserId(userId: string) {
    const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId))
    return row ?? null
  },

  /**
   * Patch settings. Returns false if the row doesn't exist.
   * No-ops (empty patch) are skipped before hitting the DB.
   */
  async patch(userId: string, patch: SettingsPatch): Promise<boolean> {
    const fields = Object.entries(patch).filter(([, v]) => v !== undefined)
    if (fields.length === 0) return true  // nothing to do — not an error

    const rows = await db.update(userSettings)
      .set(patch)
      .where(eq(userSettings.userId, userId))
      .returning({ id: userSettings.id })

    return rows.length > 0
  },
}

export const SettingsPatchSchema = z.object({
  autoNextCorrect: z.boolean().optional(),
  autoNextWrong:   z.boolean().optional(),
  noAnimation:     z.boolean().optional(),
  shuffleOptions:  z.boolean().optional(),
  offlineMode:     z.boolean().optional(),
  fontSize:        z.enum(['small', 'medium', 'large']).optional(),
  fontStyle:       z.enum(['default', 'serif', 'mono']).optional(),
  language:        z.enum(['uz', 'ru']).optional(),
  theme:           z.enum(['dark', 'light', 'system']).optional(),
}).refine(
  (obj) => Object.values(obj).some((v) => v !== undefined),
  { message: 'At least one field required' },
)
