/**
 * Octagon PvP — WebSocket matchmaking + game loop.
 *
 * Protocol (server → client):
 *   matched        { matchId, opponentName, roundCount }      ← no questionIds upfront
 *   question       { index, questionId, timeLimit }           ← reveals one at a time
 *   answer_ack     { index, correct }
 *   opp_answered   { index }
 *   round_result   { index, yourScore, oppScore }
 *   match_end      { yourScore, oppScore, result: 'win'|'lose'|'draw' }
 *   opp_disconnected
 *   error          { message }
 *
 * Protocol (client → server):
 *   join_queue     { userId, name }
 *   answer         { matchId, index, optionId }
 *   leave_queue    { userId }
 */

import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { randomUUID } from 'crypto'
import { config }         from './config'
import { verifyInitData } from './utils/telegram'
import { isAuthEnforced } from './middleware/auth'

// ── Constants ──────────────────────────────────────────────────────────────

const ROUNDS        = 10
const ROUND_TIMEOUT = 15_000  // ms per question
const QUEUE_TIMEOUT = 60_000  // ms to find opponent before giving up
const MAX_MATCHES   = 500     // hard cap on concurrent matches — protects memory
const MAX_NAME_LEN  = 64

// ── Types ──────────────────────────────────────────────────────────────────

interface Player {
  ws:         WebSocket
  userId:     string
  name:       string
  queueTimer: ReturnType<typeof setTimeout> | null
}

interface RoundState {
  answers:  Map<string, string>  // userId → optionId
  timer:    ReturnType<typeof setTimeout>
  resolved: boolean
}

interface Match {
  id:          string
  players:     [Player, Player]
  questionIds: number[]           // server-only; never sent in bulk to clients
  scores:      Map<string, number>
  round:       number
  roundState:  RoundState | null
}

// ── Module state ───────────────────────────────────────────────────────────

let QUESTION_POOL: Array<{ id: number; correct: string }> = []

const queue:         Map<string, Player> = new Map()  // userId → Player
const matches:       Map<string, Match>  = new Map()  // matchId → Match
const playerToMatch: Map<string, string> = new Map()  // userId → matchId

// ── Helpers ────────────────────────────────────────────────────────────────

function send(ws: WebSocket, msg: object): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function pickQuestions(n: number): number[] {
  const pool = [...QUESTION_POOL]
  const out: number[] = []
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    out.push(pool.splice(idx, 1)[0].id)
  }
  return out
}

function correctFor(questionId: number): string {
  return QUESTION_POOL.find((q) => q.id === questionId)?.correct ?? ''
}

// ── Match lifecycle ────────────────────────────────────────────────────────

function startMatch(p1: Player, p2: Player): void {
  if (p1.queueTimer) clearTimeout(p1.queueTimer)
  if (p2.queueTimer) clearTimeout(p2.queueTimer)
  queue.delete(p1.userId)
  queue.delete(p2.userId)

  const matchId     = randomUUID()
  const questionIds = pickQuestions(ROUNDS)
  const scores      = new Map([[p1.userId, 0], [p2.userId, 0]])
  const match: Match = {
    id: matchId, players: [p1, p2], questionIds,
    scores, round: 0, roundState: null,
  }

  matches.set(matchId, match)
  playerToMatch.set(p1.userId, matchId)
  playerToMatch.set(p2.userId, matchId)

  // Send matched without questionIds — answers must not be pre-fetchable
  for (const [player, opponent] of [[p1, p2], [p2, p1]] as [Player, Player][]) {
    send(player.ws, {
      type: 'matched', matchId,
      opponentName: opponent.name,
      roundCount: questionIds.length,
    })
  }

  startRound(match)
}

function startRound(match: Match): void {
  if (match.round >= match.questionIds.length) {
    endMatch(match)
    return
  }

  const index      = match.round
  const questionId = match.questionIds[index]
  const timer      = setTimeout(() => resolveRound(match, index), ROUND_TIMEOUT)

  match.roundState = { answers: new Map(), timer, resolved: false }

  for (const p of match.players) {
    send(p.ws, { type: 'question', index, questionId, timeLimit: ROUND_TIMEOUT })
  }
}

function resolveRound(match: Match, index: number): void {
  const rs = match.roundState
  if (!rs || rs.resolved) return
  rs.resolved = true
  clearTimeout(rs.timer)

  const correct = correctFor(match.questionIds[index])

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
    })
  }

  match.round++
  setTimeout(() => startRound(match), 1000)
}

