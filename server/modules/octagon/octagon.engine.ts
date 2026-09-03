/**
 * Octagon PvP — Game Engine va Matchmaking.
 * O'yin holati (state machine), raundlar, taymerlar, matchmaker,
 * anti-farm qarorlari va reconnect/grace window qoidalari shu yerda.
 */

import { WebSocket } from 'ws'
import { randomUUID, randomInt } from 'crypto'
import { Sentry } from '../../utils/sentry'
import { registerInterval } from '../../utils/shutdown'
import { isAuthEnforced } from '../../middleware/auth'
import { SUBJECT_REGISTRY, resolveSubject } from '../../config/subjects'
import { getProvider } from '../../providers'
import type { DuelResultRow } from '../progress/progress.repository'
import {
  resolveAvatars,
  countDuelPairsLast24h,
  addOctagonWin,
  recordDuelResultRows,
} from './octagon.repository'

// ── Constants ──────────────────────────────────────────────────────────────

export const ROUNDS              = 10
export const ROUND_TIMEOUT       = 15_000  // ms per question
export const REJOIN_MIN_ANSWER_MS = 3_000
export const QUEUE_TIMEOUT       = 60_000  // ms to find opponent before giving up
export const DUEL_TIMEOUT        = 5 * 60_000  // do'st linkni ochishi uchun 5 daqiqa
export const MAX_MATCHES         = 500     // hard cap on concurrent matches
export const MAX_NAME_LEN        = 64

/** Duel / Xona PIN kod validatsiyasi */
export const DUEL_CODE_RE = /^(?:duel-[a-z0-9]{6,16}|room-[a-z0-9]{6,16}|\d{6,8}|[a-z0-9]{6,12})$/i

/** Canonical user id */
export const WS_USER_ID_RE = /^(?:\d{1,20}|p_\d{9,15}|e_[0-9a-f]{32})$/

export const SAME_PAIR_24H_CAP = 5

// ── Types ──────────────────────────────────────────────────────────────────

export type QuestionPoolItem = { id: number; correct: string }
export type OctagonPools = Map<string, QuestionPoolItem[]>

export interface Player {
  ws:         WebSocket
  userId:     string
  name:       string
  subjectId:  string
  queueTimer: ReturnType<typeof setTimeout> | null
}

export interface RoundState {
  answers:   Map<string, string>
  timer:     ReturnType<typeof setTimeout>
  resolved:  boolean
  startedAt: number
  paused:    boolean
  remainingMs: number
}

export interface Match {
  id:              string
  players:         [Player, Player]
  pool:            QuestionPoolItem[]
  questionIds:     number[]
  scores:          Map<string, number>
  round:           number
  roundState:      RoundState | null
  disconnectTimer: ReturnType<typeof setTimeout> | null
  disconnectStartedAt: number | null
  pauseBudget:     Map<string, number>
  gapTimer:        ReturnType<typeof setTimeout> | null
  recorded?:       boolean
}

export interface PendingDuel {
  player: Player
  timer:  ReturnType<typeof setTimeout>
}

export interface DuelOutcome {
  userId:     string
  opponentId: string
  selfScore:  number
  oppScore:   number
  result:     'win' | 'lose' | 'draw'
}

// ── M-9: duel-join brute-force limiti ──────────────────────────────────────
const JOIN_ATTEMPT_WINDOW_MS = 60_000
const JOIN_ATTEMPT_MAX = 8
const joinAttempts = new Map<string, { windowStart: number; count: number }>()

export function joinAttemptAllowed(userId: string): boolean {
  const now = Date.now()
  const rec = joinAttempts.get(userId)
  if (!rec || now - rec.windowStart >= JOIN_ATTEMPT_WINDOW_MS) {
    joinAttempts.set(userId, { windowStart: now, count: 1 })
    return true
  }
  if (rec.count >= JOIN_ATTEMPT_MAX) return false
  rec.count++
  return true
}

const joinAttemptsSweepTimer = setInterval(() => {
  const cutoff = Date.now() - JOIN_ATTEMPT_WINDOW_MS
  for (const [uid, rec] of joinAttempts) {
    if (rec.windowStart < cutoff) joinAttempts.delete(uid)
  }
}, JOIN_ATTEMPT_WINDOW_MS)
joinAttemptsSweepTimer.unref?.()
registerInterval(joinAttemptsSweepTimer)

