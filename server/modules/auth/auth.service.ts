/**
 * Auth service — multi-provider login (Telegram + telefon/parol) va account linking.
 *
 * CANONICAL INVARIANT: ('telegram', T) identity HAR DOIM user_id = T (raqam-string)
 * ga tegishli. Shu sababli TG ↔ telefon birlashtirish (adopt-merge) yakuniy
 * user id SIFATIDA Telegram raqam id'ni saqlaydi (PK RENAME — FK'lardagi
 * ON UPDATE CASCADE barcha bog'langan qatorlarni atomik ko'chiradi).
 * Bu invariant Mini App initData middleware'sini DB lookup'siz saqlaydi.
 *
 * Link ≠ merge: bo'sh bo'lmagan IKKALA akkauntni birlashtirish (progress,
 * payment, daily to'qnashuvlari) v1'da QO'LLAB-QUVVATLANMAYDI — 409.
 * "Bo'sh tomon" = total_answered=0 VA payment'siz akkaunt.
 */

import { z } from 'zod'
import { randomBytes, randomUUID } from 'crypto'
import { config } from '../../config'
import { AppError } from '../../middleware/error-handler'
import { executeRows, transactionBestEffort, transactionHttp, neonRaw, type DB } from '../../db/connection'
import { sql } from 'drizzle-orm'
import { authRepository, type AuthProvider } from './auth.repository'
import { issueSession } from './session-issuer'
import { consumeOTPWithLockout } from './otp'
import { dbRateConsumeWindow } from '../../middleware/db-rate-limiter'
import { usersRepository } from '../users/users.repository'
import { progressRepository } from '../progress/progress.repository'
import { settingsRepository } from '../settings/settings.repository'
import { savedRepository } from '../saved/saved.repository'
import { coinsRepository } from '../coins/coins.repository'
import { toApiUser, toApiProgress, toApiSettings } from '../users/users.service'
import { hashPassword, verifyPassword } from '../../utils/password'
import { verifyLoginWidget } from '../../utils/telegram'
import { sendOTP, generateOTP, hashOTP } from '../../utils/sms'
import { normalizePhone } from '../../utils/phone'
import { sendEmail, emailVerificationTemplate, passwordResetTemplate, isValidEmail } from '../../utils/email'
import { validatePassword, DEFAULT_PASSWORD_POLICY } from '../../utils/password-validation'
import type { Request } from 'express'
import { getDeviceInfo, getClientIp } from '../../utils/device-fingerprint'

// ── Zod schemas (router validate uchun eksport) ─────────────────────────────

/** O'zbekiston raqamlari — E.164, faqat +998 */
export const PhoneE164Schema = z.string().regex(/^\+998\d{9}$/, "Telefon raqam +998XXXXXXXXX formatida bo'lsin")

export const PasswordSchema = z.string()
  .min(8, 'Parol kamida 8 belgidan iborat bo\'lsin')
  .max(72, 'Parol juda uzun')

export const EmailSchema = z.string().email('Email noto\'g\'ri formatda')

export const PhoneRegisterSchema = z.object({
  phone:     PhoneE164Schema,
  password:  PasswordSchema,
  firstName: z.string().trim().min(1, 'Ism kiritilishi shart').max(64),
  /** RAQAM EGALLIK ISBOTI — register FAQAT SMS kod tasdiqlangandan keyin.
   *  Aks holda kimdir boshqa kishining raqamini parol bilan "egallab" (squatting)
   *  haqiqiy egasini 409 phone_taken'ga uchratishi mumkin edi. */
  otp:       z.string().regex(/^\d{6}$/, '6 raqamli kod kiriting'),
})
export type PhoneRegisterInput = z.infer<typeof PhoneRegisterSchema>

export const PhoneLoginSchema = z.object({
  phone:    PhoneE164Schema,
  password: z.string().min(1).max(72),
})
export type PhoneLoginInput = z.infer<typeof PhoneLoginSchema>

/** Profil'dan telefon ulash — raqam YANGI (band emas) bo'lsa OTP ISBOTI SHART
 *  (raqam egasi ekanini tasdiqlash); band raqamda parol proof'i mavjud semantika. */
export const PhoneLinkSchema = z.object({
  phone:     PhoneE164Schema,
  password:  PasswordSchema,
  firstName: z.string().trim().min(1).max(64).optional(),
  /** Raqam hali band emas bo'lsa MAJBURIY (server 400 otp_required qaytaradi);
   *  band raqamga link'da (parol proof) talab qilinmaydi. */
  otp:       z.string().regex(/^\d{6}$/).optional(),
})
export type PhoneLinkInput = z.infer<typeof PhoneLinkSchema>

/** OTP so'rash (SMS yuborish) */
export const RequestOTPSchema = z.object({
  phone: PhoneE164Schema,
})
export type RequestOTPInput = z.infer<typeof RequestOTPSchema>

/** OTP tekshirish + login */
export const VerifyOTPLoginSchema = z.object({
  phone: PhoneE164Schema,
  code:  z.string().regex(/^\d{6}$/, '6 raqamli kod kiriting'),
})
export type VerifyOTPLoginInput = z.infer<typeof VerifyOTPLoginSchema>

/** OTP tekshirish + register */
export const VerifyOTPRegisterSchema = z.object({
  phone:     PhoneE164Schema,
  code:      z.string().regex(/^\d{6}$/, '6 raqamli kod kiriting'),
  password:  PasswordSchema,
  firstName: z.string().trim().min(1, 'Ism kiritilishi shart').max(64),
})
export type VerifyOTPRegisterInput = z.infer<typeof VerifyOTPRegisterSchema>

/** Telegram Login Widget callback maydonlari (initData'dan FARQLI format). */
export const TgWidgetLoginSchema = z.object({
  id:         z.union([z.number().int().positive(), z.string().regex(/^\d{1,19}$/)]),
  first_name: z.string().min(1).max(64),
  last_name:  z.string().max(64).optional().default(''),
  username:   z.string().max(64).optional().default(''),
  photo_url:  z.string().max(512).optional().default(''),
  auth_date:  z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  hash:       z.string().regex(/^[0-9a-f]{64}$/i),
})
export type TgWidgetLoginInput = z.infer<typeof TgWidgetLoginSchema>

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Telefon +998XXXXXXXXX → canonical user id 'p_998XXXXXXXXX' */
export function phoneUserId(phone: string): string {
  return `p_${normalizePhone(phone).slice(1)}`
}

