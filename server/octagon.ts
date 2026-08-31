/**
 * Octagon PvP — WebSocket matchmaking + game loop.
 *
 * Protocol (server → client):
 *   matched        { matchId, opponentName, opponentAvatar, opponentFrame, roundCount }  ← no questionIds upfront
 *   duel_created   { code }                                   ← M-6: server-generatsiya PIN (duelCode:'new' javobi)
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
 *   join_queue     { userId, name, subjectId?, duelCode? }   (mid-match join = auto-rejoin;
 *                    duelCode='new' → server PIN generatsiya qiladi, M-6)
 *   rejoin         { matchId, userId, name, initData? }
 *   answer         { matchId, index, optionId }
 *   leave_queue    { userId }
 *   ping
 */

import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { randomUUID, randomInt } from 'crypto'
import { inArray, sql, eq }   from 'drizzle-orm'
import { config }         from './config'
import { verifyInitData } from './utils/telegram'
import { isAuthEnforced } from './middleware/auth'
import { SUBJECT_IDS, DEFAULT_SUBJECT_ID, SUBJECT_REGISTRY, resolveSubject } from './config/subjects'
import { getProvider } from './providers'
import { db } from './db/connection'
import { users, progress } from './schema'
import { progressRepository } from './modules/progress/progress.repository'
import type { DuelResultRow } from './modules/progress/progress.repository'
import { authRepository } from './modules/auth/auth.repository'
import { registerInterval } from './utils/shutdown'
import { Sentry } from './utils/sentry'
import type { LeaderboardEntry } from './modules/leaderboard/leaderboard.repository'

// ── Constants ──────────────────────────────────────────────────────────────

const ROUNDS              = 10
const ROUND_TIMEOUT       = 15_000  // ms per question
/** M-4 (audit): rejoin'dan keyingi MINIMAL javob oynasi — sarflangan grace
 *  raund vaqtidan ayirilsa ham, legit qayta ulanuvchi javob bera olsin. */
const REJOIN_MIN_ANSWER_MS = 3_000
const QUEUE_TIMEOUT       = 60_000  // ms to find opponent before giving up
const DUEL_TIMEOUT        = 5 * 60_000  // do'st linkni ochishi uchun uzoqroq — 5 daqiqa
const MAX_MATCHES         = 500     // hard cap on concurrent matches — protects memory
const MAX_NAME_LEN        = 64
// Reconnect grace oynasi + pauza byudjeti endi OctagonLimits'da (test-shrinkable):
// DEFAULT_OCTAGON_LIMITS.reconnectWindowMs / pauseBudgetMs.

/** Duel / Xona PIN kod validatsiyasi: `duel-xxxxxx`, `room-xxxxxx`, 6-8 xonali PIN yoki xavfsiz belgilar (M-9: min 6 char brute-force oldini olish) */
export const DUEL_CODE_RE = /^(?:duel-[a-z0-9]{6,16}|room-[a-z0-9]{6,16}|\d{6,8}|[a-z0-9]{6,12})$/i

/** Canonical user id (Telegram raqam-string, telefon akkaunt 'p_<digits>' yoki email 'e_<hex>') */
const WS_USER_ID_RE = /^(?:\d{1,20}|p_\d{9,15}|e_[0-9a-f]{32})$/

// ── M-9 (audit): duel-join brute-force limiti ──────────────────────────────
// Noma'lum kod bilan joinDuel "kutilayotgan" duel yaratadi — hujumchi bitta
// akkauntdan minglab kodni suratga tushirishi mumkin edi. Per-user oyna:
// 60s ichida 8 ta JOIN urinishi — legit o'yinchi 1-2 urinish bilan yetarli.
const JOIN_ATTEMPT_WINDOW_MS = 60_000
const JOIN_ATTEMPT_MAX = 8
const joinAttempts = new Map<string, { windowStart: number; count: number }>()

function joinAttemptAllowed(userId: string): boolean {
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

// Stale yozuvlarni davriy tozalash (WS instance uzoq yashashi mumkin)
const joinAttemptsSweepTimer = setInterval(() => {
  const cutoff = Date.now() - JOIN_ATTEMPT_WINDOW_MS
  for (const [uid, rec] of joinAttempts) {
    if (rec.windowStart < cutoff) joinAttempts.delete(uid)
  }
}, JOIN_ATTEMPT_WINDOW_MS)
joinAttemptsSweepTimer.unref?.()
registerInterval(joinAttemptsSweepTimer)   // graceful shutdown (FIXPLAN #21)


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
  /** Bir IP manzilga parallel socketlar (auth'dan OLDIN ham — connection
   *  flooding himoyasi, M-1 audit; CGNAT sababli saxiy qiymat: mobil operator
   *  shlyuzida ko'p legit user bitta public IP'da bo'ladi) */
  maxConnsPerIp: number
  /** Serverdagi JAMI parallel socketlar — xotira/fd himoyasi (M-1 audit) */
  maxTotalConns: number
  /** Bir uzilish uchun grace oynasi (raqib shu kutadi — keyin forfeit) */
  reconnectWindowMs: number
  /** O'YINCHI BOSHI match'dagi jami pauza byudjeti (griefing himoyasi):
   *  connect-disconnect churn bilan o'yinni cheksiz to'xtatib bo'lmasligi
   *  uchun sarflangan grace vaqti yig'iladi; tugagach grace YO'Q — forfeit. */
  pauseBudgetMs:   number
}

