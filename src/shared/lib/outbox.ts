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
 *  - tarmoq xatosi / offline → navbatda qoladi, ATTEMPTS SARFLANMAYDI
 *    (serverga yetib bormagan urinish "real" emas — 100-savol offline testda
 *    har enqueue-initsiyalangan flush attempts yeb javoblarni yo'qotardi);
 *  - server JAVOB BERGAN retryable (5xx / 408 / 429) → attempts +1, keyingi
 *    flush'da qayta uriniladi (ketma-ketlik saqlanadi);
 *  - 4xx (server qat'iy rad etdi) → yozuv TASHLAB YUBORILADI (qayta yuborish
 *    befoyda, cheksiz loop'ga olib kelardi);
 *  - MAX_ATTEMPTS dan oshsa → tashlab yuboriladi (zombi yozuv himoyasi).
 *
 * Cheklov YEOLINDI: 'result' yozuvlari endi server-side idempotency token
 * bilan — so'rov yetib borib javob yo'qolsa ham replay counterlarni ikki
 * marta oshirmaydi (answer_tokens jadvali, ON CONFLICT DO NOTHING).
 */

import { api, ApiError } from '../api'

export type OutboxType = 'result' | 'saved-add' | 'saved-remove' | 'daily-fix' | 'card-review'

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

// JSON.parse har RENDER'da chaqirilmasligi uchun o'zgarishsiz xom satr keshlanadi
// (useSyncExternalStore snapshot'i tez bo'lishi kerak — Profil her renderida
//  parse qilgani baker's dozen savoddagi flush keyingi repaint'larini sekinlashtirardi).
const loadCache: { userId: string; raw: string | null; entries: OutboxEntry[] } = {
  userId: '', raw: null, entries: [],
}
function load(userId: string): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (loadCache.userId === userId && loadCache.raw === raw) return loadCache.entries
    const entries = raw ? (JSON.parse(raw) as OutboxEntry[]) : []
    loadCache.userId = userId
    loadCache.raw = raw
    loadCache.entries = entries
    return entries
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
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
export { newId }

// ── Executor'lar — har bir outbox turi uchun API chaqirig'i ────────────────

/** 'result' replay muvaffaqiyatida lokal store yangilanishi uchun.
 *  duplicate=true bo'lsa (server token'ni avval qabul qilgan) — SKIP:
 *  counterlar allaqachon o'sha javob uchun yozilgan. */
export interface ResultSyncInfo {
  date:           string
  subjectId:      string
  questionId:     number
  selectedAnswer: string | null
  correct:        boolean
  correctAnswer?: string | null
  dailyStreak:    number | null
  duplicate:      boolean
  /** Server shu javob bilan uzilgan seriyani coin evaziga saqladi */
  coinSaved?:     boolean
  coinsEarned?:   number
  coinBalance?:   number | null
  xp?:            number | null
}

const resultSyncListeners = new Set<(info: ResultSyncInfo) => void>()

export function onResultSync(fn: (info: ResultSyncInfo) => void): () => void {
  resultSyncListeners.add(fn)
  return () => resultSyncListeners.delete(fn)
}

export function setResultSyncHandler(fn: ((info: ResultSyncInfo) => void) | null): void {
  if (fn) resultSyncListeners.add(fn)
}

async function execute(userId: string, entry: OutboxEntry): Promise<void> {
  const p = entry.payload
  switch (entry.type) {
    case 'result': {
      const res = await api.postResult(userId, {
        questionId:     p.questionId as number,
        selectedAnswer: (p.selectedAnswer as string | null) ?? null,
        subjectId:      p.subjectId as string,
        // Replay XUDDI SHU token bilan — server counterlarni bir martadan
        // ortiq yozmaydi (eski tokensiz yozuvlar: token'siz, bitta shot).
        ...(p.clientToken ? { clientToken: p.clientToken as string } : {}),
        ...(typeof p.elapsedMs === 'number' ? { elapsedMs: p.elapsedMs } : {}),
      })
      const info: ResultSyncInfo = {
        date:           p.date as string,
        subjectId:      p.subjectId as string,
        questionId:     p.questionId as number,
        selectedAnswer: (p.selectedAnswer as string | null) ?? null,
        // duplicate replay'da correct null — counterlar tegilmagan (handler o'zi bilib oladi)
        correct:        res.correct ?? false,
        correctAnswer:  res.correctAnswer,
        dailyStreak:    res.dailyStreak,
        duplicate:      !!res.duplicate,
        coinSaved:      res.coinSaved,
        coinsEarned:    res.coinsEarned,
        coinBalance:    res.coinBalance,
        xp:             res.xp,
      }
      for (const listener of resultSyncListeners) {
        try {
          listener(info)
        } catch (err) {
          console.error('[outbox] resultSync listener error:', err)
        }
      }
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
    case 'card-review':
      await api.reviewCard(userId, {
        subjectId:  (p.subjectId as string) ?? 'yhq',
        questionId: p.questionId as number,
        ef:         p.ef as number,
        interval:   p.interval as number,
        reps:       p.reps as number,
        dueAt:      p.dueAt as number,
      })
      return
  }
}

/** 4xx — server so'rovni qat'iy rad etgan: qayta yuborish befoyda.
 *  Retryable 4xx: only 408 (timeout), 429 (rate limit). */
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
  void atomicUpdate(userId, entries => [
    ...entries,
    { id: newId(), type, payload, attempts: 0, createdAt: Date.now() }
  ]).then(() => {
    notify()
    void flushOutbox(userId)
  }).catch(err => {
    console.error('[outbox] enqueue failed:', err)
  })
}

const flushing = new Set<string>()

const locks = new Map<string, Promise<void>>()

function atomicUpdate(userId: string, fn: (entries: OutboxEntry[]) => OutboxEntry[]): Promise<void> {
  const key = `outbox:${userId}`

  const existing = locks.get(key) ?? Promise.resolve()

  const operation = existing.catch(() => {}).then(() => {
    const entries = load(userId)
    const updated = fn(entries)
    persist(userId, updated)
  })

  locks.set(key, operation)
  operation.finally(() => {
    if (locks.get(key) === operation) locks.delete(key)
  })

  return operation
}

function atomicRead<T>(userId: string, fn: (entries: OutboxEntry[]) => T): Promise<T> {
  const key = `outbox:${userId}`
  const existing = locks.get(key) ?? Promise.resolve()

  const operation = existing.catch(() => {}).then(() => fn(load(userId)))
  const lockPromise = operation.then(() => {}, () => {})

  // Register in locks to serialize with concurrent writes
  locks.set(key, lockPromise)
  lockPromise.finally(() => {
    if (locks.get(key) === lockPromise) locks.delete(key)
  })

  return operation
}

async function removeEntry(userId: string, id: string): Promise<void> {
  await atomicUpdate(userId, entries => entries.filter(e => e.id !== id))
}

async function updateEntry(userId: string, id: string, patch: Partial<OutboxEntry>): Promise<void> {
  await atomicUpdate(userId, entries => entries.map(e => (e.id === id ? { ...e, ...patch } : e)))
}

/** Navbatdagi yozuqlarni KETMA-KET serverga yuboradi (tartib saqlanadi). */
export async function flushOutbox(userId: string): Promise<void> {
  if (!userId || userId === '0' || flushing.has(userId)) return
  if (typeof localStorage === 'undefined') return
  // Offline'da umuman fetch urunmaslik — abort-timeout (8s) kutilmasin,
  // yozuvlar navbatda butun turadi ('online' eventida davom etadi).
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const lock = locks.get(`outbox:${userId}`)
    if (lock) await lock
    return
  }
  flushing.add(userId)
  try {
    for (;;) {
      // Read head via atomicRead to serialize with enqueue (prevent stale read race)
      const head = await atomicRead(userId, entries => entries[0])
      if (!head) break

      try {
        await execute(userId, head)
        await removeEntry(userId, head.id)
        notify()
      } catch (err) {
        const msg = String((err as Error)?.message ?? err)
        if (isFatalClientError(err)) {
          // 4xx — server qat'iy rad etdi: navbat qotib qolmasligi uchun tashlaymiz
          console.warn('[outbox] yozuv tashlab yuborildi (4xx):', head.type, msg.slice(0, 200))
          await removeEntry(userId, head.id)
          notify()
          continue
        }
        if (err instanceof ApiError) {
          // Server JAVOB BERDI (5xx/408/429, retryable) — bu real urinish,
          // attempts shu yerda va FAQAT shu yerda sarflanadi (zombi himoyasi)
          if (head.attempts + 1 >= MAX_ATTEMPTS) {
            console.warn('[outbox] yozuv tashlab yuborildi (max attempts):', head.type, msg.slice(0, 200))
            await removeEntry(userId, head.id)
            notify()
            continue
          }
          await updateEntry(userId, head.id, { attempts: head.attempts + 1, lastError: msg.slice(0, 200) })
          notify()
          break
        }
        // Tarmoq/timeout — serverga yetib bormagan: attempts TEGILMAYDI,
        // faqat diagnostika uchun lastError yangilanadi
        await updateEntry(userId, head.id, { lastError: msg.slice(0, 200) })
        notify()
        break
      }
    }
  } finally {
    flushing.delete(userId)
  }
}
