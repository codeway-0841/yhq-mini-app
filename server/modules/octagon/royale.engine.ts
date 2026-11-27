/**
 * KIVVI Battle Royale — Server-Authoritative Live Elimination Engine (Coinsiz).
 *
 * Arxitektura:
 * - Har bir `subjectId` uchun bitta faol Battle Royale xonasi (`roomsBySubject`)
 * - 100% server-authoritative: savol javob kalitlari hech qachon client'ga ketmaydi
 * - 1 ta bepul Qalqon (Shield): 1-xatoni kechiradi, 2-xatoda chiqib ketadi (Spectator)
 * - `ensurePool(subjectId)` orqali lazy question loading (boot'da 0 egress)
 * - Graceful cleanup: bo'sh xonalar va barcha taymerlar tozalanadi
 */

import { randomUUID } from 'crypto'
import type { WebSocket } from 'ws'
import {
  ROYALE_COUNTDOWN_SECONDS,
  ROYALE_FREE_SHIELDS,
  ROYALE_LOBBY_AUTOTIMER_SECONDS,
  ROYALE_MAX_PLAYERS,
  ROYALE_QUESTION_SECONDS,
  ROYALE_REVEAL_SECONDS,
  ROYALE_ROUNDS,
  secondsUntilNextDailyShow,
  type RoyaleFinishedPayload,
  type RoyaleLobbySnapshot,
  type RoyaleParticipantSummary,
  type RoyalePhase,
  type RoyalePlayerStatus,
  type RoyaleRevealPayload,
} from '../../../shared/battle-royale'
import { ensurePool, MAX_NAME_LEN, send, type QuestionPoolItem } from './octagon.engine'

interface RoyalePlayer {
  ws: WebSocket | null
  userId: string
  name: string
  status: RoyalePlayerStatus
  shieldsLeft: number
  correctCount: number
  eliminatedRound: number | null
  totalTimeMs: number
  connected: boolean
}

interface RoyaleRoundState {
  answers: Map<string, { optionId: string; elapsedMs: number }>
  startedAt: number
  deadline: number
  timer: ReturnType<typeof setTimeout>
  resolved: boolean
}

interface RoyaleRoom {
  id: string
  subjectId: string
  phase: RoyalePhase
  players: Map<string, RoyalePlayer>
  questions: QuestionPoolItem[]
  round: number
  roundState: RoyaleRoundState | null
  lobbyTimer: ReturnType<typeof setTimeout> | null
  lobbyStartsAt: number | null
  phaseTimer: ReturnType<typeof setTimeout> | null
}

const roomsBySubject = new Map<string, RoyaleRoom>()
const userToSubject = new Map<string, string>()

function pickRandomQuestions(pool: QuestionPoolItem[], count: number): QuestionPoolItem[] {
  const copy = pool.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy.slice(0, Math.min(count, copy.length))
}

function toPublicQuestion(item: QuestionPoolItem) {
  if (!item.textUz && !item.textRu) return null
  return {
    questionId: item.id,
    textUz: item.textUz ?? '',
    textRu: item.textRu ?? item.textUz ?? '',
    optionsUz: item.optionsUz ?? {},
    optionsRu: item.optionsRu ?? item.optionsUz ?? {},
    image: item.image ?? null,
  }
}

function aliveCountOf(room: RoyaleRoom): number {
  let n = 0
  for (const p of room.players.values()) {
    if (p.status === 'alive') n++
  }
  return n
}

function clearRoomTimers(room: RoyaleRoom): void {
  if (room.lobbyTimer) {
    clearTimeout(room.lobbyTimer)
    room.lobbyTimer = null
  }
  if (room.phaseTimer) {
    clearTimeout(room.phaseTimer)
    room.phaseTimer = null
  }
  if (room.roundState?.timer) {
    clearTimeout(room.roundState.timer)
  }
}

