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

  it('malformed JSON yoki non-object envelope serverni qulatmaydi (ID 01)', async () => {
    const ts = await withServer({ authDeadlineMs: 5_000, heartbeatMs: 60_000 })
    const ws = await connect(ts)
    const received: Record<string, unknown>[] = []
    ws.on('message', (raw) => {
      try { received.push(JSON.parse(raw.toString())) } catch { /* ignore */ }
    })

    // Valid JSON lekin non-object yoki malformed types
    ws.send('null')
    ws.send('123')
    ws.send('true')
    ws.send('"string"')
    ws.send('[]')
    ws.send(JSON.stringify({}))
    ws.send(JSON.stringify({ type: 123 }))
    ws.send('{ invalid json')

    await new Promise((r) => setTimeout(r, 300))

    // Socket tirik va format xatolarini olgan
    expect(ws.readyState).toBe(WebSocket.OPEN)
    const formatErrors = received.filter((m) => m['type'] === 'error' && m['message'] === 'invalid_message_format')
    expect(formatErrors.length).toBeGreaterThanOrEqual(5)

    // Keyingi sog'lom xabar ishlaydi
    ws.send(JSON.stringify({ type: 'ping' }))
    await new Promise((r) => setTimeout(r, 200))
    expect(received.some((m) => m['type'] === 'pong')).toBe(true)

    ws.terminate()
  })
})

/**
 * Pauza byudjeti (griefing cap) — eski bug: connect-disconnect churn bilan
 * o'yin CHEKSIZ pauza'da ushlab turilardi (har uzilish to'liq yangi grace
 * oynasi ochardi). Endi o'yinchi boshiga jami pauza byudjeti bor: sarflangan
 * grace vaqti ayiriladi, tugagach grace YO'Q — darhol forfeit.
 */
describe('Pauza byudjeti (disconnect-grace griefing cap)', () => {
  const LIMITS: Partial<OctagonLimits> = {
    authDeadlineMs: 5_000, heartbeatMs: 60_000,
    msgWindowMs: 10_000, maxMsgsPerWindow: 50, maxConnsPerUser: 3,
    reconnectWindowMs: 1_200, pauseBudgetMs: 2_000,
  }

  const logs = new Map<WebSocket, Record<string, unknown>[]>()
  const buffer = (ws: WebSocket): void => {
    logs.set(ws, [])
    ws.on('message', (raw) => {
      try { logs.get(ws)!.push(JSON.parse(raw.toString())) } catch { /* ignore */ }
    })
  }
  function waitMsg(ws: WebSocket, type: string, timeoutMs = 8_000): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { clearInterval(p); reject(new Error(`"${type}" kutilmadi`)) }, timeoutMs)
      const p = setInterval(() => {
        const log = logs.get(ws)!
        const idx = log.findIndex((m) => m['type'] === type)
        if (idx >= 0) { clearInterval(p); clearTimeout(t); resolve(log.splice(idx, 1)[0]!) }
      }, 20)
    })
  }

  it('byudjet sarflangach — keyingi uzilish grace\'i QISCALIB forfeit tezlashadi', async () => {
    const ts = await withServer({
      authDeadlineMs: 5_000, heartbeatMs: 60_000,
      msgWindowMs: 10_000, maxMsgsPerWindow: 50, maxConnsPerUser: 3,
      reconnectWindowMs: 1_200, pauseBudgetMs: 1_700,
    })
    const a = await connect(ts); buffer(a); ts.clients.push(a)
    const b = await connect(ts); buffer(b); ts.clients.push(b)
    a.send(JSON.stringify({ type: 'join_queue', userId: '990010', name: 'Griefer' }))
    b.send(JSON.stringify({ type: 'join_queue', userId: '990011', name: 'Victim' }))
    await Promise.all([waitMsg(a, 'matched'), waitMsg(b, 'matched')])

    // 1-chi uzilish: to'liq grace 1.2s (byudjet 1.7s dan kichik). 800ms'da qaytamiz
    // → byudjet ~900ms qoladi (< 1.2s oyna).
    a.terminate()
    const wait1 = await waitMsg(b, 'opp_waiting')
    expect(Number(wait1['waitSeconds'])).toBeGreaterThanOrEqual(1)
    await new Promise((r) => setTimeout(r, 800))

    const a2 = await connect(ts); buffer(a2); ts.clients.push(a2)
    a2.send(JSON.stringify({ type: 'rejoin', matchId: 'x', userId: '990010', name: 'Griefer' }))
    await waitMsg(a2, 'match_state')   // qayta kirdi — byudjet sarflandi

    // 2-chi uzilish: qolgan byudjet (~900ms) < to'liq oyna (1.2s) — forfeit
    // TO'LIQ oynadan ERTA kelishi shart (byudget'siz bo'lsa ~1.2s kutilardi).
    const t0 = Date.now()
    a2.terminate()
    await waitMsg(b, 'opp_waiting')
    await waitMsg(b, 'opp_disconnected')   // g'alaba rasmiylashdi
    const elapsed = Date.now() - t0
    expect(elapsed).toBeLessThan(1_150)    // to'liq 1200ms oynadan tezroq — byudjet ishladi
    expect(elapsed).toBeGreaterThan(600)   // jinoyatchilik yo'qligini: pauza berildi
  })

  it('byudjet butunlay 0 bo\'lsa — grace umuman YO\'Q (darhol forfeit)', async () => {
    const ts = await withServer({ ...LIMITS, pauseBudgetMs: 1 })
    const a = await connect(ts); buffer(a); ts.clients.push(a)
    const b = await connect(ts); buffer(b); ts.clients.push(b)
    a.send(JSON.stringify({ type: 'join_queue', userId: '990012', name: 'Griefer2' }))
    b.send(JSON.stringify({ type: 'join_queue', userId: '990013', name: 'Victim2' }))
    await Promise.all([waitMsg(a, 'matched'), waitMsg(b, 'matched')])

    a.terminate()   // byudjet 1ms ⇒ window = min(1200, 1) ≈ 0 → deyarli darhol forfeit
    await waitMsg(b, 'opp_disconnected')
  })
})
