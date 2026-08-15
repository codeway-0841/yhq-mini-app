import { config } from '../config'
import { getInitData } from '../../platform/telegram'
import { getSessionToken, notifySessionExpired } from '../lib/session'
import {
  FullProfileSchema, AuthSessionSchema, AuthResponseSchema, LinkResponseSchema,
} from '../../../shared/contracts/profile'

const BASE = config.apiBaseUrl
const TIMEOUT_MS = 8000

/**
 * Typed API error — caller'lar status bo'yicha qaror qabul qiladi
 * (outbox: 4xx fatal / 429+5xx retryable; UI: 401/403 holatlari).
 */
export class ApiError extends Error {
  /** HTTP status kodi (0 — server javobi formati buzilgan, -1 — tarmoq/timeout) */
  status: number
  /** Server qaytargan xato kodi (masalan 'premium_required') */
  code?: string
  /** Vaqtincha: qayta urinish mantiqan befoyda emas (429, 5xx, network) */
  retryable: boolean

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryable = status <= 0 || status === 408 || status === 429 || status >= 500
  }
}

/**
 * Timeout signal compatible with older Telegram WebViews
 * (AbortSignal.timeout is not available everywhere).
 */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body) headers['Content-Type'] = 'application/json'
  // Auth credential TANLOVI: initData (Mini App) USTUVOR — ikkalovidan FAQAT biri
  // yuboriladi (server dual-auth). initData yo'q bo'lsa Bearer session token.
  let sentBearer = false
  const initData = getInitData()
  if (initData) {
    headers['x-telegram-init-data'] = initData
  } else {
    const token = getSessionToken()
    if (token) { headers['Authorization'] = `Bearer ${token}`; sentBearer = true }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    // Bearer bilan yuborilgan so'rov 401 qaytardi → sessiya eskirgan/revoke:
    // token o'chiriladi + App login holatiga o'tadi ('yhq:session-expired').
    if (sentBearer && res.status === 401) notifySessionExpired()
    const text = await res.text().catch(() => res.statusText)
    // Server { error: '<code>' } JSON qaytarsa — typed code sifatida chiqaramiz
    let code: string | undefined
    try { code = (JSON.parse(text) as { error?: unknown }).error as string | undefined } catch { /* text javob */ }
    throw new ApiError(res.status, `${method} ${path} → ${res.status}: ${text}`, typeof code === 'string' ? code : undefined)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function uid(userId: string) {
  return encodeURIComponent(userId)
}

/** /init va /profile javobini shared contract bilan tekshiradi (drift himoyasi). */
function parseProfile(raw: unknown): FullProfile {
  const parsed = FullProfileSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ApiError(0, `profile contract buzilgan: ${parsed.error.issues[0]?.message ?? 'unknown'}`, 'bad_response')
  }
  return parsed.data as FullProfile
}

/** Auth javoblarini tekshirishda umumiy yordamchi (contract drift himoyasi). */
function parseWith<T>(schema: { safeParse: (raw: unknown) => { success: boolean; data?: unknown; error?: { issues: { message: string }[] } } }, label: string) {
  return (raw: unknown): T => {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      throw new ApiError(0, `${label} contract buzilgan: ${parsed.error?.issues[0]?.message ?? 'unknown'}`, 'bad_response')
    }
    return parsed.data as T
  }
}

const parseAuthSession  = parseWith<AuthSession>(AuthSessionSchema,  'auth session')
const parseAuthResponse = parseWith<AuthResponse>(AuthResponseSchema, 'auth response')
const parseLinkResponse = parseWith<LinkResponse>(LinkResponseSchema, 'link response')

export interface ApiUser {
  id: string
  firstName: string
  lastName: string | undefined
  username: string | undefined
  photoUrl: string | undefined
  phone: string | undefined
  tariff: 'free' | 'premium'
  /** Admin panel (savol CRUD) huquqi */
  isAdmin?: boolean
}

export interface ApiProgress {
  totalCorrect: number
  totalWrong: number
  totalAnswered: number
  streak: number
  /** Wrong-answer counts keyed by question id. */
  wrongByTicket: Record<string, number>
  solvedQuestions?: string[]
}

export interface ApiSettings {
  autoNextCorrect: boolean
  autoNextWrong: boolean
  noAnimation: boolean
  shuffleOptions: boolean
  fontSize: 'small' | 'medium' | 'large'
  fontStyle: 'default' | 'serif' | 'mono'
  language: 'uz' | 'ru'
  theme: 'dark' | 'light' | 'system'
  offlineMode: boolean
  notificationsEnabled?: boolean
  dailyReminder?: boolean
  dailyReminderTime?: string
}