// ── Module state ───────────────────────────────────────────────────────────

let QUESTION_POOLS: OctagonPools = new Map()

let engineLimits = {
  reconnectWindowMs: 60_000,
  pauseBudgetMs:    90_000,
}

export function setEngineLimits(limits: { reconnectWindowMs: number; pauseBudgetMs: number }): void {
  engineLimits = { ...engineLimits, ...limits }
}

export function setEnginePools(pools: OctagonPools): void {
  QUESTION_POOLS = pools
}

export const queue:         Map<string, Player> = new Map()
export const matches:       Map<string, Match>  = new Map()
export const playerToMatch: Map<string, string> = new Map()
export const duels:         Map<string, PendingDuel> = new Map()
export const lastReactionTime = new Map<string, number>()

export function getEngineStats(): { queue: number; duels: number; matches: number } {
  return {
    queue: queue.size,
    duels: duels.size,
    matches: matches.size,
  }
}

// ── Question Pools ─────────────────────────────────────────────────────────

export async function loadOctagonPools(): Promise<OctagonPools> {
  const pools: OctagonPools = new Map()
  for (const dsId of new Set(SUBJECT_REGISTRY.map((s) => s.dataSourceId))) {
    const rows = await getProvider(dsId).getAllQuestions()
    pools.set(dsId, rows.map((r) => ({ id: r.id, correct: r.correctAnswer })))
  }
  return pools
}

export async function reloadOctagonPools(): Promise<void> {
  QUESTION_POOLS = await loadOctagonPools()
}

export function poolForSubject(subjectId: string): QuestionPoolItem[] {
  const entry = resolveSubject(subjectId)
  return QUESTION_POOLS.get(entry.dataSourceId)
    ?? QUESTION_POOLS.values().next().value
    ?? []
}

export function pickQuestions(n: number, pool: QuestionPoolItem[]): number[] {
  const copy = [...pool]
  const out: number[] = []
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0].id)
  }
  return out
}

export function correctFor(questionId: number, pool: QuestionPoolItem[]): string {
  return pool.find((q) => q.id === questionId)?.correct ?? ''
}

export function send(ws: WebSocket, msg: object): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

// ── Anti-farm decision ─────────────────────────────────────────────────────

export async function pairFarmCapped(u1: string, u2: string): Promise<boolean> {
  if (u1 === '0' || u2 === '0') return false
  try {
    const n = await countDuelPairsLast24h(u1, u2)
    if (n >= SAME_PAIR_24H_CAP) {
      console.warn('[octagon.engine] anti-farm: juftlik 24h cap\'ga yetdi — natija yozilmaydi', { u1, u2, n })
      return true
    }
  } catch (err) {
    console.error('[octagon.engine] anti-farm cap check xatosi (fail-open):', err)
  }
  return false
}

// ── Result Row Builder (Pure domain logic) ─────────────────────────────────

export function buildDuelResultRows(
  matchId: string,
  outcomes: ReadonlyArray<DuelOutcome>,
  forfeit: boolean,
): DuelResultRow[] {
  return outcomes
    .filter((o) => o.userId !== '0')
    .map((o) => ({
      matchId,
      userId:     o.userId,
      opponentId: o.opponentId === '0' ? null : o.opponentId,
      result:     o.result,
      selfScore:  o.selfScore,
      oppScore:   o.oppScore,
      forfeit,
    }))
}

function recordDuelResults(match: Match, outcomes: ReadonlyArray<DuelOutcome>, forfeit: boolean): void {
  if (match.recorded) return
  match.recorded = true

  const rows = buildDuelResultRows(match.id, outcomes, forfeit)
  if (rows.length === 0) return

  void recordDuelResultRows(rows)
    .catch((err) => console.error('[octagon.engine] recordDuelResultRows failed:', err?.message ?? err))
}

// ── Match Lifecycle ────────────────────────────────────────────────────────

