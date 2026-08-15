/**
 * Octagon WebSocket client — reconnect, typed protocol, React-friendly emitter.
 */

export type OctagonMsg =
  | { type: 'matched';      matchId: string; opponentName: string; roundCount: number }
  | { type: 'question';     index: number; questionId: number; timeLimit: number }
  | { type: 'answer_ack';   index: number; correct: boolean; correctOptionId: string }
  | { type: 'opp_answered'; index: number }
  | { type: 'round_result'; index: number; yourScore: number; oppScore: number; correctOptionId: string }
  | { type: 'match_end';    yourScore: number; oppScore: number; result: 'win' | 'lose' | 'draw' }
  | { type: 'opp_waiting'; waitSeconds: number }
  | { type: 'opp_reconnected' }
  | { type: 'match_state'; matchId: string; index: number; questionId: number | null
      timeLimit: number; roundCount: number; yourScore: number; oppScore: number
      opponentName: string; yourAnswer: string | null; oppAnswered: boolean
      correctOptionId: string | null }
  | { type: 'reaction'; senderId: string; kind: 'emoji' | 'phrase' | 'prop'; content: string }
  | { type: 'opp_disconnected' }
  | { type: 'pong' }
  | { type: 'error'; message: string }

export type OctagonSend =
  | { type: 'ping' }
  | { type: 'join_queue';  userId: string; name: string; subjectId?: string; duelCode?: string; initData?: string; sessionToken?: string }
  | { type: 'rejoin';      matchId: string; userId: string; name: string; initData?: string; sessionToken?: string }
  | { type: 'answer';      matchId: string; index: number; optionId: string }
  | { type: 'reaction';    matchId: string; kind: 'emoji' | 'phrase' | 'prop'; content: string }
  | { type: 'leave_queue'; userId: string }

type Listener = (msg: OctagonMsg) => void

/** Connection lifecycle for UI: banner, indicators, retry. */
export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'failed'
type StatusListener = (s: ConnStatus) => void

const RECONNECT_DELAY_MS    = 2000
const MAX_RECONNECTS        = 5
const HEARTBEAT_INTERVAL_MS = 3000   // ping every 3s
const HEARTBEAT_TIMEOUT_MS  = 6000   // one missed pong → dead

export class OctagonSocket {
  private ws:              WebSocket | null = null
  private listeners        = new Set<Listener>()
  private statusListeners  = new Set<StatusListener>()
  private reconnectCount   = 0
  private reconnectTimer:  ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer:  ReturnType<typeof setInterval> | null = null
  private lastMsgAt        = 0
  private closed           = false
  /** Joriy holat — yangi listener DARHOL uni oladi (socket allaqachon open bo'lsa ham) */
  private currentStatus: ConnStatus = 'connecting'
  private sendQueue: OctagonSend[] = []
  readonly url:            string

  constructor(url: string) {
    this.url = url
  }

  private emitStatus(s: ConnStatus): void {
    this.currentStatus = s
    this.statusListeners.forEach((fn) => fn(s))
  }

  /**
   * Half-open TCP sockets never fire `onclose` when the network dies silently.
   * Heartbeat: ping every 3s; no traffic for 6s → force close → reconnect.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.lastMsgAt = Date.now()
    this.heartbeatTimer = setInterval(() => {
      const ws = this.ws
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      if (Date.now() - this.lastMsgAt >= HEARTBEAT_TIMEOUT_MS) {
        ws.close()   // dead connection — onclose schedules the reconnect
        return
      }
      try { ws.send(JSON.stringify({ type: 'ping' })) }
      catch { ws.close() }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    while (this.sendQueue.length > 0) {
      const msg = this.sendQueue.shift()
      if (msg) {
        try { this.ws.send(JSON.stringify(msg)) }
        catch { /* ignored */ }
      }
    }
  }

  connect(): void {
    if (this.closed) return
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) return

    this.emitStatus('connecting')
    const ws = new WebSocket(this.url)
    this.ws  = ws

    ws.onopen = () => {
      this.reconnectCount = 0
      this.emitStatus('open')
      this.startHeartbeat()
      this.flushQueue()
    }

    ws.onmessage = (e) => {
      this.lastMsgAt = Date.now()
      let msg: OctagonMsg
      try { msg = JSON.parse(e.data as string) } catch { return }
      if (msg.type === 'pong') return   // heartbeat traffic — not for the UI
      this.listeners.forEach((fn) => fn(msg))
    }

    ws.onerror = () => {
      // onerror fires before onclose in most environments;
      // actual reconnect logic lives in onclose to avoid double-scheduling.
      this.listeners.forEach((fn) =>
        fn({ type: 'error', message: 'WebSocket connection error' })
      )
    }

    ws.onclose = () => {
      this.stopHeartbeat()
      if (this.closed) return
      if (this.reconnectCount < MAX_RECONNECTS) {
        this.reconnectCount++
        this.emitStatus('reconnecting')
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null
          this.connect()
        }, RECONNECT_DELAY_MS * this.reconnectCount)
      } else {
        this.emitStatus('failed')
      }
    }
  }

  /**
   * Send a message.
   * If socket is still connecting, messages are buffered and flushed upon onopen.
   */
  send(msg: OctagonSend): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
      return
    }
    // Ulanish jarayonida — navbatga qo'shib, onopen bo'lgach jo'natamiz
    this.sendQueue.push(msg)
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      this.connect()
    }
  }

  /** Returns an unsubscribe function. */
  on(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Subscribe to connection lifecycle — JORIY holat darhol chaqiriladi. Returns an unsubscribe function. */
  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn)
    fn(this.currentStatus)
    return () => this.statusListeners.delete(fn)
  }

  disconnect(): void {
    this.closed = true
    this.reconnectCount = 0
    this.sendQueue = []
    this.stopHeartbeat()

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.ws?.close()
    this.ws = null
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────
// Recreated when URL changes (e.g. token rotation).

let _instance: OctagonSocket | null = null

export function getOctagonSocket(wsUrl: string): OctagonSocket {
  if (_instance && _instance.url !== wsUrl) {
    _instance.disconnect()
    _instance = null
  }
  if (!_instance) {
    _instance = new OctagonSocket(wsUrl)
    _instance.connect()
  }
  return _instance
}

export function destroyOctagonSocket(): void {
  _instance?.disconnect()
  _instance = null
}
