/**
 * WebSocket integration tests for the Octagon matchmaking flow.
 *
 * Spins up a real HTTP + WS server on a random port.
 * Two clients connect, join the queue, get matched, and play one round.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import WebSocket from 'ws'
import { createApp } from '../../../server/app'
import { WebSocketServer } from 'ws'
import { attachOctagon } from '../../../server/octagon'

const TEST_QUESTION_POOL = [
  { id: 1,  correct: 'A' },
  { id: 2,  correct: 'B' },
  { id: 3,  correct: 'C' },
  { id: 4,  correct: 'A' },
  { id: 5,  correct: 'B' },
  { id: 6,  correct: 'C' },
  { id: 7,  correct: 'A' },
  { id: 8,  correct: 'B' },
  { id: 9,  correct: 'C' },
  { id: 10, correct: 'A' },
]

let server: http.Server
let port: number
// Track open clients so afterAll can force-close them if a test throws
const openClients: WebSocket[] = []

beforeAll(async () => {
  const app = createApp()
  server = http.createServer(app)
  const wss = new WebSocketServer({ server })
  // attachOctagon endi dataSourceId → pool map qabul qiladi
  attachOctagon(wss, new Map([['traffic_rules_db', TEST_QUESTION_POOL]]))
  await new Promise<void>((resolve) => server.listen(0, resolve))
  port = (server.address() as { port: number }).port
})

afterAll(async () => {
  // Close any clients that weren't cleaned up by a failing test
  for (const ws of openClients) {
    if (ws.readyState !== WebSocket.CLOSED) ws.close()
  }
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  )
})

// Buffer every incoming message per connection — matching messages arriving
// in the same tick would otherwise race with waitForMessage's listener setup.
const messageLog = new Map<WebSocket, Record<string, unknown>[]>()

function wsConnect(userId: string): WebSocket {
  const ws = new WebSocket(`ws://localhost:${port}?userId=${userId}`)
  messageLog.set(ws, [])
  ws.on('message', (raw) => {
    try { messageLog.get(ws)!.push(JSON.parse(raw.toString())) } catch { /* ignore */ }
  })
  openClients.push(ws)
  return ws
}

/**
 * Wait for a message of a given type from the connection's buffer.
 * Consumes matched messages so multiple waits can run sequentially.
 */
function waitForMessage(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(poller)
      reject(new Error(`Timeout waiting for message type "${type}"`))
    }, 5_000)

    const poller = setInterval(() => {
      const log  = messageLog.get(ws)!
      const idx  = log.findIndex((m) => m['type'] === type)
      if (idx >= 0) {
        const [msg] = log.splice(idx, 1)
        clearTimeout(timeout)
        clearInterval(poller)
        resolve(msg)
      }
    }, 10)
  })
}

describe('Octagon matchmaking + first round', () => {
  it('two players get matched and receive a question', async () => {
    const ws1 = wsConnect('111')
    const ws2 = wsConnect('222')

    await Promise.all([
      new Promise<void>((r) => ws1.on('open', r)),
      new Promise<void>((r) => ws2.on('open', r)),
    ])

    const matchedP1 = waitForMessage(ws1, 'matched')
    const matchedP2 = waitForMessage(ws2, 'matched')

    // Telegram ids are numeric — non-numeric ids are rejected by the server
    ws1.send(JSON.stringify({ type: 'join_queue', userId: '111', name: 'P1' }))
    ws2.send(JSON.stringify({ type: 'join_queue', userId: '222', name: 'P2' }))

    const [m1, m2] = await Promise.all([matchedP1, matchedP2])

    expect(m1['matchId']).toBe(m2['matchId'])
    expect(typeof m1['roundCount']).toBe('number')
    // questionIds must NOT be in the matched message (security)
    expect(m1['questionIds']).toBeUndefined()

    // Both receive first question (index 0-based)
    const questionP1 = waitForMessage(ws1, 'question')
    const questionP2 = waitForMessage(ws2, 'question')
    const [q1, q2] = await Promise.all([questionP1, questionP2])

    expect(q1['index']).toBe(0)
    expect(q2['index']).toBe(0)
    expect(typeof q1['questionId']).toBe('number')

    ws1.close()
    ws2.close()
  })
})
