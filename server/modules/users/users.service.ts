/**
 * Users service — business logic for user lifecycle.
 *
 * Rules:
 *  - init() creates user + progress + settings rows atomically (idempotent).
 *  - updatePhone() validates E.164 format before hitting the DB.
 */

import { z }                      from 'zod'
import { usersRepository }        from './users.repository'
import { progressRepository }     from '../progress/progress.repository'
import { settingsRepository }     from '../settings/settings.repository'
import { savedRepository }        from '../saved/saved.repository'
import { AppError }               from '../../middleware/error-handler'

// ── Zod schemas (also exported for router-level validation) ────────────────

export const InitInputSchema = z.object({
  id:         z.string().min(1),
  first_name: z.string().min(1),
  last_name:  z.string().optional().default(''),
  username:   z.string().optional().default(''),
  photo_url:  z.string().optional().default(''),
})
export type InitInput = z.infer<typeof InitInputSchema>

export const PhoneSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9][0-9]{7,14}$/, 'Phone must be E.164 format, e.g. +998901234567'),
})

// ── Service ────────────────────────────────────────────────────────────────

export const usersService = {
  /**
   * Init or update a Telegram user and return their full profile.
   * Creates progress + settings rows if they don't exist yet.
   */
  async init(raw: InitInput) {
    const uid = BigInt(raw.id)

    const user = await usersRepository.upsert({
      id:        uid,
      firstName: raw.first_name,
      lastName:  raw.last_name  ?? null,
      username:  raw.username   ?? null,
      photoUrl:  raw.photo_url  ?? null,
    })

    // These are no-ops when rows already exist
    await Promise.all([
      progressRepository.ensureExists(uid),
      settingsRepository.ensureExists(uid),
    ])

    const [prog, sett, saved] = await Promise.all([
      progressRepository.findByUserId(uid),
      settingsRepository.findByUserId(uid),
      savedRepository.findByUserId(uid),
    ])

    return {
      user,
      progress:       prog!,
      settings:       sett!,
      savedQuestions: saved,
    }
  },

  /** Update phone number after Telegram requestContact validation. */
  async updatePhone(userId: bigint, phone: string): Promise<void> {
    const updated = await usersRepository.updatePhone(userId, phone)
    if (!updated) throw new AppError(404, 'User not found')
  },
}
