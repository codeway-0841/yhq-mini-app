/**
 * Duel state machine — sof funksiya (WebSocket UI'dan ajratilgan, unit-testable).
 * Server xabarlari (OctagonMsg) useDuelConnection'da Action'larga xaritalanadi.
 */

export type Phase = 'idle' | 'searching' | 'matched' | 'in_round' | 'match_end'

export interface DuelState {
  phase: Phase; matchId: string | null; opponentName: string | null
  /** Raqib avatari — server matched payload'dan (custom avatar URL yoki TG photo) */
  opponentAvatar: string | null
  /** Raqib avatar ramkasi — matched payload'dan (do'kon kosmetikasi, avatar-frames id) */
  opponentFrame: string | null
  roundCount: number; roundIndex: number; currentQuestionId: number | null
  yourScore: number; oppScore: number
  selected: string | null; ackCorrect: boolean | null; oppAnswered: boolean
  /** Server reveal — javob kaliti local savollarda ENDI YO'Q, ack'dan olinadi */
  ackCorrectOptionId: string | null
  oppWait: number | null; deadline: number | null
  result: 'win' | 'lose' | 'draw' | null; toastMsg: string | null
}

export type DuelAction =
  | { type: 'SEARCHING' }
  | { type: 'CANCEL' }
  | { type: 'MATCHED';      matchId: string; opponentName: string; opponentAvatar: string | null; opponentFrame: string | null; roundCount: number }
  | { type: 'START_ROUND';  index: number; questionId: number; timeLimit: number }
  | { type: 'SELECT';       optionId: string }
  | { type: 'ANSWER_ACK';   correct: boolean; correctOptionId: string }
  | { type: 'OPP_ANSWERED' }
  | { type: 'ROUND_RESULT'; yourScore: number; oppScore: number; correctOptionId: string }
  | { type: 'MATCH_END';    yourScore: number; oppScore: number; result: 'win' | 'lose' | 'draw' }
  | { type: 'OPP_DISCONNECTED' }
  | { type: 'OPP_WAIT';     waitSeconds: number }
  | { type: 'OPP_BACK' }
  | { type: 'SYNC';         matchId: string; index: number; questionId: number | null
      timeLimit: number
      roundCount: number; yourScore: number; oppScore: number
      opponentName: string; yourAnswer: string | null; oppAnswered: boolean
      correctOptionId: string | null }
  | { type: 'TOAST';        msg: string }
  | { type: 'CLEAR_TOAST' }

export const DUEL_INIT: DuelState = {
  phase: 'idle', matchId: null, opponentName: null, opponentAvatar: null, opponentFrame: null,
  roundCount: 0, roundIndex: 0, currentQuestionId: null,
  yourScore: 0, oppScore: 0,
  selected: null, ackCorrect: null, ackCorrectOptionId: null,
  oppAnswered: false, oppWait: null, deadline: null,
  result: null, toastMsg: null,
}

export function duelReducer(s: DuelState, a: DuelAction): DuelState {
  switch (a.type) {
    case 'SEARCHING':        return { ...DUEL_INIT, phase: 'searching' }
    case 'CANCEL':           return { ...DUEL_INIT }
    case 'MATCHED':          return { ...s, phase: 'matched', matchId: a.matchId, opponentName: a.opponentName, opponentAvatar: a.opponentAvatar, opponentFrame: a.opponentFrame, roundCount: a.roundCount }
    case 'START_ROUND':      return { ...s, phase: 'in_round', roundIndex: a.index, currentQuestionId: a.questionId, selected: null, ackCorrect: null, ackCorrectOptionId: null, oppAnswered: false, deadline: Date.now() + a.timeLimit }
    case 'SELECT':           return { ...s, selected: a.optionId }
    case 'ANSWER_ACK':       return { ...s, ackCorrect: a.correct, ackCorrectOptionId: a.correctOptionId }
    case 'OPP_ANSWERED':     return { ...s, oppAnswered: true }
    case 'ROUND_RESULT':     return { ...s, yourScore: a.yourScore, oppScore: a.oppScore, ackCorrectOptionId: a.correctOptionId }
    case 'MATCH_END':        return { ...s, phase: 'match_end', yourScore: a.yourScore, oppScore: a.oppScore, result: a.result }
    case 'OPP_DISCONNECTED': return { ...s, phase: 'match_end', result: 'win', oppWait: null, toastMsg: "Raqib qaytmadi — g'alaba sizniki!" }
    case 'OPP_WAIT':         return { ...s, oppWait: a.waitSeconds }
    case 'OPP_BACK':         return { ...s, oppWait: null }
    case 'SYNC':             return { ...DUEL_INIT, phase: 'in_round', matchId: a.matchId, opponentName: a.opponentName,
                                      roundCount: a.roundCount, roundIndex: a.index, currentQuestionId: a.questionId,
                                      yourScore: a.yourScore, oppScore: a.oppScore,
                                      selected: a.yourAnswer, oppAnswered: a.oppAnswered,
                                      ackCorrect: a.yourAnswer != null && a.correctOptionId != null ? a.yourAnswer === a.correctOptionId : null,
                                      ackCorrectOptionId: a.correctOptionId,
                                      oppWait: s.oppWait,  // Preserve disconnect timer across rejoin
                                      deadline: Date.now() + a.timeLimit }
    case 'TOAST':            return { ...s, toastMsg: a.msg }
    case 'CLEAR_TOAST':      return { ...s, toastMsg: null }
    default: return s
  }
}
