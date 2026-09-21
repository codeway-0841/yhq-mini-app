/**
 * Math Board — sessiya store + solve helper testlari (Faza 3).
 *
 * selectProblem reset, accept/undo oqimi, solved detekti, closedTruth.
 * Persist kalit `yhq-math-board` — account testida qamralgan.
 * P1-6: account switch'da xotiradagi sessiya ham tozalanadi (event bus).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardSession } from '../../../src/features/math-board/hooks/useBoardSession'
import { resetAccountState } from '../../../src/shared/store/account'
import { checkStep } from '../../../src/shared/math-engine'
import { isSolvedStep, closedTruth } from '../../../src/features/math-board/lib/solve'
import { boardProblemById, BOARD_PROBLEMS } from '../../../src/features/math-board/lib/problems'
import { createDrawBlock, createTypedBlock } from '../../../src/features/math-board/lib/board-model'
import { createTurn } from '../../../src/features/math-board/lib/board-revisions'

const OK = { status: 'correct', detail: 'identical_exact' } as const

beforeEach(() => {
  useBoardSession.getState().reset()
  useBoardSession.setState({ problemId: 'log-1' })
})

describe('useBoardSession', () => {
  it('selectProblem boshqa masalada qadamlarni tozalaydi', () => {
    useBoardSession.getState().acceptStep('log(2,32)=5', 'log(2,32)=5', { ...OK }, true)
    expect(useBoardSession.getState().steps).toHaveLength(1)
    useBoardSession.getState().selectProblem('log-2')
    const s = useBoardSession.getState()
    expect(s.problemId).toBe('log-2')
    expect(s.steps).toHaveLength(0)
    expect(s.solved).toBe(false)
    expect(s.inputLatex).toBe('')
  })

  it('ayni masalani tanlash holatni saqlaydi', () => {
    useBoardSession.getState().acceptStep('a', 'a', { ...OK }, false)
    useBoardSession.getState().selectProblem('log-1')
    expect(useBoardSession.getState().steps).toHaveLength(1)
  })

  it('acceptStep ketma-ket id beradi va solved bayrogini yopishtiradi', () => {
    const st = useBoardSession.getState()
    st.acceptStep('2^5=32', '2^5=32', { status: 'probably_correct', detail: 'opening_true' }, false)
    st.acceptStep('log(2,32)=5', 'log(2,32)=5', { ...OK }, true)
    const s = useBoardSession.getState()
    expect(s.steps.map((x) => x.id)).toEqual([1, 2])
    expect(s.solved).toBe(true)
    expect(s.inputLatex).toBe('')
  })

  it('undoLast oxirgi qadamni oladi va solved ni tushuradi', () => {
    const st = useBoardSession.getState()
    st.acceptStep('a', 'a', { ...OK }, false)
    st.acceptStep('b', 'b', { ...OK }, true)
    useBoardSession.getState().undoLast()
    const s = useBoardSession.getState()
    expect(s.steps).toHaveLength(1)
    expect(s.solved).toBe(false)
  })

  it('boardProblemById notanish id da birinchisini qaytaradi', () => {
    expect(boardProblemById('yoq').problem.id).toBe('log-1')
  })

  it('P1-6: resetAccountState xotiradagi sessiyani ham tozalaydi', () => {
    const st = useBoardSession.getState()
    st.acceptStep('a', 'a', { status: 'correct', detail: 'identical_exact' }, true)
    st.setInput('x+1')
    st.setBlocks('log-1', [createTypedBlock({ id: 't1', order: 1, latex: 'a', ascii: 'a', status: 'correct' })])
    expect(useBoardSession.getState().steps).toHaveLength(1)
    resetAccountState()
    const s = useBoardSession.getState()
    expect(s.steps).toHaveLength(0)
    expect(s.solved).toBe(false)
    expect(s.inputLatex).toBe('')
    // Faza 6: bloklar + turnlar ham tozalanadi
    expect(s.blocksByProblem).toEqual({})
    expect(s.turns).toEqual([])
  })

  it('Faza 6: persist snapshot localStorage’da (reload restore)', () => {
    useBoardSession.getState().reset()
    useBoardSession.getState().acceptStep('x=4', 'x=4', { status: 'correct', detail: 'identical_exact' }, true)
    const raw = localStorage.getItem('yhq-math-board')
    expect(raw).toBeTruthy()
    const snap = JSON.parse(raw as string) as { state: { problemId: string; solved: boolean } }
    expect(snap.state.problemId).toBe('log-1')
    expect(snap.state.solved).toBe(true)
  })

  it('P2: accept inputKey ni oshiradi (StepInput remount → vizual tozalash)', () => {
    const before = useBoardSession.getState().inputKey
    useBoardSession.getState().acceptStep('a', 'a', { status: 'correct', detail: 'identical_exact' }, false)
    expect(useBoardSession.getState().inputKey).toBe(before + 1)
  })

  it('P2: alg-1 to‘liq yechiladi (2x+3=11 → 2x=8 → x=4 → solved)', () => {
    const P = boardProblemById('alg-1')
    expect(P.promptAscii).toBe('2*x+3=11')
    const s1 = checkStep({ problem: P.problem, previousAcceptedStep: P.promptAscii, candidateStep: '2*x=8' })
    expect(['correct', 'probably_correct']).toContain(s1.status)
    const s2 = checkStep({ problem: P.problem, previousAcceptedStep: '2*x=8', candidateStep: 'x=4' })
    expect(['correct', 'probably_correct']).toContain(s2.status)
    expect(isSolvedStep('x=4', P.finalAnswer)).toBe(true)
  })
})

describe('P0-D revisions', () => {
  it('accept/undo acceptedStepsRevision bump qiladi', () => {
    const r0 = useBoardSession.getState().acceptedStepsRevision
    useBoardSession.getState().acceptStep('a', 'a', { status: 'correct', detail: 'identical_exact' }, false)
    expect(useBoardSession.getState().acceptedStepsRevision).toBe(r0 + 1)
    useBoardSession.getState().undoLast()
    expect(useBoardSession.getState().acceptedStepsRevision).toBe(r0 + 2)
  })

  it('selectProblem/reset sessionRevision bump qiladi', () => {
    const r0 = useBoardSession.getState().sessionRevision
    useBoardSession.getState().selectProblem('log-2')
    expect(useBoardSession.getState().sessionRevision).toBe(r0 + 1)
    useBoardSession.getState().reset()
    expect(useBoardSession.getState().sessionRevision).toBe(r0 + 2)
  })

  it('setInput/bumpInk userInkRevision, bumpRecognition recognitionRevision', () => {
    const s0 = useBoardSession.getState()
    useBoardSession.getState().setInput('x')
    expect(useBoardSession.getState().userInkRevision).toBe(s0.userInkRevision + 1)
    useBoardSession.getState().bumpInk()
    expect(useBoardSession.getState().userInkRevision).toBe(s0.userInkRevision + 2)
    useBoardSession.getState().bumpRecognition()
    expect(useBoardSession.getState().recognitionRevision).toBe(s0.recognitionRevision + 1)
  })
})

describe('isSolvedStep', () => {
  it('log(2,32)=5 final 5 bilan solved (yopiq qiymat-e’lon)', () => {
    expect(isSolvedStep('log(2,32)=5', '5')).toBe(true)
  })
  it('5=5 ham solved (ikki tomon final)', () => {
    expect(isSolvedStep('5=5', '5')).toBe(true)
  })
  it('notogri tomon solved emas', () => {
    expect(isSolvedStep('log(2,32)=4', '5')).toBe(false)
  })
  it('ifoda (tenglamasiz) solved emas', () => {
    expect(isSolvedStep('log(2,32)', '5')).toBe(false)
  })
  it('syntax xato solved emas (exception yutadi)', () => {
    expect(isSolvedStep('x+', '5')).toBe(false)
  })
  it('P0-B: promptning o‘zi solved EMAS ((5*x-3)/4=3 vs final 3)', () => {
    expect(isSolvedStep('(5*x-3)/4=3', '3')).toBe(false)
  })
  it('P0-B: izolyatsiya shart (x=4 true, 2*x=8 false)', () => {
    expect(isSolvedStep('x=4', '4')).toBe(true)
    expect(isSolvedStep('4=x', '4')).toBe(true)
    expect(isSolvedStep('2*x=8', '4')).toBe(false)
    expect(isSolvedStep('x+0=4', '4')).toBe(false)
  })
  it('P0-B: target variable hurmat qilinadi', () => {
    expect(isSolvedStep('y=5', '5', 'y')).toBe(true)
    expect(isSolvedStep('y=5', '5', 'x')).toBe(false)
    expect(isSolvedStep('x=5', '5', 'y')).toBe(false)
  })
  it('P0-B: HECH BIR prompt o‘zi solved emas (regressiya)', () => {
    const bad: string[] = []
    for (const b of BOARD_PROBLEMS) {
      if (isSolvedStep(b.promptAscii, b.finalAnswer, b.targetVariable)) bad.push(b.problem.id)
    }
    expect(bad, bad.join(',')).toEqual([])
  })
})

describe('closedTruth', () => {
  it('2^5=32 → true', () => {
    expect(closedTruth('2^5=32')).toBe(true)
  })
  it('2+2=5 → false', () => {
    expect(closedTruth('2+2=5')).toBe(false)
  })
  it('ochiq tenglama → null', () => {
    expect(closedTruth('x=5')).toBeNull()
  })
  it('syntax xato → null', () => {
    expect(closedTruth('x+')).toBeNull()
  })
})

describe('Faza 2 blocks/turns store', () => {
  const rect = { x: 0, y: 0, width: 1, height: 0.2 }

  it('setBlocks/updateBlock/clearProblemBlocks', () => {
    const st = useBoardSession.getState()
    st.setBlocks('log-1', [createDrawBlock({ id: 'b1', order: 0, strokeIds: ['s0'], rect })])
    expect(useBoardSession.getState().blocksByProblem['log-1']).toHaveLength(1)
    st.updateBlock('log-1', 'b1', { latex: 'x=1' })
    expect(useBoardSession.getState().blocksByProblem['log-1'][0].latex).toBe('x=1')
    st.clearProblemBlocks('log-1')
    expect(useBoardSession.getState().blocksByProblem['log-1']).toBeUndefined()
  })

  it('logTurn cap bilan qo‘shadi', () => {
    useBoardSession.getState().reset()
    useBoardSession.getState().logTurn(createTurn({
      problemId: 'log-1', sessionRevision: 0, userInkRevision: 0,
      recognitionRevision: 0, acceptedStepIds: [1], changedBlockIds: ['t1'],
    }))
    expect(useBoardSession.getState().turns).toHaveLength(1)
  })

  it('reset blocks+turns tozalaydi', () => {
    const st = useBoardSession.getState()
    st.setBlocks('log-1', [createTypedBlock({ id: 't1', order: 1, latex: 'x', ascii: 'x', status: 'correct' })])
    st.reset()
    const s = useBoardSession.getState()
    expect(s.blocksByProblem).toEqual({})
    expect(s.turns).toEqual([])
  })
})