export interface FullProfile {
  user: ApiUser
  progress: ApiProgress
  settings: ApiSettings
  /** Composite kalitlar: `${subjectId}:${questionId}` ('yhq:123') — multi-fan identity */
  savedQuestions: string[]
}

/** GET /auth/me javobi — FullProfile + ulangan login usullari ro'yxati. */
export interface AuthSession extends FullProfile {
  providers: ('telegram' | 'phone')[]
}

/** Login/register javobi — sessiya + to'liq profil (warm hydrate uchun). */
export interface AuthResponse extends AuthSession {
  /** Opaque Bearer token — localStorage'da (shared/lib/session) saqlanadi */
  sessionToken: string
}

/** POST /auth/phone/link javobi — 'adopted' bo'lsa user.id o'zgargan bo'lishi mumkin. */
export interface LinkResponse extends AuthResponse {
  status: 'attached' | 'adopted'
}

/** Telegram Login Widget callback maydonlari (initData'dan FARQLI format). */
export interface TelegramWidgetFields {
  id: number | string
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number | string
  hash: string
}

/**
 * Public savol qatori — TO'G'RI JAVOBSIZ (scoring trust boundary).
 * correctAnswer faqat serverda: POST /result javob bergandan keyin
 * post-answer reveal orqali qaytaradi yoki /admin/questions (admin-only).
 */
export interface DbQuestion {
  id: number
  questionUz: string
  questionRu: string
  optionsUz: Record<string, string>
  optionsRu: Record<string, string>
  image: string | null
  topicId: number | null
}

/** Admin CRUD uchun to'liq qator (faqat /admin/questions qaytaradi). */
export interface AdminDbQuestion extends DbQuestion {
  correctAnswer: string
}

export interface DbTopic {
  id: number
  nameUz: string
  nameRu: string
  slug: string
}

export interface Question {
  id: number
  text: string
  image: string | null
  options: { id: string; text: string }[]
  topicId: number | null
}

export function dbToQuestion(q: DbQuestion, lang: 'uz' | 'ru'): Question {
  const text    = lang === 'ru' ? q.questionRu : q.questionUz
  const optMap  = lang === 'ru' ? q.optionsRu  : q.optionsUz
  const options = Object.entries(optMap).map(([id, text]) => ({ id, text }))
  return { id: q.id, text, image: q.image, options, topicId: q.topicId }
}

