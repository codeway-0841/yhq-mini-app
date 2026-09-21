/**
 * Math Board — P1-3 (round-3) async drawing load race.
 *
 * Kontrakt:
 * - Load tugamaguncha chizish input'i va toolbar YOPIQ (ready-gate) — erta
 *   stroke loaded map bilan race qilmaydi.
 * - persist() load'dan oldingi Map referensini capture qilmaydi; save'lar
 *   ketma-ket queue'da — eski save yangi save natijasini bosmaydi.
 *
 * Deferred test: IDB'da BOSHQA masala chizmasi bor; load havoda turibdi;
 * user shu payt draw qilishga urinadi → hech bir surface/stroke yo'qolmaydi.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import BoardCanvas from '../../../src/features/math-board/components/BoardCanvas'
import type { DrawingHistory, DrawingStroke } from '../../../src/features/test'

vi.mock('mathlive', () => ({}))

const mockLoad = vi.fn<() => Promise<Map<string, DrawingHistory>>>()
const mockSave = vi.fn<(session: string, map: Map<string, DrawingHistory>) => Promise<boolean>>()

vi.mock('../../../src/features/math-board/lib/drawing-store', () => ({
  loadBoardDrawings: () => mockLoad(),
  saveBoardDrawings: (session: string, map: Map<string, DrawingHistory>) => mockSave(session, map),
}))

const OTHER_SURFACE = 'question:math-board-log-2'
const OWN_SURFACE = 'question:math-board-log-1'

const PRELOADED: DrawingStroke = {
  tool: 'pen', color: '#111827', width: 4, opacity: 1,
  points: [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }],
}

function preloadedMap(): Map<string, DrawingHistory> {
  return new Map([[OTHER_SURFACE, { strokes: [PRELOADED], undo: [], redo: [] }]])
}

function renderCanvas(onStrokes = vi.fn()) {
  const utils = render(
    <BoardCanvas
      problemId="log-1"
      onStrokes={onStrokes}
      label="Chizish"
      clearLabel="Tozalash"
      onKeyboard={() => {}}
    />,
  )
  return { ...utils, onStrokes }
}

/** Haqiqiy DrawingCanvas'da bitta stroke chizish (pointer down → move → up) */
function drawStrokeOn(canvas: Element) {
  fireEvent.pointerDown(canvas, { clientX: 0.2, clientY: 0.2, pointerId: 1 })
  fireEvent.pointerMove(canvas, { clientX: 0.3, clientY: 0.3, pointerId: 1 })
  fireEvent.pointerUp(canvas, { clientX: 0.3, clientY: 0.3, pointerId: 1 })
}

