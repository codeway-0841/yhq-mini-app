/**
 * Octagon PvP — WebSocket matchmaking + game loop.
 *
 * Protocol (server → client):
 *   matched        { matchId, opponentName, roundCount }      ← no questionIds upfront
 *   question       { index, questionId, timeLimit }           ← reveals one at a time
 *   answer_ack     { index, correct, correctOptionId }   ← post-answer reveal
 *   opp_answered   { index }
 *   round_result   { index, yourScore, oppScore, correctOptionId }
 *   match_end      { yourScore, oppScore, result: 'win'|'lose'|'draw' }
 *   opp_waiting    { waitSeconds }                            ← opponent in reconnect grace window
 *   opp_reconnected
 *   opp_disconnected                                          ← grace window expired, opponent wins
 *   match_state    { matchId, index, questionId|null, ... }   ← state resync after rejoin
 *   error          { message }
 *
 * Protocol (client → server):
 *   join_queue     { userId, name, subjectId? }   (mid-match join = auto-rejoin)
 *   rejoin         { matchId, userId, name, initData? }
 *   answer         { matchId, index, optionId }
 *   leave_queue    { userId }
 *   ping
 */

import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { randomUUID } from 'crypto'
import { config }         from './config'
import { verifyInitData } from './utils/telegram'
import { isAuthEnforced } from './middleware/auth'
import { SUBJECT_IDS, DEFAULT_SUBJECT_ID, SUBJECT_REGISTRY, resolveSubject } from './config/subjects'
import { getProvider } from './providers'
import { progressRepository } from './modules/progress/progress.repository'
import { authRepository } from './modules/auth/auth.repository'

// ── Constants ──────────────────────────────────────────────────────────────

const ROUNDS              = 10
const ROUND_TIMEOUT       = 15_000  // ms per question
const QUEUE_TIMEOUT       = 60_000  // ms to find opponent before giving up
const DUEL_TIMEOUT        = 5 * 60_000  // do'st linkni ochishi uchun uzoqroq — 5 daqiqa
const MAX_MATCHES         = 500     // hard cap on concurrent matches — protects memory
const MAX_NAME_LEN        = 64
const RECONNECT_WINDOW_MS = 60_000  // raqib qaytish kutilishi (raqibga vaqt — 60s)

/** Duel kod validatsiyasi: `duel-xxxxxx` faqat xavfsiz belgilar */
const DUEL_CODE_RE = /^duel-[a-z0-9]{6,16}$/

/** Canonical user id (Telegram raqam-string YOKI telefon akkaunt 'p_<digits>') */
const WS_USER_ID_RE = /^(?:\d{1,20}|p_\d{9,15})$/

/**
 * WS auth: client userId'siga HECH QACHON ishonilmaydi — faqat initData
 * (Mini App) imzosi YOKI sessionToken (telefon+parol / TG widget sessiyasi,
 * DB resolve) orqali aniqlangan id. Production'da ikkalasi ham yo'q bo'lsa null.
 */
async function resolveWsUserId(msg: Record<string, unknown>): Promise<string | null> {
  const initData = String(msg.initData ?? '')
  if (initData && config.telegram.botToken) {
    const verified = verifyInitData(initData, config.telegram.botToken)
    return verified ? String(verified.id) : null
  }
  const token = String(msg.sessionToken ?? '')
  if (token) {
    const session = await authRepository.resolveSession(token).catch(() => null)
    return session?.userId ?? null
  }
  return null
}

// ── Connection hardening limitlari ─────────────────────────────────────────
// Testlarda qisqartirilgan qiymatlar bilan attach qilinadi.

export interface OctagonLimits {
  /** Auth'siz (join_queue/rejoin qilmagan) socket shu muddatda terminate bo'ladi */
  authDeadlineMs:  number
  /** Server ping intervali; 2 davr javob (pong/message) bo'lmasa — terminate */
  heartbeatMs:     number
  /** Bitta connection uchun message oynasi hajmi */
  msgWindowMs:     number
  /** Oyna ichidagi max xabarlar soni (oshqanda 1008 rate_limited) */
  maxMsgsPerWindow: number
  /** Bir foydalanuvchiga parallel socketlar soni */
  maxConnsPerUser: number
}

