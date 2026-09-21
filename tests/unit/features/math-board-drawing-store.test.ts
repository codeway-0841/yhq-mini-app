/**
 * Math Board — P1-4 chizma persistence (IndexedDB payload + localStorage meta).
 *
 * Qoplanadigan holatlar:
 * - RELOAD: save → load roundtrip (stroke'lar tiklanadi); localStorage'da
 *   FAQAT kichik metadata (payload yo'q).
 * - MIGRATION: eski v2 localStorage snapshot birinchi load'da IDB'ga ko'chadi
 *   va meta bilan almashtiriladi.
 * - ACCOUNT RESET: localStorage meta o'chirilsa (prefix-clear) IDB'dagi eski
 *   akkaunt chizmasi ham ko'rinmaydi (wipe).
 * - QUOTA/STORAGE FAILURE: yozuv xatosi jim yutilmaydi — `false` qaytadi.
 * - FALLBACK: IndexedDB umuman yo'q bo'lsa eski localStorage yo'li ishlaydi.
 *
 * jsdom'da indexedDB yo'q — minimal in-memory fake stub ishlatiladi.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadBoardDrawings, saveBoardDrawings } from '../../../src/features/math-board/lib/drawing-store'
import { drawingStorageKey, emptyDrawing } from '../../../src/features/test'
import type { DrawingHistory, DrawingStroke } from '../../../src/features/test'

const SESSION = 'math-board'
const KEY = drawingStorageKey(SESSION) // 'yhq-test-drawing-v2:math-board'
const SURFACE = 'question:math-board-log-1'

const STROKE: DrawingStroke = {
  tool: 'pen', color: '#111827', width: 4, opacity: 1,
  points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
}

function drawingsWith(strokes: DrawingStroke[]): Map<string, DrawingHistory> {
  const map = new Map<string, DrawingHistory>()
  map.set(SURFACE, { ...emptyDrawing(), strokes })
  return map
}

/* ── Minimal in-memory IndexedDB fake ─────────────────────────────────── */

interface FakeState {
  dbs: Map<string, Map<string, unknown>>
  failWrites: boolean
}

function makeRequest<T>(fn: () => T, state: FakeState, isWrite: boolean): unknown {
  const req: Record<string, unknown> = {}
  setTimeout(() => {
    if (isWrite && state.failWrites) {
      ;(req.onerror as (() => void) | undefined)?.()
      return
    }
    try {
      req.result = fn()
      ;(req.onsuccess as (() => void) | undefined)?.()
    } catch {
      ;(req.onerror as (() => void) | undefined)?.()
    }
  }, 0)
  return req
}

function createFakeIndexedDB(): { fake: { open: (name: string) => unknown }; state: FakeState } {
  const state: FakeState = { dbs: new Map(), failWrites: false }
  const fake = {
    open(name: string) {
      const req: Record<string, unknown> = {}
      setTimeout(() => {
        if (!state.dbs.has(name)) state.dbs.set(name, new Map())
        const data = state.dbs.get(name) as Map<string, unknown>
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => ({}),
          close: () => {},
          transaction: (_store: string, mode: 'readonly' | 'readwrite') => {
            const tx: Record<string, unknown> = {}
            const isWrite = mode === 'readwrite'
            tx.objectStore = () => ({
              get: (k: string) => makeRequest(() => data.get(k), state, false),
              put: (v: { id: string }) => makeRequest(() => { data.set(v.id, v); return v.id }, state, isWrite),
              delete: (k: string) => makeRequest(() => { data.delete(k); return undefined }, state, isWrite),
            })
            setTimeout(() => {
              if (isWrite && state.failWrites) (tx.onerror as (() => void) | undefined)?.()
              else (tx.oncomplete as (() => void) | undefined)?.()
            }, 1)
            return tx
          },
        }
        ;(req.onupgradeneeded as (() => void) | undefined)?.()
        ;(req.onsuccess as (() => void) | undefined)?.()
      }, 0)
      return req
    },
  }
  return { fake, state }
}

let fakeState: FakeState

