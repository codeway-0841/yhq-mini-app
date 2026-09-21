/**
 * Math Board — chizma persistence (P1-4).
 *
 * Muammo: stroke payload (yuzlab nuqtalar) localStorage'da saqlanardi —
 * 5–10MB kvotani tez to'ldiradi va har yozuvda asosiy thread'da katta JSON
 * stringify yurardi.
 *
 * Yechim:
 * - STROKE PAYLOAD IndexedDB'da (`kivvi-math-board.drawings`, bitta record,
 *   id=sessionKey);
 * - localStorage'da FAQAT kichik metadata markeri (`{version:3, surfaceCount,
 *   updatedAt}`) — kalit o'sha-o'sha (`yhq-test-drawing-v2:<sessionKey>`),
 *   shuning uchun account reset'ning mavjud prefix-tozalash'i meta'ni o'chiradi.
 * - MIGRATION: eski v2 localStorage snapshot (to'liq payload) birinchi
 *   yuklashda IDB'ga ko'chiriladi va meta bilan almashtiriladi.
 * - ACCOUNT RESET himoyasi: meta yo'q, lekin IDB record bor → bu eski akkaunt
 *   chizmasi (meta prefix-clear'da o'chgan) — record o'chirilib bo'sh qaytariladi.
 * - FALLBACK: IndexedDB umuman yo'q bo'lsa (eski WebView/private mode) — eski
 *   localStorage yo'liga qaytadi (funksiya saqlanadi, faqat optimizatsiya yo'q).
 *
 * Xatolik kontrakti: bu modul HECH QACHON throw qilmaydi. `saveBoardDrawings`
 * muvaffaqiyatsizlikda `false` qaytaradi — caller UI'ga non-blocking
 * "saqlanmadi" holatini ko'rsatadi (jim yutish TAQIQLANADI).
 */

import {
  drawingStorageKey,
  loadDrawingSession,
  parseDrawingSessionData,
  serializeDrawingSession,
  surfacesFromDrawings,
} from '../../test'
import type { DrawingHistory, DrawingStroke } from '../../test'

const DB_NAME = 'kivvi-math-board'
const STORE = 'drawings'
/** IDB record format versiyasi — struktura o'zgarsa bump (eski record bekor) */
const FORMAT = 1
/** localStorage metadata versiyasi (2 = eski to'liq payload — migration) */
const META_VERSION = 3

interface DrawingRecord {
  id: string
  format: number
  surfaces: Record<string, DrawingStroke[]>
  updatedAt: number
}

interface DrawingMeta {
  version: typeof META_VERSION
  surfaceCount: number
  updatedAt: number
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, 1)
    } catch {
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      try {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: 'id' })
        }
      } catch { /* store mavjud — muammo emas */ }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
}

function reqPromise<T>(req: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => resolve(null)
  })
}

function txOk(tx: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
    tx.onabort = () => resolve(false)
  })
}

async function getRecord(db: IDBDatabase, id: string): Promise<DrawingRecord | null> {
  const rec = await reqPromise<DrawingRecord>(db.transaction(STORE, 'readonly').objectStore(STORE).get(id))
  return rec && rec.format === FORMAT && rec.surfaces && typeof rec.surfaces === 'object' ? rec : null
}

async function putRecord(db: IDBDatabase, id: string, surfaces: Record<string, DrawingStroke[]>): Promise<boolean> {
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put({ id, format: FORMAT, surfaces, updatedAt: Date.now() } satisfies DrawingRecord)
  return txOk(tx)
}

async function deleteRecord(db: IDBDatabase, id: string): Promise<boolean> {
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(id)
  return txOk(tx)
}