export function startMatch(p1: Player, p2: Player): void {
  if (playerToMatch.has(p1.userId) || playerToMatch.has(p2.userId)) {
    console.warn('[octagon.engine] startMatch BLOKLANDI — o\'yinchi allaqachon match\'da', {
      p1: p1.userId, p2: p2.userId,
    })
    Sentry.captureMessage('octagon_startmatch_blocked', {
      level: 'warning',
      extra: { p1: p1.userId, p2: p2.userId },
    })
    send(p1.ws, { type: 'error', message: 'match_start_failed' })
    send(p2.ws, { type: 'error', message: 'match_start_failed' })
    return
  }
  if (p1.queueTimer) clearTimeout(p1.queueTimer)
  if (p2.queueTimer) clearTimeout(p2.queueTimer)
  queue.delete(p1.userId)
  queue.delete(p2.userId)

  const matchId     = randomUUID()
  const pool        = poolForSubject(p1.subjectId)
  const questionIds = pickQuestions(ROUNDS, pool)
  const scores      = new Map([[p1.userId, 0], [p2.userId, 0]])
  const match: Match = {
    id: matchId, players: [p1, p2], pool, questionIds,
    scores, round: 0, roundState: null, disconnectTimer: null,
    disconnectStartedAt: null,
    pauseBudget: new Map([
      [p1.userId, engineLimits.pauseBudgetMs],
      [p2.userId, engineLimits.pauseBudgetMs],
    ]),
    gapTimer: null,
  }

  matches.set(matchId, match)
  playerToMatch.set(p1.userId, matchId)
  playerToMatch.set(p2.userId, matchId)

  void resolveAvatars(p1.userId, p2.userId).then((avatars) => {
    for (const [player, opponent] of [[p1, p2], [p2, p1]] as [Player, Player][]) {
      const opp = avatars.get(opponent.userId)
      send(player.ws, {
        type: 'matched', matchId,
        opponentName: opponent.name,
        opponentAvatar: opp?.avatar ?? null,
        opponentFrame: opp?.frame ?? null,
        roundCount: questionIds.length,
      })
    }
    startRound(match)
  })
}

export function startRound(match: Match): void {
  if (match.roundState && !match.roundState.resolved) {
    console.warn('[octagon.engine] startRound blocked - round already active', { matchId: match.id, round: match.round })
    return
  }

  if (match.round >= match.questionIds.length) {
    endMatch(match)
    return
  }

  if (match.roundState?.timer) {
    clearTimeout(match.roundState.timer)
  }

  const index      = match.round
  const questionId = match.questionIds[index]
  const timer = setTimeout(() => resolveRound(match, index), ROUND_TIMEOUT)
  match.roundState = { answers: new Map(), timer, resolved: false, startedAt: Date.now(), paused: false, remainingMs: ROUND_TIMEOUT }

  for (const p of match.players) {
    send(p.ws, { type: 'question', index, questionId, timeLimit: ROUND_TIMEOUT })
  }
}

export function resolveRound(match: Match, index: number): void {
  const rs = match.roundState
  if (!rs || rs.resolved) return
  rs.resolved = true
  clearTimeout(rs.timer)

  const correct = correctFor(match.questionIds[index], match.pool)

  for (const p of match.players) {
    const isCorrect = rs.answers.get(p.userId) === correct
    if (isCorrect) match.scores.set(p.userId, (match.scores.get(p.userId) ?? 0) + 1)
  }

  for (const [i, p] of match.players.entries()) {
    const opp = match.players[1 - i]
    send(p.ws, {
      type: 'round_result', index,
      yourScore: match.scores.get(p.userId)  ?? 0,
      oppScore:  match.scores.get(opp.userId) ?? 0,
      correctOptionId: correct,
    })
  }

  match.round++
  match.gapTimer = setTimeout(() => {
    match.gapTimer = null
    if (!matches.has(match.id)) return
    startRound(match)
  }, 1000)
}