export const DEFAULT_OCTAGON_LIMITS: OctagonLimits = {
  authDeadlineMs:   10_000,
  heartbeatMs:      30_000,
  msgWindowMs:      10_000,
  maxMsgsPerWindow: 50,
  maxConnsPerUser:  3,
}

// ── Per-subject question pools ─────────────────────────────────────────────
// dataSourceId → pool. Pairing subjectId bo'yicha, savollar esa usha fanning
// dataSource bankasidan olinadi (SubjectRegistry → provider).
export type QuestionPoolItem = { id: number; correct: string }
export type OctagonPools = Map<string, QuestionPoolItem[]>

// ── Types ──────────────────────────────────────────────────────────────────

interface Player {
  ws:         WebSocket
  userId:     string
  name:       string
  subjectId:  string   // faqat bir xil fan tanlagan o'yinchilar juftlashadi
  queueTimer: ReturnType<typeof setTimeout> | null
}

interface RoundState {
  answers:   Map<string, string>  // userId → optionId
  timer:     ReturnType<typeof setTimeout>
  resolved:  boolean
  startedAt: number               // rejoin uchun qolgan vaqtni hisoblash
  /** Raqib uzilganda raund PAUSE: qolgan vaqt saqlanadi, taymer to'xtatiladi */
  paused:    boolean
  remainingMs: number
}

interface Match {
  id:              string
  players:         [Player, Player]
  pool:            QuestionPoolItem[] // shu match fanining savol havzasi
  questionIds:     number[]           // server-only; never sent in bulk to clients
  scores:          Map<string, number>
  round:           number
  roundState:      RoundState | null
  disconnectTimer: ReturnType<typeof setTimeout> | null  // reconnect grace window
  gapTimer:        ReturnType<typeof setTimeout> | null  // rounds orasidagi 1s pauza
}

// ── Module state ───────────────────────────────────────────────────────────

let QUESTION_POOLS: OctagonPools = new Map()

const queue:         Map<string, Player> = new Map()  // userId → Player
const matches:       Map<string, Match>  = new Map()  // matchId → Match
const playerToMatch: Map<string, string> = new Map()  // userId → matchId

/** subjectId → savol havzasi (dataSourceId orqali); fallback — birinchi mavjud pool. */
function poolForSubject(subjectId: string): QuestionPoolItem[] {
  const entry = resolveSubject(subjectId)
  return QUESTION_POOLS.get(entry.dataSourceId)
    ?? QUESTION_POOLS.values().next().value
    ?? []
}

// ── Helpers ────────────────────────────────────────────────────────────────

function send(ws: WebSocket, msg: object): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function pickQuestions(n: number, pool: QuestionPoolItem[]): number[] {
  const copy = [...pool]
  const out: number[] = []
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0].id)
  }
  return out
}

function correctFor(questionId: number, pool: QuestionPoolItem[]): string {
  return pool.find((q) => q.id === questionId)?.correct ?? ''
}

// ── Match lifecycle ────────────────────────────────────────────────────────

function startMatch(p1: Player, p2: Player): void {
  if (p1.queueTimer) clearTimeout(p1.queueTimer)
  if (p2.queueTimer) clearTimeout(p2.queueTimer)
  queue.delete(p1.userId)
  queue.delete(p2.userId)

  const matchId     = randomUUID()
  // Ikkala o'yinchi bir xil subjectId (matchmaking filtri) — p1'dan olamiz
  const pool        = poolForSubject(p1.subjectId)
  const questionIds = pickQuestions(ROUNDS, pool)
  const scores      = new Map([[p1.userId, 0], [p2.userId, 0]])
  const match: Match = {
    id: matchId, players: [p1, p2], pool, questionIds,
    scores, round: 0, roundState: null, disconnectTimer: null, gapTimer: null,
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
  // Defensive: don't start new round if one already active (prevents state corruption on rapid calls)
  if (match.roundState && !match.roundState.resolved) {
    console.warn('[octagon] startRound blocked - round already active', { matchId: match.id, round: match.round })
    return
  }

  // Check end condition BEFORE scheduling timer to prevent leak on rapid cleanup
  if (match.round >= match.questionIds.length) {
    endMatch(match)
    return
  }

  // Paranoid cleanup: clear orphaned timer (edge case: resolved=true but timer exists from reconnect flow)
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

function resolveRound(match: Match, index: number): void {
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
      // Round yopildi — javob endi siroq emas, ikkala o'yinchiga ham ochiladi
      correctOptionId: correct,
    })
  }

  match.round++
  // Orphan guard: match grace-window (yoki boshqa sabab) bilan tozalanib ketishi mumkin —
  // cleanupMatch match.gapTimer'ni bekor qiladi; bu tekshiruv esa ikki xavfsizlik chizig'i.
  match.gapTimer = setTimeout(() => {
    match.gapTimer = null
    if (!matches.has(match.id)) return
    startRound(match)
  }, 1000)
}

