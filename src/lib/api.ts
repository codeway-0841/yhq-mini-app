import { config } from '../config'
import { FullProfileSchema } from '../../shared/contracts/profile'

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

/** Telegram WebApp initData — sent with every request for server-side verification. */
function getInitData(): string | undefined {
  const tg = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
  return tg?.initData || undefined
}

/**
 * Timeout signal compatible with older Telegram WebViews
 * (AbortSignal.timeout is not available everywhere).
 */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body) headers['Content-Type'] = 'application/json'
  const initData = getInitData()
  if (initData) headers['x-telegram-init-data'] = initData

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(TIMEOUT_MS),
  })
  if (!res.ok) {
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
}

export interface FullProfile {
  user: ApiUser
  progress: ApiProgress
  settings: ApiSettings
  /** Composite kalitlar: `${subjectId}:${questionId}` ('yhq:123') — multi-fan identity */
  savedQuestions: string[]
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

  // ── Admin (savollar CRUD) — faqat is_admin=true foydalanuvchilarga ──
  /** TO'LIQ qatorlar (correctAnswer bilan) — public /questions endi javobsiz */
  getAdminQuestions: () =>
    request<AdminDbQuestion[]>('GET', '/admin/questions'),
  createQuestion: (data: Omit<AdminDbQuestion, 'id'> & { id?: number }) =>
    request<{ id: number; created: true }>('POST', '/admin/questions', data),
  updateQuestion: (id: number, data: Omit<AdminDbQuestion, 'id'>) =>
    request<{ id: number; updated: true }>('PUT', `/admin/questions/${id}`, data),
  deleteQuestion: (id: number) =>
    request<void>('DELETE', `/admin/questions/${id}`),
  getQuestionsMeta: () =>
    request<{ total: number; withTopic: number }>('GET', '/admin/questions/meta'),
}

/** POST /result javobi — SERVER tekshiruvi (client endi to'g'ri javobni bilmaydi). */
export interface ResultResponse {
  ok: true
  correct: boolean
  /** Post-answer reveal — javob bergandan keyingina ochiladi */
  correctAnswer: string
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
