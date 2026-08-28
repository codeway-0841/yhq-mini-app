/**
 * Users service — business logic for user lifecycle.
 *
 * Rules:
 *  - init() creates user + progress + settings rows atomically (idempotent).
 *  - updatePhone() validates E.164 format + SMS OTP egalik isboti (H-2 audit).
 */

import { z }                      from 'zod'
import { usersRepository, referralsRepository } from './users.repository'
import { REFERRAL_REWARD_DAYS, REFERRAL_MAX_REWARDED } from './referral.constants'
import { parseUserId }            from '../../utils/parse'
import { users, progress, userSettings } from '../../schema'

type UserRow = typeof users.$inferSelect

/** JSON-safe user shape (canonical TEXT id) — matches the frontend ApiUser type.
 *  `economy` (FIXPLAN #40): coins balansi + ownedItems — coinsRepository'dan;
 *  o'tkazilmasa 0/[] (economy'siz eski yo'llar buzilmaydi). */
export function toApiUser(row: UserRow, economy: { coins: number; ownedItems: string[] } = { coins: 0, ownedItems: [] }) {
  // Effective premium: lifetime tarif YOKI referal mukofot muddati tugamagan
  const isPremium = row.tariff === 'premium'
    || (row.premiumUntil != null && row.premiumUntil > new Date())
  return {
    id:        row.id,
    firstName: row.firstName,
    lastName:  row.lastName  ?? '',
    username:  row.username  ?? '',
    photoUrl:  row.photoUrl  ?? '',
    /** Qo'lda yuklangan avatar bormi — global ko'rsatish uchun rasm FAQAT
     *  GET /api/avatar/:userId dan olinadi (JSON payload shishmasligi uchun). */
    hasCustomAvatar: (row.avatarWebp?.length ?? 0) > 0,
    phone:     row.phone     ?? null,
    tariff:    isPremium ? 'premium' as const : 'free' as const,
    isAdmin:   row.isAdmin,
    /** SMS marketing roziligi (opt-in) — Profil toggle holati */
    smsOptIn:  row.smsOptIn,
    /** #40: coin balansi + do'konbuyumlari egaligi + joriy avatar ramkasi */
    coins:      economy.coins,
    ownedItems: economy.ownedItems,
    avatarFrame: row.avatarFrame ?? null,
  }
}

type ProgressRow = typeof progress.$inferSelect
type SettingsRow = typeof userSettings.$inferSelect

/** Drop the userId — the client already knows who it asked about.
 *  P2: `solvedQuestions` endi `progress_questions` jadvalidan keladi (jsonb emas) —
 *  caller `progressRepository.listSolvedKeys()` natijasini uzatadi (client kontrakti o'zgarmaydi). */
export function toApiProgress(row: ProgressRow, solvedKeys: string[] = []) {
  return {
    totalCorrect:    row.totalCorrect,
    totalWrong:      row.totalWrong,
    totalAnswered:   row.totalAnswered,
    streak:          row.streak,
    wrongByTicket:   row.wrongByTicket,
    solvedQuestions: solvedKeys,
    /** Umrbod XP — level shundan hisoblanadi (shared/xp.ts) */
    xp:              row.xp,
    /** Haftalik liga darajasi — dashboard va reyting sahifasi bir xil manbadan o'qishi uchun */
    league:          row.league,
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
import { coinsRepository }        from '../coins/coins.repository'
import { consumeOTPWithLockout }  from '../auth/otp'
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
  /** H-2 (audit): users.phone endi FAQAT SMS OTP egalik isbotidan keyin yoziladi —
   *  begona raqam → pulli SMS / soxta referal mukofoti zanjiri yopiq. Kod 6 raqamli. */
  otp: z.string().regex(/^\d{6}$/, 'OTP 6 raqamli kod bo\'lishi kerak'),
})

/** Avatar data URL formati — client 256px WebP'ga siqadi (useAvatarUpload);
 *  JPEG — WebP codec'i yo'q eski WebView'lar uchun client fallback.
 *  Base64 ~1.37x: ~68KB hajm uchun 100k belgi yetarli. */
