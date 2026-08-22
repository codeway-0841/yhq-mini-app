/**
 * Authentication middleware — MULTI-PROVIDER:
 *   1) `x-telegram-init-data` header (Telegram Mini App, HMAC-SHA256) — ustuvor;
 *   2) `Authorization: Bearer <sessionToken>` (telefon+parol / TG Login Widget
 *      login'da yaratilgan opaque token — `sessions` jadvalidan resolve).
 *
 * Tekshiruv O'TGAN user id `req.userId`'ga yoziladi (canonical TEXT id:
 * Telegram raqam-string yoki 'p_<digits>') — client endi `userId` param/body'ni
 * soxtalashira olmaydi. Bearer sessiya ishlatilganda `req.sessionToken` ham
 * saqlanadi (logout/revoke uchun).
 *
 * INVARIANT: Telegram identity HAR DOIM user_id = provider_uid — shu sababli
 * initData yo'li DB lookup TALAB QILMAYDI (link/adopt-merge shu qoidaga tayanadi).
 *
 * Enforcement policy:
 *   - Production      → credentials MAJBURIY (401 without/invalid; fail-closed)
 *   - Dev / test      → ixtiyoriy: valid credential bo'lsa resolve qilinadi,
 *                       bo'lmasa request o'tadi (route'lar o'zi tekshiradi)
 */

import { Request, Response, NextFunction } from 'express'
import { posix } from 'node:path'
import { config }          from '../config'
import { verifyInitData, parseInitDataUserUnsafe } from '../utils/telegram'
import { authRepository }  from '../modules/auth/auth.repository'

/** Routes whose first path segment carries a userId: /:userId/... */
const USER_SEGMENTS = new Set([
  'profile', 'progress', 'settings', 'saved', 'users', 'daily', 'achievements',
  // M-3 (audit): GET /referrals/:userId statistikasi ham user-scoped —
  // global anti-spoofing tekshiruvidan o'tishi shart (IDOR edi).
  'referrals',
])

/**
 * Normalize path to prevent traversal attacks:
 * - Express decodes req.path once, but attacker can double/triple-encode
 * - Iteratively decode until stable (handles any encoding depth)
 * - posix.normalize() resolves '..' segments
 * - Reject paths that escape root or contain null bytes
 */
function normalizePath(path: string): string | null {
  let decoded = path
  // Decode iteratively until stable (max 5 iterations to prevent infinite loop)
  for (let i = 0; i < 5; i++) {
    const prev = decoded
    try {
      decoded = decodeURIComponent(decoded)
    } catch {
      return null // malformed URL encoding
    }
    if (decoded === prev) break // stable, no more encoding
  }
  const normalized = posix.normalize(decoded)
  // Reject if normalized path escapes root or contains null bytes
  if (normalized.startsWith('..') || normalized.includes('\0')) return null
  return normalized
}

/**
 * Public read-only content — no per-user data, safe to cache on the CDN.
 * Questions/topics are identical for every user, so auth is NOT required.
 * This lets Vercel's CDN serve them from the edge (huge DB-load win).
 */
const PUBLIC_GET = new Set(['questions', 'topics', 'dashboard',
  // 'avatar/:userId' — public profil rasmi (leaderboard/duel <img src> auth
  // header yubora olmaydi; rasm user O'ZI global ko'rsatish uchun yuklagan)
  'avatar',
])

/**
 * Auth LOGIN endpoint'lari — credentials'siz KIRISH uchun public:
 *   POST /auth/phone/register · /auth/phone/login · /auth/telegram
 *   POST /auth/otp/request · /auth/otp/verify/login · /auth/otp/verify/register
 *   POST /auth/email/register · /auth/email/login
 *   POST /auth/forgot-password · /auth/reset-password (token'li, credentials'siz)
 * (qolgan /auth/* — me/logout/link/tg-link-code/change-password —
 *  requireAuth ostida; OAuth callback'lar 501-stub, ataylab public EMAS).
 * DIQQAT: bu ro'yxat auth.router.ts bilan qo'lda sinxron saqlanadi —
 * desync'ni tests/unit/middleware/auth-public-routes.test.ts ushlaydi.
 */