/** Email → canonical user id 'e_<uuid>' */
function emailUserId(): string {
  return `e_${randomBytes(16).toString('hex')}`
}

const TG_ID_RE = /^\d{1,19}$/

// ── Abuse himoyasi konstantalari ────────────────────────────────────────────
// OTP consume+lockout umumiy qatlami: ./otp (users.service ham ishlatadi — H-2)
export { OTP_MAX_ATTEMPTS } from './otp'
export const OTP_RESEND_COOLDOWN_MS = 60_000 // bir raqamga qayta SMS yuborish oralig'i
export const PHONE_LOGIN_MAX_ATTEMPTS = 5    // telefon login parol lockout (email'dagi kabi)
const PHONE_LOGIN_LOCK_MS = 15 * 60_000
const RESET_MAX_PER_HOUR = 3          // password-reset email flood chegarasi

// Sessiya chiqarish — ./session-issuer (umumiy qatlam: users.service ham
// initData→Bearer exchange'da shuni ishlatadi, import cycle'siz).
// Xom token FAQAT shu yerda yaratilib client'ga qaytariladi; DB'ga hash yoziladi (repository'da).

// consumeOTPWithLockout + OTP_MAX_ATTEMPTS → ./otp (umumiy qatlam, cycle'siz)

/** To'liq profile + ulangan provider'lar (login/me/link javoblarining umumiy tanasi). */
async function buildAuthSession(userId: string) {
  const [user, prog, sett, saved, providers, solvedKeys, economy] = await Promise.all([
    usersRepository.findById(userId),
    progressRepository.findByUserId(userId),
    settingsRepository.findByUserId(userId),
    savedRepository.findByUserId(userId),
    authRepository.listUserProviders(userId),
    progressRepository.listSolvedKeys(userId),   // P2: jsonb o'rniga jadval
    coinsRepository.getEconomyState(userId),     // #40: balans + egalik
  ])
  if (!user || !prog || !sett) throw new AppError(500, 'auth_profile_incomplete')
  return {
    user:           toApiUser(user, economy),
    progress:       toApiProgress(prog, solvedKeys),
    settings:       toApiSettings(sett),
    savedQuestions: saved,
    providers,
  }
}

async function respondWithNewSession(userId: string, provider: AuthProvider) {
  const sessionToken = await issueSession(userId, provider)
  const profile = await buildAuthSession(userId)
  return { sessionToken, ...profile }
}

interface AccountStats { id: string; answered: number; hasPayments: boolean }

/** Bo'shlik tekshiruvi — total_answered=0 VA payment'siz (link merge qarori uchun).
 *  Transaction context: SELECT FOR UPDATE row-level lock (partial TOCTOU protection).
 *  Locks users rows; progress can't be locked (LEFT JOIN nullable side errors).
 *  Small race window exists (progress change between check and merge), but merge
 *  functions (adoptPhoneIntoTelegram/absorbEmptyAccount) re-validate + fail safely.
 *  Sorted ids prevent deadlock. */
async function accountStats(ids: [string, string], txOrDb?: DB): Promise<Map<string, AccountStats>> {
  const sorted = [...ids].sort()  // Deadlock prevention: consistent lock order
  const rows = await executeRows<{ id: string; answered: number; has_pay: boolean }>(sql`
    SELECT u.id,
           COALESCE(p.total_answered, 0)::int AS answered,
           EXISTS (SELECT 1 FROM payments pay WHERE pay.user_id = u.id) AS has_pay
    FROM users u
    LEFT JOIN progress p ON p.user_id = u.id
    WHERE u.id IN (${sorted[0]}, ${sorted[1]})
    FOR UPDATE OF u
  `, txOrDb)
  return new Map(rows.map((r) => [r.id, { id: r.id, answered: Number(r.answered), hasPayments: r.has_pay }]))
}

const isEmptyAccount = (s: AccountStats | undefined) => !!s && s.answered === 0 && !s.hasPayments

/**
 * ADOPT-MERGE (TG yo'nalishi): bo'sh TG shell (cur, raqam id) o'chiriladi,
 * telefon akkaunti (other, data bilan) PK RENAME orqali TG id'sini oladi.
 * Guard'lar ishlamasa (race) hech narsa yozilmaydi — chaqiruvchi 409 qaytaradi.
 *
 * TG identity ALOHIDA statement'da tiklanadi: Postgres FK cascade trigger'lari
 * statement OXIRIDA ishlaydi — delete-cascade va re-INSERT BIR statement'da
 * bo'lsa, yangi qator ham cascade'ga tushib ketardi (Pg CTE + RI trigger tuzog'i).
 *
 * NEON: drizzle neon-http `db.transaction()` yo'q — shu 2 statement driver-level
 * `transactionHttp` (bitta HTTP non-interactive tx) orqali atomik yuboriladi.
 * INSERT shartsiz yuboriladi: rename sodir bo'lmasa shell foydalanuvchi saqlanib
 * qoladi va `ON CONFLICT DO NOTHING` insert'ni no-op qiladi.
 */