function buildLobbySnapshot(room: RoyaleRoom): RoyaleLobbySnapshot {
  const startsInSec = room.lobbyStartsAt
    ? Math.max(0, Math.ceil((room.lobbyStartsAt - Date.now()) / 1000))
    : null
  const previewPlayers: Array<{ userId: string; name: string }> = []
  for (const p of room.players.values()) {
    if (previewPlayers.length >= 24) break
    previewPlayers.push({ userId: p.userId, name: p.name })
  }
  return {
    roomId: room.id,
    subjectId: room.subjectId,
    phase: room.phase,
    playerCount: room.players.size,
    aliveCount: aliveCountOf(room),
    maxPlayers: ROYALE_MAX_PLAYERS,
    startsInSec,
    nextDailyShowSec: secondsUntilNextDailyShow(),
    players: previewPlayers,
  }
}

function broadcast(room: RoyaleRoom, payload: object): void {
  for (const p of room.players.values()) {
    if (p.connected && p.ws) send(p.ws, payload)
  }
}

function getOrCreateLobbyRoom(subjectId: string): RoyaleRoom {
  const existing = roomsBySubject.get(subjectId)
  if (existing && existing.phase !== 'finished') return existing
  if (existing) clearRoomTimers(existing)
  const room: RoyaleRoom = {
    id: `br-${randomUUID().slice(0, 8)}`,
    subjectId,
    phase: 'lobby',
    players: new Map(),
    questions: [],
    round: 0,
    roundState: null,
    lobbyTimer: null,
    lobbyStartsAt: null,
    phaseTimer: null,
  }
  roomsBySubject.set(subjectId, room)
  return room
}

function broadcastLobby(room: RoyaleRoom): void {
  broadcast(room, { type: 'royale_lobby', ...buildLobbySnapshot(room) })
}

function scheduleLobbyAutoStart(room: RoyaleRoom): void {
  if (room.phase !== 'lobby' || room.lobbyTimer || room.players.size < 2) return
  room.lobbyStartsAt = Date.now() + ROYALE_LOBBY_AUTOTIMER_SECONDS * 1000
  room.lobbyTimer = setTimeout(() => {
    room.lobbyTimer = null
    room.lobbyStartsAt = null
    void startCountdown(room)
  }, ROYALE_LOBBY_AUTOTIMER_SECONDS * 1000)
}

async function startCountdown(room: RoyaleRoom): Promise<void> {
  if (room.phase !== 'lobby' || room.players.size === 0) return
  clearRoomTimers(room)
  room.lobbyStartsAt = null

  let pool: QuestionPoolItem[]
  try {
    pool = await ensurePool(room.subjectId)
  } catch {
    broadcast(room, { type: 'error', message: 'questions_unavailable' })
    return
  }
  if (pool.length === 0) {
    broadcast(room, { type: 'error', message: 'questions_unavailable' })
    return
  }

  room.questions = pickRandomQuestions(pool, ROYALE_ROUNDS)
  room.phase = 'countdown'
  room.round = 0
  broadcast(room, {
    type: 'royale_state',
    roomId: room.id,
    subjectId: room.subjectId,
    phase: 'countdown',
    countdownSec: ROYALE_COUNTDOWN_SECONDS,
    totalPlayers: room.players.size,
    aliveCount: aliveCountOf(room),
    totalRounds: room.questions.length,
  })

  room.phaseTimer = setTimeout(() => {
    room.phaseTimer = null
    startRound(room, 0)
  }, ROYALE_COUNTDOWN_SECONDS * 1000)
}

function startRound(room: RoyaleRoom, index: number): void {
  if (index >= room.questions.length) {
    finishRoom(room)
    return
  }
  const q = room.questions[index]
  room.phase = 'question'
  room.round = index
  const startedAt = Date.now()
  const deadline = startedAt + ROYALE_QUESTION_SECONDS * 1000
  const timer = setTimeout(() => resolveRound(room), ROYALE_QUESTION_SECONDS * 1000)

  room.roundState = {
    answers: new Map(),
    startedAt,
    deadline,
    timer,
    resolved: false,
  }

  const pubQ = toPublicQuestion(q)
  const aliveCount = aliveCountOf(room)
  const totalPlayers = room.players.size
  for (const p of room.players.values()) {
    if (!p.connected || !p.ws) continue
    send(p.ws, {
      type: 'royale_question',
      roomId: room.id,
      round: index,
      totalRounds: room.questions.length,
      questionId: q.id,
      timeLimit: ROYALE_QUESTION_SECONDS,
      aliveCount,
      totalPlayers,
      yourStatus: p.status,
      shieldsLeft: p.shieldsLeft,
      question: pubQ,
    })
  }
}

