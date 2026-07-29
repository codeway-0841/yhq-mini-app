const BASE = '/api'
const TIMEOUT_MS = 8000

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
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
}

export interface ApiProgress {
  totalCorrect: number
  totalWrong: number
  totalAnswered: number
  streak: number
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
  theme: 'dark' | 'light'
  offlineMode: boolean
}

export interface FullProfile {
  user: ApiUser
  progress: ApiProgress
  settings: ApiSettings
  savedQuestions: number[]
}

export const api = {
  init: (data: {
    id: string
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
  }) => request<FullProfile>('POST', '/init', data),

  getProfile: (userId: string) =>
    request<FullProfile>('GET', `/profile/${uid(userId)}`),

  postResult: (userId: string, correct: boolean, ticketId?: number) =>
    request<{ ok: true }>('POST', `/progress/${uid(userId)}/result`, { correct, ticketId }),

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
}