async function adoptPhoneIntoTelegram(tgId: string, phoneUserId: string, txOrDb?: DB): Promise<boolean> {
  if (!txOrDb && neonRaw) {
    const results = await transactionHttp((q) => [
      q`
        WITH del AS (
          DELETE FROM users
          WHERE id = ${tgId}
            AND COALESCE((SELECT total_answered FROM progress WHERE user_id = ${tgId}), 0) = 0
            AND NOT EXISTS (SELECT 1 FROM payments WHERE user_id = ${tgId})
            AND id <> ${phoneUserId}
          RETURNING id
        ), ren AS (
          UPDATE users SET id = ${tgId}
          WHERE id = ${phoneUserId} AND EXISTS (SELECT 1 FROM del)
          RETURNING id
        )
        SELECT (SELECT COUNT(*)::int FROM del) AS del, (SELECT COUNT(*)::int FROM ren) AS ren
      `,
      q`
        INSERT INTO auth_identities (provider, provider_uid, user_id)
        VALUES ('telegram', ${tgId}, ${tgId})
        ON CONFLICT (provider, provider_uid) DO NOTHING
      `,
    ])
    const first = (results[0] ?? []) as Array<{ del: number | string; ren: number | string }>
    return Number(first[0]?.del) > 0 && Number(first[0]?.ren) > 0
  }

  const runInTx = async (tx: DB) => {
    const rows = await executeRows<{ del: number; ren: number }>(sql`
      WITH del AS (
        DELETE FROM users
        WHERE id = ${tgId}
          AND COALESCE((SELECT total_answered FROM progress WHERE user_id = ${tgId}), 0) = 0
          AND NOT EXISTS (SELECT 1 FROM payments WHERE user_id = ${tgId})
          AND id <> ${phoneUserId}
        RETURNING id
      ), ren AS (
        UPDATE users SET id = ${tgId}
        WHERE id = ${phoneUserId} AND EXISTS (SELECT 1 FROM del)
        RETURNING id
      )
      SELECT (SELECT COUNT(*)::int FROM del) AS del, (SELECT COUNT(*)::int FROM ren) AS ren
    `, tx)
    const ok = Number(rows[0]?.del) > 0 && Number(rows[0]?.ren) > 0
    if (ok) {
      // ensureIdentity must run in same transaction for atomicity
      await executeRows(sql`
        INSERT INTO auth_identities (provider, provider_uid, user_id)
        VALUES ('telegram', ${tgId}, ${tgId})
        ON CONFLICT (provider, provider_uid) DO NOTHING
      `, tx)
    }
    return ok
  }
  return txOrDb ? runInTx(txOrDb) : transactionBestEffort(runInTx)
}

/**
 * ADOPT-MERGE (survivor = current): bo'sh `other` akkauntni identity/sessiya/
 * link_cod'lari `cur` ga ko'chirilib o'chiriladi. BITTA atomik SQL statement.
 * (`other` bo'sh EMAS bo'lsa guard ishlamaydi → chaqiruvchi 409.)
 */
async function absorbEmptyAccount(cur: string, other: string, txOrDb?: DB): Promise<boolean> {
  const runInTx = async (tx: DB) => {
    const emptyGuard = sql`
      COALESCE((SELECT total_answered FROM progress WHERE user_id = ${other}), 0) = 0
      AND NOT EXISTS (SELECT 1 FROM payments WHERE user_id = ${other})
    `
    const rows = await executeRows<{ idn: number; del: number }>(sql`
      WITH idn AS (
        UPDATE auth_identities SET user_id = ${cur}
        WHERE user_id = ${other} AND ${emptyGuard}
        RETURNING provider
      ), ses AS (
        UPDATE sessions SET user_id = ${cur}
        WHERE user_id = ${other} AND EXISTS (SELECT 1 FROM idn)
        RETURNING token
      ), lc AS (
        UPDATE link_codes SET user_id = ${cur}
        WHERE user_id = ${other} AND EXISTS (SELECT 1 FROM idn)
        RETURNING code
      ), del AS (
        DELETE FROM users
        WHERE id = ${other} AND EXISTS (SELECT 1 FROM idn)
        RETURNING id
      )
      SELECT (SELECT COUNT(*)::int FROM idn) AS idn, (SELECT COUNT(*)::int FROM del) AS del
    `, tx)
    return Number(rows[0]?.idn) > 0 && Number(rows[0]?.del) > 0
  }
  return txOrDb ? runInTx(txOrDb) : transactionBestEffort(runInTx)
}

// ── Service ──────────────────────────────────────────────────────────────────

/** Login/link javoblarining umumiy shakli (shared/contracts AuthResponse bilan sinxron) */
export interface AuthResponse {
  sessionToken:   string
  user:           ReturnType<typeof toApiUser>
  progress:       ReturnType<typeof toApiProgress>
  settings:       ReturnType<typeof toApiSettings>
  savedQuestions: string[]
  providers:      AuthProvider[]
}

export interface LinkResponse extends AuthResponse {
  status: 'attached' | 'adopted'
}

/** Bir telefon raqamga 24 soatda yuboriladigan MAKSIMAL SMS (audit H-3 —
 *  Eskiz har SMS uchun pul yechadi; IP aylanuvchi flood himoyasi). */
const OTP_SMS_DAILY_CAP = 10

