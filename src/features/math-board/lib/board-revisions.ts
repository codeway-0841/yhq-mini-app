/**
 * Math Board — turn tarixi helperlari (Faza 2/6).
 *
 * BoardTurn append-only (50 cap). Store'da `turns` ro'yxati; bu fayl sof
 * konstruktorlar (testda qoplanadi).
 */

import type { BoardTurn } from './board-model'

export const MAX_TURNS = 50

let turnSeq = 0

export function createTurn(args: {
  problemId: string
  sessionRevision: number
  userInkRevision: number
  recognitionRevision: number
  acceptedStepIds: number[]
  changedBlockIds: string[]
  hint?: BoardTurn['hint']
  now?: number
}): BoardTurn {
  turnSeq += 1
  return {
    id: `t${args.now ?? Date.now()}-${turnSeq}`,
    problemId: args.problemId,
    timestamp: args.now ?? Date.now(),
    sessionRevision: args.sessionRevision,
    userInkRevision: args.userInkRevision,
    recognitionRevision: args.recognitionRevision,
    acceptedStepIds: args.acceptedStepIds,
    changedBlockIds: args.changedBlockIds,
    hint: args.hint,
  }
}

/** Cap'li append (eskilar tushadi) */
export function appendTurn(log: BoardTurn[], turn: BoardTurn): BoardTurn[] {
  const next = [...log, turn]
  return next.length > MAX_TURNS ? next.slice(next.length - MAX_TURNS) : next
}