export const DEFAULT_OCTAGON_LIMITS: OctagonLimits = {
  authDeadlineMs:   10_000,
  heartbeatMs:      30_000,
  msgWindowMs:      10_000,
  maxMsgsPerWindow: 50,
  maxConnsPerUser:  3,
  maxConnsPerIp:    25,      // CGNAT headroom: 1 IP'da ~8 legit user (×3 conn)
  maxTotalConns:    2500,    // MAX_MATCHES(500)×2 + queue/idle headroom
  reconnectWindowMs: 60_000,   // egy uzilish uchun raqib kutilishi (60s)
  pauseBudgetMs:    90_000,    // match boshina JAMI pauza (~1.5 grace) — keyin forfeit
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
  /** Joriy grace boshlangan vaqt — rejoin'da budget'dan ayirish uchun */
  disconnectStartedAt: number | null
  /** userId → qolgan pauza byudjeti (ms). Tugagan o'yinchi grace OLMAYDI (forfeit) */
  pauseBudget:     Map<string, number>
  gapTimer:        ReturnType<typeof setTimeout> | null  // rounds orasidagi 1s pauza
  /** Natija `duel_results`ga yozildimi — endMatch va forfeit ikki marta yozmasin */
  recorded?:       boolean
}

// ── Module state ───────────────────────────────────────────────────────────

let QUESTION_POOLS: OctagonPools = new Map()

/** attachOctagon'da sozlangan AMALDAGI limitlar (testlar kichraytiradi) */
let ACTIVE_LIMITS: OctagonLimits = DEFAULT_OCTAGON_LIMITS

const queue:         Map<string, Player> = new Map()  // userId → Player
const matches:       Map<string, Match>  = new Map()  // matchId → Match
const playerToMatch: Map<string, string> = new Map()  // userId → matchId
const connsByUser = new Map<string, Set<WebSocket>>()

/** Diagnostika counter'lari — /ws/stats endpoint'idan ko'rinadi (PII yo'q). */
let totalConnections = 0
let totalMessages = 0
export function getOctagonStats(wssClients: number): Record<string, number> {
  return {
    clients: wssClients,
    totalConnections,
    totalMessages,
    onlineUsers: connsByUser.size,
    queue: queue.size,
    duels: duels.size,
    matches: matches.size,
  }
}

// ── M-2 (audit): online ro'yxat yuklama himoyasi ────────────────────────────
// Eski holat: har connect/disconnect (250ms debounce) TO'LIQ DB query + O(N)
// payload BARCHA N socket'ga (flap = 4 query/s + O(N²) egress); har get_online
// esa alohida query edi. Endi:
//  1) DB snapshot 5s KESHLANADI — broadcast va get_online bitta snapshot'ni
//     baham ko'radi (flap'da ham ≤1 query/5s);
//  2) broadcast debounce 1s — kir-chiq "flap"larida 4× kamroq tarqatish;
//  3) broadcast payload 200 qatorga CHEKLANADI — egress O(N²) bo'ylamaydi.
const ONLINE_CACHE_TTL_MS = 5_000
const ONLINE_BROADCAST_DEBOUNCE_MS = 1_000
const ONLINE_BROADCAST_MAX = 200

let onlineRowsCache: { at: number; gen: number; rows: LeaderboardEntry[] } | null = null
/** connsByUser a'zoligi o'zgarish GENERATION'i — kesh invalidatsiya kaliti.
 *  (A'zolik o'zgarganda presence darhol yangilanadi; o'zgarmagan paytda esa
 *  get_online/broadcast spam'i DB'ga tegmaydi — TTL kesh.) */
let onlineGen = 0

/** Online userlarning profil qatorlari — generation + 5s TTL keshli snapshot (isYou: false). */
async function fetchOnlineRowsCached(): Promise<LeaderboardEntry[]> {
  const c = onlineRowsCache
  if (c && c.gen === onlineGen && Date.now() - c.at < ONLINE_CACHE_TTL_MS) {
    return c.rows
  }
  const onlineUserIds = Array.from(connsByUser.keys()).filter((id) => AVATAR_UID_RE.test(id))
  if (onlineUserIds.length === 0) {
    onlineRowsCache = { at: Date.now(), gen: onlineGen, rows: [] }
    return []
  }
  try {
    const rows = await db
      .select({
        id:              users.id,
        firstName:       users.firstName,
        lastName:        users.lastName,
        photoUrl:        users.photoUrl,
        hasCustomAvatar: sql<boolean>`(${users.avatarWebp} IS NOT NULL)`,
        avatarFrame:     users.avatarFrame,
        streak:          sql<number>`COALESCE(${progress.streak}, 0)`,
        score:           sql<number>`COALESCE(${progress.octagonWins}, 0)`,
      })
      .from(users)
      .leftJoin(progress, eq(progress.userId, users.id))
      .where(inArray(users.id, onlineUserIds))

    const mapped = rows.map((r, i) => ({
      rank: i + 1,
      userId: r.id,
      name: `${r.firstName} ${r.lastName ?? ''}`.trim(),
      score: Number(r.score),
      streak: Number(r.streak),
      isYou: false,
      photoUrl: r.photoUrl || null,
      hasCustomAvatar: !!r.hasCustomAvatar,
      avatarFrame: r.avatarFrame ?? null,
    }))
    onlineRowsCache = { at: Date.now(), gen: onlineGen, rows: mapped }
    return mapped
  } catch (err) {
    console.error('[octagon] online rows error:', err)
    return onlineRowsCache?.rows ?? []   // xatoda eski (stale) snapshot — jim yemas
  }
}