function endMatch(match: Match): void {
  const [p1, p2] = match.players
  const s1 = match.scores.get(p1.userId) ?? 0
  const s2 = match.scores.get(p2.userId) ?? 0

  const result = (self: number, opp: number): 'win' | 'lose' | 'draw' =>
    self > opp ? 'win' : self < opp ? 'lose' : 'draw'

  send(p1.ws, { type: 'match_end', yourScore: s1, oppScore: s2, result: result(s1, s2) })
  send(p2.ws, { type: 'match_end', yourScore: s2, oppScore: s1, result: result(s2, s1) })

  // G'alilgan — Yutuqlar uchun DB'ga yozamiz (fire-and-forget; draw da yo'q)
  const winnerId = s1 > s2 ? p1.userId : s1 < s2 ? p2.userId : null
  if (winnerId && winnerId !== '0') {
    void progressRepository.addOctagonWin(winnerId)
      .catch((err) => console.error('[octagon] addOctagonWin failed:', err?.message ?? err))
  }

  cleanupMatch(match)
}

function cleanupMatch(match: Match): void {
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

/**
 * Reconnect a player into their live match — replace dead socket, cancel the
 * forfeit timer, resync full state, notify the opponent. Returns false when
 * there is nothing to rejoin (match already cleaned up).
 */
function rejoinMatch(ws: WebSocket, userId: string): boolean {
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

  // RESUME: raund pauza'da bo'lgan bo'lsa — qolgan vaqtidan davom ettiriladi
  const rs = match.roundState
  if (rs && !rs.resolved && rs.paused) {
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
    // Qayta kirgan o'yinchi uchun QOLGAN vaqt — to'liq 15s emas
    timeLimit:    active ? Math.max(0, ROUND_TIMEOUT - (Date.now() - rs.startedAt)) : ROUND_TIMEOUT,
    roundCount:   match.questionIds.length,
    yourScore:    match.scores.get(userId) ?? 0,
    oppScore:     opponent ? (match.scores.get(opponent.userId) ?? 0) : 0,
    opponentName: opponent?.name ?? 'Raqib',
    yourAnswer:   active ? (rs.answers.get(userId) ?? null) : null,
    oppAnswered:  opponent ? (active ? rs.answers.has(opponent.userId) : false) : false,
    // Qayta kirganda javob berib qo'yilgan bo'lsa — highlight uchun reveal
    correctOptionId: active && rs.answers.get(userId) != null
      ? correctFor(match.questionIds[match.round], match.pool)
      : null,
  })
  if (opponent) send(opponent.ws, { type: 'opp_reconnected' })
  return true
}