export function endMatch(match: Match): void {
  const [p1, p2] = match.players
  const s1 = match.scores.get(p1.userId) ?? 0
  const s2 = match.scores.get(p2.userId) ?? 0

  const result = (self: number, opp: number): 'win' | 'lose' | 'draw' =>
    self > opp ? 'win' : self < opp ? 'lose' : 'draw'

  send(p1.ws, { type: 'match_end', yourScore: s1, oppScore: s2, result: result(s1, s2) })
  send(p2.ws, { type: 'match_end', yourScore: s2, oppScore: s1, result: result(s2, s1) })

  const winnerId = s1 > s2 ? p1.userId : s1 < s2 ? p2.userId : null
  const outcomes: DuelOutcome[] = [
    { userId: p1.userId, opponentId: p2.userId, selfScore: s1, oppScore: s2, result: result(s1, s2) },
    { userId: p2.userId, opponentId: p1.userId, selfScore: s2, oppScore: s1, result: result(s2, s1) },
  ]

  void (async () => {
    if (await pairFarmCapped(p1.userId, p2.userId)) return
    if (winnerId && winnerId !== '0') {
      void addOctagonWin(winnerId)
    }
    recordDuelResults(match, outcomes, false)
  })()

  cleanupMatch(match)
}

export function cleanupMatch(match: Match): void {
  for (const p of match.players) playerToMatch.delete(p.userId)
  matches.delete(match.id)
  if (match.roundState && !match.roundState.resolved) {
    clearTimeout(match.roundState.timer)
  }
  if (match.disconnectTimer) {
    clearTimeout(match.disconnectTimer)
    match.disconnectTimer = null
  }
  if (match.gapTimer) {
    clearTimeout(match.gapTimer)
    match.gapTimer = null
  }
}

export function forfeitDisconnected(match: Match, userId: string): void {
  const opp = match.players.find((p) => p.userId !== userId)
  if (opp) {
    send(opp.ws, { type: 'opp_disconnected' })
    const oppScore  = match.scores.get(opp.userId) ?? 0
    const selfScore = match.scores.get(userId)     ?? 0
    const outcomes: DuelOutcome[] = [
      { userId: opp.userId, opponentId: userId,     selfScore: oppScore,  oppScore: selfScore, result: 'win'  },
      { userId,             opponentId: opp.userId, selfScore,            oppScore,            result: 'lose' },
    ]
    void (async () => {
      if (await pairFarmCapped(opp.userId, userId)) return
      if (opp.userId !== '0') {
        void addOctagonWin(opp.userId)
      }
      recordDuelResults(match, outcomes, true)
    })()
  }
  cleanupMatch(match)
}

export function rejoinMatch(ws: WebSocket, userId: string): boolean {
  const matchId = playerToMatch.get(userId)
  if (!matchId) return false
  const match = matches.get(matchId)
  if (!match) return false
  const slot     = match.players.find((p) => p.userId === userId)
  if (!slot) return false
  const opponent = match.players.find((p) => p.userId !== userId)

  slot.ws = ws
  if (match.disconnectTimer) {
    clearTimeout(match.disconnectTimer)
    match.disconnectTimer = null
  }
  let graceConsumedMs = 0
  if (match.disconnectStartedAt != null) {
    graceConsumedMs = Date.now() - match.disconnectStartedAt
    match.pauseBudget.set(userId, Math.max(0, (match.pauseBudget.get(userId) ?? 0) - graceConsumedMs))
    match.disconnectStartedAt = null
  }

  const rs = match.roundState
  if (rs && !rs.resolved && rs.paused) {
    rs.remainingMs = Math.max(REJOIN_MIN_ANSWER_MS, rs.remainingMs - graceConsumedMs)
    rs.startedAt = Date.now() - (ROUND_TIMEOUT - rs.remainingMs)
    rs.timer     = setTimeout(() => resolveRound(match, match.round), rs.remainingMs)
    rs.paused    = false
  }

  const active = rs !== null && !rs.resolved
  send(ws, {
    type:         'match_state',
    matchId:      match.id,
    index:        match.round,
    questionId:   active ? match.questionIds[match.round] : null,
    timeLimit:    active ? Math.max(0, ROUND_TIMEOUT - (Date.now() - rs.startedAt)) : ROUND_TIMEOUT,
    roundCount:   match.questionIds.length,
    yourScore:    match.scores.get(userId) ?? 0,
    oppScore:     opponent ? (match.scores.get(opponent.userId) ?? 0) : 0,
    opponentName: opponent?.name ?? 'Raqib',
    yourAnswer:   active ? (rs.answers.get(userId) ?? null) : null,
    oppAnswered:  opponent ? (active ? rs.answers.has(opponent.userId) : false) : false,
    correctOptionId: active && rs.answers.get(userId) != null
      ? correctFor(match.questionIds[match.round], match.pool)
      : null,
  })
  if (opponent) send(opponent.ws, { type: 'opp_reconnected' })
  return true
}