/** Hozirgi jonli online foydalanuvchilar ro'yxati (faqat haqiqiy ulanganlar) */
export async function getOnlineUsers(callerUserId: string | null): Promise<LeaderboardEntry[]> {
  const rows = await fetchOnlineRowsCached()
  return rows.map((r) => ({ ...r, isYou: callerUserId !== null && r.userId === callerUserId }))
}

let onlineBroadcastTimer: NodeJS.Timeout | null = null

/** Barcha ulangan mijozlarga real-time online o'yinchilar ro'yxatini yuborish (debounced) */
export function triggerOnlineBroadcast(): void {
  if (onlineBroadcastTimer) return
  onlineBroadcastTimer = setTimeout(async () => {
    onlineBroadcastTimer = null
    const all = await fetchOnlineRowsCached()
    // Payload cap — to'liq onlayn SONI saqlanadi, ro'yxat kesiladi (M-2)
    const playerRows = all.slice(0, ONLINE_BROADCAST_MAX)
    for (const [uid, sockets] of connsByUser) {
      const payload = {
        type: 'online_players',
        count: all.length,
        players: playerRows.map((p) => ({ ...p, isYou: p.userId === uid })),
      }
      for (const ws of sockets) {
        send(ws, payload)
      }
    }
  }, ONLINE_BROADCAST_DEBOUNCE_MS)
}

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

/** Proxy (Render LB) ortida real client IP — XFF birinchi entry; yo'q bo'lsa socket.
 *  M-1 (audit): per-IP connection cap kaliti. XFF soxtalash mumkin, lekin cap
 *  faqat DoS yumshatish uchun (aniq identifikatsiya emas) — auth alohida qatlam. */
