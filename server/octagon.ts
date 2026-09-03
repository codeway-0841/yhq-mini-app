/**
 * Octagon PvP — Backward-compatibility entry point / facade.
 *
 * Haqiqiy javobgarliklar Separation of Concerns bo'yicha 3 ta modulga ajratilgan:
 *  - server/modules/octagon/octagon.gateway.ts    (WS transport, security, auth orchestration, dispatch)
 *  - server/modules/octagon/octagon.engine.ts     (Game state machine, matchmaker, timers, rules)
 *  - server/modules/octagon/octagon.repository.ts (Database access, Drizzle queries, avatars, presence)
 */

export {
  attachOctagon,
  getOctagonStats,
  getOnlineUsers,
  triggerOnlineBroadcast,
  resolveWsUserId,
  connsByUser,
  onlineGen,
  ACTIVE_LIMITS,
  DEFAULT_OCTAGON_LIMITS,
  type OctagonLimits,
} from './modules/octagon/octagon.gateway'

export {
  loadOctagonPools,
  reloadOctagonPools,
  buildDuelResultRows,
  joinAttemptAllowed,
  ROUNDS,
  ROUND_TIMEOUT,
  REJOIN_MIN_ANSWER_MS,
  QUEUE_TIMEOUT,
  DUEL_TIMEOUT,
  MAX_MATCHES,
  MAX_NAME_LEN,
  DUEL_CODE_RE,
  WS_USER_ID_RE,
  SAME_PAIR_24H_CAP,
  type QuestionPoolItem,
  type OctagonPools,
  type Player,
  type RoundState,
  type Match,
  type PendingDuel,
  type DuelOutcome,
} from './modules/octagon/octagon.engine'

export {
  fetchOnlineRowsCached,
  resolveAvatars,
  countDuelPairsLast24h,
  addOctagonWin,
  recordDuelResultRows,
  AVATAR_UID_RE,
} from './modules/octagon/octagon.repository'
