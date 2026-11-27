/**
 * KIVVI Battle Royale — Shared protocol & constants (SSOT for server + client).
 *
 * Qoidalar (coinsiz, 100% bilim + tezlik):
 * - 12 ta savol, har biri 12 soniya
 * - Har bir o'yinchida 1 ta bepul Qalqon (1-xato kechiriladi; 2-xatoda chiqib ketadi)
 * - Chiqib ketgan o'yinchi Tomoshabin (Spectator) rejimida oxirigacha kuzatadi
 * - Oxirida Top-3 shohsupa (Podium) + raund/tezlik bo'yicha o'rin
 */

export const ROYALE_ROUNDS = 12
export const ROYALE_QUESTION_SECONDS = 12
export const ROYALE_REVEAL_SECONDS = 4
export const ROYALE_COUNTDOWN_SECONDS = 3
export const ROYALE_LOBBY_AUTOTIMER_SECONDS = 15
export const ROYALE_MAX_PLAYERS = 200
export const ROYALE_FREE_SHIELDS = 1
/** Kunlik asosiy turnir vaqti: 21:00 (Toshkent UTC+5) */
export const ROYALE_DAILY_HOUR_UZT = 21

export type RoyalePhase = 'lobby' | 'countdown' | 'question' | 'reveal' | 'finished'

export type RoyalePlayerStatus = 'alive' | 'eliminated'

export interface RoyaleParticipantSummary {
  userId: string
  name: string
  status: RoyalePlayerStatus
  shieldsLeft: number
  correctCount: number
  eliminatedRound: number | null
  totalTimeMs: number
  rank?: number
}

export interface RoyaleLobbySnapshot {
  roomId: string
  subjectId: string
  phase: RoyalePhase
  playerCount: number
  aliveCount: number
  maxPlayers: number
  /** Lobby auto-startgacha qolgan soniya (null — hali boshlanmagan) */
  startsInSec: number | null
  /** Navbatdagi kunlik 21:00 (UTC+5) shouga qolgan soniya */
  nextDailyShowSec: number
  players: Array<{ userId: string; name: string }>
}

export interface RoyaleRevealPayload {
  roomId: string
  round: number
  totalRounds: number
  correctOptionId: string
  aliveCount: number
  totalPlayers: number
  eliminatedThisRound: number
  yourOutcome: 'correct' | 'shield_saved' | 'eliminated' | 'spectator'
  yourStatus: RoyalePlayerStatus
  shieldsLeft: number
  correctCount: number
}

export interface RoyaleFinishedPayload {
  roomId: string
  subjectId: string
  totalPlayers: number
  roundsPlayed: number
  podium: RoyaleParticipantSummary[]
  yourRank: number
  yourCorrect: number
  yourStatus: RoyalePlayerStatus
}

/** Toshkent (UTC+5) vaqti bo'yicha keyingi 21:00 gacha qolgan soniya */
export function secondsUntilNextDailyShow(nowMs = Date.now()): number {
  const UZT_OFFSET_MS = 5 * 3600 * 1000
  const uzt = new Date(nowMs + UZT_OFFSET_MS)
  const target = new Date(uzt.getTime())
  target.setUTCHours(ROYALE_DAILY_HOUR_UZT, 0, 0, 0)
  if (target.getTime() <= uzt.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1)
  }
  return Math.max(0, Math.floor((target.getTime() - uzt.getTime()) / 1000))
}