export const api = {
  // ── Auth — SMS OTP ────────────────────────────────────────────────────────
  requestOTP: (data: { phone: string }) =>
    request<{ sent: boolean }>('POST', '/auth/otp/request', data),

  verifyOTPLogin: (data: { phone: string; code: string }) =>
    request<unknown>('POST', '/auth/otp/verify/login', data).then(parseAuthResponse),

  verifyOTPRegister: (data: { phone: string; code: string; password: string; firstName: string }) =>
    request<unknown>('POST', '/auth/otp/verify/register', data).then(parseAuthResponse),

  // ── Auth — Email ──────────────────────────────────────────────────────────
  registerWithEmail: (data: { email: string; password: string; firstName: string }) =>
    request<unknown>('POST', '/auth/email/register', data).then(parseAuthResponse),

  loginWithEmail: (data: { email: string; password: string }) =>
    request<unknown>('POST', '/auth/email/login', data).then(parseAuthResponse),

  verifyEmail: (token: string) =>
    request<{ ok: true }>('POST', '/auth/verify-email', { token }),

  resendEmailVerification: (email: string) =>
    request<{ ok: true }>('POST', '/auth/resend-verification', { email }),

  requestPasswordReset: (email: string) =>
    request<{ ok: true }>('POST', '/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/reset-password', { token, newPassword }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/change-password', { currentPassword, newPassword }),

  // ── Auth — Legacy phone + password ────────────────────────────────────────
  registerPhone: (data: { phone: string; password: string; firstName: string }) =>
    request<unknown>('POST', '/auth/phone/register', data).then(parseAuthResponse),

  loginPhone: (data: { phone: string; password: string }) =>
    request<unknown>('POST', '/auth/phone/login', data).then(parseAuthResponse),

  loginTelegramWidget: (fields: TelegramWidgetFields) =>
    request<unknown>('POST', '/auth/telegram', fields).then(parseAuthResponse),

  createTelegramLogin: () =>
    request<{ code: string; url: string | null; expiresInSeconds: number }>('POST', '/auth/telegram-login', {}),

  checkTelegramLogin: async (code: string) => {
    const res = await request<unknown>('GET', `/auth/telegram-login/${code}`)
    const r = res as { status: string; sessionToken?: string }
    if (r.status === 'completed' && r.sessionToken) {
      const parsed = parseAuthResponse(res)
      return { ...parsed, status: 'completed' as const, sessionToken: r.sessionToken }
    }
    return { status: r.status as 'pending' | 'expired' }
  },

  /** Bearer sessiya bilan warm start — profile + providers. */
  getAuthMe: () =>
    request<unknown>('GET', '/auth/me').then(parseAuthSession),

  /** Offline'da ham lokal reset bo'lishi uchun xato yutuvchi. */
  logout: () =>
    request<{ ok: true }>('POST', '/auth/logout', {}).catch(() => ({ ok: true as const })),

  /** Joriy akkauntga telefon raqam ulash (parol = proof of ownership). */
  linkPhone: (data: { phone: string; password: string; firstName?: string }) =>
    request<unknown>('POST', '/auth/phone/link', data).then(parseLinkResponse),

  /** Telefon sessiyasidan Telegram'ga ulash uchun bot deep-link kodi (10 daq). */
  createTelegramLinkCode: () =>
    request<{ code: string; url: string | null; expiresInMinutes: number }>('POST', '/auth/tg-link-code', {}),

  init: (data: {
    id: string
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
    start_param?: string
  // Warm-start asosiy manbai — contract DRIFT bo'lsa jimgina buzilmasin:
  }): Promise<FullProfile> =>
    request<unknown>('POST', '/init', data).then(parseProfile),

  getProfile: (userId: string): Promise<FullProfile> =>
    request<unknown>('GET', `/profile/${uid(userId)}`).then(parseProfile),

  postResult: (userId: string, data: {
    questionId: number
    selectedAnswer: string | null
    subjectId: string
    /** Outbox idempotency kaliti — replay counterlarni qayta yozmaydi */
    clientToken?: string
  }) => request<ResultResponse>(
    'POST', `/progress/${uid(userId)}/result`, data,
  ),

  patchProgress: (userId: string, patch: Partial<ApiProgress>) =>
    request<{ ok: true }>('PATCH', `/progress/${uid(userId)}`, patch),

  patchSettings: (userId: string, patch: Partial<ApiSettings>) =>
    request<{ ok: true }>('PATCH', `/settings/${uid(userId)}`, patch),

  addSaved: (userId: string, questionId: number, subjectId: string) =>
    request<{ ok: true }>('POST', `/saved/${uid(userId)}`, { questionId, subjectId }),

  removeSaved: (userId: string, questionId: number, subjectId: string) =>
    request<{ ok: true }>(
      'DELETE',
      `/saved/${uid(userId)}/${encodeURIComponent(questionId)}?subject=${encodeURIComponent(subjectId)}`,
    ),

  resetProgress: (userId: string) =>
    request<{ ok: true }>('DELETE', `/progress/${uid(userId)}`),

  updatePhone: (userId: string, phone: string) =>
    request<{ ok: true }>('PATCH', `/users/${uid(userId)}/phone`, { phone }),

  /** 3 kunlik bepul Premium trial (FAQAT 1 marta — backend tekshiradi) */
  startTrial: (userId: string) =>
    request<{ granted: boolean; reason?: 'already_used'; days: number }>('POST', `/users/${uid(userId)}/trial`, {}),

  getQuestions: (subject?: string, fresh = false) => {
    const params = new URLSearchParams()
    if (subject) params.set('subject', subject)
    // Admin CRUD'dan keyin: browser (1h) + Vercel CDN (24h) cache'ni chetlab o'tish
    if (fresh) params.set('_t', String(Date.now()))
    const qs = params.toString()
    return request<DbQuestion[]>('GET', `/questions${qs ? `?${qs}` : ''}`)
  },
  getTopics: (subject?: string, fresh = false) => {
    const params = new URLSearchParams()
    if (subject) params.set('subject', subject)
    if (fresh) params.set('_t', String(Date.now()))
    const qs = params.toString()
    return request<DbTopic[]>('GET', `/topics${qs ? `?${qs}` : ''}`)
  },

  getLeaderboard: (limit: number, userId?: string) =>
    request<LeaderboardEntry[]>(
      'GET',
      `/leaderboard?limit=${limit}${userId ? `&userId=${uid(userId)}` : ''}`
    ),

  getLeagueWeekly: (limit: number, userId?: string) =>
    request<LeagueWeekly>(
      'GET',
      `/leaderboard?limit=${limit}&mode=weekly${userId ? `&userId=${uid(userId)}` : ''}`
    ),

  // ── Daily Challenge ────────────────────────────────────────────────────
  getDaily: (userId: string, date: string, subject: string) =>
    request<DailyState>('GET', `/daily/${uid(userId)}?date=${encodeURIComponent(date)}&subject=${encodeURIComponent(subject)}`),

  getDailyHistory: (userId: string, date: string, subject: string) =>
    request<DailyHistory>('GET', `/daily/${uid(userId)}/history?date=${encodeURIComponent(date)}&subject=${encodeURIComponent(subject)}`),

  addDailyFix: (userId: string, data: { subjectId: string }) =>
    request<{ ok: true }>('POST', `/daily/${uid(userId)}/fix`, data),

  getAchievements: (userId: string) =>
    request<{ stats: AchievementStats }>('GET', `/achievements/${uid(userId)}`),

  touchDailyActivity: (userId: string, data: { subjectId: string }) =>
    request<{ ok: true; dailyStreak: number }>('POST', `/daily/${uid(userId)}/activity`, data),

  // ── Spaced Repetition (Adaptive Mode) Cards ────────────────────────────
  getCards: (userId: string, subjectId: string) =>
    request<{ ok: true; cards: Record<number, { questionId: number; ef: number; interval: number; reps: number; dueAt: number }> }>(
      'GET',
      `/progress/${uid(userId)}/cards?subjectId=${encodeURIComponent(subjectId)}`
    ),

  reviewCard: (userId: string, data: { subjectId: string; questionId: number; ef: number; interval: number; reps: number; dueAt: number }) =>
    request<{ ok: true }>('POST', `/progress/${uid(userId)}/cards/review`, data),

  // ── Admin (savollar CRUD) — faqat is_admin=true foydalanuvchilarga ──
  /** TO'LIQ qatorlar (correctAnswer bilan) — public /questions endi javobsiz */
  getAdminQuestions: (subjectId?: string) =>
    request<AdminDbQuestion[]>('GET', `/admin/questions${subjectId ? `?subject=${encodeURIComponent(subjectId)}` : ''}`),
  createQuestion: (data: Omit<AdminDbQuestion, 'id'> & { id?: number; subjectId?: string; bankId?: string }) =>
    request<{ id: number; created: true }>('POST', '/admin/questions', data),
  updateQuestion: (id: number, data: Omit<AdminDbQuestion, 'id'>) =>
    request<{ id: number; updated: true }>('PUT', `/admin/questions/${id}`, data),
  deleteQuestion: (id: number) =>
    request<void>('DELETE', `/admin/questions/${id}`),
  getQuestionsMeta: (subjectId?: string) =>
    request<{ total: number; withTopic: number }>('GET', `/admin/questions/meta${subjectId ? `?subject=${encodeURIComponent(subjectId)}` : ''}`),
  getAdminTopics: (subjectId?: string) =>
    request<DbTopic[]>('GET', `/admin/topics${subjectId ? `?subject=${encodeURIComponent(subjectId)}` : ''}`),
  bulkImportQuestions: (data: {
    subjectId?: string
    bankId?: string
    items: Array<{
      questionUz: string
      questionRu: string
      optionsUz: Record<string, string>
      optionsRu: Record<string, string>
      correctAnswer: string
      image?: string | null
      topicId?: number | null
    }>
  }) =>
    request<{ success: boolean; count: number }>('POST', '/admin/questions/bulk-import', data),

  // ── Promo codes ───────────────────────────────────────────────────────────
  redeemPromo: (code: string) =>
    request<{
      success: boolean
      type: string
      value: number
      premiumUntil: string | null
      tariff: 'free' | 'premium'
    }>('POST', '/promo/redeem', { code }),

  // ── Admin Promo Codes ─────────────────────────────────────────────────────
  getAdminPromoCodes: () =>
    request<{ codes: AdminPromoCode[] }>('GET', '/admin/promo-codes'),
  createAdminPromoCode: (data: { code: string; type?: string; value: number; maxUses?: number | null; expiresAt?: string | null }) =>
    request<AdminPromoCode>('POST', '/admin/promo-codes', data),
  toggleAdminPromoCode: (id: number, isActive: boolean) =>
    request<{ ok: boolean; id: number; isActive: boolean }>('PATCH', `/admin/promo-codes/${id}/toggle`, { isActive }),
  deleteAdminPromoCode: (id: number) =>
    request<{ ok: boolean; id: number }>('DELETE', `/admin/promo-codes/${id}`),

  // ── Admin Stats & Users ───────────────────────────────────────────────────
  getAdminStats: () =>
    request<AdminStats>('GET', '/admin/stats'),
  searchAdminUsers: (query?: string) =>
    request<{ users: AdminUserItem[] }>('GET', `/admin/users${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  grantAdminUserPremium: (userId: string, data: { tariff: 'free' | 'premium'; days?: number | null }) =>
    request<{ ok: boolean; user: { id: string; firstName: string; tariff: 'free' | 'premium'; premiumUntil: string | null } }>(
      'POST',
      `/admin/users/${userId}/grant-premium`,
      data,
    ),
  // ── Admin Broadcast (Ommaviy xabarnoma) ──────────────────────────────────
  getBroadcastPreviewCount: (target: 'all' | 'free' | 'premium' | 'inactive_7d' | 'active_today') =>
    request<{ target: string; count: number }>('POST', '/admin/broadcast/preview-count', { target }),
  sendBroadcast: (data: {
    target: 'all' | 'free' | 'premium' | 'inactive_7d' | 'active_today'
    text: string
    imageUrl?: string | null
    imageData?: string | null
    buttonText?: string | null
    buttonUrl?: string | null
    testTelegramId?: string | number | null
  }) =>
    request<{
      ok: boolean
      total: number
      sent: number
      blocked: number
      failed: number
      durationMs: number
    }>('POST', '/admin/broadcast', data),

  sendRetentionTest: (data: { type: 'streak' | 'inactivity' | 'league' | 'premium_expiring'; targetTelegramId?: string }) =>
    request<{ ok: boolean; message: string }>('POST', '/admin/retention/test', data),

  // ── Payments & Orders (Click.uz) ──────────────────────────────────────────
  createPaymentOrder: (data: { plan: string; provider?: 'click'; returnUrl?: string }) =>
    request<{
      ok: boolean
      orderId: string
      amountUzs: number
      plan: string
      provider: string
      paymentUrl: string
    }>('POST', '/payments/create-order', data),

  checkPaymentOrder: (orderId: string) =>
    request<{
      ok: boolean
      orderId: string
      status: 'pending' | 'completed' | 'cancelled' | 'failed'
      plan: string
      amountUzs: number
      provider: string
      updatedAt: string
    }>('GET', `/payments/check-order/${encodeURIComponent(orderId)}`),
}

export interface AdminPromoCode {
  id: number
  code: string
  type: string
  value: number
  maxUses: number | null
  usedCount: number
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

export interface AdminStats {
  totalUsers: number
  premiumUsers: number
  todayActiveUsers: number
  totalQuestions: number
  totalAnswered: number
  totalPromoCodes: number
}

export interface AdminUserItem {
  id: string
  firstName: string
  lastName: string | null
  username: string | null
  photoUrl: string | null
  phone: string | null
  tariff: 'free' | 'premium'
  premiumUntil: string | null
  isAdmin: boolean
  createdAt: string
  answered: number
  correct: number
  league: string | null
}

/** POST /result javobi — SERVER tekshiruvi (client endi to'g'ri javobni bilmaydi). */
export interface ResultResponse {
  ok: true
  /** duplicate'da null — faqat yangi (hisoblangan) javobda boolean */
  correct: boolean | null
  /** Post-answer reveal — FAQAT yangi javobda; duplicate replay'da null */
  correctAnswer: string | null
  /** Idempotent duplicate bo'lsa null (counterlar qayta yozilmagan) */
  dailyStreak: number | null
  /** Shu clientToken allaqachon qabul qilingan */
  duplicate?: boolean
}

export interface DailyState {  record: { date: string; subjectId: string; answered: number; correct: number; challengeDone: boolean } | null
  dailyStreak: number
}

export interface DailyHistoryRow {
  date:      string
  subjectId: string
  answered:  number
  correct:   number
  fixed:     number
}

export interface DailyHistory {
  rows:        DailyHistoryRow[]
  dailyStreak: number
  bestStreak:  number
}

export interface AchievementStats {
  totalCorrect:  number
  totalAnswered: number
  octagonWins:   number
  bestStreak:    number
  totalFixed:    number
  subjectAccuracy: { subjectId: string; answered: number; accuracy: number }[]
  allPassed80:   boolean
}

export interface WeeklyEntry {
  rank:   number
  userId: string
  name:   string
  score:  number
  league: string
  isYou:  boolean
}

export interface LeagueWeekly {
  entries:   WeeklyEntry[]
  myLeague:  string | null
  weekStart: string
}

export interface LeaderboardEntry {
  rank:   number
  userId: string
  name:   string
  score:  number
  streak: number
  isYou:  boolean
}


