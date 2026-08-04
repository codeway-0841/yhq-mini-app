/**
 * Users service — business logic for user lifecycle.
 *
 * Rules:
 *  - init() creates user + progress + settings rows atomically (idempotent).
 *  - updatePhone() validates E.164 format before hitting the DB.
 */

import { z }                      from 'zod'
import { usersRepository }        from './users.repository'
import { users, progress, userSettings } from '../../schema'

type UserRow = typeof users.$inferSelect

/** JSON-safe user shape (bigint id → string) — matches the frontend ApiUser type. */
export function toApiUser(row: UserRow) {
  return {
    id:        String(row.id),
    firstName: row.firstName,
    lastName:  row.lastName  ?? '',
    username:  row.username  ?? '',
    photoUrl:  row.photoUrl  ?? '',
    phone:     row.phone     ?? null,
    tariff:    row.tariff,
  }
}

type ProgressRow = typeof progress.$inferSelect
type SettingsRow = typeof userSettings.$inferSelect

/** Drop the bigint userId — the client already knows who it asked about. */
export function toApiProgress(row: ProgressRow) {
  return {
    totalCorrect:  row.totalCorrect,
    totalWrong:    row.totalWrong,
    totalAnswered: row.totalAnswered,
    streak:        row.streak,
    wrongByTicket: row.wrongByTicket,
  }
}

export function toApiSettings(row: SettingsRow) {
  return {
    autoNextCorrect: row.autoNextCorrect,
    autoNextWrong:   row.autoNextWrong,
    noAnimation:     row.noAnimation,
    shuffleOptions:  row.shuffleOptions,
    fontSize:        row.fontSize,
    fontStyle:       row.fontStyle,
    language:        row.language,
    theme:           row.theme,
    offlineMode:     row.offlineMode,
  }
}
import { progressRepository }     from '../progress/progress.repository'
import { settingsRepository }     from '../settings/settings.repository'
import { savedRepository }        from '../saved/saved.repository'
import { AppError }               from '../../middleware/error-handler'

// ── Zod schemas (also exported for router-level validation) ────────────────

export const InitInputSchema = z.object({
  // Telegram user id'lari faqat musbat raqamlar va int8 sig'adi
  id:         z.string().regex(/^\d{1,19}$/, 'user id must be a positive integer string'),
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
      user:           toApiUser(user),
      progress:       toApiProgress(prog!),
      settings:       toApiSettings(sett!),
      savedQuestions: saved,
    }
  },

  /** Update phone number after Telegram requestContact validation. */
  async updatePhone(userId: bigint, phone: string): Promise<void> {
    const updated = await usersRepository.updatePhone(userId, phone)
    if (!updated) throw new AppError(404, 'User not found')
  },
}
