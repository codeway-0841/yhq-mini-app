/**
 * Octagon PvP — WebSocket Gateway (Transport, Security & Dispatch).
 * WebSocket server, connection lifecycle, IP flood protection,
 * authentication orchestration, heartbeat va xabarlarni yo'naltirish shu yerda.
 */

import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { config } from '../../config'
import { Sentry } from '../../utils/sentry'
import { registerInterval } from '../../utils/shutdown'
import { isAuthEnforced } from '../../middleware/auth'
import { verifyInitData } from '../../utils/telegram'
import { authRepository } from '../auth/auth.repository'
import { SUBJECT_IDS, DEFAULT_SUBJECT_ID } from '../../config/subjects'
import type { LeaderboardEntry } from '../leaderboard/leaderboard.repository'
import {
  fetchOnlineRowsCached,
  getOnlineUsers as repoGetOnlineUsers,
} from './octagon.repository'
import {
  OctagonPools,
  MAX_MATCHES,
  MAX_NAME_LEN,
  DUEL_CODE_RE,
  WS_USER_ID_RE,
  send,
  matches,
  playerToMatch,
  lastReactionTime,
  setEngineLimits,
  setEnginePools,
  getEngineStats,
  rejoinMatch,
  handleDisconnect,
  leaveDuelByUser,
  joinDuelCreate,
  joinDuel,
  joinQueue,
  handleAnswer,
  handleReaction,
  handleLeaveQueue,
} from './octagon.engine'

// ── Connection hardening limitlari ─────────────────────────────────────────

export interface OctagonLimits {
  authDeadlineMs:  number
  heartbeatMs:     number
  msgWindowMs:     number
  maxMsgsPerWindow: number
  maxConnsPerUser: number
  maxConnsPerIp:   number
  maxTotalConns:   number
  reconnectWindowMs: number
  pauseBudgetMs:   number
}

export const DEFAULT_OCTAGON_LIMITS: OctagonLimits = {
  authDeadlineMs:   10_000,
  heartbeatMs:      30_000,
  msgWindowMs:      10_000,
  maxMsgsPerWindow: 50,
  maxConnsPerUser:  3,
  maxConnsPerIp:    25,
  maxTotalConns:    2500,
  reconnectWindowMs: 60_000,
  pauseBudgetMs:    90_000,
}

export let ACTIVE_LIMITS: OctagonLimits = DEFAULT_OCTAGON_LIMITS

// ── Connection Tracking & Stats ────────────────────────────────────────────

export const connsByUser = new Map<string, Set<WebSocket>>()
export let onlineGen = 0

let totalConnections = 0
let totalMessages = 0

export function getOctagonStats(wssClients: number): Record<string, number> {
  const engineStats = getEngineStats()
  return {
    clients: wssClients,
    totalConnections,
    totalMessages,
    onlineUsers: connsByUser.size,
    ...engineStats,
  }
}

// ── Online presence & broadcast ────────────────────────────────────────────

const ONLINE_BROADCAST_DEBOUNCE_MS = 1_000
const ONLINE_BROADCAST_MAX = 200

let onlineBroadcastTimer: NodeJS.Timeout | null = null