beforeEach(() => {
  mockLoad.mockReset()
  mockSave.mockReset()
  mockSave.mockResolvedValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('P1-3 async drawing load race', () => {
  it('load havoda: canvas+toolbar yopiq, save CHAQIRILMAYDI; load\'dan keyin stroke saqlanadi', async () => {
    let resolveLoad: ((m: Map<string, DrawingHistory>) => void) | null = null
    mockLoad.mockImplementation(
      () => new Promise<Map<string, DrawingHistory>>((resolve) => {
        resolveLoad = resolve
      }),
    )
    const { container, onStrokes } = renderCanvas()

    // Load havoda — chizish input'i YOPIQ (race himoyasi)
    expect(container.querySelector('canvas')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    // Toolbar ham yopiq
    expect(container.querySelector('button[aria-label="Qalam"]')).toBeNull()
    // Bu paytda hech qanday save bo'lmasligi shart
    expect(mockSave).not.toHaveBeenCalled()

    // Queue zanjiri microtask'da load'ni chaqiradi — avval flush
    await act(async () => {})
    // Load tugadi — IDB'da BOSHQA masala (log-2) chizmasi bor edi
    await act(async () => {
      resolveLoad?.(preloadedMap())
    })
    // Endi canvas ochiq
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeTruthy()
    // O'z masalasi (log-1) bo'sh — boshlang'ich onStrokes bo'sh massiv
    expect(onStrokes).toHaveBeenLastCalledWith([])

    // User stroke chizadi
    fireEvent.pointerDown(canvas as Element, { clientX: 0.2, clientY: 0.2, pointerId: 1 })
    fireEvent.pointerMove(canvas as Element, { clientX: 0.3, clientY: 0.3, pointerId: 1 })
    fireEvent.pointerUp(canvas as Element, { clientX: 0.3, clientY: 0.3, pointerId: 1 })

    await act(async () => {})
    // Save bajarildi
    expect(mockSave).toHaveBeenCalledTimes(1)
    const savedMap = mockSave.mock.calls[0][1]
    // HECH BIR surface yo'qolmadi: yangi stroke o'z surface'ida…
    // (jsdom pointer koordinatalari NaN — aniqlik emas, saqlanish tekshiriladi)
    const ownStrokes = savedMap.get(OWN_SURFACE)?.strokes
    expect(ownStrokes).toHaveLength(1)
    expect(ownStrokes?.[0].points.length).toBeGreaterThan(0)
    // …va IDB'dagi BOSHQA masala chizmasi ham SAQLANIB qolgan
    expect(savedMap.get(OTHER_SURFACE)?.strokes).toEqual([PRELOADED])
  })

  it('save queue: ikkita tez commit ketma-ket yoziladi (eski save yangisini bosmaydi)', async () => {
    mockLoad.mockResolvedValue(preloadedMap())
    // Save'lar deferred — birinchisi havoda turganda ikkinchi commit kelyapti
    const saveResolvers: Array<(ok: boolean) => void> = []
    mockSave.mockImplementation(
      () => new Promise<boolean>((resolve) => {
        saveResolvers.push(resolve)
      }),
    )
    const { container } = renderCanvas()
    await act(async () => {})

    const canvas = container.querySelector('canvas') as Element
    // 1-commit — 1-save boshlanadi (havoda)
    drawStrokeOn(canvas)
    await act(async () => {})
    expect(mockSave).toHaveBeenCalledTimes(1)

    // 2-commit — 1-save hali tugamagan: 2-save QUEUE'da kutadi
    drawStrokeOn(canvas)
    await act(async () => {})
    expect(mockSave).toHaveBeenCalledTimes(1)

    // 1-save tugadi → 2-save boshlanadi
    await act(async () => {
      saveResolvers[0](true)
    })
    expect(mockSave).toHaveBeenCalledTimes(2)

    // Oxirgi save TO'LIQ holatni yozadi: 2 stroke + boshqa masala surface'i
    const lastMap = mockSave.mock.calls[1][1]
    expect(lastMap.get(OWN_SURFACE)?.strokes).toHaveLength(2)
    expect(lastMap.get(OTHER_SURFACE)?.strokes).toEqual([PRELOADED])

    await act(async () => {
      saveResolvers[1]?.(true)
    })
  })

  it('persist xatosi jim yutilmaydi — non-blocking ogohlantirish chiqadi', async () => {
    mockLoad.mockResolvedValue(preloadedMap())
    mockSave.mockResolvedValue(false)
    const { container } = renderCanvas()
    await act(async () => {})

    drawStrokeOn(container.querySelector('canvas') as Element)
    await act(async () => {})

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('saqlanmadi')
  })
})

describe('P1-3 cross-problem persistence (round-4)', () => {
  const A_SURFACE = 'question:math-board-log-1'
  const B_SURFACE = 'question:math-board-log-2'

  function canvasEl(problemId: string, onStrokes: (s: DrawingStroke[]) => void) {
    return (
      <BoardCanvas
        problemId={problemId}
        onStrokes={onStrokes}
        label="Chizish"
        clearLabel="Tozalash"
        onKeyboard={() => {}}
      />
    )
  }

  it('A save havoda → B switch → B draw/save — TESKARI timingda ham A va B stroke\'lari saqlanadi', async () => {
    // Fake IDB: load o'qiydi, save RESOLVE bo'lganda yozadi
    let idbState = new Map<string, DrawingHistory>()
    mockLoad.mockImplementation(() => Promise.resolve(new Map(idbState)))
    const saveResolvers: Array<() => void> = []
    const savedSnapshots: Map<string, DrawingHistory>[] = []
    mockSave.mockImplementation((_session, map) => new Promise<boolean>((resolve) => {
      savedSnapshots.push(map)
      saveResolvers.push(() => {
        idbState = new Map(map)
        resolve(true)
      })
    }))

    const onStrokes = vi.fn()
    const { container, rerender } = render(canvasEl('log-1', onStrokes))
    await act(async () => {}) // A load tugadi

    // A'da stroke → save-1 QUEUE'da (HAVODA qoldiramiz)
    drawStrokeOn(container.querySelector('canvas') as Element)
    await act(async () => {})
    expect(mockSave).toHaveBeenCalledTimes(1)

    // save-1 resolve bo'lmasdan B ga switch — B load umumiy queue'da save-1'ni KUTADI
    rerender(canvasEl('log-2', onStrokes))
    await act(async () => {})
    // B canvas hali YOPIQ (load save-1'dan keyin) — race yo'q
    expect(container.querySelector('canvas')).toBeNull()
    expect(mockLoad).toHaveBeenCalledTimes(1) // B load hali BOSHLANMADI

    // save-1 TESKARI kechikti — endi resolve; B load shundan keyin o'qiydi
    await act(async () => {
      saveResolvers[0]()
    })
    expect(mockLoad).toHaveBeenCalledTimes(2)
    const canvasB = container.querySelector('canvas')
    expect(canvasB).toBeTruthy()

    // B'da stroke → save-2 (snapshot B map'dan — A stroke'lari bilan birga)
    drawStrokeOn(canvasB as Element)
    await act(async () => {})
    expect(mockSave).toHaveBeenCalledTimes(2)
    await act(async () => {
      saveResolvers[1]()
    })

    // save-1 snapshot — faqat A (xronologik to'g'ri)
    expect(savedSnapshots[0].get(A_SURFACE)?.strokes).toHaveLength(1)
    expect(savedSnapshots[0].get(B_SURFACE)).toBeUndefined()
    // save-2 snapshot — A VA B ikkalasi ham (B load A save'dan KEYIN o'qilgani uchun)
    expect(savedSnapshots[1].get(A_SURFACE)?.strokes).toHaveLength(1)
    expect(savedSnapshots[1].get(B_SURFACE)?.strokes).toHaveLength(1)
    // Yakuniy "IDB" holati — hech bir stroke yo'qolmagan
    expect(idbState.get(A_SURFACE)?.strokes).toHaveLength(1)
    expect(idbState.get(B_SURFACE)?.strokes).toHaveLength(1)
  })

  it('rapid A→B→A switch: stroke/surface yoqolmaydi, yakuniy holat A chizmasi', async () => {
    const loadResolvers: Array<(m: Map<string, DrawingHistory>) => void> = []
    mockLoad.mockImplementation(
      () => new Promise<Map<string, DrawingHistory>>((resolve) => {
        loadResolvers.push(resolve)
      }),
    )
    const aMap = new Map<string, DrawingHistory>([
      [A_SURFACE, { strokes: [PRELOADED], undo: [], redo: [] }],
    ])
    const onStrokes = vi.fn()
    const { container, rerender } = render(canvasEl('log-1', onStrokes))

    // Rapid switch — load'lar tugamasdan A→B→A
    rerender(canvasEl('log-2', onStrokes))
    rerender(canvasEl('log-1', onStrokes))

    // 3 load queue'da ketma-ket boshlanadi — flush'lab, har birini resolve qilamiz
    await act(async () => {}) // load-1 queue'da boshlanadi
    expect(loadResolvers.length).toBeGreaterThanOrEqual(1)
    while (loadResolvers.length > 0) {
      const resolve = loadResolvers.shift()
      await act(async () => {
        resolve?.(new Map(aMap))
      })
    }

    // Yakuniy holat: A canvas ochiq, A chizmasi tiklangan — hech narsa yo'qolmagan
    expect(container.querySelector('canvas')).toBeTruthy()
    const lastCall = onStrokes.mock.calls[onStrokes.mock.calls.length - 1][0] as DrawingStroke[]
    expect(lastCall).toEqual([PRELOADED])
    // Oraliq (B) load bekor qilingan — save umuman chaqirilmagan
    expect(mockSave).not.toHaveBeenCalled()
  })
})