export const authService = {
  // ── SMS OTP flow ─────────────────────────────────────────────────────────

  /**
   * OTP so'rash — 6 raqamli kod generatsiya + SMS yuborish.
   * Rate limit: router qatlami (10/min per IP) + per-telefon resend cooldown
   * (IP aylanuvchi SMS-flood himoyasi — Eskiz har SMS uchun pul yechadi).
   * SMS-first pattern: foydalanuvchiga kod yetmaydigan holat yo'q.
   */
  async requestOTP(input: RequestOTPInput): Promise<{ sent: boolean }> {
    const code = generateOTP()
    const codeHash = hashOTP(code)
    const expiresAt = new Date(Date.now() + 5 * 60_000) // 5 daqiqa

    // 0. Kunlik per-telefon SMS cap (SMS-flood himoyasi — audit H-3): IP'ni
    //    almashtiruvchi hujumchi bitta raqamni kun davomida bombalamasin —
    //    har SMS Eskiz'da PUL. Atomik multi-instance counter (rate_limits).
    const daily = await dbRateConsumeWindow(`otp:phone:${input.phone}`, OTP_SMS_DAILY_CAP, 24 * 3600)
    if (!daily.allowed) {
      throw new AppError(429, 'otp_daily_limit: Kunlik SMS limiti tugadi — ertaga qayta urinib ko\'ring')
    }

    // 1. Atomik cooldown bilan DB'da joy olish (M-11: parallel poyga va ortiqcha SMS'ni to'sadi)
    const acquired = await authRepository.createOTPWithCooldown(input.phone, codeHash, expiresAt)
    if (!acquired) {
      throw new AppError(429, 'otp_cooldown: Kod allaqachon yuborilgan — bir daqiqadan keyin qayta so\'rang')
    }

    // 2. SMS yuborish (muvaffaqiyatsiz bo'lsa DB'dagi OTP'ni tozalaymiz — tezkor retry uchun)
    try {
      await sendOTP(input.phone, code)
    } catch (err) {
      await authRepository.deleteOTP(input.phone).catch(() => {})
      throw err
    }

    // Opportunistic cleanup
    void authRepository.cleanExpiredOTP().catch((e) => console.warn('[OTP cleanup]', e))

    return { sent: true }
  },

  /**
   * OTP tekshirish — login (mavjud akkaunt).
   */
  async verifyOTPLogin(input: VerifyOTPLoginInput): Promise<AuthResponse> {
    await consumeOTPWithLockout(input.phone, input.code)

    const identity = await authRepository.findIdentity('phone', input.phone)
    if (!identity) throw new AppError(404, 'account_not_found')

    return respondWithNewSession(identity.userId, 'phone')
  },

  /**
   * OTP tekshirish + register — yangi akkaunt.
   * Race window minimal (OTP consume atomik, identity check + create qisqa).
   */
  async verifyOTPRegister(input: VerifyOTPRegisterInput): Promise<AuthResponse> {
    await consumeOTPWithLockout(input.phone, input.code)

    const userId = phoneUserId(input.phone)

    // Pre-check — race window
    const existing = await authRepository.findIdentity('phone', input.phone)
    if (existing) throw new AppError(409, 'phone_taken')

    // User create (atomik, conflict ignored)
    await usersRepository.initAtomic({
      id: userId,
      firstName: input.firstName.trim(),
      lastName: '',
      username: '',
      photoUrl: '',
    })

    // Identity create (ON CONFLICT DO NOTHING → created=false)
    const created = await authRepository.createIdentity(
      'phone', input.phone, userId, hashPassword(input.password),
    )
    if (!created) {
      // Race: boshqa request o'zib ketdi — user orphaned lekin zararmas
      throw new AppError(409, 'phone_taken')
    }

    return respondWithNewSession(userId, 'phone')
  },

  // ── Telefon + parol ──────────────────────────────────────────────────────

  /** Ro'yxatdan o'tish — yangi 'p_<digits>' akkaunt + parol + sessiya.
   *  OTP MAJBURIY: SMS kod tasdiqlangach (raqam egasi isboti) akkaunt ochiladi. */
  async registerWithPhone(input: PhoneRegisterInput) {
    const existing = await authRepository.findIdentity('phone', input.phone)
    if (existing) throw new AppError(409, 'phone_taken')

    await consumeOTPWithLockout(input.phone, input.otp)

    const userId = phoneUserId(input.phone)
    await usersRepository.initAtomic({
      id: userId, firstName: input.firstName, lastName: '', username: '', photoUrl: '',
    })
    const created = await authRepository.createIdentity(
      'phone', input.phone, userId, hashPassword(input.password),
    )
    if (!created) throw new AppError(409, 'phone_taken')
    return respondWithNewSession(userId, 'phone')
  },

  /** Kirish — parol tekshiruvidan keyin yangi sessiya. Lockout email login'dagi kabi. */
  async loginWithPhone(input: PhoneLoginInput) {
    const identity = await authRepository.findIdentity('phone', input.phone)
    if (!identity?.passwordHash) {
      throw new AppError(401, 'invalid_credentials')
    }

    // Account lockout (brute-force himoyasi — IP limit yetarli emas, botnet aylanadi)
    if (await authRepository.isAccountLocked(identity.userId)) {
      throw new AppError(403, 'account_locked')
    }

    if (!verifyPassword(input.password, identity.passwordHash)) {
      const attempts = await authRepository.incrementFailedLoginAttempts(identity.userId)
      if (attempts >= PHONE_LOGIN_MAX_ATTEMPTS) {
        await authRepository.lockAccount(identity.userId, new Date(Date.now() + PHONE_LOGIN_LOCK_MS))
        throw new AppError(403, 'account_locked')
      }
      throw new AppError(401, 'invalid_credentials')
    }

    await authRepository.resetFailedLoginAttempts(identity.userId)
    return respondWithNewSession(identity.userId, 'phone')
  },

  // ── Telegram Login Widget (web/brauzer) ──────────────────────────────────

  /** Widget HMAC tekshiruvi → TG user upsert (initAtomic invariant'i bilan) → sessiya. */
  async loginWithTelegramWidget(input: TgWidgetLoginInput) {
    const botToken = config.telegram.botToken
    if (!botToken) throw new AppError(503, 'Telegram login hozircha sozlanmagan')

    const fields: Record<string, string> = {
      id: String(input.id),
      first_name: input.first_name,
      auth_date:  String(input.auth_date),
      hash:       input.hash,
    }
    if (input.last_name) fields['last_name'] = input.last_name
    if (input.username)  fields['username']  = input.username
    if (input.photo_url) fields['photo_url'] = input.photo_url

    const user = verifyLoginWidget(fields, botToken)
    if (!user) throw new AppError(401, 'invalid_widget_signature')

    const uid = String(user.id)
    await usersRepository.initAtomic({
      id: uid,
      firstName: user.first_name ?? '',
      lastName:  user.last_name  ?? '',
      username:  user.username   ?? '',
      photoUrl:  user.photo_url  ?? '',
    })
    // INVARIANT: TG identity user_id = provider_uid (yuqoridagi izohga qarang)
    await authRepository.ensureIdentity('telegram', uid, uid)
    return respondWithNewSession(uid, 'telegram')
  },

  // ── Linking (Profil "Hisobni bog'lash") ──────────────────────────────────

  /**
   * Telefon raqamni joriy akkauntga ulash:
   *  - raqam bo'sh → yangi identity + parol o'rnatiladi ('attached');
   *  - raqam shu user'niki → parol tekshiriladi, no-op ('attached');
   *  - raqam BOSHQA akkauntniki → parol proof → adopt-merge:
   *      joriy bo'sh TG shell → telefon akkaunti RENAME (TG id saqlanadi);
   *      joriy to'liq → bo'sh qarama-qarshi tomon absorb qilinadi;
   *      ikki tomon ham to'liq → 409 'accounts_merge_required' (v2).
   */
  async linkPhone(currentUserId: string, input: PhoneLinkInput): Promise<LinkResponse> {
    const identity = await authRepository.findIdentity('phone', input.phone)

    // 1) Raqam hali band emas — OTP ISBOTI SHART (raqam egasi ekanini tasdiqlash;
    //    aks holda kimdir boshqa kishining raqamini "egallab" olishi mumkin).
    //    Client adaptiv: otp'siz kelib 400 otp_required oladi → kod so'raydi →
    //    otp bilan qaytadi. Band raqam yo'llarida (2/3) parol proof'i yetarli.
    if (!identity) {
      if (!input.otp) throw new AppError(400, 'otp_required: Bu raqam yangi — SMS kod bilan tasdiqlang')
      await consumeOTPWithLockout(input.phone, input.otp)
      await authRepository.ensureIdentity('phone', input.phone, currentUserId)
      const recheck = await authRepository.findIdentity('phone', input.phone)
      if (recheck?.userId !== currentUserId) {
        // parallel link urinishi — boshqa user o'zib ketdi; pastda proof yo'li bilan davom
        return this.linkPhone(currentUserId, input)
      }
      await authRepository.setPasswordHash('phone', input.phone, hashPassword(input.password))
      await usersRepository.updatePhone(currentUserId, input.phone).catch(() => false)
      return { status: 'attached' as const, ...(await respondWithNewSession(currentUserId, 'phone')) }
    }

    // 2) Raqam shu user'niki — idempotent no-op (parol mosligi SHART)
    if (identity.userId === currentUserId) {
      if (!identity.passwordHash || !verifyPassword(input.password, identity.passwordHash)) {
        throw new AppError(401, 'invalid_credentials')
      }
      return { status: 'attached' as const, ...(await respondWithNewSession(currentUserId, 'phone')) }
    }

    // 3) Raqam boshqa akkauntniki — parol proof MAJBURIY (account takeover himoyasi)
    const otherId = identity.userId
    if (!identity.passwordHash || !verifyPassword(input.password, identity.passwordHash)) {
      throw new AppError(401, 'invalid_credentials')
    }

    await transactionBestEffort(async (tx) => {
      const stats = await accountStats([currentUserId, otherId], tx)
      const curEmpty   = isEmptyAccount(stats.get(currentUserId))
      const otherEmpty = isEmptyAccount(stats.get(otherId))

      if (!curEmpty && !otherEmpty) throw new AppError(409, 'accounts_merge_required')

      if (TG_ID_RE.test(currentUserId)) {
        if (!curEmpty && otherEmpty) {
          // TG akkaunt (data) telefon akkauntini (bo'sh) yutadi
          const ok = await absorbEmptyAccount(currentUserId, otherId, tx)
          if (!ok) throw new AppError(409, 'accounts_merge_required')
        } else {
          // Telefon akkaunti (data) bo'sh TG shell'ga ko'chadi — TG id saqlanadi
          const ok = await adoptPhoneIntoTelegram(currentUserId, otherId, tx)
          if (!ok) throw new AppError(409, 'accounts_merge_required')
        }
      } else {
        // Ikkalasi ham telefon akkaunti (kam uchraydigan holat) — bo'sh tomon yutuladi
        if (!otherEmpty) throw new AppError(409, 'accounts_merge_required')
        const ok = await absorbEmptyAccount(currentUserId, otherId, tx)
        if (!ok) throw new AppError(409, 'accounts_merge_required')
      }
    })
    // Denormalized phone field + session after transaction commits (retriable, idempotent)
    await usersRepository.updatePhone(currentUserId, input.phone).catch(() => false)
    return { status: 'adopted' as const, ...(await respondWithNewSession(currentUserId, 'phone')) }
  },

  /**
   * APK/brauzerdagi (telefon sessiya) foydalanuvchi uchun Telegram ulash kodi.
   * Bot `/start link_<code>` orqali BIR MARTA ishlatiladi (10 daqiqa).
   */
  async createTelegramLinkCode(userId: string) {
    const code = randomBytes(8).toString('base64url')        // 11 belgi, URL-safe
    const expiresAt = new Date(Date.now() + 10 * 60_000)
    await authRepository.createLinkCode({ code, userId, expiresAt })
    const botUsername = config.telegram.botUsername
    return {
      code,
      url: botUsername ? `https://t.me/${botUsername}?start=link_${code}` : null,
      expiresInMinutes: 10,
    }
  },

  /**
   * Bot: `/start link_<code>` — kod konsumatsiyasi + TG identity ulash
   * (adopt-merge qoidalari yuqoridagi invariant bilan BIR XIL).
   * Qaytaradi { status, message } — message UZ tilida bot reply sifatida yuboriladi.
   */
  async linkTelegramByCode(code: string, tg: { id: number }): Promise<{ status: 'linked' | 'conflict' | 'invalid'; message: string }> {
    return transactionBestEffort(async (tx) => {
      const userId = await authRepository.consumeLinkCode(code, tx)
      if (!userId) {
        return { status: 'invalid', message: '❌ Kod eskirgan yoki allaqachon ishlatilgan — APK/brauzerdan yangi kod oling.' }
      }

      const tgId = String(tg.id)
      if (userId === tgId) {
        return { status: 'linked', message: '✅ Bu Telegram akkaunt allaqachon shu hisobga ulangan.' }
      }

      // Telefon akkauntiga TG identity qo'shiladi — yakuniy id HAR DOIM TG raqam
      const tgExisting = await usersRepository.findById(tgId, tx)
      const otherId = userId   // ko'rsatkich egasi (odatda 'p_...' telefon akkaunti)

      if (!tgExisting) {
        // TG user birorta marta Mini App ochmagan — oddiy PK RENAME (data p_ → tg)
        const rows = await executeRows<{ ren: number }>(sql`
          WITH ren AS (
            UPDATE users SET id = ${tgId} WHERE id = ${otherId} RETURNING id
          ), tgi AS (
            INSERT INTO auth_identities (provider, provider_uid, user_id)
            SELECT 'telegram', ${tgId}, ${tgId} WHERE EXISTS (SELECT 1 FROM ren)
            ON CONFLICT (provider, provider_uid) DO NOTHING
            RETURNING provider
          )
          SELECT COUNT(*)::int AS ren FROM ren
        `, tx)
        if (Number(rows[0]?.ren) === 0) return { status: 'invalid', message: '❌ Ichki xatolik — akkaunt topilmadi.' }
        return { status: 'linked', message: LINK_OK_MSG }
      }

      const stats = await accountStats([tgId, otherId], tx)
      const tgEmpty    = isEmptyAccount(stats.get(tgId))
      const otherEmpty = isEmptyAccount(stats.get(otherId))

      if (!tgEmpty && !otherEmpty) {
        return {
          status: 'conflict',
          message: '⚠️ Bu Telegram akkauntda allaqachon alohida hisob bor — ikkala hisobda ham ma\'lumot bo\'lgani uchun ulash hozircha qo\'llab-quvvatlanmaydi. Iltimos, support bilan bog\'laning.',
        }
      }
      if (tgEmpty) {
        const ok = await adoptPhoneIntoTelegram(tgId, otherId, tx)
        if (!ok) return { status: 'conflict', message: '⚠️ Ulash vaqtida xatolik — keyinroq urinib ko\'ring.' }
      } else {
        const ok = await absorbEmptyAccount(tgId, otherId, tx)
        if (!ok) return { status: 'conflict', message: '⚠️ Ulash vaqtida xatolik — keyinroq urinib ko\'ring.' }
      }
      return { status: 'linked', message: LINK_OK_MSG }
    })
  },

  // ── Session lifecycle ────────────────────────────────────────────────────

  /** GET /auth/me — Bearer token'dan resolve qilingan user profili. */
  async getSessionProfile(userId: string) {
    return buildAuthSession(userId)
  },

  async logout(token: string): Promise<void> {
    await authRepository.deleteSession(token)
  },

  // ── Email + Password ────────────────────────────────────────────────────

  /** Email registration - creates unverified account, sends verification email */
  async registerWithEmail(input: { email: string; password: string; firstName: string }, req?: Request) {
    if (!isValidEmail(input.email)) {
      throw new AppError(400, 'invalid_email')
    }

    // Password strength validation
    const strength = validatePassword(input.password, DEFAULT_PASSWORD_POLICY)
    if (!strength.isValid) {
      throw new AppError(400, 'weak_password', strength.feedback.join('; '))
    }

    // Check if email already taken
    const existing = await authRepository.findIdentity('email', input.email.toLowerCase())
    if (existing) {
      throw new AppError(409, 'email_taken')
    }

    const userId = emailUserId()
    const passwordHash = hashPassword(input.password)

    // Create user + identity atomically in transaction (prevents orphan users on race)
    await transactionBestEffort(async (tx) => {
      await usersRepository.initAtomic({
        id: userId,
        firstName: input.firstName.trim(),
        lastName: '',
        username: '',
        photoUrl: '',
      }, tx)

      const created = await authRepository.createIdentity('email', input.email.toLowerCase(), userId, passwordHash, tx)
      if (!created) {
        // Audit H-5: neon-http transaction() IZOLYATSIYA BERMAYDI (driver
        // stateless — db/connection.ts) — "tx rollback" izohi faqat postgres-js
        // uchun to'g'ri. Race'da identity'siz ORPHAN user qolmasligi uchun
        // qo'lda kompensatsiya (postgres-js'da rollback allaqachon tozalagan,
        // idempotent DELETE ikkala yo'lda xavfsiz; FK cascade progress/settings
        // qatorlarini ham olib ketadi).
        await executeRows(sql`DELETE FROM users WHERE id = ${userId}`, tx)
          .catch((e) => console.warn('[registerWithEmail] orphan cleanup failed:', e))
        throw new AppError(409, 'email_taken')
      }

      // Update email field in users table
      await executeRows(sql`UPDATE users SET email = ${input.email.toLowerCase()} WHERE id = ${userId}`, tx)
    })

    // Send verification email
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24 hours
    await authRepository.createEmailVerificationToken(userId, input.email.toLowerCase(), token, expiresAt)

    const verificationLink = `${config.deploy.appUrl}/#/verify-email?token=${token}`
    await sendEmail({
      to: input.email,
      subject: 'Email tasdiqlang — KIVVI',
      html: emailVerificationTemplate(verificationLink, input.firstName, 'uz'),
    }).catch(err => {
      console.error('[Email verification send failed]', err)
      // Don't fail registration if email send fails
    })

    // Create audit log
    if (req) {
      await authRepository.createAuditLog({
        userId,
        action: 'account_created',
        resourceType: 'user',
        resourceId: userId,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
      })
    }

    // Return session (allow login before verification)
    return respondWithNewSession(userId, 'email')
  },

  /** Email login - allows unverified accounts but tracks verification status */
  async loginWithEmail(input: { email: string; password: string }, req?: Request) {
    const identity = await authRepository.findIdentity('email', input.email.toLowerCase())

    // Track failed login attempt (works even if identity not found for security audit)
    const logFailure = async (userId: string | null, reason: string) => {
      if (!req) return

      // Create anonymous audit trail even for non-existent accounts
      await authRepository.createAuditLog({
        userId: userId ?? undefined,
        action: 'login_failed',
        resourceType: 'auth',
        changes: { provider: 'email', reason, email: input.email.toLowerCase() },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
      })

      if (userId) {
        await authRepository.createLoginHistory({
          userId,
          provider: 'email',
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          success: false,
          failureReason: reason,
        })
      }
    }

    if (!identity?.passwordHash) {
      await logFailure(identity?.userId ?? null, 'invalid_credentials')
      throw new AppError(401, 'invalid_credentials')
    }

    // Check account lock
    const locked = await authRepository.isAccountLocked(identity.userId)
    if (locked) {
      await logFailure(identity.userId, 'account_locked')
      throw new AppError(403, 'account_locked')
    }

    // Verify password
    if (!verifyPassword(input.password, identity.passwordHash)) {
      await logFailure(identity.userId, 'invalid_password')

      // Increment failed attempts
      const attempts = await authRepository.incrementFailedLoginAttempts(identity.userId)

      // Lock account after 5 failed attempts (15 minutes)
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000)
        await authRepository.lockAccount(identity.userId, lockUntil)

        await authRepository.createAuditLog({
          userId: identity.userId,
          action: 'account_locked',
          resourceType: 'user',
          resourceId: identity.userId,
          changes: { reason: 'failed_login_attempts', attempts },
          ipAddress: req ? getClientIp(req) : undefined,
          userAgent: req?.headers['user-agent'],
        })

        throw new AppError(403, 'account_locked')
      }

      throw new AppError(401, 'invalid_credentials')
    }

    // Success - reset failed attempts
    await authRepository.resetFailedLoginAttempts(identity.userId)
    await authRepository.updateLastLogin(identity.userId)

    // Track device and log success
    if (req) {
      const deviceInfo = getDeviceInfo(req)
      await authRepository.upsertDevice({
        id: deviceInfo.id,
        userId: identity.userId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        fingerprint: deviceInfo.fingerprint,
      })

      await authRepository.createLoginHistory({
        userId: identity.userId,
        provider: 'email',
        deviceId: deviceInfo.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        success: true,
      })
    }

    return respondWithNewSession(identity.userId, 'email')
  },

  /** Verify email address - marks account as verified */
  async verifyEmail(token: string) {
    const result = await authRepository.consumeEmailVerificationToken(token)
    if (!result) {
      throw new AppError(400, 'invalid_token')
    }

    await authRepository.markEmailVerified(result.userId)

    await authRepository.createAuditLog({
      userId: result.userId,
      action: 'email_verified',
      resourceType: 'user',
      resourceId: result.userId,
      changes: { email: result.email },
    })

    return { verified: true, userId: result.userId }
  },

  /** Resend email verification */
  async resendEmailVerification(userId: string) {
    const user = await usersRepository.findById(userId)
    if (!user?.email) {
      throw new AppError(404, 'email_not_found')
    }
    if (user.emailVerifiedAt) {
      throw new AppError(400, 'already_verified')
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await authRepository.createEmailVerificationToken(userId, user.email, token, expiresAt)

    const verificationLink = `${config.deploy.appUrl}/#/verify-email?token=${token}`
    await sendEmail({
      to: user.email,
      subject: 'Email tasdiqlang — KIVVI',
      html: emailVerificationTemplate(verificationLink, user.firstName, 'uz'),
    })

    return { sent: true }
  },

  // ── Password Reset ──────────────────────────────────────────────────────

  /** Request password reset - sends reset email */
  async requestPasswordReset(email: string) {
    const identity = await authRepository.findIdentity('email', email.toLowerCase())
    if (!identity) {
      // Don't reveal if email exists (security best practice)
      return { sent: true }
    }

    const user = await usersRepository.findById(identity.userId)
    if (!user) {
      return { sent: true }
    }

    // Per-email flood himoyasi: soatiga N tadan oshsa — jimgina SKIP
    // (429 emas: enumeration himoyasini buzmaslik uchun javob bir xil qoladi)
    const recent = await authRepository.countRecentPasswordResetTokens(identity.userId, 60)
    if (recent >= RESET_MAX_PER_HOUR) {
      console.warn(`[auth] password reset rate-limited for user ${identity.userId}`)
      return { sent: true }
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)  // 1 hour
    await authRepository.createPasswordResetToken(identity.userId, token, expiresAt)

    const resetLink = `${config.deploy.appUrl}/#/reset-password?token=${token}`
    await sendEmail({
      to: email,
      subject: 'Parolni tiklash — KIVVI',
      html: passwordResetTemplate(resetLink, user.firstName, 'uz'),
    }).catch(err => {
      console.error('[Password reset email send failed]', err)
    })

    return { sent: true }
  },

  /** Reset password with token */
  async resetPassword(token: string, newPassword: string, req?: Request) {
    // Validate password strength
    const strength = validatePassword(newPassword, DEFAULT_PASSWORD_POLICY)
    if (!strength.isValid) {
      throw new AppError(400, 'weak_password', strength.feedback.join('; '))
    }

    const userId = await authRepository.consumePasswordResetToken(token)
    if (!userId) {
      throw new AppError(400, 'invalid_token')
    }

    // Get email identity for this user
    const rows = await executeRows<{ provider_uid: string }>(sql`
      SELECT provider_uid FROM auth_identities
      WHERE user_id = ${userId} AND provider = 'email'
      LIMIT 1
    `)
    if (!rows[0]) {
      throw new AppError(404, 'identity_not_found')
    }

    const passwordHash = hashPassword(newPassword)
    await authRepository.setPasswordHash('email', rows[0].provider_uid, passwordHash)
    await authRepository.updatePasswordChangeTimestamp(userId)
    // Eski (ehtimol o'g'irlangan) sessiyalar TTL tugaguncha yashamasligi kerak
    await authRepository.deleteUserSessions(userId)

    // Audit log
    await authRepository.createAuditLog({
      userId,
      action: 'password_changed',
      resourceType: 'user',
      resourceId: userId,
      changes: { method: 'reset_token' },
      ipAddress: req ? getClientIp(req) : undefined,
      userAgent: req?.headers['user-agent'],
    })

    return { reset: true }
  },

  /** Change password (authenticated user) */
  async changePassword(userId: string, currentPassword: string, newPassword: string, req?: Request) {
    // Get identity
    const rows = await executeRows<{ provider_uid: string; password_hash: string }>(sql`
      SELECT provider_uid, password_hash FROM auth_identities
      WHERE user_id = ${userId} AND provider IN ('email', 'phone') AND password_hash IS NOT NULL
      ORDER BY CASE WHEN provider = 'phone' THEN 1 ELSE 2 END, provider_uid ASC
      LIMIT 1
    `)
    if (!rows[0]?.password_hash) {
      throw new AppError(404, 'no_password_set')
    }

    // Verify current password
    if (!verifyPassword(currentPassword, rows[0].password_hash)) {
      throw new AppError(401, 'invalid_current_password')
    }

    // Validate new password strength
    const strength = validatePassword(newPassword, DEFAULT_PASSWORD_POLICY)
    if (!strength.isValid) {
      throw new AppError(400, 'weak_password', strength.feedback.join('; '))
    }

    // Check not same as current
    if (verifyPassword(newPassword, rows[0].password_hash)) {
      throw new AppError(400, 'password_same_as_current')
    }

    const passwordHash = hashPassword(newPassword)
    // Determine provider from identity (phone has +998 prefix, email has @)
    const provider = rows[0].provider_uid.includes('@') ? 'email' : 'phone'
    await authRepository.setPasswordHash(provider, rows[0].provider_uid, passwordHash)
    await authRepository.updatePasswordChangeTimestamp(userId)
    // Boshqa qurilmalardagi (ehtimol o'g'irlangan) sessiyalarni yopamiz; joriy qoladi
    await authRepository.deleteUserSessions(userId, (req as { sessionToken?: string } | undefined)?.sessionToken)

    // Audit log
    await authRepository.createAuditLog({
      userId,
      action: 'password_changed',
      resourceType: 'user',
      resourceId: userId,
      changes: { method: 'user_initiated' },
      ipAddress: req ? getClientIp(req) : undefined,
      userAgent: req?.headers['user-agent'],
    })

    return { changed: true }
  },

  // ── Telegram Login via Bot (deep-link + contact sharing) ────────────────

  /**
   * Frontend "Telegram orqali kirish" tugmasi — kod yaratib, bot deep-link qaytaradi.
   * User bot'ga o'tadi, contact ulashadi, bot phone orqali user topadi va session yaratadi.
   */
  async createTelegramLoginCode() {
    const code = randomBytes(8).toString('base64url')
    const expiresAt = new Date(Date.now() + 5 * 60_000)
    await executeRows(sql`
      INSERT INTO telegram_login_codes (code, expires_at) VALUES (${code}, ${expiresAt})
    `)
    const botUsername = config.telegram.botUsername
    return {
      code,
      url: botUsername ? `https://t.me/${botUsername}?start=login_${code}` : null,
      expiresInSeconds: 300,
    }
  },

  async checkTelegramLoginCode(code: string) {
    const rows = await executeRows<{ session_token: string | null; expires_at: Date }>(sql`
      SELECT session_token, expires_at FROM telegram_login_codes WHERE code = ${code}
    `)
    if (!rows[0]) return { status: 'expired' as const }
    if (rows[0].expires_at <= new Date()) {
      await executeRows(sql`DELETE FROM telegram_login_codes WHERE code = ${code}`)
      return { status: 'expired' as const }
    }
    const sessionToken = rows[0].session_token
    // 'pending:' marker (D2 claim) — tasdiqlash jarayoni hali davom etyapti,
    // client bu marker'ni token sifatida ishlatib yubormasligi kerak.
    if (sessionToken && !sessionToken.startsWith('pending:')) {
      await executeRows(sql`DELETE FROM telegram_login_codes WHERE code = ${code}`)
      const session = await authRepository.resolveSession(sessionToken)
      if (!session) return { status: 'expired' as const }
      const profile = await buildAuthSession(session.userId)
      return { status: 'completed' as const, sessionToken, ...profile }
    }
    return { status: 'pending' as const }
  },

  async completeTelegramLoginByPhone(code: string, phone: string, tg: { id: number; first_name?: string; last_name?: string; username?: string }) {
    // ATOMIK CLAIM (D2): avval kodni vaqtinchalik marker bilan band qilamiz —
    // ikki parallel tasdiqlash sariq IDOR'siz faqat BIRI UPDATE'dan o'tadi
    // (row lock, RETURNING bo'sh qaytadi). Eski oqim SELECT→issue→UPDATE edi:
    // ikkovlon SELECT'da o'tib, 2 yaroqli sessiya yaratardi.
    const claimMarker = `pending:${randomUUID()}`
    const claimed = await executeRows<{ code: string }>(sql`
      UPDATE telegram_login_codes
      SET session_token = ${claimMarker}
      WHERE code = ${code} AND session_token IS NULL AND expires_at > now()
      RETURNING code
    `)
    if (!claimed[0]) {
      return { ok: false, message: '❌ Kod eskirgan yoki allaqachon ishlatilgan.' }
    }

    // Canonical E.164 ('+998...') — bot contact `+` siz yuboradi, qolgan
    // barcha oqimlar esa `+998...` saqlaydi (normalizePhone — yagona manba).
    const canonical = normalizePhone(phone)
    const identity = await authRepository.findIdentity('phone', canonical)

    let userId: string
    if (identity) {
      userId = identity.userId
    } else {
      const tgId = String(tg.id)
      await usersRepository.initAtomic({
        id: tgId,
        firstName: tg.first_name ?? '',
        lastName: tg.last_name ?? '',
        username: tg.username ?? '',
        photoUrl: '',
      })
      await authRepository.ensureIdentity('telegram', tgId, tgId)
      await authRepository.ensureIdentity('phone', canonical, tgId)
      userId = tgId
    }

    const sessionToken = await issueSession(userId, 'telegram')
    await executeRows(sql`
      UPDATE telegram_login_codes SET session_token = ${sessionToken}
      WHERE code = ${code} AND session_token = ${claimMarker}
    `)
    return { ok: true, message: '✅ Muvaffaqiyatli! Ilovaga qayting — avtomatik kirish amalga oshdi.' }
  },

  // ── OAuth (Google + Apple) ──────────────────────────────────────────────

  /** Google OAuth callback - stub for implementation */
  async handleGoogleOAuth(_code: string, _req?: Request) {
    // TODO: Implement Google OAuth flow
    // 1. Exchange code for tokens
    // 2. Get user info from Google API
    // 3. Create or link account
    // 4. Return session
    throw new AppError(501, 'google_oauth_not_implemented')
  },

  /** Apple OAuth callback - stub for implementation */
  async handleAppleOAuth(_code: string, _req?: Request) {
    // TODO: Implement Apple Sign In flow
    // 1. Validate JWT from Apple
    // 2. Extract user info
    // 3. Create or link account
    // 4. Return session
    throw new AppError(501, 'apple_oauth_not_implemented')
  },
}

const LINK_OK_MSG = '✅ Telegram akkauntingiz ulandi! Endi Telegram (bot) va APK/brauzerdagi hisobingiz SINXRON — test natijalaringiz ikki tomonda ham ko\'rinadi.'