beforeEach(() => {
  localStorage.clear()
  const { fake, state } = createFakeIndexedDB()
  fakeState = state
  vi.stubGlobal('indexedDB', fake)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('P1-4 drawing persistence', () => {
  it('RELOAD: save → load roundtrip — stroke\'lar tiklanadi', async () => {
    const ok = await saveBoardDrawings(SESSION, drawingsWith([STROKE]))
    expect(ok).toBe(true)

    // "Reload" — yangi load (xotira tozalanib, storage'dan o'qiladi)
    const loaded = await loadBoardDrawings(SESSION)
    expect(loaded.get(SURFACE)?.strokes).toEqual([STROKE])
  })

  it('localStorage\'da FAQAT metadata — stroke payload YO\'Q', async () => {
    await saveBoardDrawings(SESSION, drawingsWith([STROKE]))
    const raw = localStorage.getItem(KEY) as string
    const meta = JSON.parse(raw) as { version: number; surfaceCount: number; surfaces?: unknown }
    expect(meta.version).toBe(3)
    expect(meta.surfaceCount).toBe(1)
    // Payload localStorage'da yo'q — faqat IDB'da
    expect(meta.surfaces).toBeUndefined()
    expect(raw).not.toContain('points')
  })

  it('MIGRATION: eski v2 localStorage snapshot IDB\'ga ko\'chadi + meta\'ga almashtiriladi', async () => {
    // Legacy snapshot (P1-4'dan OLDINGI format — to'liq payload)
    localStorage.setItem(KEY, JSON.stringify({
      version: 2,
      surfaces: { [SURFACE]: [STROKE] },
    }))

    const loaded = await loadBoardDrawings(SESSION)
    expect(loaded.get(SURFACE)?.strokes).toEqual([STROKE])

    // localStorage endi kichik meta — eski payload almashtirildi
    const meta = JSON.parse(localStorage.getItem(KEY) as string) as { version: number; surfaces?: unknown }
    expect(meta.version).toBe(3)
    expect(meta.surfaces).toBeUndefined()

    // Ikkinchi load IDB'dan o'qiydi (migration barqaror)
    const again = await loadBoardDrawings(SESSION)
    expect(again.get(SURFACE)?.strokes).toEqual([STROKE])
  })

  it('ACCOUNT RESET: meta o\'chirilsa IDB\'dagi eski chizma ko\'rinmaydi (wipe)', async () => {
    await saveBoardDrawings(SESSION, drawingsWith([STROKE]))
    // Account reset localStorage prefix'ini tozalaydi (account.ts) — meta yo'qoladi
    localStorage.removeItem(KEY)

    const loaded = await loadBoardDrawings(SESSION)
    // Eski akkaunt chizmasi yangi akkauntga KO'RINMAYDI
    expect(loaded.size).toBe(0)

    // IDB record ham o'chirilgan — keyingi save'dan keyin ham eski ma'lumot qaytmaydi
    await saveBoardDrawings(SESSION, drawingsWith([]))
    const again = await loadBoardDrawings(SESSION)
    expect(again.size).toBe(0)
  })

  it('QUOTA/STORAGE FAILURE: yozuv xatosi jim yutilmaydi — false qaytadi', async () => {
    fakeState.failWrites = true
    const ok = await saveBoardDrawings(SESSION, drawingsWith([STROKE]))
    expect(ok).toBe(false)
    // Xato holatida IDB+meta yarim holatda qolmaydi (meta yozilmaydi)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('FALLBACK: IndexedDB yo\'q bo\'lsa eski localStorage yo\'li ishlaydi', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const ok = await saveBoardDrawings(SESSION, drawingsWith([STROKE]))
    expect(ok).toBe(true)
    // Eski format (v2 payload) localStorage'da
    const raw = JSON.parse(localStorage.getItem(KEY) as string) as { version: number }
    expect(raw.version).toBe(2)

    const loaded = await loadBoardDrawings(SESSION)
    expect(loaded.get(SURFACE)?.strokes).toEqual([STROKE])
  })

  it('FALLBACK + quota: localStorage setItem throw — false qaytadi', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const original = localStorage.setItem.bind(localStorage)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const ok = await saveBoardDrawings(SESSION, drawingsWith([STROKE]))
    expect(ok).toBe(false)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(original)
  })

  it('buzilgan localStorage meta — ilova yiqilmaydi, bo\'sh qaytaradi', async () => {
    localStorage.setItem(KEY, '{buzilgan json')
    const loaded = await loadBoardDrawings(SESSION)
    expect(loaded.size).toBe(0)
  })

  it('load xatosi throw qilmaydi (IDB open fail)', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => { throw new Error('blocked') },
    })
    // openDb null → localStorage fallback (bo'sh) — throw YO'Q
    const loaded = await loadBoardDrawings(SESSION)
    expect(loaded.size).toBe(0)
  })
})
