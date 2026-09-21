/**
 * Math Board — useBoardTurn (P1-2/P1-3 store darajasida).
 *
 * - accept: typed accept typed MathBlock yaratadi va step.blockId shunga
 *   bog'lanadi; draw-confirm accept (`sourceBlockId`) duplicate typed blok
 *   YARATMAYDI — grading aynan shu blokka yoziladi.
 * - undo: accepted step + aynan unga tegishli MathBlock ATOMIK o'chadi;
 *   BoardTurn.changedBlockIds haqiqiy o'chirilgan blockId'ni yozadi
 *   (oldingi `step:<id>` soxta edi).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBoardTurn } from '../../../src/features/math-board/hooks/useBoardTurn'
import { useBoardSession } from '../../../src/features/math-board/hooks/useBoardSession'
import { createDrawBlock } from '../../../src/features/math-board/lib/board-model'

const OK = { status: 'correct', detail: 'identical_exact' } as const
const RECT = { x: 0, y: 0, width: 1, height: 0.2 }

function turn() {
  return renderHook(() => useBoardTurn())
}

function state() {
  return useBoardSession.getState()
}

function blocks(pid = 'log-1') {
  return state().blocksByProblem[pid] ?? []
}

beforeEach(() => {
  useBoardSession.getState().reset()
  useBoardSession.setState({ problemId: 'log-1' })
})

describe('useBoardTurn accept', () => {
  it('typed accept: typed blok yaratadi, step.blockId shunga bog\'lanadi', () => {
    const { result } = turn()
    act(() => result.current.accept('x=1', 'x=1', { ...OK }, false))
    const s = state()
    const blockId = s.steps[0].blockId
    expect(blockId).toBeTruthy()
    const block = blocks().find((b) => b.id === blockId)
    expect(block).toBeTruthy()
    expect(block?.strokeIds).toHaveLength(0) // typed — stroke'siz
    expect(block?.latex).toBe('x=1')
    expect(s.turns[s.turns.length - 1].changedBlockIds).toEqual([blockId])
  })

  it('draw-confirm accept: duplicate typed blok YO\'Q — grading shu blokda, step shu blockId', () => {
    state().setBlocks('log-1', [
      createDrawBlock({ id: 'b:0:0', order: 0, strokeIds: ['s0'], rect: RECT }),
    ])
    // Confirm P1-2'da yozilgan deb olamiz (confirmed + latex/ascii)
    state().updateBlock('log-1', 'b:0:0', {
      latex: 'x=1',
      ascii: 'x=1',
      recognition: { state: 'confirmed', provider: 'gemini', revision: 2 },
    })

    const { result } = turn()
    act(() => result.current.accept('x=1', 'x=1', { ...OK }, false, 'b:0:0'))

    const s = state()
    // Duplicate yo'q — bloklar soni o'zgarmadi
    expect(blocks()).toHaveLength(1)
    expect(s.steps[0].blockId).toBe('b:0:0')
    // Grading aynan shu blokka yozildi, recognition holati buzilmadi
    expect(blocks()[0].grading.status).toBe('correct')
    expect(blocks()[0].recognition.state).toBe('confirmed')
    expect(s.turns[s.turns.length - 1].changedBlockIds).toEqual(['b:0:0'])
  })

  it('sourceBlockId topilmasa — typed blok fallback (xavfsiz tomon)', () => {
    const { result } = turn()
    act(() => result.current.accept('x=1', 'x=1', { ...OK }, false, 'b:yoq'))
    const s = state()
    expect(blocks()).toHaveLength(1)
    expect(s.steps[0].blockId).not.toBe('b:yoq')
    expect(blocks()[0].id).toBe(s.steps[0].blockId)
  })
})

describe('useBoardTurn undo (P1-3 invariant)', () => {
  it('accept → undo: step + typed blok atomik o\'chadi, changedBlockIds haqiqiy', () => {
    const { result } = turn()
    act(() => result.current.accept('x=1', 'x=1', { ...OK }, false))
    const blockId = state().steps[0].blockId as string
    expect(blocks().some((b) => b.id === blockId)).toBe(true)

    act(() => result.current.undo())
    const s = state()
    expect(s.steps).toHaveLength(0)
    // Blok ham o'chdi — acceptedSteps va MathBlocklar desync EMAS
    expect(blocks().some((b) => b.id === blockId)).toBe(false)
    // Haqiqiy o'chirilgan blockId (eski `step:<id>` soxta edi)
    expect(s.turns[s.turns.length - 1].changedBlockIds).toEqual([blockId])
  })

  it('draw-confirm → accept → undo: draw-blok O\'CHMAYDI — grading=pending, confirmed, input tiklanadi', () => {
    state().setBlocks('log-1', [
      createDrawBlock({ id: 'b:0:0', order: 0, strokeIds: ['s0'], rect: RECT }),
      createDrawBlock({ id: 'b:0:1', order: 1, strokeIds: ['s1'], rect: RECT }),
    ])
    // P1-2 confirm'dan keyingi holat (confirmed + latex/ascii)
    state().updateBlock('log-1', 'b:0:1', {
      latex: 'x=1',
      ascii: 'x=1',
      recognition: { state: 'confirmed', provider: 'gemini', revision: 2 },
    })
    const { result } = turn()
    act(() => result.current.accept('x=1', 'x=1', { ...OK }, false, 'b:0:1'))
    expect(blocks()[1].grading.status).toBe('correct')

    act(() => result.current.undo())
    const s = state()
    expect(s.steps).toHaveLength(0)
    // Stroke'li draw-blok stroke'lar canvasda qolgani uchun SAQLANADI:
    // recognition=confirmed, grading=pending; hech qanday blok o'chmadi
    expect(blocks()).toHaveLength(2)
    expect(blocks()[1].recognition.state).toBe('confirmed')
    expect(blocks()[1].grading.status).toBe('pending')
    expect(s.turns[s.turns.length - 1].changedBlockIds).toEqual(['b:0:1'])
    // Input tiklandi — draw qadam qayta check/accept qilinishi mumkin
    expect(s.inputLatex).toBe('x=1')
    expect(s.inputBlockId).toBe('b:0:1')
  })

  it('bo\'sh holatda undo — xato yo\'q, changedBlockIds bo\'sh', () => {
    const { result } = turn()
    act(() => result.current.undo())
    const s = state()
    expect(s.steps).toHaveLength(0)
    expect(s.turns[s.turns.length - 1].changedBlockIds).toEqual([])
  })
})
