import { config } from '../config'
import { getInitData, requestFreshInitData } from '../../platform/telegram'
import { getSessionToken, setSessionToken, clearSessionToken, notifySessionExpired } from '../lib/session'
import {
  FullProfileSchema, AuthSessionSchema, AuthResponseSchema, LinkResponseSchema,
} from '../../../shared/contracts/profile'

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
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = TIMEOUT_MS,
  extraHeaders?: Record<string, string>,
  retriedWithInitData = false,
): Promise<T> {
  const headers: Record<string, string> = { ...extraHeaders }
  if (body) headers['Content-Type'] = 'application/json'
  // Auth credential TANLOVI (v2 initData→Bearer exchange): Bearer sessiya
  // USTUVOR — initData faqat BOOTSTRAP credential (POST /init 30-kunlik sessiya
  // chiqaradi). Bearer bo'lmasa initData yuboriladi. Account switch xavfsizligi:
  // ensureAccountOwner yangi TG akkauntida 'yhq-session'ni boot'dan OLDIN
  // tozalaydi — begona token hech qachon yuborilmaydi.
  let sentBearer = false
  let sentInitData = false
  const token = getSessionToken()
  const initData = getInitData()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
    sentBearer = true
  } else if (initData) {
    headers['x-telegram-init-data'] = initData
    sentInitData = true
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err: any) {
    if (controller.signal.aborted) {
      throw new ApiError(
        408,
        `So'rov vaqti tugadi (${Math.round(timeoutMs / 1000)} soniya). Iltimos, qayta urinib ko'ring.`,
        'timeout'
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    // Server { error: '<code>' } JSON qaytarsa — typed code sifatida chiqaramiz
    let code: string | undefined
    try { code = (JSON.parse(text) as { error?: unknown }).error as string | undefined } catch { /* text javob */ }
    // 401 FAQAT auth middleware'ining 'invalid_session' kodida sessiyani o'chiradi.
    // BIZNES-logika 401'lari (invalid_credentials / invalid_otp /
    // invalid_current_password — server/modules/auth/*) joriy sessiyani BUZMAYDI:
    // aks holda Profil'da bitta xato parol/OTP yozish = TO'LIQ LOGOUT bo'lardi.
    // (server/middleware/auth.ts 401 kodlari: 'invalid_session' = Bearer sessiya
    // yaroqsiz; 'Invalid Telegram initData signature' = initData eskirgan/soxta).
    // Bearer bilan yuborilgan so'rov → token eskirgan/revoke:
    //  - TG muhitida (initData bor): LOGOUT EMAS — token jim o'chiriladi va
    //    so'rov initData bilan BIR MARTA qayta yuboriladi (keyingi /init yangi
    //    Bearer chiqaradi). 401 = so'rov serverda BAJARILMAGAN — qayta yuborish
    //    xavfsiz (mutatsiyalar clientToken bilan idempotent).
    //  - initData'siz muhitda (brauzer/APK): App login holatiga o'tadi
    //    ('yhq:session-expired').
    if (sentBearer && res.status === 401 && code === 'invalid_session') {
      if (initData && !retriedWithInitData) {
        clearSessionToken()
        return request<T>(method, path, body, timeoutMs, extraHeaders, true)
      }
      notifySessionExpired()
    }
    // initData bilan yuborilgan so'rov 401 → auth_date eskirgan (server replay
    // oynasi qisqartirildi). Mini App'ni BIR marta qayta yuklab Telegram'dan
    // yangi initData olamiz (loop guard — P1-4 klient recovery).
    if (sentInitData && res.status === 401 && code === 'Invalid Telegram initData signature') requestFreshInitData()
    throw new ApiError(res.status, `${method} ${path} → ${res.status}: ${text}`, typeof code === 'string' ? code : undefined)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function uid(userId: string) {
  return encodeURIComponent(userId)
}

/**
 * Global avatar src'ini hosil qiladi:
 *  - server-relative yo'l ('/api/avatar/...', duel WS payload'dan) → API base'ga ulash
 *  - hasCustomAvatar → GET /api/avatar/:id (keshlanadi, CDN)
 *  - aks holda TG photo_url (absolyut http) yoki null (harf fallback)
 */
export function avatarSrcFor(
  user: { id?: string; userId?: string; photoUrl?: string | null; hasCustomAvatar?: boolean | null } | null | undefined,
): string | null {
  if (!user) return null
  if (user.hasCustomAvatar) {
    const id = user.id ?? user.userId
    if (id) return `${config.apiBaseUrl}/avatar/${uid(id)}`
  }
  const p = user.photoUrl ?? ''
  return p || null
}

/** Duel WS payload'dan kelgan tayyor yo'l ('/api/avatar/...' yoki absolyut http). */
export function resolveAvatarPath(path: string | null | undefined): string | null {
  if (!path) return null
  return path.startsWith('/') ? `${config.apiBaseUrl}${path}` : path
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
  /** Qo'lda yuklangan avatar bormi — rasm uchun avatarSrcFor(user) ishlating */
  hasCustomAvatar?: boolean
  phone: string | undefined
  tariff: 'free' | 'premium'
  premiumUntil?: string | null
  /** Admin panel (savol CRUD) huquqi */
  isAdmin?: boolean
  /** SMS marketing roziligi (opt-in) — faqat user o'zi yoqadi */
  smsOptIn?: boolean
  /** #40: coin balansi (server SSOT — client faqat ko'rsatadi, o'zi yozmaydi) */
  coins?: number
  /** #40: do'konda sotib olingan buyum id'lari (shared/shop-items) */
  ownedItems?: string[]
  /** #40: joriy avatar ramkasi id (avatar-frames config) yoki null */
  avatarFrame?: string | null
}

export interface ApiProgress {
  totalCorrect: number
  totalWrong: number
  totalAnswered: number
  streak: number
  /** Wrong-answer counts keyed by question id. */
  wrongByTicket: Record<string, number>
  solvedQuestions?: string[]
  /** Umrbod XP — level shundan hisoblanadi (shared/xp.ts). Eski server: undefined */
  xp?: number
  /** Haftalik liga darajasi (server hisobi, cron yuritadi). Eski server: undefined */
  league?: 'bronze' | 'silver' | 'gold' | 'platinum'
}

export interface ApiSettings {
  autoNextCorrect: boolean
  autoNextWrong: boolean
  noAnimation: boolean
  shuffleOptions: boolean
  fontSize: 'small' | 'medium' | 'large'
  fontStyle: 'default' | 'jakarta' | 'rounded' | 'grotesk' | 'serif' | 'mono'
  language: 'uz' | 'ru'
  theme: 'dark' | 'light' | 'system'
  offlineMode: boolean
  dailyReminder?: boolean
  dailyReminderTime?: string
}

export interface FullProfile {
  user: ApiUser
  progress: ApiProgress
  settings: ApiSettings
  /** Composite kalitlar: `${subjectId}:${questionId}` ('yhq:123') — multi-fan identity */
  savedQuestions: string[]
  /** initData→Bearer exchange (v2): FAQAT sessiyasiz init javobida keladi. */
  sessionToken?: string
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
  /**
   * Serverless backend'ni "uyg'otish" — fire-and-forget (javob MUHIM EMAS).
   *
   * Vercel funksiyasi + Neon DB idle'dan keyin SUSPEND bo'ladi: birinchi real
   * so'rov (masalan, testdagi 1-javob POST /result) cold start tufayli 5-8s
   * kutadi — 8s client timeout yoki server xatosiga urilib, javob "offline"ga
   * (outbox) tushib qolardi. Test sahifasi ochilganda shu ping yuboriladi:
   * user 1-savolni o'qib javob berguncha backend isib QOLADI. `/ready` DB
   * ping qiladi (`SELECT 1`) — ya'ni funksiya HAM, Neon compute HAM uyg'onadi
   * (`/health` DB'ga tegmaydi, u yetarli emas). Auth'siz public endpoint.
   */
  warmUp: (): void => {
    fetch(`${config.apiBaseUrl}/ready`).catch(() => {})
  },

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

  // Server FAQAT GET /auth/verify-email?token= qabul qiladi (auth.router.ts) —
  // email'dagi link brauzerda GET sifatida ochiladi, client ham shu kontraktga mos.
  verifyEmail: (token: string) =>
    request<{ verified: boolean; userId: string }>('GET', `/auth/verify-email?token=${encodeURIComponent(token)}`),

  resendEmailVerification: (email: string) =>
    request<{ ok: true }>('POST', '/auth/resend-verification', { email }),

  requestPasswordReset: (email: string) =>
    request<{ ok: true }>('POST', '/auth/forgot-password', { email }),

  // Server zod schemsi { token, password } kutadi (auth.router.ts ResetPasswordSchema).
  resetPassword: (token: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/reset-password', { token, password: newPassword }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/change-password', { currentPassword, newPassword }),

  // ── Auth — phone + password (OTP tasdiqlash bilan) ────────────────────────
  /** Register: SMS kod bilan tasdiqlangandan keyin (raqam egasi isboti). */
  registerPhone: (data: { phone: string; password: string; firstName: string; otp: string }) =>
    request<unknown>('POST', '/auth/phone/register', data).then(parseAuthResponse),

  loginPhone: (data: { phone: string; password: string }) =>
    request<unknown>('POST', '/auth/phone/login', data).then(parseAuthResponse),

  loginTelegramWidget: (fields: TelegramWidgetFields) =>
    request<unknown>('POST', '/auth/telegram', fields).then(parseAuthResponse),

  createTelegramLogin: () =>
    request<{ code: string; url: string | null; expiresInSeconds: number }>('POST', '/auth/telegram-login', {}),

  checkTelegramLogin: async (code: string) => {
    // Kod HEADER'da yuboriladi — URL path'da yurmaydi (log'ga/proxy'ga tushmaydi)
    const res = await request<unknown>('GET', '/auth/telegram-login', undefined, undefined, {
      'X-Login-Code': code,
    })
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
  linkPhone: (data: { phone: string; password: string; firstName?: string; otp?: string }) =>
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
    request<unknown>('POST', '/init', data).then((raw) => {
      const profile = parseProfile(raw)
      // initData→Bearer exchange (v2): server sessiyasiz (initData'li) init'da
      // 30-kunlik token chiqaradi — saqlab qo'yamiz, keyingi so'rovlar Bearer bilan.
      if (profile.sessionToken) setSessionToken(profile.sessionToken)
      return profile
    }),

  getProfile: (userId: string): Promise<FullProfile> =>
    request<unknown>('GET', `/profile/${uid(userId)}`).then(parseProfile),

  postResult: (userId: string, data: {
    questionId: number
    selectedAnswer: string | null
    subjectId: string
    /** Outbox idempotency kaliti — replay counterlarni qayta yozmaydi */
    clientToken?: string
    /** Savol ko'rsatilgandan javobgacha ketgan vaqt (ms) — statistika uchun */
    elapsedMs?: number
  }) => request<ResultResponse>(
    'POST', `/progress/${uid(userId)}/result`, data,
  ),

  /** Referal statistikasi (Profil kartasi).
   *  Server javobi: getStats + {rewardDays, cap} (users.router.ts) — kontrakt
   *  drift'ini olib tashladik (audit C5). */
  getReferrals: (userId: string): Promise<{
    invited: number
    rewarded: number
    pending: number
    rewardDays: number
    cap: number
  }> => request('GET', `/referrals/${uid(userId)}`),

  patchSettings: (userId: string, patch: Partial<ApiSettings>) => {
    const serverPatch = { ...patch }
    if (serverPatch.fontStyle && serverPatch.fontStyle !== 'serif' && serverPatch.fontStyle !== 'mono') {
      serverPatch.fontStyle = 'default'
    }
    return request<{ ok: true }>('PATCH', `/settings/${uid(userId)}`, serverPatch)
  },

  addSaved: (userId: string, questionId: number, subjectId: string) =>
    request<{ ok: true }>('POST', `/saved/${uid(userId)}`, { questionId, subjectId }),

  removeSaved: (userId: string, questionId: number, subjectId: string) =>
    request<{ ok: true }>(
      'DELETE',
      `/saved/${uid(userId)}/${encodeURIComponent(questionId)}?subject=${encodeURIComponent(subjectId)}`,
    ),

  resetProgress: (userId: string) =>
    request<{ ok: true }>('DELETE', `/progress/${uid(userId)}`),

  /** H-2 (audit): server endi phone'ni FAQAT SMS OTP isbotidan keyin yozadi.
   *  Oqim: requestOTP({phone}) → SMS kod → updatePhone(userId, phone, otp). */
  updatePhone: (userId: string, phone: string, otp: string) =>
    request<{ ok: true }>('PATCH', `/users/${uid(userId)}/phone`, { phone, otp }),

  /** Custom avatar yuklash (256px WebP/JPEG data URL) — server global manba bo'ladi.
   *  Timeout 20s: ~100KB'lik body sekin mobil uplink + Vercel/Neon cold start'da
   *  default 8s'ga sig'may qolardi — user "aloqa xatosi" ko'rardi. */
  uploadAvatar: (userId: string, image: string) =>
    request<{ ok: true }>('PUT', `/users/${uid(userId)}/avatar`, { image }, 20_000),

  /** Custom avatarni o'chirish (harf/TG avatar fallback'ga qaytish). */
  removeAvatar: (userId: string) =>
    request<{ ok: true }>('DELETE', `/users/${uid(userId)}/avatar`, undefined, 20_000),

  /** 3 kunlik bepul Premium trial (FAQAT 1 marta — backend tekshiradi) */
  startTrial: (userId: string) =>
    request<{ granted: boolean; reason?: 'already_used'; days: number }>('POST', `/users/${uid(userId)}/trial`, {}),

  /** Telegram bot orqali sertifikat jo'natish (100% ishonchli bot delivery) */
  sendCertificate: (payload: {
    imageBase64: string
    certId: string
    subjectName: string
    score?: number
    total?: number
    percent?: number
  }) => request<{ success: boolean; sentToTelegram: boolean; message?: string }>('POST', '/certificate/send', payload),

  /** Umumiy rasm-natija ulashish (#48): Telegram WebView'da navigator.share/download
   *  ishlamaydi — bot user chatiga yuboradi, user u yerdan forward qiladi. */
  sendShareImage: (payload: { imageBase64: string; caption: string; fileName?: string }) =>
    request<{ ok: boolean; sentToTelegram: boolean; message?: string }>('POST', '/share/image', payload),

  getQuestions: (subject?: string, fresh = false) => {
    const params = new URLSearchParams()
    if (subject) params.set('subject', subject)
    // Admin CRUD'dan keyin: browser (1h) + Vercel CDN (24h) cache'ni chetlab o'tish
    if (fresh) params.set('_t', String(Date.now()))
    const qs = params.toString()
    return request<DbQuestion[]>('GET', `/questions${qs ? `?${qs}` : ''}`)
  },
  getExplanation: (questionId: number, lang: 'uz' | 'ru' = 'uz') =>
    request<{ questionId: number; text: string }>('GET', `/questions/${encodeURIComponent(questionId)}/explanation?lang=${lang}`),

  getTopics: (subject?: string, fresh = false) => {
    const params = new URLSearchParams()
    if (subject) params.set('subject', subject)
    if (fresh) params.set('_t', String(Date.now()))
    const qs = params.toString()
    return request<DbTopic[]>('GET', `/topics${qs ? `?${qs}` : ''}`)
  },

  getLeaderboard: (limit: number, userId?: string, mode?: 'daily' | 'monthly' | 'all') =>
    request<LeaderboardEntry[]>(
      'GET',
      `/leaderboard?limit=${limit}${mode && mode !== 'all' ? `&mode=${mode}` : ''}${userId ? `&userId=${uid(userId)}` : ''}`
    ),

  getLeaderboardDaily: (limit: number, userId?: string) =>
    request<LeaderboardEntry[]>(
      'GET',
      `/leaderboard?limit=${limit}&mode=daily${userId ? `&userId=${uid(userId)}` : ''}`
    ),

  getLeaderboardMonthly: (limit: number, userId?: string) =>
    request<LeaderboardEntry[]>(
      'GET',
      `/leaderboard?limit=${limit}&mode=monthly${userId ? `&userId=${uid(userId)}` : ''}`
    ),

  getLeaderboardDuel: (limit: number, userId?: string, timeframe?: 'daily' | 'weekly' | 'monthly' | 'all') =>
    request<DuelLeaderboardEntry[]>(
      'GET',
      `/leaderboard?limit=${limit}&mode=duel${timeframe && timeframe !== 'all' ? `&timeframe=${timeframe}` : ''}${userId ? `&userId=${uid(userId)}` : ''}`
    ),

  getOnlinePlayers: (userId?: string) =>
    request<LeaderboardEntry[]>(
      'GET',
      `/leaderboard?mode=online${userId ? `&userId=${uid(userId)}` : ''}`
    ),

  getLeagueWeekly: (limit: number, userId?: string) =>
    request<LeagueWeekly>(
      'GET',
      `/leaderboard?limit=${limit}&mode=weekly${userId ? `&userId=${uid(userId)}` : ''}`
    ),

  getTournamentWinners: () =>
    request<{
      ok: boolean
      winners: Array<{
        periodKey: string
        rank: number
        userId: string
        name: string
        score: number
        league: string
        prizeDays: number
      }>
    }>('GET', '/leaderboard/tournament-winners'),

  /** Chempionlar tarixi (#47): o'tgan N haftalik turnir g'oliblari (eng yangi birinchi). */
  getTournamentHistory: (limit: number, userId?: string) =>
    request<{ ok: boolean; seasons: TournamentSeason[] }>(
      'GET',
      `/leaderboard/tournament-history?limit=${limit}${userId ? `&userId=${uid(userId)}` : ''}`
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
    request<{ ok: true; dailyStreak: number; coinSaved?: boolean }>('POST', `/daily/${uid(userId)}/activity`, data),

  // ── Spaced Repetition (Adaptive Mode) Cards ────────────────────────────
  getCards: (userId: string, subjectId: string) =>
    request<{ ok: true; cards: Record<number, { questionId: number; ef: number; interval: number; reps: number; dueAt: number }> }>(
      'GET',
      `/progress/${uid(userId)}/cards?subjectId=${encodeURIComponent(subjectId)}`
    ),

  /** SR dashboard: bugun/ertaga/hafta prognozi (#46) */
  getCardsSummary: (userId: string, subjectId: string) =>
    request<{ ok: true; summary: { total: number; dueNow: number; dueNext24h: number; dueNext7d: number; avgEf: number | null } }>(
      'GET',
      `/progress/${uid(userId)}/cards/summary?subjectId=${encodeURIComponent(subjectId)}`
    ),

  reviewCard: (userId: string, data: { subjectId: string; questionId: number; ef: number; interval: number; reps: number; dueAt: number }) =>
    request<{ ok: true }>('POST', `/progress/${uid(userId)}/cards/review`, data),

  // ── Do'kon / Coins (#40) — userId server'da sessiyadan (client yubormaydi) ──
  purchaseItem: (data: { itemId: string; purchaseId: string }) =>
    request<PurchaseResponse>('POST', '/coins/purchase', data),

  equipFrame: (itemId: string | null) =>
    request<{ ok: true; avatarFrame: string | null }>('POST', '/coins/equip', { itemId }),

  getCoinHistory: () =>
    request<{ ok: true; rows: CoinTransactionRow[] }>('GET', '/coins/history'),

  /** Kunlik vazifalar holati (progress server aggregate'idan) */
  getCoinTasks: () =>
    request<{ ok: true; date: string; tasks: CoinTaskState[] }>('GET', '/coins/tasks'),

  /** Mukofotni olish — atomik, 1/kun (409 TASK_NOT_COMPLETED / TASK_ALREADY_CLAIMED) */
  claimCoinTask: (taskId: string) =>
    request<{ ok: true; balance: number; reward: number }>('POST', '/coins/claim-task', { taskId }),

  // ── Lucky Spin (kunlik omad g'ildiragi) ──
  getSpinState: () =>
    request<{ ok: true; date: string; spun: boolean; rewardId: string | null }>('GET', '/coins/spin'),

  /** Segment FAQAT server'da tanlanadi (409 SPIN_ALREADY_USED_TODAY) */
  spinWheel: () =>
    request<{
      ok: true
      segment: { id: string; kind: 'coins' | 'premium-days'; amount: number }
      balance: number | null
      premiumUntil: string | null
    }>('POST', '/coins/spin'),

  // ── Boss Battle (haftalik jamoaviy jang) — faqat o'qish ──
  getBossState: () =>
    request<{
      ok: true
      periodKey: string
      bossId: number
      bossKey: string
      hpTotal: number
      hpLeft: number
      status: 'active' | 'defeated' | 'escaped'
      myDamage: number
      totalDamage: number
      top: { userId: string; firstName: string; photoUrl: string | null; hasCustomAvatar: boolean; damage: number }[]
    }>('GET', '/boss/state'),

  // ── Merch (#40 Faza 3) ─────────────────────────────────────────────────
  getMerchCatalog: () =>
    request<{ ok: true; items: MerchCatalogItem[] }>('GET', '/coins/merch'),

  buyMerch: (data: { itemId: string; purchaseId: string; fullName: string; phone: string; note?: string | null }) =>
    request<{ ok: true; duplicate: boolean; orderId: number | null; balance: number }>('POST', '/coins/buy-merch', data),

  getMyMerchOrders: () =>
    request<{ ok: true; rows: MerchOrderRow[] }>('GET', '/coins/merch-orders'),

  // Admin:
  getAdminMerchOrders: (status?: string) =>
    request<{ ok: true; rows: AdminMerchOrderRow[] }>('GET', `/admin/merch-orders${status ? `?status=${status}` : ''}`),

  setMerchOrderStatus: (id: number, status: 'contacted' | 'delivered') =>
    request<{ ok: true; id: number; status: string }>('PATCH', `/admin/merch-orders/${id}/status`, { status }),

  cancelMerchOrder: (id: number) =>
    request<{ ok: true; id: number; status: string }>('POST', `/admin/merch-orders/${id}/cancel`),

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
      optionsUz: Record<string, string> | Array<{ id: string; text: string }>
      optionsRu: Record<string, string> | Array<{ id: string; text: string }>
      correctAnswer: string
      image?: string | null
      topicId?: number | null
    }>
  }) =>
    request<{ ok?: boolean; success?: boolean; count: number }>('POST', '/admin/questions/bulk-import', data, 90_000),

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

  // ── SMS marketing (opt-in) ─────────────────────────────────────────────────
  setSmsConsent: (userId: string, optIn: boolean) =>
    request<{ ok: true }>('PATCH', `/users/${uid(userId)}/sms-consent`, { optIn }),

  getSmsAudience: () =>
    request<{ optedIn: number }>('GET', '/admin/sms/audience'),
  createSmsCampaign: (data: { title: string; message: string }) =>
    request<{ ok: true; campaign: AdminSmsCampaign }>('POST', '/admin/sms/campaigns', data),
  getSmsCampaigns: () =>
    request<{ campaigns: AdminSmsCampaign[] }>('GET', '/admin/sms/campaigns'),
  sendSmsCampaignChunk: (id: number) =>
    request<{
      ok: true
      status: AdminSmsCampaign['status']
      batchSent: number
      batchFailed: number
      remaining: number
      campaign: AdminSmsCampaign
    }>('POST', `/admin/sms/campaigns/${id}/send`, {}),

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
    }>('POST', '/admin/broadcast', data, 90_000),

  // ── Admin TG Broadcast — CHUNKED kampaniya (M-5, resumable) ────────────
  createTgBroadcast: (data: {
    segment: 'all' | 'free' | 'premium' | 'inactive_7d' | 'active_today'
    message: string
    imageUrl?: string | null
    buttonText?: string | null
    buttonUrl?: string | null
  }) =>
    request<{ ok: boolean; broadcast: AdminTgBroadcast }>('POST', '/admin/tg-broadcasts', data),
  getTgBroadcasts: () =>
    request<{ broadcasts: AdminTgBroadcast[] }>('GET', '/admin/tg-broadcasts'),
  sendTgBroadcastChunk: (id: number) =>
    request<{ ok: boolean; status: string; batchSent: number; batchBlocked: number; batchFailed: number; remaining: number; broadcast: AdminTgBroadcast }>(
      'POST', `/admin/tg-broadcasts/${id}/dispatch`, {}, 60_000,
    ),

  generateAiQuestions: (data: {
    mode: 'custom_text' | 'topic'
    subjectId: string
    subjectName?: string
    promptText: string
    count?: number
    difficulty?: 'easy' | 'medium' | 'hard' | 'mixed'
    language?: 'uz' | 'ru' | 'both'
  }) =>
    request<{
      ok: boolean
      count: number
      questions: Array<{
        questionUz: string
        questionRu: string
        optionsUz: Array<{ id: string; text: string }>
        optionsRu: Array<{ id: string; text: string }>
        correctAnswer: string
        explanation?: string
      }>
    }>('POST', '/admin/ai/generate-questions', data, 90_000),
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

export interface AdminSmsCampaign {
  id: number
  title: string
  message: string
  status: 'draft' | 'sending' | 'sent'
  targetCount: number
  sentCount: number
  failedCount: number
  createdAt: string
  finishedAt: string | null
}

export interface AdminTgBroadcast {
  id: number
  segment: string
  message: string
  imageUrl: string | null
  buttonText: string | null
  buttonUrl: string | null
  status: 'draft' | 'sending' | 'sent'
  targetCount: number
  sentCount: number
  blockedCount: number
  failedCount: number
  createdAt: string
  finishedAt: string | null
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
  /** #40: shu javob uchun mint bo'lgan tangalar (0/1) — faqat yangi javobda */
  coinsEarned?: number
  /** #40: mint'dan keyingi server balansi (wrong javobda null) */
  coinBalance?: number | null
  /** Streak coin-save: shu javob uzilgan seriyani 50 coin evaziga saqladi */
  coinSaved?: boolean
  /** Umrbod XP (server hisobi) va shu javobda berilgani */
  xp?: number | null
  xpEarned?: number
}

/** Do'kon xaridi javobi (#40) */
export interface PurchaseResponse {
  ok: true
  /** Idempotent retry (xuddi shu purchaseId) — double-debit YO'Q */
  duplicate: boolean
  /** Xariddan keyingi balans */
  balance: number
  /** premium-days consumable uchun yangilangan muddat */
  premiumUntil: string | null
}

/** Coin tranzaksiyasi (tarix ko'rinishi) */
export interface CoinTransactionRow {
  delta: number
  reason: string
  refId: string
  createdAt: string
}

/** Kunlik vazifa holati (#40 Faza 2) — server aggregate (client raqami ishonchsiz) */
export interface CoinTaskState {
  id: string
  metric: 'answered' | 'correct' | 'fixed'
  target: number
  reward: number
  progress: number
  completed: boolean
  claimed: boolean
}

/** Merch katalog itemi — server hisoblagan stock + user holati (#40 Faza 3) */
export interface MerchCatalogItem {
  id: string
  price: number
  remaining: number
  alreadyOwned: boolean
}

/** Merch buyurtma qatori */
export interface MerchOrderRow {
  id: number
  itemId: string
  pricePaid: number
  status: 'new' | 'contacted' | 'delivered' | 'cancelled'
  createdAt: string
}

/** Admin merch buyurtma qatori (user ismi bilan) */
export interface AdminMerchOrderRow {
  id: number
  user_id: string
  first_name: string
  item_id: string
  full_name: string
  phone: string
  note: string | null
  price_paid: number
  status: string
  created_at: string
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
  /** Global avatar manbalari (avatarSrcFor bilan ishlating) */
  photoUrl?:        string | null
  hasCustomAvatar?: boolean
  /** Joriy avatar ramkasi id (avatar-frames config) — do'kon kosmetikasi */
  avatarFrame?:     string | null
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
  photoUrl?:        string | null
  hasCustomAvatar?: boolean
  avatarFrame?:     string | null
}

/** Duel (Oktagon) reytingi qatori — score = davr ichidagi g'alabalar soni */
export interface DuelLeaderboardEntry extends LeaderboardEntry {
  wins:   number
  losses: number
  draws:  number
  /** Butun foiz (0..100) */
  winRate: number
}

/** Chempionlar tarixi (#47) — bitta davr g'olibi */
export interface TournamentWinner {
  rank:      number
  userId:    string
  name:      string
  score:     number
  league:    string
  prizeDays: number
  isYou:     boolean
  photoUrl?:        string | null
  hasCustomAvatar?: boolean
  avatarFrame?:     string | null
}

/** Bitta haftalik davr + uning podium g'oliblari (rank tartibida) */
export interface TournamentSeason {
  periodKey: string   // 'YYYY-MM-DD' — hafta dushanbasi
  winners:   TournamentWinner[]
}


