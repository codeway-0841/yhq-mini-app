/**
 * Audit HIGH-1 regression — retry'da startedAt qochishi:
 * handleRetry (TestPage) sahifani REMOUNT qilmaydi — faqat navigate(replace)
 * orqali location.key yangilanadi. startedAtRef eski qiymatda qolib, yangi
 * urinish ESKI startedAt bilan saqlanardi → reload'da remainingSeconds=0 →
 * instant "vaqt tugadi". Fix: useTestSession'da locationKey'ga bog'liq reset
 * effect (save effect'dan OLDIN ishlaydi).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTestSession } from '../../../src/features/test/hooks/useTestSession'
import { useTestSessionStore } from '../../../src/shared/store/useTestSessionStore'
import type { Question } from '../../../src/shared/api'

const Q = (id: number) =>
  ({ id, text: `Savol ${id}`, options: ['a', 'b', 'c', 'd'], correctAnswer: 'a' }) as unknown as Question

type Params = Parameters<typeof useTestSession>[0]

function params(locationKey: string, over: Partial<Params> = {}): Params {
  return {
    mode:            'marathon',          // shuffle → har memo'da YANGI massiv (real retry oqimi)
    questionIds:     undefined,
    questions:       [Q(1), Q(2), Q(3), Q(4), Q(5)],
    subjectId:       'yhq',
    stateTitle:      'Marafon',
    answers:         [null, null, null, null, null],
    current:         0,
    isFinished:      false,
    locationKey,
    selectedHistory: [null, null, null, null, null],
    correctOpts:     [null, null, null, null, null],
    ...over,
  }
}

describe('useTestSession — retry startedAt (audit HIGH-1 regression)', () => {
  beforeEach(() => { useTestSessionStore.getState().clear() })
  afterEach(() => { vi.restoreAllMocks(); useTestSessionStore.getState().clear() })

  it('retry (yangi locationKey + tozalangan store) — startedAt YANGI vaqtga yoziladi', () => {
    let now = 1_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    const { rerender } = renderHook((p: Params) => useTestSession(p), { initialProps: params('k1') })
    const startedAt1 = useTestSessionStore.getState().session?.startedAt
    expect(startedAt1).toBe(1_000_000_000)

    // 20 daqiqa o'tdi — user testni yakunlab "Qayta" bosdi (handleRetry oqimi:
    // avval store.clear(), keyin navigate → yangi location.key)
    now += 20 * 60_000
    act(() => { useTestSessionStore.getState().clear() })
    rerender(params('k2'))

    const startedAt2 = useTestSessionStore.getState().session?.startedAt
    expect(startedAt2).toBe(now)              // eski kodda 1_000_000_000 qolardi!
    expect(startedAt2).not.toBe(startedAt1)   // → reload'da instant "vaqt tugadi"
  })

  it("oddiy javob almashinuvi (locationKey o'zgarmaydi) — startedAt SAQLANADI", () => {
    let now = 5_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    const { rerender } = renderHook((p: Params) => useTestSession(p), { initialProps: params('k1') })
    expect(useTestSessionStore.getState().session?.startedAt).toBe(5_000_000_000)

    now += 60_000
    rerender(params('k1', { current: 1 }))

    expect(useTestSessionStore.getState().session?.startedAt).toBe(5_000_000_000)
  })

  it("reload-resume (yangi mount, store'da sessiya bor) — startedAt store'dan tiklanadi", () => {
    let now = 9_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    const first = renderHook((p: Params) => useTestSession(p), { initialProps: params('k1') })
    expect(useTestSessionStore.getState().session?.startedAt).toBe(9_000_000_000)
    first.unmount()

    // "Reload": yangi mount — persist store'da eski sessiya turibdi,
    // timer eski startedAt'dan DAVOM etishi kerak (qayta boshlanmasligi!)
    now += 5 * 60_000
    renderHook((p: Params) => useTestSession(p), { initialProps: params('k1') })
    expect(useTestSessionStore.getState().session?.startedAt).toBe(9_000_000_000)
  })
})
