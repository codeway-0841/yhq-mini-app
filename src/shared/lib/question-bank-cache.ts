/**
 * Question bank persist-keshi (IndexedDB) — "A" bosqichi (2026-09-21 EGRESS).
 *
 * Muammo: Telegram Mini App har ochilishda sahifani qayta yuklaydi va bank
 * faqat RAM'da (modul o'zgaruvchisida) saqlanardi — har launch butun bank
 * (5-13MB) qayta tortilardi.
 *
 * Yechim: bank SERVER VERSIYASI bilan IndexedDB'ga yoziladi (server:
 * GET /questions/version, ~40 bayt). Keyingi launch'da:
 *   - versiya bir xil → bank keshdan o'qiladi, tarmoqda FAQAT versiya so'rovi;
 *   - versiya boshqa → bank qayta tortilib kesh yangilanadi;
 *   - versiya so'rovi yiqilsa (offline) → eskirgan kesh bilan yashanadi.
 *
 * Xavfsizlik: keshda FAQAT /questions public payload'i (correctAnswer'siz) —
 * scoring trust boundary buzilmaydi (bu ma'lumot har user'ga zaten ochiq).
 * Kesh user-specific EMAS (public kontent) — account switch'da tozalanmaydi.
 *
 * MUHIM INVARIANT: bu modul HECH QACHON throw qilmaydi. IndexedDB yo'q
 * bo'lsa (eski WebView, private mode, kvota to'lgan) — ilova jimgina avvalgi
 * "har safar tortish" yo'liga qaytadi. Kesh — optimizatsiya, kritik path emas.
 */
import type { DbQuestion, DbTopic } from '../api'

export interface BankCacheEntry {
  subjectId: string
  /** Server kontent versiyasi (GET /questions/version javobidagi `v`) */
  v: string
  /** /questions public javobi (correctAnswer'siz, ikkala til bir qatorda) */
  raw: DbQuestion[]
  topics: DbTopic[]
  savedAt: number
  /** Client kesh formati — struktura o'zgarsa bump qilinadi (eski entry bekor). */
  format: number
}

const DB_NAME = 'kivvi-bank-cache'
const STORE = 'banks'
/** Format versiyasi — BankCacheEntry strukturasi o'zgarsa OSHIRILADI. */
export const BANK_CACHE_FORMAT = 1
/** LRU chegarasi — ko'p fan almashtiruvchi qurilmada kvota himoyasi
 *  (eng og'ir bank ~13MB × 6 ≈ 80MB — IndexedDB kvotasiga bemalol sig'adi). */
const MAX_ENTRIES = 6

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
          req.result.createObjectStore(STORE, { keyPath: 'subjectId' })
        }
      } catch { /* store mavjud — muammo emas */ }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => resolve(null)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
}

/** Keshdan o'qish. Entry yo'q / format eski / IDB mavjud emas → null (throw yo'q). */
export async function readBankCache(subjectId: string): Promise<BankCacheEntry | null> {
  try {
    const db = await openDb()
    if (!db) return null
    try {
      const entry = await reqToPromise<BankCacheEntry>(
        db.transaction(STORE, 'readonly').objectStore(STORE).get(subjectId),
      )
      if (!entry || entry.format !== BANK_CACHE_FORMAT || !Array.isArray(entry.raw)) return null
      return entry
    } finally {
      db.close()
    }
  } catch {
    return null
  }
}

/** Keshga yozish + LRU evict (MAX_ENTRIES dan oshsa eng eskisini o'chiradi). Jim fail. */
export async function writeBankCache(entry: Pick<BankCacheEntry, 'subjectId' | 'v' | 'raw' | 'topics'>): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    try {
      const record: BankCacheEntry = { ...entry, savedAt: Date.now(), format: BANK_CACHE_FORMAT }
      // tx1: put + ro'yxat (put getAll'dan OLDIN bajariladi — yangi yozuv ham ko'rinadi)
      const tx1 = db.transaction(STORE, 'readwrite')
      const st1 = tx1.objectStore(STORE)
      st1.put(record)
      const all = await reqToPromise<BankCacheEntry[]>(st1.getAll())
      await txDone(tx1)
      // tx2: LRU evict — alohida tranzaksiya (tx1 allaqachon commit bo'lgan bo'lishi mumkin)
      if (all && all.length > MAX_ENTRIES) {
        const excess = all
          .filter((e) => e.subjectId !== entry.subjectId)
          .sort((a, b) => a.savedAt - b.savedAt)
          .slice(0, all.length - MAX_ENTRIES)
        if (excess.length > 0) {
          const tx2 = db.transaction(STORE, 'readwrite')
          const st2 = tx2.objectStore(STORE)
          for (const old of excess) st2.delete(old.subjectId)
          await txDone(tx2)
        }
      }
    } finally {
      db.close()
    }
  } catch { /* kvota/IDB xatosi — keshsiz yashaymiz */ }
}

/** Barcha fanlarni tozalash (test/debug uchun; asosiy oqimda ishlatilmaydi). */
export async function clearBankCache(): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      await txDone(tx)
    } finally {
      db.close()
    }
  } catch { /* ignore */ }
}
