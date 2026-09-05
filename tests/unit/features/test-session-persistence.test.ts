import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTestSession, useTestSessionSave } from '../../../src/features/test/hooks/useTestSession'
import { useTestAnswerFlow } from '../../../src/features/test/hooks/useTestAnswerFlow'
import { useTestSessionStore } from '../../../src/shared/store/useTestSessionStore'
import { isResumable, clampIndex } from '../../../src/shared/lib/test-session'
import type { Question } from '../../../src/shared/api'

const Q = (id: number) =>
  ({ id, text: `Savol ${id}`, options: [{ id: 'a', text: 'Opt A' }, { id: 'b', text: 'Opt B' }], correctAnswer: 'a' }) as unknown as Question

describe('Test Session Persistence & Recovery (Regression Guard)', () => {
  beforeEach(() => {
    useTestSessionStore.getState().clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    useTestSessionStore.getState().clear()
  })

  it('persists answer-flow state to session store and recovers on reload/remount', async () => {
    const questions = [Q(1), Q(2), Q(3), Q(4), Q(5)]
    const subjectId = 'yhq'
    const mode = 'exam'
    const locationKey = 'test-key-1'

    // 1-bosqich: Komponent mount bo'ldi
    const mockSubmit = vi.fn().mockResolvedValue({
      correct: true,
      correctAnswer: 'a',
      duplicate: false,
      coinsEarned: 1,
      xpEarned: 10,
    })

    const { result: sessionResult } = renderHook(() =>
      useTestSession({
        mode,
        questions,
        subjectId,
        locationKey,
      })
    )

    const activeQuestions = sessionResult.current.activeQuestions
    const sessionKey = sessionResult.current.sessionKey

    let current = 0
    const onToast = vi.fn()
    const goTo = vi.fn((idx: number) => { current = idx })

    const { result: flowResult } = renderHook(() =>
      useTestAnswerFlow({
        activeQuestions,
        current,
        submitAnswer: mockSubmit,
        answerTimer: { elapsed: () => 1200 },
        goTo,
        onToast,
      })
    )

    // Initial session save hook (as in TestPage)
    const { rerender: rerenderSave } = renderHook(
      (props) => useTestSessionSave(props),
      {
        initialProps: {
          sessionKey,
          subjectId,
          mode,
          activeQuestions,
          current,
          answers: flowResult.current.answers,
          selectedHistory: flowResult.current.selectedHistory,
          correctOpts: flowResult.current.correctOpts,
          earnedXp: flowResult.current.earnedXpTotal,
          earnedCoins: flowResult.current.earnedCoinsTotal,
          rewardedQuestionIds: flowResult.current.rewardedQuestionIds,
          cheatViolations: 0,
          isFinished: false,
          locationKey,
        },
      }
    )

    // 2-bosqich: Foydalanuvchi 1-savolga javob beradi
    await act(async () => {
      await flowResult.current.handleSelect('a')
    })

    // Save hook rerender qilinadi (React render tsikli)
    rerenderSave({
      sessionKey,
      subjectId,
      mode,
      activeQuestions,
      current,
      answers: flowResult.current.answers,
      selectedHistory: flowResult.current.selectedHistory,
      correctOpts: flowResult.current.correctOpts,
      earnedXp: flowResult.current.earnedXpTotal,
      earnedCoins: flowResult.current.earnedCoinsTotal,
      rewardedQuestionIds: flowResult.current.rewardedQuestionIds,
      cheatViolations: 0,
      isFinished: false,
      locationKey,
    })

    // 3-bosqich: Snapshot'ni tekshiramiz
    const savedSnap = useTestSessionStore.getState().session
    expect(savedSnap).not.toBeNull()
    expect(savedSnap?.answers).toEqual(expect.arrayContaining(['correct']))
    expect(savedSnap?.selected).toEqual(expect.arrayContaining(['a']))
    expect(savedSnap?.correctOptions).toEqual(expect.arrayContaining(['a']))
    expect(savedSnap?.earnedXp).toBe(10)
    expect(savedSnap?.earnedCoins).toBe(1)
    expect(savedSnap?.rewardedQuestionIds).toEqual([activeQuestions[0].id])

    // 4-bosqich: Sahifani qayta yuklash (Remount / Reload simulyatsiyasi)
    // Yangi mountda useTestSession snap'ni o'qiydi
    const { result: reloadedSession } = renderHook(() =>
      useTestSession({
        mode,
        questions,
        subjectId,
        locationKey: 'test-key-2', // yangi render
      })
    )

    expect(reloadedSession.current.sessionKey).toBe(sessionKey)

    // Snap resumable ekanini tekshiramiz
    const snap = useTestSessionStore.getState().session
    expect(isResumable(snap, sessionKey, subjectId)).toBe(true)

    // TestPage'dagi restore mantiqi:
    const restoredCurrent = clampIndex(snap!.current, activeQuestions.length)
    const restoredAnswers = [...snap!.answers]
    const restoredSelected = [...snap!.selected]
    const restoredCorrectOpts = [...snap!.correctOptions]

    expect(restoredCurrent).toBe(0)
    expect(restoredAnswers[0]).toBe('correct')
    expect(restoredSelected[0]).toBe('a')
    expect(restoredCorrectOpts[0]).toBe('a')
    expect(snap?.earnedXp).toBe(10)
    expect(snap?.earnedCoins).toBe(1)
    expect(snap?.rewardedQuestionIds).toEqual([activeQuestions[0].id])
  })
})