/** localStorage markerini o'qiydi: meta | eski payload | yo'q/buzilgan */
function readLocal(key: string): { kind: 'meta' } | { kind: 'payload'; surfaces: Record<string, DrawingStroke[]> } | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DrawingMeta> & { surfaces?: unknown }
    if (parsed.version === META_VERSION) return { kind: 'meta' }
    if (parsed.version === 2 && parsed.surfaces && typeof parsed.surfaces === 'object') {
      return { kind: 'payload', surfaces: parsed.surfaces as Record<string, DrawingStroke[]> }
    }
    return null
  } catch {
    return null
  }
}

function writeMeta(key: string, surfaceCount: number): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(key, JSON.stringify({ version: META_VERSION, surfaceCount, updatedAt: Date.now() } satisfies DrawingMeta))
    return true
  } catch {
    return false
  }
}

/**
 * Chizmani yuklaydi (reload restore). IDB → (migration) legacy localStorage →
 * bo'sh. HECH QACHON throw qilmaydi; xato bo'lsa bo'sh Map (ilova yiqilmaydi).
 */
export async function loadBoardDrawings(sessionKey: string): Promise<Map<string, DrawingHistory>> {
  try {
    const key = drawingStorageKey(sessionKey)
    const db = await openDb()
    if (!db) return loadDrawingSession(sessionKey) // fallback: eski localStorage yo'li
    try {
      const local = readLocal(key)
      const rec = await getRecord(db, sessionKey)
      if (!rec && local?.kind === 'payload') {
        // MIGRATION: eski localStorage snapshot → IDB + meta almashtirish
        const ok = await putRecord(db, sessionKey, local.surfaces)
        if (ok) writeMeta(key, Object.keys(local.surfaces).length)
        // meta yozilmasa keyingi load yana migrate urinadi — ma'lumot yo'qolmaydi
        return parseDrawingSessionData({ version: 2, surfaces: local.surfaces })
      }
      if (rec && local?.kind === 'payload') {
        // Ikkalasi ham bor (meta yozilmay qolgan) — IDB ustun, meta tiklanadi
        writeMeta(key, Object.keys(rec.surfaces).length)
        return parseDrawingSessionData({ version: 2, surfaces: rec.surfaces })
      }
      if (rec && local === null) {
        // ACCOUNT RESET: meta prefix-clear'da o'chgan — IDB'dagi eski akkaunt
        // chizmasi yangi akkauntga KO'RINMASLIGI shart.
        await deleteRecord(db, sessionKey)
        return new Map()
      }
      return parseDrawingSessionData({ version: 2, surfaces: rec?.surfaces ?? {} })
    } finally {
      db.close()
    }
  } catch {
    return new Map()
  }
}

/**
 * Chizmani saqlaydi. `true` — yozildi; `false` — persist xatosi (kvota/IDB) —
 * caller UI'da non-blocking ogohlantirish ko'rsatadi. IDB+meta atomikligi:
 * meta yozilmasa IDB recordi ham o'chiriladi (aks holda keyingi load uni
 * "account reset" deb o'chirib yuborardi).
 */
export async function saveBoardDrawings(sessionKey: string, drawings: Map<string, DrawingHistory>): Promise<boolean> {
  try {
    const key = drawingStorageKey(sessionKey)
    const surfaces = surfacesFromDrawings(drawings)
    const db = await openDb()
    if (!db) {
      // Fallback: IDB'siz muhit — eski localStorage yo'li (kvota xatosi signal bilan)
      if (typeof localStorage === 'undefined') return false
      try {
        const raw = serializeDrawingSession(drawings)
        if (raw === null) localStorage.removeItem(key)
        else localStorage.setItem(key, raw)
        return true
      } catch {
        return false
      }
    }
    try {
      const ok = Object.keys(surfaces).length === 0
        ? await deleteRecord(db, sessionKey)
        : await putRecord(db, sessionKey, surfaces)
      if (!ok) return false
      if (!writeMeta(key, Object.keys(surfaces).length)) {
        await deleteRecord(db, sessionKey)
        return false
      }
      return true
    } finally {
      db.close()
    }
  } catch {
    return false
  }
}