export const AVATAR_DATA_URL_RE = /^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/=]+$/
export const AvatarUploadSchema = z.object({
  image: z.string().regex(AVATAR_DATA_URL_RE, 'WebP/JPEG data URL formatida bo\'lishi kerak').max(100_000),
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

    const [user, prog, sett, saved, solvedKeys, economy] = await Promise.all([
      usersRepository.findById(uid),
      progressRepository.findByUserId(uid),
      settingsRepository.findByUserId(uid),
      savedRepository.findByUserId(uid),
      progressRepository.listSolvedKeys(uid),   // P2: jsonb o'rniga jadval
      coinsRepository.getEconomyState(uid),     // #40: balans + egalik
    ])

    // ── Referal: `start_param=ref_<userId>` — FAQAT yangi foydalanuvchi uchun.
    // Referee WELCOME sovg'asini (+3 kun) DARHOL oladi (yangi o'quvchi test
    // yechishga majbur emas); referrer mukofoti referee 10 ta har xil savol
    // yechganda beriladi (progress.repository CTE — anti-farming).
    // Referrer ID'si HAR QANDAY canonical shaklda bo'lishi mumkin (TG raqam,
    // p_<digits>, e_<hex>) — telefon akkauntli userlarning havolasi ham sanaladi.
    // Reward xatosi ASOSIY init oqimini sindirmasligi kerak (mukofot ixtiyoriy).
    const refMatch = /^ref_(.+)$/.exec(raw.start_param ?? '')
    if (refMatch && !existing) {
      try {
        const referrerId = parseUserId(refMatch[1])
        if (referrerId && referrerId !== uid && await usersRepository.findById(referrerId)) {
          await referralsRepository.createPending(referrerId, uid)
        }
      } catch (err) {
        console.error('[referral] qayd xatosi (init davom etadi):', err)
      }
    }

    if (!user || !prog || !sett) throw new AppError(500, 'init_incomplete')
    return {
      user:           toApiUser(user, economy),
      progress:       toApiProgress(prog, solvedKeys),
      settings:       toApiSettings(sett),
      savedQuestions: saved,
    }
  },

  /** Update phone number — FAQAT SMS OTP egalik isbotidan keyin (H-2 audit).
   *  Avval kod konsumatsiya qilinadi (lockout bilan) — soxta raqam YOZILMAYDI. */
  async updatePhone(userId: string, phone: string, otp: string): Promise<void> {
    await consumeOTPWithLockout(phone, otp)   // 401 invalid_otp / 429 otp_locked
    await usersService.applyVerifiedPhone(userId, phone)
  },

  /** users.phone yozish nuqtasi — FAQAT egaligi ALLAQACHON isbotlangan
   *  raqam uchun (SMS OTP o'tgan YOKI Telegram-imzolangan contact xabari —
   *  bot fast-path, qarang: api-entry/bot.ts message:contact).
   *  Telefon ulash REFERAL trigger'i: referee raqam ulasa — referrerga
   *  mukofot (marketing: HAQIQATAN verified raqam + anti-fraud; repository
   *  CTE idempotent — pending→rewarded bir marta). */
  async applyVerifiedPhone(userId: string, phone: string): Promise<void> {
    const updated = await usersRepository.updatePhone(userId, phone)
    if (!updated) throw new AppError(404, 'User not found')
    try {
      await referralsRepository.rewardIfPhoneLinked(userId)
    } catch (err) {
      // Mukofot ixtiyoriy — asosiy phone oqimini sindirmaydi
      console.error('[referral] phone-link reward xatosi (applyVerifiedPhone davom etadi):', err)
    }
  },

  /** Custom avatar yozish/o'chirish (image=null → remove). Global manba: users.avatar_webp. */
  async updateAvatar(userId: string, image: string | null): Promise<void> {
    const ok = await usersRepository.setAvatarWebp(userId, image)
    if (!ok) throw new AppError(404, 'User not found')
  },

  /** Global avatar o'qish (GET /api/avatar/:userId) — data URL yoki null. */
  async getAvatar(userId: string): Promise<string | null> {
    return usersRepository.getAvatarWebp(userId)
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
/** Referal konstantalari — YAGONA MANBA `referral.constants.ts` (re-export) */
export { REFERRAL_REWARD_DAYS, REFERRAL_MAX_REWARDED }
