/**
 * Users service — business logic for user lifecycle.
 *
 * Rules:
 *  - init() creates user + progress + settings rows atomically (idempotent).
 *  - updatePhone() validates E.164 format before hitting the DB.
 */

import { z }                      from 'zod'
import { usersRepository, referralsRepository } from './users.repository'
import { users, progress, userSettings } from '../../schema'

type UserRow = typeof users.$inferSelect

/** JSON-safe user shape (canonical TEXT id) — matches the frontend ApiUser type. */
export function toApiUser(row: UserRow) {
  // Effective premium: lifetime tarif YOKI referal mukofot muddati tugamagan
  const isPremium = row.tariff === 'premium'
    || (row.premiumUntil != null && row.premiumUntil > new Date())
  return {
    id:        row.id,
    firstName: row.firstName,
    lastName:  row.lastName  ?? '',
    username:  row.username  ?? '',
    photoUrl:  row.photoUrl  ?? '',
    phone:     row.phone     ?? null,
    tariff:    isPremium ? 'premium' as const : 'free' as const,
    isAdmin:   row.isAdmin,
  }
}

type ProgressRow = typeof progress.$inferSelect
type SettingsRow = typeof userSettings.$inferSelect

/** Drop the userId — the client already knows who it asked about. */
export function toApiProgress(row: ProgressRow) {
  return {
    totalCorrect:    row.totalCorrect,
    totalWrong:      row.totalWrong,
    totalAnswered:   row.totalAnswered,
    streak:          row.streak,
    wrongByTicket:   row.wrongByTicket,
    solvedQuestions: row.solvedQuestions ?? [],
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
import { authRepository }         from '../auth/auth.repository'
import { AppError }               from '../../middleware/error-handler'

// ── Zod schemas (also exported for router-level validation) ────────────────

export const InitInputSchema = z.object({
  // Telegram user id'lari faqat musbat raqamlar va int8 sig'adi
  id:         z.string().regex(/^\d{1,19}$/, 'user id must be a positive integer string'),
  first_name: z.string().min(1),
  last_name:  z.string().optional().default(''),
  username:   z.string().optional().default(''),
  photo_url: z.string().optional().default(''),
  /** Telegram start_param — masalan `ref_<userId>` (referal) yoki `duel-xxx` */
  start_param: z.string().max(64).optional(),
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
    const uid = raw.id   // canonical TEXT id (Telegram raqam-string)
    const existing = await usersRepository.findById(uid)   // yangi foydalanuvchimi?

    // user + progress + settings BITTA atomik SQL statement'da (yarim holat yo'q)
    await usersRepository.initAtomic({
      id:        uid,
      firstName: raw.first_name,
      lastName:  raw.last_name  ?? null,
      username:  raw.username   ?? null,
      photoUrl:  raw.photo_url  ?? null,
    })
    // INVARIANT: TG identity user_id = provider_uid (multi-provider auth;
    // idempotent — middleware initData resolve'si DB'siz shunga tayanadi)
    await authRepository.ensureIdentity('telegram', uid, uid)

    const [user, prog, sett, saved] = await Promise.all([
      usersRepository.findById(uid),
      progressRepository.findByUserId(uid),
      settingsRepository.findByUserId(uid),
      savedRepository.findByUserId(uid),
    ])

    // ── Referal: `start_param=ref_<userId>` — FAQAT yangi foydalanuvchi uchun.
    // Qayd + mukofot bitta atomik statement'da (referrals UNIQUE — bir martalik).
    // Reward xatosi ASOSIY init oqimini sindirmasligi kerak (mukofot ixtiyoriy).
    const refMatch = /^ref_(\d{1,19})$/.exec(raw.start_param ?? '')
    if (refMatch && !existing) {
      try {
        const referrerId = refMatch[1]   // referallar Telegram-only (raqam-string id)
        if (referrerId !== uid && await usersRepository.findById(referrerId)) {
          await referralsRepository.tryCreateWithReward(referrerId, uid, REFERRAL_REWARD_DAYS, REFERRAL_MAX_REWARDED)
        }
      } catch (err) {
        console.error('[referral] reward xatosi (init davom etadi):', err)
      }
    }

    if (!user || !prog || !sett) throw new AppError(500, 'init_incomplete')
    return {
      user:           toApiUser(user),
      progress:       toApiProgress(prog),
      settings:       toApiSettings(sett),
      savedQuestions: saved,
    }
  },

  /** Update phone number after Telegram requestContact validation. */
  async updatePhone(userId: string, phone: string): Promise<void> {
    const updated = await usersRepository.updatePhone(userId, phone)
    if (!updated) throw new AppError(404, 'User not found')
  },

  /** 3 kunlik BEPUL trial — conditional UPDATE parallel requestlarda ham bir marta. */
  async startTrial(userId: string): Promise<{ granted: boolean; reason?: 'already_used'; days: number }> {
    if (await usersRepository.tryGrantTrial(userId, TRIAL_DAYS)) {
      return { granted: true, days: TRIAL_DAYS }
    }
    if (!(await usersRepository.findById(userId))) throw new AppError(404, 'User not found')
    return { granted: false, reason: 'already_used', days: 0 }
  },
}

export const TRIAL_DAYS = 3
/** Referrerga beriladigan mukofot (kun) — referee faqat 1 marta hisoblanadi */
export const REFERRAL_REWARD_DAYS = 3
/** Bitta referrer mukofot olishi mumkin bo'lgan MAKSIMAL referallar soni (farming himoyasi) */
export const REFERRAL_MAX_REWARDED = 50
