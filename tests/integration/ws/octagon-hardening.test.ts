/**
 * WebSocket hardening integration tests — connection darajasidagi himoyalar:
 *  1. Auth deadline: join_queue/rejoin qilmagan socket terminate bo'ladi.
 *  2. Message rate limit: oyna ichidagi limitdan oshsa 1008 bilan yopiladi.
 *  3. Per-user connection cap: parallel socketlar soni cheklangan.
 *
 * Har xususiyat QISQARTIRILGAN limitlar bilan alohida server'da tekshiriladi.
 */

import { describe, it, expect, afterEach } from 'vitest'
import http from 'http'
import WebSocket, { WebSocketServer } from 'ws'
import { createApp } from '../../../server/app'
import { attachOctagon, type OctagonLimits } from '../../../server/octagon'

const POOL = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, correct: 'A' }))

interface TestServer {
  server: http.Server
  port: number
  wss: WebSocketServer
  clients: WebSocket[]
}

async function startServer(limits: Partial<OctagonLimits>): Promise<TestServer> {
  const app = createApp()
  const server = http.createServer(app)
  const wss = new WebSocketServer({ server })
  attachOctagon(wss, new Map([['traffic_rules_db', POOL]]), limits)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as { port: number }).port
  return { server, port, wss, clients: [] }
}

const servers: TestServer[] = []

async function withServer(limits: Partial<OctagonLimits>): Promise<TestServer> {
  const ts = await startServer(limits)
  servers.push(ts)
  return ts
}

afterEach(async () => {
  for (const ts of servers.splice(0)) {
    for (const c of ts.clients) {
      if (c.readyState !== WebSocket.CLOSED) c.terminate()
    }
    ts.wss.close()
    await new Promise<void>((res) => ts.server.close(() => res()))
  }
})

function connect(ts: TestServer): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${ts.port}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function waitForClose(ws: WebSocket, timeoutMs = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('close kutilmadi')), timeoutMs)
    ws.on('close', (code) => { clearTimeout(t); resolve(code) })
  })
}

describe('WS hardening', () => {
  it('auth deadline: join qilmagan socket terminate bo\'ladi', async () => {
    const ts = await withServer({ authDeadlineMs: 150, heartbeatMs: 60_000 })
    const ws = await connect(ts)
    const code = await waitForClose(ws)
    expect(code).toBe(1006) // terminate — abnormal closure
  })

  it('auth deadline: join QILGAN socket yopilmaydi', async () => {
    const ts = await withServer({ authDeadlineMs: 500, heartbeatMs: 60_000 })
    const ws = await connect(ts)
    ws.send(JSON.stringify({ type: 'join_queue', userId: '990001', name: 'A' }))
    await new Promise((r) => setTimeout(r, 800))
    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.terminate()
  })

  it('rate limit: oynadan oshgan xabarlar socketni yopadi (1008)', async () => {
    const ts = await withServer({ msgWindowMs: 60_000, maxMsgsPerWindow: 3, heartbeatMs: 60_000 })
    const ws = await connect(ts)
    const closePromise = waitForClose(ws)
    for (let i = 0; i < 10; i++) ws.send(JSON.stringify({ type: 'ping' }))
    expect(await closePromise).toBe(1008)
  })

  it('per-user cap: parallel socketlar cheklangan', async () => {
    const ts = await withServer({ maxConnsPerUser: 1, authDeadlineMs: 5_000, heartbeatMs: 60_000 })
    const uid = '990002'

    const ws1 = await connect(ts)
    ws1.send(JSON.stringify({ type: 'join_queue', userId: uid, name: 'A' }))
    await new Promise((r) => setTimeout(r, 100))

    // Ikkinchi socket cap'dan oshadi — error + close
    const ws2 = await connect(ts)
    const received: Record<string, unknown>[] = []
    ws2.on('message', (raw) => received.push(JSON.parse(raw.toString())))
    const closePromise = waitForClose(ws2)
    ws2.send(JSON.stringify({ type: 'join_queue', userId: uid, name: 'B' }))
    expect(await closePromise).toBe(1008)
    expect(received.some((m) => m.message === 'too_many_connections')).toBe(true)

    // Birinchisi tirik qoladi
    expect(ws1.readyState).toBe(WebSocket.OPEN)
    ws1.terminate()
  })

  it('boshqa user uchun cap ta\'sir qilmaydi', async () => {
    const ts = await withServer({ maxConnsPerUser: 1, authDeadlineMs: 5_000, heartbeatMs: 60_000 })
    const ws1 = await connect(ts)
    ws1.send(JSON.stringify({ type: 'join_queue', userId: '990003', name: 'A' }))
    await new Promise((r) => setTimeout(r, 100))
    const ws2 = await connect(ts)
    ws2.send(JSON.stringify({ type: 'join_queue', userId: '990004', name: 'B' }))
    await new Promise((r) => setTimeout(r, 200))
    expect(ws1.readyState).toBe(WebSocket.OPEN)
    expect(ws2.readyState).toBe(WebSocket.OPEN)
    ws1.terminate()
    ws2.terminate()
  })
})