function resolveRound(room: RoyaleRoom): void {
  const rs = room.roundState
  if (!rs || rs.resolved) return
  rs.resolved = true
  clearTimeout(rs.timer)

  const q = room.questions[room.round]
  const correctId = q.correct
  let eliminatedThisRound = 0
  const outcomes = new Map<string, RoyaleRevealPayload['yourOutcome']>()

  for (const p of room.players.values()) {
    if (p.status !== 'alive') {
      outcomes.set(p.userId, 'spectator')
      continue
    }
    const ans = rs.answers.get(p.userId)
    if (ans && ans.optionId === correctId) {
      p.correctCount += 1
      p.totalTimeMs += ans.elapsedMs
      outcomes.set(p.userId, 'correct')
    } else if (p.shieldsLeft > 0) {
      p.shieldsLeft -= 1
      p.totalTimeMs += ans ? ans.elapsedMs : ROYALE_QUESTION_SECONDS * 1000
      outcomes.set(p.userId, 'shield_saved')
    } else {
      p.status = 'eliminated'
      p.eliminatedRound = room.round + 1
      p.totalTimeMs += ans ? ans.elapsedMs : ROYALE_QUESTION_SECONDS * 1000
      eliminatedThisRound += 1
      outcomes.set(p.userId, 'eliminated')
    }
  }

  room.phase = 'reveal'
  const aliveCount = aliveCountOf(room)
  const totalPlayers = room.players.size

  for (const p of room.players.values()) {
    if (!p.connected || !p.ws) continue
    const reveal: RoyaleRevealPayload & { type: 'royale_reveal' } = {
      type: 'royale_reveal',
      roomId: room.id,
      round: room.round,
      totalRounds: room.questions.length,
      correctOptionId: correctId,
      aliveCount,
      totalPlayers,
      eliminatedThisRound,
      yourOutcome: outcomes.get(p.userId) ?? 'spectator',
      yourStatus: p.status,
      shieldsLeft: p.shieldsLeft,
      correctCount: p.correctCount,
    }
    send(p.ws, reveal)
  }

  const multiPlayerDone = totalPlayers >= 2 && aliveCount <= 1
  const allOut = aliveCount === 0
  const lastRound = room.round + 1 >= room.questions.length

  room.phaseTimer = setTimeout(() => {
    room.phaseTimer = null
    if (multiPlayerDone || allOut || lastRound) {
      finishRoom(room)
    } else {
      startRound(room, room.round + 1)
    }
  }, ROYALE_REVEAL_SECONDS * 1000)
}

function rankParticipants(room: RoyaleRoom): RoyaleParticipantSummary[] {
  const list: RoyaleParticipantSummary[] = Array.from(room.players.values()).map((p) => ({
    userId: p.userId,
    name: p.name,
    status: p.status,
    shieldsLeft: p.shieldsLeft,
    correctCount: p.correctCount,
    eliminatedRound: p.eliminatedRound,
    totalTimeMs: p.totalTimeMs,
  }))

  list.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'alive' ? -1 : 1
    if (a.correctCount !== b.correctCount) return b.correctCount - a.correctCount
    const erA = a.eliminatedRound ?? 999
    const erB = b.eliminatedRound ?? 999
    if (erA !== erB) return erB - erA
    return a.totalTimeMs - b.totalTimeMs
  })

  list.forEach((entry, idx) => {
    entry.rank = idx + 1
  })
  return list
}