export function handleDisconnect(userId: string, deadWs: WebSocket): void {
  const queued = queue.get(userId)
  if (queued) {
    if (queued.ws !== deadWs) return
    if (queued.queueTimer) clearTimeout(queued.queueTimer)
    queue.delete(userId)
    return
  }

  leaveDuelByUser(userId, deadWs)

  const matchId = playerToMatch.get(userId)
  if (!matchId) return
  const match = matches.get(matchId)
  if (!match || match.disconnectTimer) return

  const budgetLeft = match.pauseBudget.get(userId) ?? 0
  if (budgetLeft <= 0) {
    forfeitDisconnected(match, userId)
    return
  }
  const windowMs = Math.min(engineLimits.reconnectWindowMs, budgetLeft)

  const opponent = match.players.find((p) => p.userId !== userId)
  if (opponent) {
    send(opponent.ws, { type: 'opp_waiting', waitSeconds: Math.ceil(windowMs / 1000) })
  }

  const rs0 = match.roundState
  if (rs0 && !rs0.resolved && !rs0.paused) {
    rs0.remainingMs = Math.max(0, ROUND_TIMEOUT - (Date.now() - rs0.startedAt))
    clearTimeout(rs0.timer)
    rs0.paused = true
  }

  match.disconnectStartedAt = Date.now()
  match.disconnectTimer = setTimeout(() => {
    if (!matches.has(matchId)) return
    if (match.disconnectTimer === null) return
    match.disconnectTimer = null
    match.disconnectStartedAt = null
    forfeitDisconnected(match, userId)
  }, windowMs)
}

export function leaveDuelByUser(userId: string, deadWs?: WebSocket): void {
  for (const [code, d] of duels) {
    if (d.player.userId === userId && (!deadWs || d.player.ws === deadWs)) {
      clearTimeout(d.timer)
      duels.delete(code)
    }
  }
}

export function joinDuelCreate(ws: WebSocket, userId: string, name: string, subjectId: string): void {
  if (rejoinIfInMatch(ws, userId)) return
  if (!joinAttemptAllowed(userId)) {
    send(ws, { type: 'error', message: 'duel_join_rate_limited' })
    return
  }
  removeFromQueue(userId, ws)
  leaveDuelByUser(userId)

  let code = ''
  for (let i = 0; i < 10; i++) {
    code = String(randomInt(100_000, 1_000_000))
    if (!duels.has(code)) break
  }
  if (duels.has(code)) {
    send(ws, { type: 'error', message: 'server_full' })
    return
  }

  const player: Player = { ws, userId, name, subjectId, queueTimer: null }
  const timer = setTimeout(() => {
    const cur = duels.get(code)
    if (cur && cur.player.userId === userId) {
      duels.delete(code)
      send(ws, { type: 'error', message: 'duel_timeout' })
    }
  }, DUEL_TIMEOUT)
  duels.set(code, { player, timer })
  send(ws, { type: 'duel_created', code })
}

export function joinDuel(ws: WebSocket, userId: string, name: string, rawCode: string, fallbackSubjectId: string): void {
  if (rejoinIfInMatch(ws, userId)) return

  if (!joinAttemptAllowed(userId)) {
    send(ws, { type: 'error', message: 'duel_join_rate_limited' })
    return
  }

  removeFromQueue(userId, ws)

  const code = rawCode.trim().toLowerCase().replace(/^(?:duel|room)-/, '')
  const existing = duels.get(code)
  if (existing) {
    const isDifferentPlayer = existing.player.userId !== userId || (!isAuthEnforced() && existing.player.ws !== ws)
    if (isDifferentPlayer) {
      clearTimeout(existing.timer)
      duels.delete(code)
      const joinerUid = existing.player.userId === userId ? `${userId}_2` : userId
      const joiner: Player = { ws, userId: joinerUid, name, subjectId: existing.player.subjectId, queueTimer: null }
      startMatch(existing.player, joiner)
      return
    }
  }
  leaveDuelByUser(userId)
  const player: Player = { ws, userId, name, subjectId: fallbackSubjectId, queueTimer: null }
  const timer = setTimeout(() => {
    const cur = duels.get(code)
    if (cur && cur.player.userId === userId) {
      duels.delete(code)
      send(ws, { type: 'error', message: 'duel_timeout' })
    }
  }, DUEL_TIMEOUT)
  duels.set(code, { player, timer })
}