function handleDisconnect(userId: string, deadWs: WebSocket): void {
  // Remove from queue — faqat o'sha socketga tegishli entryni.
  // Yangi socketda qayta join_queue bo'lgan bo'lsa, eski socketning close eventi
  // YANGI entryni o'chirib yubormasligi kerak (aks holda user "searching"da qoladi).
  const queued = queue.get(userId)
  if (queued) {
    if (queued.ws !== deadWs) return
    if (queued.queueTimer) clearTimeout(queued.queueTimer)
    queue.delete(userId)
    return
  }

  // Duel kutilishi — o'sha socketniki bo'lsa o'chiramiz
  leaveDuelByUser(userId, deadWs)

  const matchId = playerToMatch.get(userId)
  if (!matchId) return
  const match = matches.get(matchId)
  if (!match || match.disconnectTimer) return   // already in the grace window

  // Mid-match disconnect: give the player a grace window to come back.
  // Round timers keep running — a rejoining player loses at most one round.
  const opponent = match.players.find((p) => p.userId !== userId)
  if (opponent) {
    send(opponent.ws, { type: 'opp_waiting', waitSeconds: RECONNECT_WINDOW_MS / 1000 })
  }

  // PAUSE: o'yin to'xtatiladi — raqib qaytsa shu joyidan davom etadi
  const rs0 = match.roundState
  if (rs0 && !rs0.resolved && !rs0.paused) {
    rs0.remainingMs = Math.max(0, ROUND_TIMEOUT - (Date.now() - rs0.startedAt))
    clearTimeout(rs0.timer)
    rs0.paused = true
  }

  match.disconnectTimer = setTimeout(() => {
    // Guard: check match still exists and player still disconnected (rejoin clears timer)
    if (!matches.has(matchId)) return  // match already cleaned up
    if (match.disconnectTimer === null) return  // rejoined, timer was cleared
    match.disconnectTimer = null
    // Never came back — opponent wins by forfeit (Yutuqlar uchun ham hisoblanadi).
    const opp = match.players.find((p) => p.userId !== userId)
    if (opp) {
      send(opp.ws, { type: 'opp_disconnected' })
      if (opp.userId !== '0') {
        void progressRepository.addOctagonWin(opp.userId)
          .catch((err) => console.error('[octagon] forfeit win save failed:', err?.message ?? err))
      }
    }
    cleanupMatch(match)
  }, RECONNECT_WINDOW_MS)
}

// ── Queue join — extracted to handle re-join timer leak ───────────────────

/**
 * Duel (do'stlar o'rtasida) — kutilayotgan yaratuvchilar: code → kutuvchi o'yinchi.
 * Do'st shu kod bilan join_queue qilganda juftlashadi; savollar YARATUVCHIning
 * fanidan olinadi (ikkinchi o'yinchida boshqa fan tanlangan bo'lishi mumkin).
 */
interface PendingDuel { player: Player; timer: ReturnType<typeof setTimeout> }
const duels = new Map<string, PendingDuel>()

function leaveDuelByUser(userId: string, deadWs?: WebSocket): void {
  for (const [code, d] of duels) {
    if (d.player.userId === userId && (!deadWs || d.player.ws === deadWs)) {
      clearTimeout(d.timer)
      duels.delete(code)
    }
  }
}