function finishRoom(room: RoyaleRoom): void {
  clearRoomTimers(room)
  room.phase = 'finished'
  room.roundState = null

  const ranked = rankParticipants(room)
  const podium = ranked.slice(0, 3)
  const roundsPlayed = Math.min(room.questions.length, room.round + 1)

  for (const p of room.players.values()) {
    const entry = ranked.find((r) => r.userId === p.userId)
    if (p.connected && p.ws) {
      const payload: RoyaleFinishedPayload & { type: 'royale_finished' } = {
        type: 'royale_finished',
        roomId: room.id,
        subjectId: room.subjectId,
        totalPlayers: room.players.size,
        roundsPlayed,
        podium,
        yourRank: entry?.rank ?? room.players.size,
        yourCorrect: p.correctCount,
        yourStatus: p.status,
      }
      send(p.ws, payload)
    }
    if (userToSubject.get(p.userId) === room.subjectId) {
      userToSubject.delete(p.userId)
    }
  }

  roomsBySubject.delete(room.subjectId)
}

// ── Public Gateway Handlers ────────────────────────────────────────────────

export function getRoyaleLobbyStatus(subjectId: string): RoyaleLobbySnapshot {
  const room = roomsBySubject.get(subjectId)
  if (!room || room.phase === 'finished') {
    return {
      roomId: '',
      subjectId,
      phase: 'lobby',
      playerCount: 0,
      aliveCount: 0,
      maxPlayers: ROYALE_MAX_PLAYERS,
      startsInSec: null,
      nextDailyShowSec: secondsUntilNextDailyShow(),
      players: [],
    }
  }
  return buildLobbySnapshot(room)
}

export function joinRoyale(ws: WebSocket, userId: string, rawName: string, subjectId: string): void {
  const name = rawName.trim().slice(0, MAX_NAME_LEN) || "Noma'lum"

  // Agar oldin boshqa fanda lobbyda bo'lsa chiqaramiz
  const prevSubject = userToSubject.get(userId)
  if (prevSubject && prevSubject !== subjectId) {
    leaveRoyale(userId)
  }

  const room = getOrCreateLobbyRoom(subjectId)
  const existing = room.players.get(userId)

  // Qayta ulanish (reconnect)
  if (existing) {
    existing.ws = ws
    existing.connected = true
    existing.name = name
    userToSubject.set(userId, subjectId)

    if (room.phase === 'lobby') {
      broadcastLobby(room)
    } else if (room.phase === 'question' && room.roundState) {
      const q = room.questions[room.round]
      const remSec = Math.max(1, Math.ceil((room.roundState.deadline - Date.now()) / 1000))
      send(ws, {
        type: 'royale_question',
        roomId: room.id,
        round: room.round,
        totalRounds: room.questions.length,
        questionId: q.id,
        timeLimit: remSec,
        aliveCount: aliveCountOf(room),
        totalPlayers: room.players.size,
        yourStatus: existing.status,
        shieldsLeft: existing.shieldsLeft,
        question: toPublicQuestion(q),
      })
    } else {
      send(ws, { type: 'royale_lobby', ...buildLobbySnapshot(room) })
    }
    return
  }

  // O'yin ketayotgan xonaga kechikib kirganlar Tomoshabin (Spectator) sifatida ulanadi
  if (room.players.size >= ROYALE_MAX_PLAYERS) {
    send(ws, { type: 'error', message: 'royale_full' })
    return
  }

  const lateJoin = room.phase !== 'lobby'
  const player: RoyalePlayer = {
    ws,
    userId,
    name,
    status: lateJoin ? 'eliminated' : 'alive',
    shieldsLeft: lateJoin ? 0 : ROYALE_FREE_SHIELDS,
    correctCount: 0,
    eliminatedRound: lateJoin ? 0 : null,
    totalTimeMs: 0,
    connected: true,
  }
  room.players.set(userId, player)
  userToSubject.set(userId, subjectId)

  if (room.phase === 'lobby') {
    scheduleLobbyAutoStart(room)
    broadcastLobby(room)
  } else if (room.phase === 'question' && room.roundState) {
    const q = room.questions[room.round]
    const remSec = Math.max(1, Math.ceil((room.roundState.deadline - Date.now()) / 1000))
    send(ws, {
      type: 'royale_question',
      roomId: room.id,
      round: room.round,
      totalRounds: room.questions.length,
      questionId: q.id,
      timeLimit: remSec,
      aliveCount: aliveCountOf(room),
      totalPlayers: room.players.size,
      yourStatus: player.status,
      shieldsLeft: 0,
      question: toPublicQuestion(q),
    })
  } else {
    send(ws, { type: 'royale_lobby', ...buildLobbySnapshot(room) })
  }
}

