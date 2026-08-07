const BASE = '/api'
const TIMEOUT_MS = 8000

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
    throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function uid(userId: string) {
  return encodeURIComponent(userId)
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
  savedQuestions: number[]
}

export interface DbQuestion {
  id: number
  questionUz: string
  questionRu: string
  optionsUz: Record<string, string>
  optionsRu: Record<string, string>
  correctAnswer: string
  image: string | null
  topicId: number | null
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
  correct: string
  topicId: number | null
}

export function dbToQuestion(q: DbQuestion, lang: 'uz' | 'ru'): Question {
  const text    = lang === 'ru' ? q.questionRu : q.questionUz
  const optMap  = lang === 'ru' ? q.optionsRu  : q.optionsUz
  const options = Object.entries(optMap).map(([id, text]) => ({ id, text }))
  return { id: q.id, text, image: q.image, options, correct: q.correctAnswer, topicId: q.topicId }
}

export const api = {
  init: (data: {
    id: string
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
    start_param?: string
  }) => request<FullProfile>('POST', '/init', data),

  getProfile: (userId: string) =>
    request<FullProfile>('GET', `/profile/${uid(userId)}`),

  postResult: (userId: string, correct: boolean, questionId?: number) =>
    request<{ ok: true }>('POST', `/progress/${uid(userId)}/result`, { correct, questionId }),

  patchProgress: (userId: string, patch: Partial<ApiProgress>) =>
    request<{ ok: true }>('PATCH', `/progress/${uid(userId)}`, patch),

  patchSettings: (userId: string, patch: Partial<ApiSettings>) =>
    request<{ ok: true }>('PATCH', `/settings/${uid(userId)}`, patch),

  addSaved: (userId: string, questionId: number) =>
    request<{ ok: true }>('POST', `/saved/${uid(userId)}`, { questionId }),

  removeSaved: (userId: string, questionId: number) =>
    request<{ ok: true }>('DELETE', `/saved/${uid(userId)}/${encodeURIComponent(questionId)}`),

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

  addDailyFix: (userId: string, data: { date: string; subjectId: string }) =>
    request<{ ok: true }>('POST', `/daily/${uid(userId)}/fix`, data),

  getAchievements: (userId: string) =>
    request<{ stats: AchievementStats }>('GET', `/achievements/${uid(userId)}`),

  touchDailyActivity: (userId: string, data: { date: string; subjectId: string; answered?: number; correct?: number }) =>
    request<{ ok: true; dailyStreak: number }>('POST', `/daily/${uid(userId)}/activity`, data),

  // ── Admin (savollar CRUD) — faqat is_admin=true foydalanuvchilarga ──
  createQuestion: (data: Omit<DbQuestion, 'id'> & { id?: number }) =>
    request<{ id: number; created: true }>('POST', '/admin/questions', data),
  updateQuestion: (id: number, data: Omit<DbQuestion, 'id'>) =>
    request<{ id: number; updated: true }>('PUT', `/admin/questions/${id}`, data),
  deleteQuestion: (id: number) =>
    request<void>('DELETE', `/admin/questions/${id}`),
  getQuestionsMeta: () =>
    request<{ total: number; withTopic: number }>('GET', '/admin/questions/meta'),
}

export interface DailyState {
  record: { date: string; subjectId: string; answered: number; correct: number; challengeDone: boolean } | null
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
