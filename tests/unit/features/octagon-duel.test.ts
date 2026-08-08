/**
 * Duel state machine — sof reducer testlari (WebSocket'siz).
 * Muhim invariantlar:
 *  1) CANCEL har doim toza idle holatga qaytaradi
 *  2) START_ROUND javob/reveal state'ini tozalaydi (eskisidan meros qolmaydi)
 *  3) OPP_DISCONNECTED → avtomatik g'alaba + toast
 */
import { describe, it, expect } from 'vitest'
import { duelReducer, DUEL_INIT, type DuelState } from '../../../src/features/octagon/duel-reducer'

const inRound: DuelState = {
  ...DUEL_INIT,
  phase: 'in_round', matchId: 'm1', opponentName: 'Raqib',
  roundCount: 10, roundIndex: 0, currentQuestionId: 5,
  yourScore: 3, oppScore: 2,
  selected: 'A', ackCorrect: false, ackCorrectOptionId: 'B',
  oppAnswered: true, deadline: 123,
}

describe('duelReducer', () => {
  it('SEARCHING — state tozalanib searching fazaga o`tadi', () => {
    const s = duelReducer(inRound, { type: 'SEARCHING' })
    expect(s.phase).toBe('searching')
    expect(s.matchId).toBeNull()
    expect(s.yourScore).toBe(0)
  })

  it('CANCEL — har doim toza INIT holat', () => {
    expect(duelReducer(inRound, { type: 'CANCEL' })).toEqual(DUEL_INIT)
  })

  it('MATCHED — matchId/opponent saqlanadi, score nol', () => {
    const s = duelReducer({ ...DUEL_INIT, phase: 'searching' },
      { type: 'MATCHED', matchId: 'm9', opponentName: 'X', roundCount: 10 })
    expect(s).toMatchObject({ phase: 'matched', matchId: 'm9', opponentName: 'X', roundCount: 10 })
  })

  it('START_ROUND — old javob/ack/oppAnswered TOZALANADI (server-trust invariant)', () => {
    const s = duelReducer(inRound, { type: 'START_ROUND', index: 1, questionId: 7, timeLimit: 20_000 })
    expect(s.phase).toBe('in_round')
    expect(s.selected).toBeNull()
    expect(s.ackCorrect).toBeNull()
    expect(s.ackCorrectOptionId).toBeNull() // javob kaliti faqat keyingi ack'dan
    expect(s.oppAnswered).toBe(false)
    expect(s.roundIndex).toBe(1)
    expect(s.deadline).toBeGreaterThan(Date.now())
  })

  it('ANSWER_ACK — to`g`ri variant id si saqlanadi (reveal faqat serverdan)', () => {
    const s = duelReducer({ ...inRound, selected: 'B' }, { type: 'ANSWER_ACK', correct: true, correctOptionId: 'B' })
    expect(s.ackCorrect).toBe(true)
    expect(s.ackCorrectOptionId).toBe('B')
  })

  it('OPP_DISCONNECTED — avto-g`alaba + ogohlantirish', () => {
    const s = duelReducer(inRound, { type: 'OPP_DISCONNECTED' })
    expect(s.phase).toBe('match_end')
    expect(s.result).toBe('win')
    expect(s.oppWait).toBeNull()
    expect(s.toastMsg).toBeTruthy()
  })

  it('OPP_WAIT → OPP_BACK sikl', () => {
    const waiting = duelReducer(inRound, { type: 'OPP_WAIT', waitSeconds: 30 })
    expect(waiting.oppWait).toBe(30)
    expect(duelReducer(waiting, { type: 'OPP_BACK' }).oppWait).toBeNull()
  })

  it('SYNC (reconnect) — server state bilan to`liq almashtiriladi', () => {
    const s = duelReducer(DUEL_INIT, {
      type: 'SYNC', matchId: 'm2', index: 3, questionId: 11, timeLimit: 15_000,
      roundCount: 10, yourScore: 5, oppScore: 4, opponentName: 'Y',
      yourAnswer: 'C', oppAnswered: true, correctOptionId: null,
    })
    expect(s).toMatchObject({
      phase: 'in_round', matchId: 'm2', roundIndex: 3, currentQuestionId: 11,
      yourScore: 5, oppScore: 4, selected: 'C', oppAnswered: true,
    })
  })

  it('TOAST → CLEAR_TOAST sikl', () => {
    const t = duelReducer(DUEL_INIT, { type: 'TOAST', msg: 'x' })
    expect(t.toastMsg).toBe('x')
    expect(duelReducer(t, { type: 'CLEAR_TOAST' }).toastMsg).toBeNull()
  })
})