export function startRoyaleNow(userId: string): void {
  const subjectId = userToSubject.get(userId)
  if (!subjectId) return
  const room = roomsBySubject.get(subjectId)
  if (!room || room.phase !== 'lobby' || !room.players.has(userId)) return
  void startCountdown(room)
}

export function handleRoyaleAnswer(userId: string, roundIndex: number, optionId: string): void {
  const subjectId = userToSubject.get(userId)
  if (!subjectId) return
  const room = roomsBySubject.get(subjectId)
  if (!room || room.phase !== 'question' || !room.roundState) return
  if (room.round !== roundIndex || room.roundState.resolved) return

  const player = room.players.get(userId)
  if (!player || player.status !== 'alive') return
  if (room.roundState.answers.has(userId)) return

  const elapsedMs = Math.max(0, Date.now() - room.roundState.startedAt)
  room.roundState.answers.set(userId, { optionId, elapsedMs })

  if (player.connected && player.ws) {
    send(player.ws, {
      type: 'royale_answer_ack',
      roomId: room.id,
      round: roundIndex,
      optionId,
    })
  }

  // Barcha tirik o'yinchilar javob berganda raundni darhol yopamiz (tezkor temp!)
  let allAliveAnswered = true
  for (const p of room.players.values()) {
    if (p.status === 'alive' && p.connected && !room.roundState.answers.has(p.userId)) {
      allAliveAnswered = false
      break
    }
  }
  if (allAliveAnswered) {
    resolveRound(room)
  }
}

export function leaveRoyale(userId: string): void {
  const subjectId = userToSubject.get(userId)
  if (!subjectId) return
  userToSubject.delete(userId)
  const room = roomsBySubject.get(subjectId)
  if (!room) return

  if (room.phase === 'lobby') {
    room.players.delete(userId)
    if (room.players.size < 2 && room.lobbyTimer) {
      clearTimeout(room.lobbyTimer)
      room.lobbyTimer = null
      room.lobbyStartsAt = null
    }
    if (room.players.size === 0) {
      clearRoomTimers(room)
      roomsBySubject.delete(subjectId)
    } else {
      broadcastLobby(room)
    }
    return
  }

  const p = room.players.get(userId)
  if (p) {
    p.connected = false
    p.ws = null
  }
  // Agar hech kim ulanmagan bo'lsa, xonani tozalaymiz
  const anyConnected = Array.from(room.players.values()).some((pl) => pl.connected)
  if (!anyConnected) {
    clearRoomTimers(room)
    roomsBySubject.delete(subjectId)
  }
}

export function handleRoyaleDisconnect(ws: WebSocket, userId: string): void {
  const subjectId = userToSubject.get(userId)
  if (!subjectId) return
  const room = roomsBySubject.get(subjectId)
  if (!room) return
  const p = room.players.get(userId)
  if (!p || p.ws !== ws) return
  if (room.phase === 'lobby') {
    leaveRoyale(userId)
  } else {
    p.connected = false
    p.ws = null
  }
}

export function getRoyaleStats(): { royaleRooms: number; royalePlayers: number } {
  let royalePlayers = 0
  for (const room of roomsBySubject.values()) royalePlayers += room.players.size
  return { royaleRooms: roomsBySubject.size, royalePlayers }
}

export function resetRoyaleState(): void {
  for (const room of roomsBySubject.values()) clearRoomTimers(room)
  roomsBySubject.clear()
  userToSubject.clear()
}