function joinDuel(ws: WebSocket, userId: string, name: string, code: string, fallbackSubjectId: string): void {
  const existing = duels.get(code)
  if (existing && existing.player.userId !== userId) {
    // Do'st keldi — juftlaymiz (YARATUVCHIning fan savollarida)
    clearTimeout(existing.timer)
    duels.delete(code)
    const joiner: Player = { ws, userId, name, subjectId: existing.player.subjectId, queueTimer: null }
    startMatch(existing.player, joiner)
    return
  }
  // Yaratuvchi kutilmoqda (yoki reconnect — yangi socket bilan yangilanadi)
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

function joinQueue(ws: WebSocket, userId: string, name: string, subjectId: string): void {
  // Coming back to a live match (app relaunch within grace window) — rejoin it
  if (playerToMatch.has(userId)) {
    if (!rejoinMatch(ws, userId)) {
      send(ws, { type: 'error', message: 'already_in_match' })
    }
    return
  }

  // Re-joining while already queued — cancel old timer first
  const existing = queue.get(userId)
  if (existing?.queueTimer) clearTimeout(existing.queueTimer)

  // Find a waiting opponent (not self) — FAQAT bir xil fan tanlaganlar
  const waiting = [...queue.values()].find((p) => p.userId !== userId && p.subjectId === subjectId)
  if (waiting) {
    // Remove from queue before startMatch to avoid double-removal races
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

// ── WebSocket server ───────────────────────────────────────────────────────

/**
 * Startup loader — har bir dataSourceId uchun savol havzasini provider orqali yuklaydi.
 * (Bugun barcha fanlar bitta bankaga bog'langan — 1 unique provider, 1 query.
 *  Haqiqiy fan bazalari kelganda avtomatik per-subject ishlaydi.)
 */
export async function loadOctagonPools(): Promise<OctagonPools> {
  const pools: OctagonPools = new Map()
  for (const dsId of new Set(SUBJECT_REGISTRY.map((s) => s.dataSourceId))) {
    const rows = await getProvider(dsId).getAllQuestions()
    pools.set(dsId, rows.map((r) => ({ id: r.id, correct: r.correctAnswer })))
  }
  return pools
}

export function attachOctagon(
  wss: WebSocketServer,
  pools: OctagonPools,
  limits: Partial<OctagonLimits> = {},
): void {
  QUESTION_POOLS = pools
  const L: OctagonLimits = { ...DEFAULT_OCTAGON_LIMITS, ...limits }

  // ── Per-connection state + per-user connection cap ──────────────────────
  interface ConnState {
    authed:    boolean
    userId:    string | null
    isAlive:   boolean
    msgWindowStart: number
    msgCount:  number
  }
  const states = new WeakMap<WebSocket, ConnState>()
  const connsByUser = new Map<string, Set<WebSocket>>()

  function trackConn(userId: string, ws: WebSocket): boolean {
    let set = connsByUser.get(userId)
    if (!set) { set = new Set(); connsByUser.set(userId, set) }
    if (!set.has(ws) && set.size >= L.maxConnsPerUser) return false
    set.add(ws)
    return true
  }
  function untrackConn(ws: WebSocket): void {
    for (const [uid, set] of connsByUser) {
      if (set.delete(ws) && set.size === 0) connsByUser.delete(uid)
    }
  }

  // ── Heartbeat: 2 davrda hech qanday jonlilik belgisi (pong/message)
  // yo'q socket'lar terminate qilinadi (xotira oqimlari himoyasi) ───────────
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const st = states.get(client)
      if (st && !st.isAlive) { client.terminate(); continue }
      if (st) st.isAlive = false
      client.ping()
    }
  }, L.heartbeatMs)
  wss.on('close', () => clearInterval(heartbeat))

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Origin allowlist — FAQAT prod'da va ALLOWED_ORIGIN ANIQ berilganda
    // (env yo'q bo'lsa deny-all bo'lib qolmasligi uchun explicit flag).
    if (config.isProd && config.server.allowedOriginExplicit) {
      const origin = req.headers.origin
      if (!origin || !config.server.allowedOrigins.includes(origin)) {
        ws.close(1008, 'origin_not_allowed')
        return
      }
    }

    const state: ConnState = {
      authed: false, userId: null, isAlive: true,
      msgWindowStart: Date.now(), msgCount: 0,
    }
    states.set(ws, state)

    // Auth deadline — hech qachon join_queue/rejoin qilmagan socketlar
    // resurslarni cheksiz ushlab turmasligi kerak.
    const authTimer = setTimeout(() => {
      if (!state.authed) ws.terminate()
    }, L.authDeadlineMs)

    ws.on('pong', () => { state.isAlive = true })

    /** Auth muvaffaqiyatidan keyin chaqiriladi — connection'ni user'ga bog'laydi.
     *  Per-user cap oshsa false (socket yopiladi). */
    const markAuthed = (uid: string): boolean => {
      state.userId = uid
      if (!trackConn(uid, ws)) {
        send(ws, { type: 'error', message: 'too_many_connections' })
        ws.close(1008, 'too_many_connections')
        return false
      }
      if (!state.authed) {
        state.authed = true
        clearTimeout(authTimer)
      }
      return true
    }

    ws.on('message', (raw) => {
      state.isAlive = true

      // Per-connection message rate limit
      const now = Date.now()
      if (now - state.msgWindowStart >= L.msgWindowMs) {
        state.msgWindowStart = now
        state.msgCount = 0
      }
      if (++state.msgCount > L.maxMsgsPerWindow) {
        ws.close(1008, 'rate_limited')
        return
      }
      let msg: Record<string, unknown>
      try { msg = JSON.parse(raw.toString()) } catch { return }

      if (msg.type === 'ping') {
        send(ws, { type: 'pong' })
        return
      }

      if (msg.type === 'rejoin') {
        void (async () => {
          let uid = String(msg.userId ?? '')
          if (isAuthEnforced()) {
            const resolved = await resolveWsUserId(msg)
            if (!resolved) {
              send(ws, { type: 'error', message: 'auth_failed' })
              ws.close(4001, 'Unauthorized')
              return
            }
            uid = resolved
          }
          if (!markAuthed(uid)) return
          if (!rejoinMatch(ws, uid)) {
            send(ws, { type: 'error', message: 'rejoin_failed' })
          }
        })()
        return
      }

      if (msg.type === 'join_queue') {
        void (async () => {
          let uid = String(msg.userId ?? '')
          const name = String(msg.name ?? "Noma'lum").slice(0, MAX_NAME_LEN)

          // User must be authenticated in production — initData YOKI sessionToken
          if (isAuthEnforced()) {
            const resolved = await resolveWsUserId(msg)
            if (!resolved) {
              send(ws, { type: 'error', message: 'auth_failed' })
              ws.close(4001, 'Unauthorized')
              return
            }
            uid = resolved   // NEVER trust the client-supplied id
          }

          if (!WS_USER_ID_RE.test(uid)) {
            send(ws, { type: 'error', message: 'invalid_user' })
            return
          }

          if (matches.size >= MAX_MATCHES) {
            send(ws, { type: 'error', message: 'server_full' })
            return
          }

          if (!markAuthed(uid)) return

          const subjectId = SUBJECT_IDS.includes(String(msg.subjectId))
            ? String(msg.subjectId)
            : DEFAULT_SUBJECT_ID
          // Duel rejimi: kod bo'lsa — do'st kutishi/juftlashish (navbatdan tashqari)
          const duelCode = typeof msg.duelCode === 'string' && DUEL_CODE_RE.test(msg.duelCode)
            ? msg.duelCode
            : null
          if (duelCode) joinDuel(ws, uid, name, duelCode, subjectId)
          else joinQueue(ws, uid, name, subjectId)
          return
        })()
        return
      }

      if (msg.type === 'answer' && state.userId) {
        const userId = state.userId
        const matchId  = String(msg.matchId)
        const match    = matches.get(matchId)
        if (!match || !match.roundState || match.roundState.resolved) return
        // Protocol integrity: faqat match ishtirokchilari javob bera oladi
        if (!match.players.some((p) => p.userId === userId)) return

        const index = Number(msg.index)
        if (!Number.isInteger(index) || index !== match.round) return

        const rs       = match.roundState
        const optionId = String(msg.optionId)
        if (rs.answers.has(userId)) return  // already answered this round

        rs.answers.set(userId, optionId)

        const correct   = correctFor(match.questionIds[index], match.pool)
        // Ack + post-answer reveal: client to'g'ri javob kalitini lokal
        // savollar to'plamidan emas, FAQAT shu server ack'dan oladi.
        send(ws, { type: 'answer_ack', index, correct: optionId === correct, correctOptionId: correct })

        const opponent = match.players.find((p) => p.userId !== userId)
        if (opponent) send(opponent.ws, { type: 'opp_answered', index })

        if (rs.answers.size === 2) resolveRound(match, index)
        return
      }

      if (msg.type === 'leave_queue' && state.userId) {
        const userId = state.userId
        const queued = queue.get(userId)
        if (queued?.queueTimer) clearTimeout(queued.queueTimer)
        queue.delete(userId)
        leaveDuelByUser(userId)
        return
      }
    })

    ws.on('close', () => {
      clearTimeout(authTimer)
      untrackConn(ws)
      const userId = state.userId
      if (!userId) return
      // Stale socket closing after a rejoin replaced it — not a real disconnect
      const matchId = playerToMatch.get(userId)
      if (matchId) {
        const slot = matches.get(matchId)?.players.find((p) => p.userId === userId)
        if (slot && slot.ws !== ws) return
      }
      handleDisconnect(userId, ws)
    })
  })
}
