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
import { randomBytes } from 'crypto'
import { config } from '../../config'
import { AppError } from '../../middleware/error-handler'
import { executeRows, transaction, type DB } from '../../db/connection'
import { sql } from 'drizzle-orm'
import { authRepository, type AuthProvider } from './auth.repository'
import { usersRepository } from '../users/users.repository'
import { progressRepository } from '../progress/progress.repository'
import { settingsRepository } from '../settings/settings.repository'
import { savedRepository } from '../saved/saved.repository'
import { toApiUser, toApiProgress, toApiSettings } from '../users/users.service'
import { hashPassword, verifyPassword } from '../../utils/password'
import { verifyLoginWidget } from '../../utils/telegram'
import { sendOTP, generateOTP, hashOTP } from '../../utils/sms'

// ── Zod schemas (router validate uchun eksport) ─────────────────────────────

/** O'zbekiston raqamlari — E.164, faqat +998 */
export const PhoneE164Schema = z.string().regex(/^\+998\d{9}$/, "Telefon raqam +998XXXXXXXXX formatida bo'lsin")

export const PasswordSchema = z.string()
  .min(8, 'Parol kamida 8 belgidan iborat bo\'lsin')
  .max(72, 'Parol juda uzun')

export const PhoneRegisterSchema = z.object({
  phone:     PhoneE164Schema,
  password:  PasswordSchema,
  firstName: z.string().trim().min(1, 'Ism kiritilishi shart').max(64),
})
export type PhoneRegisterInput = z.infer<typeof PhoneRegisterSchema>

export const PhoneLoginSchema = z.object({
  phone:    PhoneE164Schema,
  password: z.string().min(1).max(72),
})
export type PhoneLoginInput = z.infer<typeof PhoneLoginSchema>

/** Profil'dan telefon ulash — yangi identity bo'lsa parol O'RNATILADI,
 *  mavjud bo'lsa parol TASDIQLANADI (proof of ownership). */
export const PhoneLinkSchema = z.object({
  phone:     PhoneE164Schema,
  password:  PasswordSchema,
  firstName: z.string().trim().min(1).max(64).optional(),
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
  return `p_${phone.replace(/\D/g, '')}`
}

const TG_ID_RE = /^\d{1,19}$/

function newSessionToken(): string {
  return randomBytes(32).toString('hex')   // 64-hex opaque
}

function sessionExpiry(): Date {
  return new Date(Date.now() + config.auth.sessionTtlDays * 86_400_000)
}

async function issueSession(userId: string, provider: AuthProvider): Promise<string> {
  const token = newSessionToken()
  await authRepository.createSession({ token, userId, provider, expiresAt: sessionExpiry() })
  return token
}

/** To'liq profile + ulangan provider'lar (login/me/link javoblarining umumiy tanasi). */
async function buildAuthSession(userId: string) {
  const [user, prog, sett, saved, providers] = await Promise.all([
    usersRepository.findById(userId),
    progressRepository.findByUserId(userId),
    settingsRepository.findByUserId(userId),
    savedRepository.findByUserId(userId),
    authRepository.listUserProviders(userId),
  ])
  if (!user || !prog || !sett) throw new AppError(500, 'auth_profile_incomplete')
  return {
    user:           toApiUser(user),
    progress:       toApiProgress(prog),
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
 */
async function adoptPhoneIntoTelegram(tgId: string, phoneUserId: string, txOrDb?: DB): Promise<boolean> {
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
  return txOrDb ? runInTx(txOrDb) : transaction(runInTx)
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
  return txOrDb ? runInTx(txOrDb) : transaction(runInTx)
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

export const authService = {
  // ── SMS OTP flow ─────────────────────────────────────────────────────────

  /**
   * OTP so'rash — 6 raqamli kod generatsiya + SMS yuborish.
   * Rate limit: router qatlami (10/min per IP).
   * SMS-first pattern: foydalanuvchiga kod yetmaydigan holat yo'q.
   */
  async requestOTP(input: RequestOTPInput): Promise<{ sent: boolean }> {
    const code = generateOTP()
    const codeHash = hashOTP(code)
    const expiresAt = new Date(Date.now() + 5 * 60_000) // 5 daqiqa

    // SMS yuborish OLDIN — fail-fast, kod yetmasa DB'ga ham saqlanmaydi
    await sendOTP(input.phone, code)

    // SMS muvaffaqiyatli — DB'ga saqlash (conflict'da replace)
    await authRepository.createOTP(input.phone, codeHash, expiresAt)

    // Opportunistic cleanup
    void authRepository.cleanExpiredOTP().catch((e) => console.warn('[OTP cleanup]', e))

    return { sent: true }
  },

  /**
   * OTP tekshirish — login (mavjud akkaunt).
   */
  async verifyOTPLogin(input: VerifyOTPLoginInput): Promise<AuthResponse> {
    const codeHash = hashOTP(input.code)
    const valid = await authRepository.consumeOTP(input.phone, codeHash)
    if (!valid) throw new AppError(401, 'invalid_otp')

    const identity = await authRepository.findIdentity('phone', input.phone)
    if (!identity) throw new AppError(404, 'account_not_found')

    return respondWithNewSession(identity.userId, 'phone')
  },

  /**
   * OTP tekshirish + register — yangi akkaunt.
   * Race window minimal (OTP consume atomik, identity check + create qisqa).
   */
  async verifyOTPRegister(input: VerifyOTPRegisterInput): Promise<AuthResponse> {
    const codeHash = hashOTP(input.code)
    const valid = await authRepository.consumeOTP(input.phone, codeHash)
    if (!valid) throw new AppError(401, 'invalid_otp')

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

  /** Ro'yxatdan o'tish — yangi 'p_<digits>' akkaunt + parol + sessiya. */
  async registerWithPhone(input: PhoneRegisterInput) {
    const existing = await authRepository.findIdentity('phone', input.phone)
    if (existing) throw new AppError(409, 'phone_taken')

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

  /** Kirish — parol tekshiruvidan keyin yangi sessiya. */
  async loginWithPhone(input: PhoneLoginInput) {
    const identity = await authRepository.findIdentity('phone', input.phone)
    if (!identity?.passwordHash || !verifyPassword(input.password, identity.passwordHash)) {
      throw new AppError(401, 'invalid_credentials')
    }
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

    // 1) Raqam hali band emas — joriy userga yangi login usuli qo'shiladi
    if (!identity) {
      await authRepository.ensureIdentity('phone', input.phone, currentUserId)
      const recheck = await authRepository.findIdentity('phone', input.phone)
      if (recheck?.userId !== currentUserId) {
        // parallel link urinishi — boshqa user o'zib ketdi; pastda proof yo'li bilan davom
        return this.linkPhone(currentUserId, input)
      }
      await authRepository.setPasswordHash(input.phone, hashPassword(input.password))
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

    await transaction(async (tx) => {
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
    return transaction(async (tx) => {
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
}

const LINK_OK_MSG = '✅ Telegram akkauntingiz ulandi! Endi Telegram (bot) va APK/brauzerdagi hisobingiz SINXRON — test natijalaringiz ikki tomonda ham ko\'rinadi.'