export function rejoinIfInMatch(ws: WebSocket, userId: string): boolean {
  if (!playerToMatch.has(userId)) return false
  if (!rejoinMatch(ws, userId)) {
    send(ws, { type: 'error', message: 'already_in_match' })
  }
  return true
}

export function removeFromQueue(userId: string, ws: WebSocket): void {
  const queued = queue.get(userId)
  if (!queued) return
  if (queued.queueTimer) clearTimeout(queued.queueTimer)
  queue.delete(userId)
  if (queued.ws !== ws && queued.ws.readyState === WebSocket.OPEN) {
    queued.ws.close(1000, 'replaced_by_new_tab')
  }
}

export function joinQueue(ws: WebSocket, userId: string, name: string, subjectId: string): void {
  if (rejoinIfInMatch(ws, userId)) return

  leaveDuelByUser(userId)

  const existing = queue.get(userId)
  if (existing) {
    if (existing.queueTimer) clearTimeout(existing.queueTimer)
    if (existing.ws !== ws && existing.ws.readyState === WebSocket.OPEN) {
      existing.ws.close(1000, 'replaced_by_new_tab')
    }
    queue.delete(userId)
  }

  const waiting = [...queue.values()].find((p) => p.userId !== userId && p.subjectId === subjectId)
  if (waiting) {
    queue.delete(waiting.userId)
    const joiner: Player = { ws, userId, name, subjectId, queueTimer: null }
    startMatch(waiting, joiner)
    return
  }

  const player: Player = { ws, userId, name, subjectId, queueTimer: null }
  player.queueTimer = setTimeout(() => {
    if (queue.get(userId) === player) {
      queue.delete(userId)
      send(ws, { type: 'error', message: 'queue_timeout' })
    }
  }, QUEUE_TIMEOUT)
  queue.set(userId, player)
}

export function handleAnswer(ws: WebSocket, userId: string, matchId: string, index: number, optionId: string): void {
  const match = matches.get(matchId)
  if (!match || !match.roundState || match.roundState.resolved) return
  if (!match.players.some((p) => p.userId === userId)) return

  if (!Number.isInteger(index) || index !== match.round) return

  const rs = match.roundState
  if (rs.answers.has(userId)) return

  rs.answers.set(userId, optionId)

  const correct = correctFor(match.questionIds[index], match.pool)
  send(ws, { type: 'answer_ack', index, correct: optionId === correct, correctOptionId: correct })

  const opponent = match.players.find((p) => p.userId !== userId)
  if (opponent) send(opponent.ws, { type: 'opp_answered', index })

  if (rs.answers.size === 2) resolveRound(match, index)
}

export function handleReaction(userId: string, matchId: string, kindRaw: unknown, contentRaw: unknown): void {
  const match = matches.get(matchId)
  if (!match || !match.players.some((p) => p.userId === userId)) return

  const now = Date.now()
  const lastTime = lastReactionTime.get(userId) ?? 0
  if (now - lastTime < 1200) return
  lastReactionTime.set(userId, now)

  const kind = kindRaw === 'phrase' || kindRaw === 'prop' ? kindRaw : 'emoji'
  const content = String(contentRaw ?? '').slice(0, 120)
  if (!content) return

  for (const p of match.players) {
    send(p.ws, {
      type: 'reaction',
      senderId: userId,
      kind,
      content,
    })
  }
}

export function handleLeaveQueue(userId: string): void {
  const queued = queue.get(userId)
  if (queued?.queueTimer) clearTimeout(queued.queueTimer)
  queue.delete(userId)
  leaveDuelByUser(userId)
}