const PUBLIC_AUTH_POST = new Set([
  'auth/phone/register',
  'auth/phone/login',
  'auth/telegram',
  'auth/telegram-login',
  'auth/otp/request',
  'auth/otp/verify/login',
  'auth/otp/verify/register',
  'auth/email/register',
  'auth/email/login',
  'auth/forgot-password',
  'auth/reset-password',
])

const PUBLIC_AUTH_GET_PREFIXES = [
  'auth/telegram-login',
  // Email'dagi link istalgan brauzerdan ochiladi (headers'siz) — public
  'auth/verify-email',
]

/** Payment provider webhooks — credentials'siz keladi (imzo bilan himoyalangan) */
const PUBLIC_PAYMENT_POST = new Set([
  'payments/click',
  'payments/click/prepare',
  'payments/click/complete',
])

// `export` faqat unit-testlar uchun (allowlist desync'ini ushlab turish).
export function isPublicGet(req: Request): boolean {
  if (req.method !== 'GET') return false
  const normalized = normalizePath(req.path)
  if (!normalized) return false
  const seg = normalized.split('/').filter(Boolean)[0]
  return PUBLIC_GET.has(seg)
}

// `export` faqat unit-testlar uchun (allowlist desync'ini ushlab turish).
export function isPublicAuthPost(req: Request): boolean {
  if (req.method !== 'POST') return false
  const normalized = normalizePath(req.path)
  if (!normalized) return false
  // TO'LIQ path exact-match (audit #14): oldingi slice(0,3)/slice(0,4) prefiks
  // tekshiruvi 'auth/phone/login/anything' kabi MAVJUD BO'LMAGAN chuqurroq
  // yo'lni ham public deb belgilardi (Express baribir 404 qaytaradi — mos
  // route yo'q — shuning uchun amaliy ta'sir yo'q edi, lekin allowlist
  // niyatiga mos EMAS edi).
  const path = normalized.split('/').filter(Boolean).join('/')
  return PUBLIC_AUTH_POST.has(path)
}

