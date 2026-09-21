/**
 * Math Board — P2-1 (round-3) persist migration v2 → v3.
 *
 * v2 AcceptedStep'larda blockId YO'Q — undo invarianti (step ↔ MathBlock)
 * uchun xavfsiz mapping imkonsiz (typed blockId = t:<problemId>:
 * <sessionRevision>:<stepId> — revision qayta qurilmaydi). Shuning uchun
 * legacy session IZCHIL RESET qilinadi — step va blok divergent qoldirilmaydi.
 *
 * Test: real v2 localStorage snapshot → rehydrate → undo.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const STORAGE_KEY = 'yhq-math-board'

const V2_TYPED_BLOCK = {
  id: 't:log-1:0:1',
  order: 1001,
  type: 'equation',
  source: 'user',
  strokeIds: [],
  latex: 'x=1',
  ascii: 'x=1',
  recognition: { state: 'confirmed', provider: 'manual', revision: 0 },
  grading: { status: 'correct' },
  createdAt: 1,
  updatedAt: 1,
}

const V2_STEP = {
  id: 1,
  latex: 'x=1',
  ascii: 'x=1',
  result: { status: 'correct', detail: 'identical_exact' },
  at: 1,
  // blockId YO'Q — v2 formati
}

function seedV2Snapshot(overrides?: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2,
    state: {
      problemId: 'log-1',
      steps: [V2_STEP],
      inputLatex: '',
      solved: false,
      nextId: 2,
      inputKey: 1,
      sessionRevision: 0,
      userInkRevision: 0,
      recognitionRevision: 0,
      acceptedStepsRevision: 1,
      blocksByProblem: { 'log-1': [V2_TYPED_BLOCK] },
      turns: [],
      ...overrides,
    },
  }))
}

async function importFreshStore() {
  vi.resetModules()
  return import('../../../src/features/math-board/hooks/useBoardSession')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.resetModules()
})

describe('P2-1 persist migration v2 → v3', () => {
  it('v2 snapshot (blockId\'siz step + typed blok) → izchil RESET: steps+blocks+turns toza', async () => {
    seedV2Snapshot()
    const { useBoardSession } = await importFreshStore()
    const s = useBoardSession.getState()
    // Legacy session izchil reset — divergent holat YO'Q
    expect(s.steps).toEqual([])
    expect(s.blocksByProblem).toEqual({})
    expect(s.turns).toEqual([])
    expect(s.solved).toBe(false)
    expect(s.inputLatex).toBe('')
    // Masala tanlovi saqlanadi (session meta — reset faqat o'yin holatiga)
    expect(s.problemId).toBe('log-1')

    // REHYDRATE → UNDO: crash yo'q, no-op, divergent yo'q
    useBoardSession.getState().undoLast()
    const after = useBoardSession.getState()
    expect(after.steps).toEqual([])
    expect(after.blocksByProblem).toEqual({})
  })

  it('v2 snapshot faqat stepli (blocksiz) ham izchil reset', async () => {
    seedV2Snapshot({ blocksByProblem: {} })
    const { useBoardSession } = await importFreshStore()
    const s = useBoardSession.getState()
    expect(s.steps).toEqual([])
    expect(s.blocksByProblem).toEqual({})
  })

  it('bo\'sh v2 snapshot (yangi user) — reset kerak emas, holat saqlanadi', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      state: {
        problemId: 'log-2',
        steps: [],
        inputLatex: '',
        solved: false,
        nextId: 1,
        inputKey: 0,
        sessionRevision: 5,
        userInkRevision: 0,
        recognitionRevision: 0,
        acceptedStepsRevision: 0,
        blocksByProblem: {},
        turns: [],
      },
    }))
    const { useBoardSession } = await importFreshStore()
    const s = useBoardSession.getState()
    expect(s.steps).toEqual([])
    expect(s.problemId).toBe('log-2')
    expect(s.sessionRevision).toBe(5)
  })

  it('v3 snapshot (blockId\'li) — MIGRATSIYA YO\'Q: rehydrate → undo invariant ishlaydi', async () => {
    const step = { ...V2_STEP, blockId: 't:log-1:0:1' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 3,
      state: {
        problemId: 'log-1',
        steps: [step],
        inputLatex: '',
        solved: false,
        nextId: 2,
        inputKey: 1,
        sessionRevision: 0,
        userInkRevision: 0,
        recognitionRevision: 0,
        acceptedStepsRevision: 1,
        blocksByProblem: { 'log-1': [V2_TYPED_BLOCK] },
        turns: [],
      },
    }))
    const { useBoardSession } = await importFreshStore()
    // v3 sessiya saqlanib qolgan — reset YO'Q
    let s = useBoardSession.getState()
    expect(s.steps).toHaveLength(1)
    expect(s.steps[0].blockId).toBe('t:log-1:0:1')
    expect(s.blocksByProblem['log-1']).toHaveLength(1)

    // REHYDRATE → UNDO: typed blok step bilan birga o'chadi (invariant)
    useBoardSession.getState().undoLast()
    s = useBoardSession.getState()
    expect(s.steps).toEqual([])
    expect(s.blocksByProblem['log-1']).toEqual([])
  })
})
