/**
 * Octagon WebSocket client — reconnect, typed protocol, React-friendly emitter.
 */

export type OctagonMsg =
  | { type: 'matched';      matchId: string; opponentName: string; roundCount: number }
  | { type: 'question';     index: number; questionId: number; timeLimit: number }
  | { type: 'answer_ack';   index: number; correct: boolean }
  | { type: 'opp_answered'; index: number }
  | { type: 'round_result'; index: number; yourScore: number; oppScore: number }
  | { type: 'match_end';    yourScore: number; oppScore: number; result: 'win' | 'lose' | 'draw' }
  | { type: 'opp_disconnected' }
  | { type: 'error'; message: string }

export type OctagonSend =
  | { type: 'join_queue';  userId: string; name: string; initData?: string }
  | { type: 'answer';      matchId: string; index: number; optionId: string }
  | { type: 'leave_queue'; userId: string }

type Listener = (msg: OctagonMsg) => void

/** Connection lifecycle for UI: banner, indicators, retry. */
export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'failed'
type StatusListener = (s: ConnStatus) => void

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECTS     = 5

export class OctagonSocket {
  private ws:              WebSocket | null = null
  private listeners        = new Set<Listener>()
  private statusListeners  = new Set<StatusListener>()
  private reconnectCount   = 0
  private reconnectTimer:  ReturnType<typeof setTimeout> | null = null
  private closed           = false
  readonly url:            string

  constructor(url: string) {
    this.url = url
  }

  private emitStatus(s: ConnStatus): void {
    this.statusListeners.forEach((fn) => fn(s))
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
    }

    ws.onmessage = (e) => {
      let msg: OctagonMsg
      try { msg = JSON.parse(e.data as string) } catch { return }
      this.listeners.forEach((fn) => fn(msg))
    }

    ws.onerror = () => {
      // onerror fires before onclose in most environments;
      // actual reconnect logic lives in onclose to avoid double-scheduling.
      // Emit an error event so the UI can surface a toast if needed.
      this.listeners.forEach((fn) =>
        fn({ type: 'error', message: 'WebSocket connection error' })
      )
    }

    ws.onclose = () => {
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
   * Throws if the socket is not OPEN so callers can handle it (e.g. show a toast).
   */
  send(msg: OctagonSend): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error('OctagonSocket: not connected — cannot send message')
    }
    this.ws.send(JSON.stringify(msg))
  }

  /** Returns an unsubscribe function. */
  on(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Subscribe to connection lifecycle. Returns an unsubscribe function. */
  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn)
    return () => this.statusListeners.delete(fn)
  }

  disconnect(): void {
    this.closed = true
    this.reconnectCount = 0

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