// `export` faqat unit-testlar uchun (allowlist desync'ini ushlab turish).
export function isPublicAuthGet(req: Request): boolean {
  if (req.method !== 'GET') return false
  const normalized = normalizePath(req.path)
  if (!normalized) return false
  const path = normalized.split('/').filter(Boolean).join('/')
  return PUBLIC_AUTH_GET_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function isPublicPaymentPost(req: Request): boolean {
  if (req.method !== 'POST') return false
  const normalized = normalizePath(req.path)
  if (!normalized) return false
  const path = normalized.split('/').filter(Boolean).join('/')
  return PUBLIC_PAYMENT_POST.has(path)
}

export function isAuthEnforced(): boolean {
  // Production auth BOT_TOKEN mavjudligiga bog'liq bo'lmasligi kerak: token noto'g'ri
  // sozlansa request ochilib qolmaydi, balki quyida 503 bilan fail-closed bo'ladi.
  return config.isProd
}

function getInitData(req: Request): string | undefined {
  const header = req.headers['x-telegram-init-data']
  return Array.isArray(header) ? header[0] : header
}

function getBearerToken(req: Request): string | undefined {
  const header = req.headers['authorization']
  const value = Array.isArray(header) ? header[0] : header
  if (!value?.startsWith('Bearer ')) return undefined
  const token = value.slice(7).trim()
  return token.length > 0 ? token : undefined
}

/** initData imzosi to'g'ri bo'lsa canonical Telegram user id, aks holda null. */
function verifyTelegram(initData: string): string | null {
  if (!config.telegram.botToken) return null
  const user = verifyInitData(initData, config.telegram.botToken)
  return user ? String(user.id) : null
}

/**
 * DEV/TEST FALLBACK: imzo tekshiruvi muvaffaqiyatsiz bo'lsa (masalan
 * index.html'dagi mock Telegram user — doim soxta `hash=dev` yuboradi, haqiqiy
 * BOT_TOKEN bilan HECH QACHON validatsiyadan o'tolmaydi) — imzosiz user id'ni
 * o'qiydi. FAQAT isAuthEnforced()===false chaqiruvchisida ishlatiladi (pastda),
 * production'da BU YO'L UMUMAN CHAQIRILMAYDI.
 */
function devUnverifiedTelegramId(initData: string): string | null {
  const user = parseInitDataUserUnsafe(initData)
  return user ? String(user.id) : null
}

async function resolveBearer(token: string, req: Request): Promise<boolean> {
  const session = await authRepository.resolveSession(token)
  if (!session) return false
  ;(req as { userId?: string }).userId = session.userId
  ;(req as { sessionToken?: string }).sessionToken = token
  return true
}

export async function telegramAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (isPublicGet(req) || isPublicAuthPost(req) || isPublicAuthGet(req) || isPublicPaymentPost(req)) { next(); return }

    const initData = getInitData(req)
    const bearer   = getBearerToken(req)

    // Verification is optional outside production — validate when present though.
    // Imzo muvaffaqiyatsiz bo'lsa devUnverifiedTelegramId fallback qiladi (dev-mock
    // Telegram user'ning soxta hash'i haqiqiy BOT_TOKEN bilan hech qachon
    // tasdiqlanmaydi — bu yo'lsiz coins/boss kabi qat'iy route'lar local dev'da
    // doim 401 qaytarardi).
    if (!isAuthEnforced()) {
      if (initData) {
        const id = verifyTelegram(initData) ?? devUnverifiedTelegramId(initData)
        if (id) (req as { userId?: string }).userId = id
      } else if (bearer) {
        await resolveBearer(bearer, req)
      }
      next()
      return
    }

    if (initData) {
      if (!config.telegram.botToken) {
        res.status(503).json({ error: 'Authentication service is not configured' })
        return
      }
      const verifiedId = verifyTelegram(initData)
      if (!verifiedId) {
        res.status(401).json({ error: 'Invalid Telegram initData signature' })
        return
      }
      ;(req as { userId?: string }).userId = verifiedId
    } else if (bearer) {
      if (!(await resolveBearer(bearer, req))) {
        res.status(401).json({ error: 'invalid_session' })
        return
      }
      // !session bo'lsa resolveBearer ayrildi — userId endi mavjud
    } else {
      res.status(401).json({ error: 'Missing credentials (initData or Bearer token)' })
      return
    }

    const verifiedId = (req as { userId?: string }).userId
    if (!verifiedId) {   // prognoz imkonsiz — lekin fail-closed
      res.status(401).json({ error: 'Authentication failed' })
      return
    }

    // Anti-spoofing: the :userId in the URL must match the verified id.
    // req.path here is relative to the /api mount point.
    // SECURITY: normalize to prevent path traversal (.. segments, double-encoding)
    const normalized = normalizePath(req.path)
    if (!normalized) {
      res.status(400).json({ error: 'Invalid path' })
      return
    }
    const seg = normalized.split('/').filter(Boolean)
    if (seg.length >= 2 && USER_SEGMENTS.has(seg[0]) && seg[1] !== verifiedId) {
      res.status(403).json({ error: 'Forbidden — cannot access another user’s data' })
      return
    }

    // /init: the id in the body must match the verified Telegram id
    if (seg.length === 1 && seg[0] === 'init' && req.method === 'POST') {
      const bodyId = (req.body as { id?: unknown })?.id
      if (bodyId != null && String(bodyId) !== verifiedId) {
        res.status(403).json({ error: 'Forbidden — id mismatch' })
        return
      }
    }

    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Route-level ownership guard. User-scoped routerlar buni explicit qo'llaydi;
 * global path tekshiruvi esa defense-in-depth bo'lib qoladi.
 */
export function requireSelf(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthEnforced()) { next(); return }

  const verifiedId = (req as { userId?: string }).userId
  const requestedId = req.params['userId']
  if (!verifiedId) {
    res.status(401).json({ error: 'User is not authenticated' })
    return
  }
  if (!requestedId || requestedId !== verifiedId) {
    res.status(403).json({ error: 'Forbidden — cannot access another user’s data' })
    return
  }
  next()
}

/**
 * Endpoint ichida auth MAJBURIY (dev'da ham) — masalan /api/auth/me.
 * Global telegramAuth resolve qilgan req.userId'ga tayanadi.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as { userId?: string }).userId
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  next()
}