function clientIp(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for']
  const raw = Array.isArray(xff) ? xff[0] : xff
  const ip = raw?.split(',')[0]?.trim()
  return ip || req.socket.remoteAddress || 'unknown'
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

// ── Avatar resolve (matched payload uchun) ─────────────────────────────────
// Client yuborgan name kabi rasmga ham ISHONILMAYDI — FAQAT server DB'dan.
// Custom avatar (avatar_webp) → `/api/avatar/:uid` yo'li; yo'q bo'lsa TG photo_url.
// Same-account dev duel uid'lari (`${uid}_2`) jadvalda yo'q — null qaytadi.
const AVATAR_UID_RE = /^(?:\d{1,20}|p_\d{9,15}|e_[0-9a-f]{32})$/

async function resolveAvatars(...ids: string[]): Promise<Map<string, { avatar: string | null; frame: string | null }>> {
  const clean = [...new Set(ids.filter((id) => AVATAR_UID_RE.test(id)))]
  const out = new Map<string, { avatar: string | null; frame: string | null }>()
  if (!clean.length) return out
  try {
    // Query builder (inArray) — RAW `ANY($array)` param'dan CHETLANISH:
    // neon-http driver JS massivni JSON string qilib yuboradi (ANY buziladi).
    const rows = await db
      .select({
        id:          users.id,
        photoUrl:    users.photoUrl,
        hasCustom:   sql<boolean>`(${users.avatarWebp} IS NOT NULL)`,
        avatarFrame: users.avatarFrame,
      })
      .from(users)
      .where(inArray(users.id, clean))
    for (const r of rows) {
      out.set(r.id, {
        avatar: r.hasCustom ? `/api/avatar/${encodeURIComponent(r.id)}` : (r.photoUrl || null),
        frame:  r.avatarFrame ?? null,
      })
    }
  } catch (err) {
    console.error('[octagon] avatar resolve xatosi (matched davom etadi):', err)
  }
  return out
}

// ── Match lifecycle ────────────────────────────────────────────────────────

function startMatch(p1: Player, p2: Player): void {
  // H-1 (audit): bitta user PARALLEL match'larga tushib ketmasligi SHART.
  // Yuqori qatlam (joinQueue/joinDuel) queue/duel/match eksklyuzivligini
  // kafolatlaydi — bu guard ikkinchi xavfsizlik chizig'i (defense-in-depth):
  // qandaydir kelajakdagi yo'l bu yerga band o'yinchi keltirsa, yangi match
  // YARATILMAYDI (state corruption o'rniga toza xato).
  if (playerToMatch.has(p1.userId) || playerToMatch.has(p2.userId)) {
    console.warn('[octagon] startMatch BLOKLANDI — o\'yinchi allaqachon match\'da', {
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
  // Ikkala o'yinchi bir xil subjectId (matchmaking filtri) — p1'dan olamiz
  const pool        = poolForSubject(p1.subjectId)
  const questionIds = pickQuestions(ROUNDS, pool)
  const scores      = new Map([[p1.userId, 0], [p2.userId, 0]])
  const match: Match = {
    id: matchId, players: [p1, p2], pool, questionIds,
    scores, round: 0, roundState: null, disconnectTimer: null,
    disconnectStartedAt: null,
    pauseBudget: new Map([
      [p1.userId, ACTIVE_LIMITS.pauseBudgetMs],
      [p2.userId, ACTIVE_LIMITS.pauseBudgetMs],
    ]),
    gapTimer: null,
  }

  matches.set(matchId, match)
  playerToMatch.set(p1.userId, matchId)
  playerToMatch.set(p2.userId, matchId)

  // Send matched without questionIds — answers must not be pre-fetchable.
  // Avatar URL'lar DB'dan (bitta tez so'rov) — match holati allaqachon
  // saqlangan, xato bo'lsa matched null avatar bilan ketadi (duel buzilmaydi).
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

// M-3 (audit) duel anti-farm: bir juftlik (userId, opponentId) oxirgi 24 soatda
// shu sondan ortiq match o'ynasa — natija statistikaga YOZILMAYDI (o'yin oddiy
// o'ynalaveradi, lekin reyting/yutuq/leaderboard hisoblanmaydi). Feeder-akkaunt
// (o'ziga ataylab yutqazuvchi 2-akkaunt) bilan cheksiz win yig'ish yo'li yopiladi.
const SAME_PAIR_24H_CAP = 5

/** Juftlik farm cap'ga yetganmi? Mehmon ('0') ishtirokchili match'larda cap YO'Q
 *  (dev artifact). Xatolikda FAIL-OPEN (yozuvga ruxsat) — reyting yozuvi
 *  kritik emas, DB uzilishida o'yin natijalari yo'qolmasligi muhimroq. */
async function pairFarmCapped(u1: string, u2: string): Promise<boolean> {
  if (u1 === '0' || u2 === '0') return false
  try {
    const n = await progressRepository.duelPairCountLast24h(u1, u2)
    if (n >= SAME_PAIR_24H_CAP) {
      console.warn('[octagon] anti-farm: juftlik 24h cap\'ga yetdi — natija yozilmaydi', { u1, u2, n })
      return true
    }
  } catch (err) {
    console.error('[octagon] anti-farm cap check xatosi (fail-open):', err)
  }
  return false
}

function endMatch(match: Match): void {
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

  // M-3: anti-farm cap tekshiruvidan KEYIN yozuv (fire-and-forget).
  // G'alilgan — Yutuqlar uchun DB'ga yozamiz (draw da yo'q); davr reytingi
  // (kunlik/haftalik/oylik) uchun timestamp'li natija — draw ham yoziladi.
  void (async () => {
    if (await pairFarmCapped(p1.userId, p2.userId)) return
    if (winnerId && winnerId !== '0') {
      void progressRepository.addOctagonWin(winnerId)
        .catch((err) => console.error('[octagon] addOctagonWin failed:', err?.message ?? err))
    }
    recordDuelResults(match, outcomes, false)
  })()

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

/** Grace oynasi tugadi (yoki pauza byudjeti qolmagani uchun grace berilmadi) —
 *  diskonekt qilgan o'yinchi taslim; raqib +1 g'alaba (yutuq hisobi bilan). */
function forfeitDisconnected(match: Match, userId: string): void {
  const opp = match.players.find((p) => p.userId !== userId)
  if (opp) {
    send(opp.ws, { type: 'opp_disconnected' })
    const oppScore  = match.scores.get(opp.userId) ?? 0
    const selfScore = match.scores.get(userId)     ?? 0
    const outcomes: DuelOutcome[] = [
      { userId: opp.userId, opponentId: userId,     selfScore: oppScore,  oppScore: selfScore, result: 'win'  },
      { userId,             opponentId: opp.userId, selfScore,            oppScore,            result: 'lose' },
    ]
    // M-3: anti-farm — forfeit ham juftlik cap'iga bo'ysunadi (feeder ataylab
    // disconnect qilib "main"ga win yozdirish eng ommaviy farm usuli edi).
    void (async () => {
      if (await pairFarmCapped(opp.userId, userId)) return
      if (opp.userId !== '0') {
        void progressRepository.addOctagonWin(opp.userId)
          .catch((err) => console.error('[octagon] forfeit win save failed:', err?.message ?? err))
      }
      recordDuelResults(match, outcomes, true)
    })()
  }
  cleanupMatch(match)
}

/** Bitta o'yinchining match yakunidagi natijasi (DB qatoriga aylantirilgunga qadar) */
export interface DuelOutcome {
  userId:     string
  opponentId: string
  selfScore:  number
  oppScore:   number
  result:     'win' | 'lose' | 'draw'
}

/**
 * Match yakunini `duel_results` qatorlariga aylantirish — mehmon (`'0'`)
 * o'yinchilar uchun qator yozilmaydi, raqib mehmon bo'lsa opponentId null.
 * Pure funksiya (testlanadi); yozishning o'zi `recordDuelResults`da.
 */
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

/**
 * Duel natijalarini `duel_results`ga yozish (fire-and-forget).
 * `match.recorded` bayrog'i endMatch va forfeit ketma-ket ishga tushsa ham
 * ikkinchi yozuvni to'xtatadi (DB'da (match_id, user_id) unique ham bor).
 */
function recordDuelResults(match: Match, outcomes: ReadonlyArray<DuelOutcome>, forfeit: boolean): void {
  if (match.recorded) return
  match.recorded = true

  const rows = buildDuelResultRows(match.id, outcomes, forfeit)
  if (rows.length === 0) return

  void progressRepository.recordDuelResults(rows)
    .catch((err) => console.error('[octagon] recordDuelResults failed:', err?.message ?? err))
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
  // Pauza byudjeti: sarflangan grace vaqtini ayiramiz (griefing cap) —
  // qaytkan o'yinchi "yangi" to'liq oynani OLMAYDI.
  let graceConsumedMs = 0
  if (match.disconnectStartedAt != null) {
    graceConsumedMs = Date.now() - match.disconnectStartedAt
    match.pauseBudget.set(userId, Math.max(0, (match.pauseBudget.get(userId) ?? 0) - graceConsumedMs))
    match.disconnectStartedAt = null
  }

  // RESUME: raund pauza'da bo'lgan bo'lsa — qolgan vaqtidan davom ettiriladi
  const rs = match.roundState
  if (rs && !rs.resolved && rs.paused) {
    // M-4 (audit) PAUSE-ABUSE yumshatish: qiyin savolda qasddan uzilib,
    // javobni internetdan topib qaytish "bepul o'ylash vaqti" edi. Endi
    // sarflangan grace vaqti raundning qolgan vaqtidan AYIRILADI; legit qayta
    // ulanuvchi uchun minimal javob oynasi (REJOIN_MIN_ANSWER_MS) kafolatlanadi.
    // (Raqib pauza davomida savolni ko'rib turdi — qisqa vaqt unga zarar yetkazmaydi.)
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

  // Duel kutilishi — o'sha socketniki bo'lsa o'chiramiz.
  // (H-2: birlamchi tozalash endi close handler'da — early-return'lardan OLDIN;
  //  bu qator idempotent ikkinchi chiziq sifatida qoladi.)
  leaveDuelByUser(userId, deadWs)

  const matchId = playerToMatch.get(userId)
  if (!matchId) return
  const match = matches.get(matchId)
  if (!match || match.disconnectTimer) return   // already in the grace window

  // PAUSE BYUDGETI (griefing himoyasi): connect-disconnect churn bilan o'yinni
  // cheksiz to'xtatish mumkin edi — endi har o'yinchi match boshiga cheklangan
  // pauza vaqtiga ega; byudjet tugagan → GRACE YO'Q, darhol forfeit.
  const L = ACTIVE_LIMITS
  const budgetLeft = match.pauseBudget.get(userId) ?? 0
  if (budgetLeft <= 0) {
    forfeitDisconnected(match, userId)
    return
  }
  const windowMs = Math.min(L.reconnectWindowMs, budgetLeft)

  // Mid-match disconnect: give the player a grace window to come back.
  // Round PAUSED while waiting — rejoin shu joyidan davom etadi.
  const opponent = match.players.find((p) => p.userId !== userId)
  if (opponent) {
    send(opponent.ws, { type: 'opp_waiting', waitSeconds: Math.ceil(windowMs / 1000) })
  }

  // PAUSE: o'yin to'xtatiladi — raqib qaytsa shu joyidan davom etadi
  const rs0 = match.roundState
  if (rs0 && !rs0.resolved && !rs0.paused) {
    rs0.remainingMs = Math.max(0, ROUND_TIMEOUT - (Date.now() - rs0.startedAt))
    clearTimeout(rs0.timer)
    rs0.paused = true
  }

  match.disconnectStartedAt = Date.now()
  match.disconnectTimer = setTimeout(() => {
    // Guard: check match still exists and player still disconnected (rejoin clears timer)
    if (!matches.has(matchId)) return  // match already cleaned up
    if (match.disconnectTimer === null) return  // rejoined, timer was cleared
    match.disconnectTimer = null
    match.disconnectStartedAt = null
    // Never came back — opponent wins by forfeit (Yutuqlar uchun ham hisoblanadi).
    forfeitDisconnected(match, userId)
  }, windowMs)
}

// ── Queue join — extracted to handle re-join timer leak ───────────────────

/**
 * Duel (do'stlar o'rtasida) — kutilayotgan yaratuvchilar: code → kutuvchi o'yinchi.
 * Do'st shu kod bilan join_queue qilganda juftlashadi; savollar YARATUVCHIning
 * fanidan olinadi (ikkinchi o'yinchida boshqa fan tanlangan bo'lishi mumkin).
 */
interface PendingDuel { player: Player; timer: ReturnType<typeof setTimeout> }
const duels = new Map<string, PendingDuel>()
const lastReactionTime = new Map<string, number>()

function leaveDuelByUser(userId: string, deadWs?: WebSocket): void {
  for (const [code, d] of duels) {
    if (d.player.userId === userId && (!deadWs || d.player.ws === deadWs)) {
      clearTimeout(d.timer)
      duels.delete(code)
    }
  }
}

/**
 * M-6 (audit): duel PIN'ini SERVER generatsiya qiladi. Eski oqimda kod client'da
 * `Math.random()`'dan yaratilardi — bashorat qilinadigan, ikki yaratuvchi
 * collision'ida noto'g'ri pairing (begona odam xonaga tushardi) va kutilayotgan
 * xonalarni enumeration qilish mumkin edi. Endi:
 *  - client `duelCode: 'new'` yuboradi → server `crypto.randomInt` bilan
 *    6 xonali kod tanlaydi (collision retry) va `duel_created` bilan qaytaradi;
 *  - ESKI client'lar (o'z PIN'ini yuboradigan) ham ishlayveradi — joinDuel
 *    yo'li o'zgarishsiz (backward-compat, eski APK'lar uchun).
 */
function joinDuelCreate(ws: WebSocket, userId: string, name: string, subjectId: string): void {
  if (rejoinIfInMatch(ws, userId)) return
  if (!joinAttemptAllowed(userId)) {
    send(ws, { type: 'error', message: 'duel_join_rate_limited' })
    return
  }
  // H-1 eksklyuzivligi + avvalgi kutilayotgan duel(lar)ni almashtirish
  removeFromQueue(userId, ws)
  leaveDuelByUser(userId)

  // Collision retry: 900k fazo — amalda birinchi urinishda bo'sh kod topiladi
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

function joinDuel(ws: WebSocket, userId: string, name: string, rawCode: string, fallbackSubjectId: string): void {
  // H-1 (audit): match'dagi o'yinchi duel kod yuborsa — bu REJOIN, yangi match
  // EMAS. Aks holda u kutilayotgan duel orqali IKKINCHI parallel match'ga
  // tushib ketardi. (Rejoin join-attempt limitini sarflamaydi.)
  if (rejoinIfInMatch(ws, userId)) return

  // M-9: brute-force kod suratga tushirish limiti (60s'da 8 urinish)
  if (!joinAttemptAllowed(userId)) {
    send(ws, { type: 'error', message: 'duel_join_rate_limited' })
    return
  }

  // H-1 (audit) EKSKLYUZIVLIK: random navbatdan duel rejimiga o'tish —
  // navbat entry'si o'chiriladi (aks holda navbat orqali HAM, duel orqali HAM
  // match'ga tushib PARALLEL 2 o'yin o'ynardi).
  removeFromQueue(userId, ws)

  const code = rawCode.trim().toLowerCase().replace(/^(?:duel|room)-/, '')
  const existing = duels.get(code)
  if (existing) {
    const isDifferentPlayer = existing.player.userId !== userId || (!isAuthEnforced() && existing.player.ws !== ws)
    if (isDifferentPlayer) {
      // Do'st keldi — juftlaymiz (YARATUVCHIning fan savollarida)
      clearTimeout(existing.timer)
      duels.delete(code)
      const joinerUid = existing.player.userId === userId ? `${userId}_2` : userId
      const joiner: Player = { ws, userId: joinerUid, name, subjectId: existing.player.subjectId, queueTimer: null }
      startMatch(existing.player, joiner)
      return
    }
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

/**
 * H-1 (audit): match'dagi user uchun HAR QANDAY join yo'li REJOIN'ga tushadi
 * (yangi match/duel YO'Q). true = so'rov handled (caller return qiladi).
 */
function rejoinIfInMatch(ws: WebSocket, userId: string): boolean {
  if (!playerToMatch.has(userId)) return false
  if (!rejoinMatch(ws, userId)) {
    send(ws, { type: 'error', message: 'already_in_match' })
  }
  return true
}

/** H-1 (audit): user'ni random navbatdan chiqaradi (duel rejimiga o'tishda);
 *  eski (boshqa tab) socket bo'lsa 'replaced_by_new_tab' bilan yopiladi. */
function removeFromQueue(userId: string, ws: WebSocket): void {
  const queued = queue.get(userId)
  if (!queued) return
  if (queued.queueTimer) clearTimeout(queued.queueTimer)
  queue.delete(userId)
  if (queued.ws !== ws && queued.ws.readyState === WebSocket.OPEN) {
    queued.ws.close(1000, 'replaced_by_new_tab')
  }
}

function joinQueue(ws: WebSocket, userId: string, name: string, subjectId: string): void {
  // Coming back to a live match (app relaunch within grace window) — rejoin it
  if (rejoinIfInMatch(ws, userId)) return

  // H-1 (audit) EKSKLYUZIVLIK: user queue/duel/match'dan FAQAT BIRINIDA bo'ladi.
  // Random navbat tanlandi → o'zi yaratgan kutilayotgan duel(lar) BEKOR qilinadi.
  // Aks holda do'st shu duel kodi bilan kirganda user ALLAQACHON random match'da
  // bo'lib, startMatch uni IKKINCI parallel match'ga tushirardi (win-farm +
  // state corruption).
  leaveDuelByUser(userId)

  // Re-joining while already queued — cancel old timer + close old socket (tab duplication)
  const existing = queue.get(userId)
  if (existing) {
    if (existing.queueTimer) clearTimeout(existing.queueTimer)
    if (existing.ws !== ws && existing.ws.readyState === WebSocket.OPEN) {
      existing.ws.close(1000, 'replaced_by_new_tab')
    }
    // Eski entry'ni DARHOL o'chiramiz (H-1): pastdagi juftlash `waiting`ni
    // tanlaganda bu queueTimer'siz "arava" entry ko'rinmasligi kerak.
    queue.delete(userId)
  }

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

/**
 * Admin savol CRUD'dan keyin in-memory pool'ni yangilash (staleness himoyasi):
 * o'zgargan correctAnswer/o'chirilgan savol eski ko'rinishda qolmasligi uchun.
 * attachOctagon'dan OLDIN chaqirilsa ham xavfsiz (KEYINGI attach qayta yozadi).
 */
export async function reloadOctagonPools(): Promise<void> {
  QUESTION_POOLS = await loadOctagonPools()
}

export function attachOctagon(
  wss: WebSocketServer,
  pools: OctagonPools,
  limits: Partial<OctagonLimits> = {},
): void {
  QUESTION_POOLS = pools
  const L: OctagonLimits = { ...DEFAULT_OCTAGON_LIMITS, ...limits }
  ACTIVE_LIMITS = L

  // ── Per-connection state + per-user connection cap ──────────────────────
  interface ConnState {
    authed:    boolean
    userId:    string | null
    isAlive:   boolean
    msgWindowStart: number
    msgCount:  number
  }
  const states = new WeakMap<WebSocket, ConnState>()
  // M-1 (audit): per-IP connection counter — flooding himoyasi.
  // Per-attach (test izolyatsiyasi); close handler'da decrement.
  const connsByIp = new Map<string, number>()

  function trackConn(userId: string, ws: WebSocket): boolean {
    let set = connsByUser.get(userId)
    if (!set) { set = new Set(); connsByUser.set(userId, set) }
    if (!set.has(ws) && set.size >= L.maxConnsPerUser) return false
    if (!set.has(ws)) onlineGen++   // M-2: a'zolik o'zgardi → kesh invalidate
    set.add(ws)
    return true
  }
  function untrackConn(ws: WebSocket): void {
    let removed = false
    for (const [uid, set] of connsByUser) {
      if (set.delete(ws)) {
        removed = true
        if (set.size === 0) connsByUser.delete(uid)
      }
    }
    if (removed) onlineGen++        // M-2: faqat HAQIQIY o'zgarishda invalidate
    triggerOnlineBroadcast()
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
  registerInterval(heartbeat)   // wss 'close' ham tozalaydi; shutdown registry esa Node process'dan chiqishda sog'lom optimum
  wss.on('close', () => clearInterval(heartbeat))
  // 'error' event'i listener'siz EventEmitter'da process throw'ga aylanadi (P0).
  wss.on('error', (err) => {
    console.error('[octagon] wss error:', err)
    Sentry.captureException(err)
  })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Origin allowlist — FAQAT prod'da va ALLOWED_ORIGIN ANIQ berilganda
    // (env yo'q bo'lsa deny-all bo'lib qolmasligi uchun explicit flag).
    if (config.isProd && config.server.allowedOriginExplicit) {
      const origin = req.headers.origin
      if (!origin || !config.server.allowedOrigins.includes(origin)) {
        // Diagnostika: rad etish JIM bo'lmasligi kerak — 2026-08-31 incident'da
        // Render ALLOWED_ORIGIN'eski domen bilan qolib, app.kivvi.uz'dagi BARCHA
        // user "Aloqa uzildi" ko'rgan; log bo'lsa bir qarashda topilardi.
        console.warn('[octagon] origin REJECTED', { origin: origin ?? null })
        ws.close(1008, 'origin_not_allowed')
        return
      }
    }

    // ── M-1 (audit): connection flooding himoyasi ─────────────────────────
    // Auth deadline ulanish UMRINI cheklaydi, lekin parallel SONINI emas —
    // bitta IP'dan minglab parallel upgrade fd/xotirani tugatishi mumkin edi.
    // Cap'lar auth'dan OLDIN (eng arzon nuqta): global + per-IP.
    // Eslatma: connsByIp increment FAQAT shu nuqtadan o'tgan socketlar uchun;
    // ertaga qaytarilgan (close) socketlar hech qachon increment qilinmaydi —
    // close handler'dagi decrement shunga mos (pastda guard'li).
    if (wss.clients.size > L.maxTotalConns) {
      ws.close(1008, 'server_full')
      return
    }
    const ip = clientIp(req)
    const ipCount = connsByIp.get(ip) ?? 0
    if (ipCount >= L.maxConnsPerIp) {
      ws.close(1008, 'too_many_connections_ip')
      return
    }
    connsByIp.set(ip, ipCount + 1)
    // Diagnostika (Render log'larida WS transport muammolarini ko'rish uchun):
    // 'connection' otdi, lekin xabarlar kelyaptimi — close'dagi counts orqali bilinadi.
    console.log('[octagon] connection OPEN', { ip, origin: req.headers.origin ?? null, total: wss.clients.size })
    totalConnections++

    const state: ConnState = {
      authed: false, userId: null, isAlive: true,
      msgWindowStart: Date.now(), msgCount: 0,
    }
    states.set(ws, state)

    // 'error' listener'siz socket EventEmitter throw qiladi — bitta g'araz
    // socket butun process'ni qulatmasligi kerak (P0). Terminate qilamiz:
    // 'close' handler tozalashni (states/queue/duels) o'zi bajaradi.
    ws.on('error', (err) => {
      console.warn('[octagon] ws error:', err.message)
      ws.terminate()
    })

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
      triggerOnlineBroadcast()
      return true
    }

    ws.on('message', (raw) => {
      state.isAlive = true
      totalMessages++

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

      if (msg.type === 'get_online') {
        void (async () => {
          const uid = state.userId
          const onlineList = await getOnlineUsers(uid)
          send(ws, {
            type: 'online_players',
            count: onlineList.length,
            players: onlineList,
          })
        })()
        return
      }

      if (msg.type === 'auth') {
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
          if (!WS_USER_ID_RE.test(uid)) {
            send(ws, { type: 'error', message: 'invalid_user' })
            return
          }
          markAuthed(uid)
          send(ws, { type: 'auth_ok' })
        })()
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
          const rawCode = typeof msg.duelCode === 'string' ? msg.duelCode.trim().toLowerCase() : ''
          // M-6: 'new' — SERVER yangi kod generatsiya qiladi (duel_created qaytadi)
          if (rawCode === 'new') {
            joinDuelCreate(ws, uid, name, subjectId)
            return
          }
          const cleanCode = rawCode.replace(/^(?:duel|room)-/, '')
          const duelCode = cleanCode && (DUEL_CODE_RE.test(cleanCode) || DUEL_CODE_RE.test(rawCode)) ? cleanCode : null
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

      if (msg.type === 'reaction' && state.userId) {
        const userId = state.userId
        const matchId = String(msg.matchId)
        const match = matches.get(matchId)
        if (!match || !match.players.some((p) => p.userId === userId)) return

        // Anti-spam rate-limit: 1 reaksiya / 1.2 soniya
        const now = Date.now()
        const lastTime = lastReactionTime.get(userId) ?? 0
        if (now - lastTime < 1200) return
        lastReactionTime.set(userId, now)

        const kind = msg.kind === 'phrase' || msg.kind === 'prop' ? msg.kind : 'emoji'
        const content = String(msg.content ?? '').slice(0, 120)
        if (!content) return

        // Ikkala o'yinchiga ham yuboramiz
        for (const p of match.players) {
          send(p.ws, {
            type: 'reaction',
            senderId: userId,
            kind,
            content,
          })
        }
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

    ws.on('close', (code: number, reason: Buffer) => {
      // M-1: per-IP counter decrement — bu handler FAQAT cap tekshiruvidan
      // o'tgan (increment qilingan) socketlar uchun biriktirilgan.
      const n = (connsByIp.get(ip) ?? 1) - 1
      if (n <= 0) connsByIp.delete(ip)
      else connsByIp.set(ip, n)
      console.log('[octagon] connection CLOSE', { ip, code, reason: reason.toString().slice(0, 60), msgs: state.msgCount, authed: state.authed })

      clearTimeout(authTimer)
      untrackConn(ws)
      const userId = state.userId
      if (!userId) return
      // H-2 (audit) GHOST-DUEL himoyasi: kutilayotgan duel xonasini FAQAT shu
      // o'layotgan socket'niki bo'lsa o'chiramiz VA buni har qanday early-return'dan
      // OLDIN qilamiz — pastdagi match-slot stale-close return'i (yoki
      // handleDisconnect'dagi queue return'i) tozalashni o'tkazib yubormasligi
      // uchun. Yangi socket bilan qayta yaratilgan duel ws-mismatch tufayli
      // saqlanadi (deadWs filtri).
      leaveDuelByUser(userId, ws)
      // Stale socket closing after a rejoin replaced it — not a real disconnect
      const matchId = playerToMatch.get(userId)
      if (matchId) {
        const slot = matches.get(matchId)?.players.find((p) => p.userId === userId)
        if (slot && slot.ws !== ws) return
      }
      lastReactionTime.delete(userId)
      handleDisconnect(userId, ws)
    })
  })
}
