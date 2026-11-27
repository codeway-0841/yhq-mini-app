import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebSocket } from 'ws'
import { setEnginePools, type QuestionPoolItem } from '../../../server/modules/octagon/octagon.engine'
import {
  getRoyaleLobbyStatus,
  handleRoyaleAnswer,
  handleRoyaleDisconnect,
  joinRoyale,
  leaveRoyale,
  resetRoyaleState,
  startRoyaleNow,
} from '../../../server/modules/octagon/royale.engine'
import {
  ROYALE_COUNTDOWN_SECONDS,
  ROYALE_REVEAL_SECONDS,
  secondsUntilNextDailyShow,
} from '../../../shared/battle-royale'

function createMockWs() {
  const sent: Array<Record<string, unknown>> = []
  const ws = {
    readyState: 1, // OPEN
    send: vi.fn((raw: string) => {
      sent.push(JSON.parse(raw) as Record<string, unknown>)
    }),
  } as unknown as WebSocket
  return { ws, sent }
}

const SAMPLE_POOL: QuestionPoolItem[] = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  correct: 'a',
  textUz: `Savol ${i + 1}`,
  textRu: `Вопрос ${i + 1}`,
  optionsUz: { a: 'To‘g‘ri', b: 'Xato 1', c: 'Xato 2', d: 'Xato 3' },
  optionsRu: { a: 'Верно', b: 'Неверно 1', c: 'Неверно 2', d: 'Неверно 3' },
  image: null,
}))

describe('KIVVI Battle Royale Engine (Coinsiz, Server-Authoritative)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetRoyaleState()
    setEnginePools(new Map([['traffic_rules_db', SAMPLE_POOL]]))
  })

  afterEach(() => {
    resetRoyaleState()
    vi.useRealTimers()
  })

  it('computes seconds until next 21:00 UZT show cleanly', () => {
    // 20:30 UZT = 15:30 UTC -> 1800s left
    const t = Date.parse('2026-11-27T15:30:00Z')
    expect(secondsUntilNextDailyShow(t)).toBe(1800)
    // 21:30 UZT = 16:30 UTC -> next day 21:00 = 23.5h = 84600s
    const tAfter = Date.parse('2026-11-27T16:30:00Z')
    expect(secondsUntilNextDailyShow(tAfter)).toBe(84_600)
  })

  it('runs full lobby -> countdown -> question (no answer key) -> shield save -> elimination -> podium', async () => {
    const p1 = createMockWs()
    const p2 = createMockWs()

    joinRoyale(p1.ws, '1001', 'Ali', 'yhq')
    joinRoyale(p2.ws, '1002', 'Vali', 'yhq')

    const status = getRoyaleLobbyStatus('yhq')
    expect(status.playerCount).toBe(2)
    expect(status.phase).toBe('lobby')
    expect(status.startsInSec).toBeGreaterThan(0)

    // Manual start triggers countdown
    startRoyaleNow('1001')
    await vi.advanceTimersByTimeAsync(0)
    expect(p1.sent.some((m) => m.type === 'royale_state' && m.phase === 'countdown')).toBe(true)

    // Advance past 3s countdown -> Round 0 question delivered WITHOUT correct answer
    await vi.advanceTimersByTimeAsync(ROYALE_COUNTDOWN_SECONDS * 1000)
    const q1 = p1.sent.find((m) => m.type === 'royale_question')
    expect(q1).toBeTruthy()
    expect(q1?.round).toBe(0)
    expect((q1?.question as Record<string, unknown>)?.correct).toBeUndefined()

    // Round 0: p1 answers correctly ('a'), p2 answers wrong ('b') -> p2 saved by free Shield!
    handleRoyaleAnswer('1001', 0, 'a')
    handleRoyaleAnswer('1002', 0, 'b')

    const r1p1 = p1.sent.find((m) => m.type === 'royale_reveal' && m.round === 0)
    const r1p2 = p2.sent.find((m) => m.type === 'royale_reveal' && m.round === 0)
    expect(r1p1?.yourOutcome).toBe('correct')
    expect(r1p2?.yourOutcome).toBe('shield_saved')
    expect(r1p2?.shieldsLeft).toBe(0)
    expect(r1p2?.aliveCount).toBe(2)

    // Advance past reveal -> Round 1
    await vi.advanceTimersByTimeAsync(ROYALE_REVEAL_SECONDS * 1000)
    expect(p1.sent.some((m) => m.type === 'royale_question' && m.round === 1)).toBe(true)

    // Round 1: p1 answers 'a', p2 answers 'b' again -> p2 eliminated (aliveCount=1) -> tournament finishes!
    handleRoyaleAnswer('1001', 1, 'a')
    handleRoyaleAnswer('1002', 1, 'b')

    const r2p2 = p2.sent.find((m) => m.type === 'royale_reveal' && m.round === 1)
    expect(r2p2?.yourOutcome).toBe('eliminated')
    expect(r2p2?.aliveCount).toBe(1)
    expect(r2p2?.eliminatedThisRound).toBe(1)

    await vi.advanceTimersByTimeAsync(ROYALE_REVEAL_SECONDS * 1000)
    const fin1 = p1.sent.find((m) => m.type === 'royale_finished')
    const fin2 = p2.sent.find((m) => m.type === 'royale_finished')
    expect(fin1?.yourRank).toBe(1)
    expect(fin2?.yourRank).toBe(2)
    expect((fin1?.podium as Array<{ userId: string }>)?.[0]?.userId).toBe('1001')
  })

  it('cleans up lobby room cleanly when players leave or disconnect', () => {
    const p1 = createMockWs()
    const p2 = createMockWs()
    joinRoyale(p1.ws, '2001', 'A', 'yhq')
    joinRoyale(p2.ws, '2002', 'B', 'yhq')
    expect(getRoyaleLobbyStatus('yhq').playerCount).toBe(2)

    leaveRoyale('2001')
    expect(getRoyaleLobbyStatus('yhq').playerCount).toBe(1)
    expect(getRoyaleLobbyStatus('yhq').startsInSec).toBeNull()

    handleRoyaleDisconnect(p2.ws, '2002')
    expect(getRoyaleLobbyStatus('yhq').playerCount).toBe(0)
  })
})
