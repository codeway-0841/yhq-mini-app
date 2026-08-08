/**
 * Auth sessiya tokeni (opaque Bearer) — platform-agnostik kichik store.
 * Telegram Mini App initData'dan MUSTAQIL ikkinchi login yo'li
 * (telefon+parol / TG Login Widget) uchun: token localStorage'da saqlanadi
 * va `Authorization: Bearer` header'iga api qatlami tomonidan qo'yiladi.
 *
 * 401 (invalid_session) bo'lganda `yhq:session-expired` event'i tarqaladi —
 * App.tsx shu event'ga obuna bo'lib akkauntni reset qiladi (LoginPage ko'rinadi).
 * Node/test muhitida window/localStorage bo'lmasligi mumkin — hamma narsa guard'li.
 */

const KEY = 'yhq-session'

export const SESSION_EXPIRED_EVENT = 'yhq:session-expired'
/** Token o'rnatilgan/o'chirilgan — App isAuthed state'ini yangilash uchun. */
export const SESSION_CHANGED_EVENT = 'yhq:session-changed'

export function getSessionToken(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
  } catch {
    return null // private mode
  }
}

export function setSessionToken(token: string): void {
  try {
    localStorage.setItem(KEY, token)
  } catch { /* private mode — token faqat xotirada qolmaydi, login keyinroq so'raladi */ }
  dispatch(SESSION_CHANGED_EVENT)
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(KEY)
  } catch { /* ignore */ }
  dispatch(SESSION_CHANGED_EVENT)
}

/** Server sessiyani rad etdi (401) — token o'chirilib UI login holatiga o'tadi. */
export function notifySessionExpired(): void {
  clearSessionToken()
  dispatch(SESSION_EXPIRED_EVENT)
}

function dispatch(name: string): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(name))
  }
}