export function triggerOnlineBroadcast(): void {
  if (onlineBroadcastTimer) return
  onlineBroadcastTimer = setTimeout(async () => {
    onlineBroadcastTimer = null
    const onlineUserIds = Array.from(connsByUser.keys())
    const all = await fetchOnlineRowsCached(onlineUserIds, onlineGen)
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

/** Hozirgi jonli online foydalanuvchilar ro'yxati */
export async function getOnlineUsers(callerUserId: string | null): Promise<LeaderboardEntry[]> {
  const onlineUserIds = Array.from(connsByUser.keys())
  return repoGetOnlineUsers(onlineUserIds, callerUserId, onlineGen)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clientIp(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for']
  const raw = Array.isArray(xff) ? xff[0] : xff
  const ip = raw?.split(',')[0]?.trim()
  return ip || req.socket.remoteAddress || 'unknown'
}

/**
 * WS auth: client userId'siga HECH QACHON ishonilmaydi — faqat initData
 * (Mini App) imzosi YOKI sessionToken (telefon+parol / TG widget sessiyasi,
 * DB resolve) orqali aniqlangan id.
 */
export async function resolveWsUserId(msg: Record<string, unknown>): Promise<string | null> {
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

// ── Attach Octagon WebSocket Server ────────────────────────────────────────

export function attachOctagon(
  wss: WebSocketServer,
  pools: OctagonPools,
  limits: Partial<OctagonLimits> = {},
): void {
  setEnginePools(pools)
  const L: OctagonLimits = { ...DEFAULT_OCTAGON_LIMITS, ...limits }
  ACTIVE_LIMITS = L
  setEngineLimits({
    reconnectWindowMs: L.reconnectWindowMs,
    pauseBudgetMs: L.pauseBudgetMs,
  })

  interface ConnState {
    authed:    boolean
    userId:    string | null
    isAlive:   boolean
    msgWindowStart: number
    msgCount:  number
  }
  const states = new WeakMap<WebSocket, ConnState>()
  const connsByIp = new Map<string, number>()

  function trackConn(userId: string, ws: WebSocket): boolean {
    let set = connsByUser.get(userId)
    if (!set) { set = new Set(); connsByUser.set(userId, set) }
    if (!set.has(ws) && set.size >= L.maxConnsPerUser) return false
    if (!set.has(ws)) onlineGen++
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
    if (removed) onlineGen++
    triggerOnlineBroadcast()
  }

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const st = states.get(client)
      if (st && !st.isAlive) { client.terminate(); continue }
      if (st) st.isAlive = false
      client.ping()
    }
  }, L.heartbeatMs)
  registerInterval(heartbeat)
  wss.on('close', () => clearInterval(heartbeat))

  wss.on('error', (err) => {
    console.error('[octagon.gateway] wss error:', err)
    Sentry.captureException(err)
  })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    if (config.isProd && config.server.allowedOriginExplicit) {
      const origin = req.headers.origin
      if (!origin || !config.server.allowedOrigins.includes(origin)) {
        console.warn('[octagon.gateway] origin REJECTED', { origin: origin ?? null })
        ws.close(1008, 'origin_not_allowed')
        return
      }
    }

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
    console.log('[octagon.gateway] connection OPEN', { ip, origin: req.headers.origin ?? null, total: wss.clients.size })
    totalConnections++

    const state: ConnState = {
      authed: false, userId: null, isAlive: true,
      msgWindowStart: Date.now(), msgCount: 0,
    }
    states.set(ws, state)

    ws.on('error', (err) => {
      console.warn('[octagon.gateway] ws error:', err.message)
      ws.terminate()
    })

    const authTimer = setTimeout(() => {
      if (!state.authed) ws.terminate()
    }, L.authDeadlineMs)

    ws.on('pong', () => { state.isAlive = true })

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

function parseWsMessage(raw: unknown): Record<string, unknown> | null {
  try {
    const text = typeof raw === 'string' ? raw : (raw as Buffer).toString('utf-8')
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null
    }
    const type = (parsed as Record<string, unknown>)['type']
    if (typeof type !== 'string' || type.length === 0 || type.length > 64) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

    ws.on('message', (raw) => {
      try {
        state.isAlive = true
        totalMessages++

        const now = Date.now()
        if (now - state.msgWindowStart >= L.msgWindowMs) {
          state.msgWindowStart = now
          state.msgCount = 0
        }
        if (++state.msgCount > L.maxMsgsPerWindow) {
          ws.close(1008, 'rate_limited')
          return
        }

        const msg = parseWsMessage(raw)
        if (!msg) {
          send(ws, { type: 'error', message: 'invalid_message_format' })
          return
        }

        if (msg.type === 'ping') {
          send(ws, { type: 'pong' })
          return
        }

        if (msg.type === 'get_online') {
          void (async () => {
            try {
              const uid = state.userId
              const onlineList = await getOnlineUsers(uid)
              send(ws, {
                type: 'online_players',
                count: onlineList.length,
                players: onlineList,
              })
            } catch (err) {
              Sentry.captureException(err, { tags: { ws: 'get_online' } })
              send(ws, { type: 'error', message: 'internal_error' })
            }
          })()
          return
        }

        if (msg.type === 'auth') {
          void (async () => {
            try {
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
            } catch (err) {
              Sentry.captureException(err, { tags: { ws: 'auth' } })
              send(ws, { type: 'error', message: 'internal_error' })
            }
          })()
          return
        }

        if (msg.type === 'rejoin') {
          void (async () => {
            try {
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
            } catch (err) {
              Sentry.captureException(err, { tags: { ws: 'rejoin' } })
              send(ws, { type: 'error', message: 'internal_error' })
            }
          })()
          return
        }

        if (msg.type === 'join_queue') {
          void (async () => {
            try {
              let uid = String(msg.userId ?? '')
              const name = String(msg.name ?? "Noma'lum").slice(0, MAX_NAME_LEN)

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

              if (matches.size >= MAX_MATCHES) {
                send(ws, { type: 'error', message: 'server_full' })
                return
              }

              if (!markAuthed(uid)) return

              const subjectId = SUBJECT_IDS.includes(String(msg.subjectId))
                ? String(msg.subjectId)
                : DEFAULT_SUBJECT_ID

              const rawCode = typeof msg.duelCode === 'string' ? msg.duelCode.trim().toLowerCase() : ''
              if (rawCode === 'new') {
                joinDuelCreate(ws, uid, name, subjectId)
                return
              }
              const cleanCode = rawCode.replace(/^(?:duel|room)-/, '')
              const duelCode = cleanCode && (DUEL_CODE_RE.test(cleanCode) || DUEL_CODE_RE.test(rawCode)) ? cleanCode : null
              if (duelCode) joinDuel(ws, uid, name, duelCode, subjectId)
              else joinQueue(ws, uid, name, subjectId)
            } catch (err) {
              Sentry.captureException(err, { tags: { ws: 'join_queue' } })
              send(ws, { type: 'error', message: 'internal_error' })
            }
          })()
          return
        }

        if (msg.type === 'answer' && state.userId) {
          const userId = state.userId
          const matchId = String(msg.matchId ?? '')
          const index = Number(msg.index)
          const optionId = String(msg.optionId ?? '')
          handleAnswer(ws, userId, matchId, index, optionId)
          return
        }

        if (msg.type === 'reaction' && state.userId) {
          const userId = state.userId
          const matchId = String(msg.matchId ?? '')
          handleReaction(userId, matchId, msg.kind, msg.content)
          return
        }

        if (msg.type === 'leave_queue' && state.userId) {
          handleLeaveQueue(state.userId)
          return
        }
      } catch (err) {
        console.error('[octagon.gateway] unhandled sync error in ws.on(message):', err)
        Sentry.captureException(err, { tags: { ws: 'message_sync_error' } })
      }
    })


    ws.on('close', (code: number, reason: Buffer) => {
      const n = (connsByIp.get(ip) ?? 1) - 1
      if (n <= 0) connsByIp.delete(ip)
      else connsByIp.set(ip, n)
      console.log('[octagon.gateway] connection CLOSE', { ip, code, reason: reason.toString().slice(0, 60), msgs: state.msgCount, authed: state.authed })

      clearTimeout(authTimer)
      untrackConn(ws)
      const userId = state.userId
      if (!userId) return

      leaveDuelByUser(userId, ws)

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