function endMatch(match: Match): void {
  const [p1, p2] = match.players
  const s1 = match.scores.get(p1.userId) ?? 0
  const s2 = match.scores.get(p2.userId) ?? 0

  const result = (self: number, opp: number): 'win' | 'lose' | 'draw' =>
    self > opp ? 'win' : self < opp ? 'lose' : 'draw'

  send(p1.ws, { type: 'match_end', yourScore: s1, oppScore: s2, result: result(s1, s2) })
  send(p2.ws, { type: 'match_end', yourScore: s2, oppScore: s1, result: result(s2, s1) })

  cleanupMatch(match)
}

function cleanupMatch(match: Match): void {
  for (const p of match.players) playerToMatch.delete(p.userId)
  matches.delete(match.id)
  if (match.roundState && !match.roundState.resolved) {
    clearTimeout(match.roundState.timer)
  }
}

function handleDisconnect(userId: string): void {
  // Remove from queue
  const queued = queue.get(userId)
  if (queued) {
    if (queued.queueTimer) clearTimeout(queued.queueTimer)
    queue.delete(userId)
    return
  }

  // Notify opponent and tear down match
  const matchId = playerToMatch.get(userId)
  if (!matchId) return
  const match = matches.get(matchId)
  if (!match) return

  const opponent = match.players.find((p) => p.userId !== userId)
  if (opponent) send(opponent.ws, { type: 'opp_disconnected' })

  cleanupMatch(match)
}

// ── Queue join — extracted to handle re-join timer leak ───────────────────

function joinQueue(ws: WebSocket, userId: string, name: string): void {
  // Already in a match
  if (playerToMatch.has(userId)) {
    send(ws, { type: 'error', message: 'already_in_match' })
    return
  }

  // Re-joining while already queued — cancel old timer first
  const existing = queue.get(userId)
  if (existing?.queueTimer) clearTimeout(existing.queueTimer)

  // Find a waiting opponent (not self)
  const waiting = [...queue.values()].find((p) => p.userId !== userId)
  if (waiting) {
    // Remove from queue before startMatch to avoid double-removal races
    queue.delete(waiting.userId)
    const joiner: Player = { ws, userId, name, queueTimer: null }
    startMatch(waiting, joiner)
    return
  }

  const player: Player = { ws, userId, name, queueTimer: null }
  player.queueTimer = setTimeout(() => {
    if (queue.get(userId) === player) {
      queue.delete(userId)
      send(ws, { type: 'error', message: 'queue_timeout' })
    }
  }, QUEUE_TIMEOUT)
  queue.set(userId, player)
}

// ── WebSocket server ───────────────────────────────────────────────────────

export function attachOctagon(
  wss: WebSocketServer,
  questionPool: Array<{ id: number; correct: string }>,
): void {
  QUESTION_POOL = questionPool

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    let userId: string | null = null

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>
      try { msg = JSON.parse(raw.toString()) } catch { return }

      if (msg.type === 'ping') {
        send(ws, { type: 'pong' })
        return
      }

      if (msg.type === 'join_queue') {
        userId = String(msg.userId ?? '')
        const name = String(msg.name ?? "Noma'lum").slice(0, MAX_NAME_LEN)

        // User must be authenticated in production — initData carries the signed id
        if (isAuthEnforced()) {
          const initData = String(msg.initData ?? '')
          const verified = initData && config.telegram.botToken
            ? verifyInitData(initData, config.telegram.botToken)
            : null
          if (!verified) {
            send(ws, { type: 'error', message: 'auth_failed' })
            ws.close(4001, 'Unauthorized')
            return
          }
          userId = String(verified.id)   // NEVER trust the client-supplied id
        }

        if (!/^\d+$/.test(userId)) {
          send(ws, { type: 'error', message: 'invalid_user' })
          return
        }

        if (matches.size >= MAX_MATCHES) {
          send(ws, { type: 'error', message: 'server_full' })
          return
        }

        joinQueue(ws, userId, name)
        return
      }

      if (msg.type === 'answer' && userId) {
        const matchId  = String(msg.matchId)
        const match    = matches.get(matchId)
        if (!match || !match.roundState || match.roundState.resolved) return

        const index = Number(msg.index)
        if (!Number.isInteger(index) || index !== match.round) return

        const rs       = match.roundState
        const optionId = String(msg.optionId)
        if (rs.answers.has(userId)) return  // already answered this round

        rs.answers.set(userId, optionId)

        const correct   = correctFor(match.questionIds[index])
        send(ws, { type: 'answer_ack', index, correct: optionId === correct })

        const opponent = match.players.find((p) => p.userId !== userId)
        if (opponent) send(opponent.ws, { type: 'opp_answered', index })

        if (rs.answers.size === 2) resolveRound(match, index)
        return
      }

      if (msg.type === 'leave_queue' && userId) {
        const queued = queue.get(userId)
        if (queued?.queueTimer) clearTimeout(queued.queueTimer)
        queue.delete(userId)
        return
      }
    })

    ws.on('close', () => {
      if (userId) handleDisconnect(userId)
    })
  })
}
