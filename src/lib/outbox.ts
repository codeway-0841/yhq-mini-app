/**
 * Offline Sync Center — mutation outbox (USER-SCOPED).
 *
 * Offline bajarilgan mutation'lar (test javobi, bookmark, xato-tuzatish)
 * avval lokal navbatga yoziladi (`yhq-outbox:<userId>`), internet qaytganda
 * ketma-ket serverga yuboriladi. Har akkaunt alohida navbatga ega —
 * account switch'da boshqa user'ning navbati BEGONA nomdan yuborilmaydi
 * (kalit userId bilan namespace'langan).
 *
 * Retry siyosati:
 *  - tarmoq xatosi / 5xx / 429  → navbatda qoladi, keyingi flush'da qayta
 *    uriniladi (ketma-ketlik saqlanadi);
 *  - 4xx (server qat'iy rad etdi) → yozuv TASHLAB YUBORILADI (qayta yuborish
 *    befoyda, cheksiz loop'ga olib kelardi);
 *  - MAX_ATTEMPTS dan oshsa → tashlab yuboriladi (zombi yozuv himoyasi).
 *
 * Cheklov: so'rov serverga yetib borgan, lekin javob yo'qolgan holatda
 * replay qo'shni hisobini ikki marta oshirishi mumkin (haqiqiy idempotency
 * uchun server tarafda idempotency-key kerak — keyingi qadam).
 */

import { api, ApiError } from './api'

export type OutboxType = 'result' | 'saved-add' | 'saved-remove' | 'daily-fix'

export interface OutboxEntry {
  id:         string
  type:       OutboxType
  payload:    Record<string, unknown>
  attempts:   number
  lastError?: string
  createdAt:  number
}

const MAX_ATTEMPTS = 25

function storageKey(userId: string): string {
  return `yhq-outbox:${userId}`
}

function load(userId: string): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as OutboxEntry[]) : []
  } catch {
    return []
  }
}

function persist(userId: string, entries: OutboxEntry[]): void {
  try {
    if (entries.length === 0) localStorage.removeItem(storageKey(userId))
    else localStorage.setItem(storageKey(userId), JSON.stringify(entries))
  } catch { /* quota/private mode — xotiradagi navbat bilan davom */ }
}

// ── UI bildirishnomasi (React useSyncExternalStore uchun) ──────────────────
let version = 0
const listeners = new Set<() => void>()

export function onOutboxChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify(): void {
  version++
  for (const fn of listeners) fn()
}

export function getOutboxEntries(userId: string): OutboxEntry[] {
  void version // snapshot o'zgarishini React'ga ko'rsatish uchun
  return load(userId)
}

export function getOutboxCount(userId: string): number {
  void version
  return load(userId).length
}

function newId(): string {
  try { return crypto.randomUUID() } catch { /* eski WebView */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ── Executor'lar — har bir outbox turi uchun API chaqirig'i ────────────────

/** 'result' yozuvi replay bo'lganda daily streak'ni lokal store'ga qo'llash
 *  (useAppStore ro'yxatdan o'tkazadi — lib → store to'g'ridan-to'g'ri
 *  bog'liqlik bo'lmasligi uchun). */
let resultSyncHandler: ((date: string, subjectId: string, dailyStreak: number) => void) | null = null
export function setResultSyncHandler(fn: typeof resultSyncHandler): void {
  resultSyncHandler = fn
}

async function execute(userId: string, entry: OutboxEntry): Promise<void> {
  const p = entry.payload
  switch (entry.type) {
    case 'result': {
      const res = await api.postResult(userId, {
        questionId:     p.questionId as number,
        selectedAnswer: (p.selectedAnswer as string | null) ?? null,
        subjectId:      p.subjectId as string,
      })
      resultSyncHandler?.(p.date as string, p.subjectId as string, res.dailyStreak)
      return
    }
    case 'saved-add':
      await api.addSaved(userId, p.questionId as number, (p.subjectId as string) ?? 'yhq')
      return
    case 'saved-remove':
      await api.removeSaved(userId, p.questionId as number, (p.subjectId as string) ?? 'yhq')
      return
    case 'daily-fix':
      await api.addDailyFix(userId, { subjectId: p.subjectId as string })
      return
  }
}

/** 4xx — server so'rovni qat'iy rad etgan: qayta yuborish befoyda. */
function isFatalClientError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429
  }
  const m = /→ (\d{3}):/.exec(String((err as Error)?.message ?? err))
  if (!m) return false
  const status = Number(m[1])
  return status >= 400 && status < 500 && status !== 408 && status !== 429
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Mutation'ni navbatga qo'shadi va fonda flush'ni ishga tushiradi. */
export function enqueueOutbox(userId: string, type: OutboxType, payload: Record<string, unknown>): void {
  if (!userId || userId === '0') return
  const entries = load(userId)
  entries.push({ id: newId(), type, payload, attempts: 0, createdAt: Date.now() })
  persist(userId, entries)
  notify()
  void flushOutbox(userId)
}

const flushing = new Set<string>()

/** Yozuvni navbatdan o'chiradi — FRESH load asosida (flush in-flight paytida
 *  qo'shilgan yangi yozuvlar ustidan yozib yuborilmasligi uchun). */
function removeEntry(userId: string, id: string): void {
  persist(userId, load(userId).filter((e) => e.id !== id))
}

/** Yozuvning attempts/lastError'ini yangilaydi — FRESH load asosida. */
function updateEntry(userId: string, id: string, patch: Partial<OutboxEntry>): void {
  persist(userId, load(userId).map((e) => (e.id === id ? { ...e, ...patch } : e)))
}

/** Navbatdagi yozuqlarni KETMA-KET serverga yuboradi (tartib saqlanadi). */
export async function flushOutbox(userId: string): Promise<void> {
  if (!userId || userId === '0' || flushing.has(userId)) return
  if (typeof localStorage === 'undefined') return
  flushing.add(userId)
  try {
    for (;;) {
      const head = load(userId)[0]
      if (!head) break
      try {
        await execute(userId, head)
        removeEntry(userId, head.id)
        notify()
      } catch (err) {
        const msg = String((err as Error)?.message ?? err)
        if (isFatalClientError(err) || head.attempts + 1 >= MAX_ATTEMPTS) {
          // Server rad etdi yoki zombi — navbat qotib qolmasligi uchun tashlaymiz
          console.warn('[outbox] yozuv tashlab yuborildi:', head.type, msg.slice(0, 200))
          removeEntry(userId, head.id)
          notify()
          continue
        }
        // Tarmoq xatosi — saqlab qolamiz, keyingi flush'da davom etadi
        updateEntry(userId, head.id, { attempts: head.attempts + 1, lastError: msg.slice(0, 200) })
        notify()
        break
      }
    }
  } finally {
    flushing.delete(userId)
  }
}
