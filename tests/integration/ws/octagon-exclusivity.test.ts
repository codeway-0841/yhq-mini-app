/**
 * Octagon EKSKLYUZIVLIK + connection-cap regression testlari (AUDIT 2026-08-31).
 *
 *  H-1: user queue / duel / match'dan FAQAT BIRINIDA bo'lishi mumkin.
 *       Eski bug'lar:
 *        a) duel yaratib random navbatga kirsa — duel bekor bo'lmasdan qolardi
 *           → do'st kod bilan kirganda user IKKINCHI parallel match'ga tushardi;
 *        b) navbatda turib duel kodiga o'tsa — navbat entry'si o'chirilmasdi
 *           → navbat orqali ham match'ga tushib parallel 2 o'yin;
 *        c) match'dagi user duel kod yuborsa — yangi match yaratilardi
 *           (endi REJOIN).
 *  H-2: duel yaratgan socket yopilganda xona o'chiriladi (ghost-duel yo'q);
 *       qayta yaratilgan duel yangi socket'da saqlanadi.
 *  M-1: per-IP + global connection cap — connection flooding himoyasi
 *       (auth'dan OLDIN, alohida server'larda qisqartirilgan limitlar bilan).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import http from 'http'
import { eq } from 'drizzle-orm'
import WebSocket, { WebSocketServer } from 'ws'
import { createApp } from '../../../server/app'
import { attachOctagon, type OctagonLimits } from '../../../server/octagon'
import { db } from '../../../server/db/connection'
import { users } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'

const POOL = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, correct: 'A' }))

// Har stsenariy O'Z user id'lari/kodlari/fani bilan — modul holati
// (queue/duels/matches) testlar orasida baham ko'riladi, ta'sir o'tmasligi uchun.
// DIQQAT: id diapazoni FAYL bo'yicha UNIQUE bo'lishi SHART — integration
// fayllar parallel worker'larda BITTA test DB'ni baham ko'radi; bir xil id
// boshqa faylning user'larini o'chirib yuboradi (FK fail → flaky).
// Band diapazonlar: 910x (social), 920x (match-results), 930x (rejoin).
const IDS = [
  '990000009401', '990000009402', '990000009403', // H-1a
  '990000009411', '990000009412', '990000009413', '990000009414', // H-1b
  '990000009421', '990000009422', '990000009423', // H-1c
  '990000009431', '990000009432', // H-2a
  '990000009441', '990000009442', // H-2b
  '990000009451', '990000009452', '990000009453', '990000009454', '990000009455', '990000009456', // M-6
]

let server: http.Server
let wss: WebSocketServer
let port: number
const openClients: WebSocket[] = []
const messageLog = new Map<WebSocket, Record<string, unknown>[]>()

beforeAll(async () => {
  for (const id of IDS) await db.delete(users).where(eq(users.id, id))
  for (const [i, id] of IDS.entries()) {
    await usersRepository.initAtomic({ id, firstName: 'Excl', lastName: `U${i + 1}`, username: '', photoUrl: '' })
  }

  const app = createApp()
  server = http.createServer(app)
  wss = new WebSocketServer({ server })
  attachOctagon(wss, new Map([['traffic_rules_db', POOL]]), {
    authDeadlineMs:    60_000,   // test davomida socket o'z-o'zidan yopilmasin
    heartbeatMs:       60_000,
    reconnectWindowMs: 500,      // test oxirida forfeit/cleanup tez yakunlansin
    pauseBudgetMs:     500,
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  port = (server.address() as { port: number }).port
})

afterAll(async () => {
  for (const ws of openClients) {
    if (ws.readyState !== WebSocket.CLOSED) ws.terminate()
  }
  wss.close()
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  for (const id of IDS) await db.delete(users).where(eq(users.id, id))   // cascade: duel_results
})

async function connect(): Promise<WebSocket> {
  const ws = new WebSocket(`ws://localhost:${port}`)
  messageLog.set(ws, [])
  ws.on('message', (raw) => {
    try { messageLog.get(ws)!.push(JSON.parse(raw.toString()) as Record<string, unknown>) } catch { /* ignore */ }
  })
  openClients.push(ws)
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve())
    ws.on('error', reject)
  })
  return ws
}

const send = (ws: WebSocket, msg: object) => ws.send(JSON.stringify(msg))

/** Bufferdan berilgan turdagi (ixtiyoriy shartli) xabarni kutadi va iste'mol qiladi. */
function waitFor(
  ws: WebSocket,
  type: string,
  predicate: (m: Record<string, unknown>) => boolean = () => true,
  timeoutMs = 5_000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(poller)
      reject(new Error(`"${type}" xabari kutilmadi`))
    }, timeoutMs)
    const poller = setInterval(() => {
      const log = messageLog.get(ws)!
      const idx = log.findIndex((m) => m['type'] === type && predicate(m))
      if (idx >= 0) {
        const [msg] = log.splice(idx, 1)
        clearTimeout(timeout)
        clearInterval(poller)
        resolve(msg!)
      }
    }, 10)
  })
}

/** Berilgan muddat ichida shu turdagi xabar KELMAGANINI tasdiqlaydi. */
async function expectNoMessage(ws: WebSocket, type: string, ms = 700): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
  expect(messageLog.get(ws)!.filter((m) => m['type'] === type)).toEqual([])
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── H-1: queue / duel / match eksklyuzivligi ────────────────────────────────

describe('H-1: queue/duel/match eksklyuzivligi (parallel match himoyasi)', () => {
  it('duel yaratib RANDOM navbatga kirsa — kutilayotgan duel bekor qilinadi', async () => {
    const A = '990000009401', B = '990000009402', C = '990000009403'
    const wsA = await connect()
    // 1) A duel xonasi yaratadi
    send(wsA, { type: 'join_queue', userId: A, name: 'A1', subjectId: 'ingliz', duelCode: 'duel-ha1001' })
    await sleep(150)
    // 2) A fikrini o'zgartirib RANDOM navbatga kiradi → duel bekor bo'lishi shart
    send(wsA, { type: 'join_queue', userId: A, name: 'A1', subjectId: 'ingliz' })
    await sleep(150)
    // 3) B eski duel kodi bilan kiradi — A bilan JUFTLAShMASLIGI kerak
    //    (B endi shu kodning yangi kutuvchisi bo'lib qoladi)
    const wsB = await connect()
    send(wsB, { type: 'join_queue', userId: B, name: 'B1', subjectId: 'ingliz', duelCode: 'duel-ha1001' })
    await expectNoMessage(wsA, 'matched')
    await expectNoMessage(wsB, 'matched')
    // 4) A haqiqatan navbatda — C kirganda A+C juftlashadi
    const wsC = await connect()
    send(wsC, { type: 'join_queue', userId: C, name: 'C1', subjectId: 'ingliz' })
    const matchedA = await waitFor(wsA, 'matched')
    await waitFor(wsC, 'matched')
    expect(matchedA['opponentName']).toBe('C1')
  })

  it('navbatda turib DUEL kodiga o\'tsa — navbat entry\'si o\'chiriladi', async () => {
    const A = '990000009411', B = '990000009412', C = '990000009413', D = '990000009414'
    const wsA = await connect()
    // 1) A random navbatda
    send(wsA, { type: 'join_queue', userId: A, name: 'A2', subjectId: 'biologiya' })
    await sleep(150)
    // 2) A duel kodiga o'tadi → navbatdan CHIQARILISHI shart
    send(wsA, { type: 'join_queue', userId: A, name: 'A2', subjectId: 'biologiya', duelCode: 'duel-hb1001' })
    await sleep(150)
    // 3) B random navbatga kiradi — A bilan JUFTLAShMASLIGI kerak
    const wsB = await connect()
    send(wsB, { type: 'join_queue', userId: B, name: 'B2', subjectId: 'biologiya' })
    await expectNoMessage(wsA, 'matched')
    await expectNoMessage(wsB, 'matched')
    // 4) A'nin dueli tirik — C kod bilan kirganda A+C juftlashadi
    const wsC = await connect()
    send(wsC, { type: 'join_queue', userId: C, name: 'C2', subjectId: 'rustili', duelCode: 'duel-hb1001' })
    const matchedA = await waitFor(wsA, 'matched')
    expect(matchedA['opponentName']).toBe('C2')
    await waitFor(wsC, 'matched')
    // 5) B esa navbatda qolgan — D kirganda B+D juftlashadi
    const wsD = await connect()
    send(wsD, { type: 'join_queue', userId: D, name: 'D2', subjectId: 'biologiya' })
    const matchedB = await waitFor(wsB, 'matched')
    expect(matchedB['opponentName']).toBe('D2')
  })

  it('match\'dagi user duel kod yuborsa — REJOIN (yangi match YO\'Q)', async () => {
    const A = '990000009421', B = '990000009422', C = '990000009423'
    const wsA = await connect()
    const wsB = await connect()
    send(wsA, { type: 'join_queue', userId: A, name: 'A3', subjectId: 'matematika' })
    send(wsB, { type: 'join_queue', userId: B, name: 'B3', subjectId: 'matematika' })
    const matchedA = await waitFor(wsA, 'matched')
    const matchId = String(matchedA['matchId'])
    // A match ichidan duel kod yuboradi — yangi match EMAS, mavjud match'ga rejoin
    send(wsA, { type: 'join_queue', userId: A, name: 'A3', duelCode: 'duel-hc1001' })
    const state = await waitFor(wsA, 'match_state')
    expect(state['matchId']).toBe(matchId)
    // C shu kod bilan kirsa — A BAND bo'lgani uchun juftlashMAYDI (kutuvchi bo'lib qoladi)
    const wsC = await connect()
    send(wsC, { type: 'join_queue', userId: C, name: 'C3', duelCode: 'duel-hc1001' })
    await expectNoMessage(wsC, 'matched')
  })
})

// ── H-2: ghost-duel himoyasi ────────────────────────────────────────────────

describe('H-2: ghost-duel himoyasi', () => {
  it('duel yaratgan socket yopilsa — xona o\'chiriladi (ghost qolmaydi)', async () => {
    const A = '990000009431', B = '990000009432'
    const wsA = await connect()
    send(wsA, { type: 'join_queue', userId: A, name: 'A4', duelCode: 'duel-h2a001' })
    await sleep(150)
    wsA.terminate()
    await sleep(300)   // close event + tozalash
    // B shu kod bilan kiradi — ghost xona bo'lsa A (o'lik) bilan juftlashardi;
    // toza bo'lsa B yangi kutuvchi bo'lib qoladi (matched YO'Q).
    const wsB = await connect()
    send(wsB, { type: 'join_queue', userId: B, name: 'B4', duelCode: 'duel-h2a001' })
    await expectNoMessage(wsB, 'matched')
  })

  it('bir xil socket\'da duel QAYTA yaratilsa — yangisi saqlanadi va ishlaydi', async () => {
    const A = '990000009441', B = '990000009442'
    const wsA = await connect()
    send(wsA, { type: 'join_queue', userId: A, name: 'A5', duelCode: 'duel-h2b001' })
    await sleep(150)
    // Bir xil socket'da qayta yaratish (replace yo'li) — duel o'chib qolmasligi kerak
    send(wsA, { type: 'join_queue', userId: A, name: 'A5', duelCode: 'duel-h2b001' })
    await sleep(150)
    const wsB = await connect()
    send(wsB, { type: 'join_queue', userId: B, name: 'B5', duelCode: 'duel-h2b001' })
    const matchedA = await waitFor(wsA, 'matched')
    expect(matchedA['opponentName']).toBe('B5')
    await waitFor(wsB, 'matched')
  })
})

// ── M-6: server-generatsiya duel PIN ────────────────────────────────────────

describe('M-6: duel PIN server generatsiyasi (duelCode: "new")', () => {
  it("'new' so'roviga duel_created + 6 xonali kod qaytadi; do'st shu kod bilan juftlashadi", async () => {
    const A = '990000009451', B = '990000009452'
    const wsA = await connect()
    send(wsA, { type: 'join_queue', userId: A, name: 'A6', duelCode: 'new' })
    const created = await waitFor(wsA, 'duel_created')
    const code = String(created['code'])
    expect(code).toMatch(/^\d{6}$/)

    // Do'st server bergan kod bilan kiradi — juftlashadi
    const wsB = await connect()
    send(wsB, { type: 'join_queue', userId: B, name: 'B6', duelCode: code })
    const matchedA = await waitFor(wsA, 'matched')
    expect(matchedA['opponentName']).toBe('B6')
    await waitFor(wsB, 'matched')
  })

  it("ikki parallel 'new' so'rovi TURLI kod oladi (collision yo'q)", async () => {
    const A = '990000009453', C = '990000009454'
    const wsA = await connect()
    send(wsA, { type: 'join_queue', userId: A, name: 'A6', duelCode: 'new' })
    const c1 = await waitFor(wsA, 'duel_created')

    const wsC = await connect()
    send(wsC, { type: 'join_queue', userId: C, name: 'C6', duelCode: 'new' })
    const c2 = await waitFor(wsC, 'duel_created')

    expect(c2['code']).not.toBe(c1['code'])
    // Ikkalasi ham kutilayotgan holatda — hech kim matched bo'lmaydi
    await expectNoMessage(wsA, 'matched')
    await expectNoMessage(wsC, 'matched')
  })

  it("yangi 'new' so'rovi eski kutilayotgan duenni ALMASHTIRADI (eski kod o'ladi)", async () => {
    const A = '990000009455', B = '990000009456'
    const wsA = await connect()
    send(wsA, { type: 'join_queue', userId: A, name: 'A6', duelCode: 'new' })
    const c1 = await waitFor(wsA, 'duel_created')

    send(wsA, { type: 'join_queue', userId: A, name: 'A6', duelCode: 'new' })
    const c2 = await waitFor(wsA, 'duel_created')
    expect(c2['code']).not.toBe(c1['code'])

    // Eski kod bilan kirib bo'lmaydi — B faqat KUTUVCHI bo'lib qoladi (matched YO'Q)
    const wsB = await connect()
    send(wsB, { type: 'join_queue', userId: B, name: 'B6', duelCode: String(c1['code']) })
    await expectNoMessage(wsB, 'matched')
    // Yangi kod esa ishlaydi
    send(wsB, { type: 'join_queue', userId: B, name: 'B6', duelCode: String(c2['code']) })
    const matchedA = await waitFor(wsA, 'matched')
    expect(matchedA['opponentName']).toBe('B6')
  })
})

// ── M-1: per-IP + global connection cap ─────────────────────────────────────
// Har cap testi O'Z serverida (qisqartirilgan limitlar) — hardening pattern'i.

interface CapServer {
  server: http.Server
  port: number
  wss: WebSocketServer
  clients: WebSocket[]
}

const capServers: CapServer[] = []

async function withCapServer(limits: Partial<OctagonLimits>): Promise<CapServer> {
  const app = createApp()
  const server = http.createServer(app)
  const wss = new WebSocketServer({ server })
  attachOctagon(wss, new Map([['traffic_rules_db', POOL]]), limits)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as { port: number }).port
  const ts: CapServer = { server, port, wss, clients: [] }
  capServers.push(ts)
  return ts
}

afterEach(async () => {
  for (const ts of capServers.splice(0)) {
    for (const c of ts.clients) {
      if (c.readyState !== WebSocket.CLOSED) c.terminate()
    }
    ts.wss.close()
    await new Promise<void>((res) => ts.server.close(() => res()))
  }
})

async function connectCap(ts: CapServer): Promise<WebSocket> {
  const ws = new WebSocket(`ws://localhost:${ts.port}`)
  ts.clients.push(ws)
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve())
    ws.on('error', reject)
  })
  return ws
}

function waitForClose(ws: WebSocket, timeoutMs = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('close kutilmadi')), timeoutMs)
    ws.on('close', (code) => { clearTimeout(t); resolve(code) })
  })
}

describe('M-1: connection flooding himoyasi (per-IP + global cap)', () => {
  it('per-IP cap: bitta IP\'dan limitdan ortiq socket 1008 bilan rad etiladi', async () => {
    const ts = await withCapServer({ maxConnsPerIp: 2, authDeadlineMs: 5_000, heartbeatMs: 60_000 })
    const ws1 = await connectCap(ts)
    const ws2 = await connectCap(ts)
    expect(ws1.readyState).toBe(WebSocket.OPEN)
    expect(ws2.readyState).toBe(WebSocket.OPEN)

    // 3-socket (bir xil IP — test localhost) cap'ga uriladi
    const ws3 = await connectCap(ts)
    expect(await waitForClose(ws3)).toBe(1008)

    // Birortasi yopilgach — joy bo'shaydi, yangi socket qabul qilinadi
    ws1.terminate()
    await sleep(300)
    const ws4 = await connectCap(ts)
    await sleep(150)
    expect(ws4.readyState).toBe(WebSocket.OPEN)
  })

  it('global cap: jami socketlar limitdan oshsa — 1008 server_full', async () => {
    const ts = await withCapServer({ maxTotalConns: 2, authDeadlineMs: 5_000, heartbeatMs: 60_000 })
    const ws1 = await connectCap(ts)
    const ws2 = await connectCap(ts)
    expect(ws1.readyState).toBe(WebSocket.OPEN)
    expect(ws2.readyState).toBe(WebSocket.OPEN)

    const ws3 = await connectCap(ts)
    expect(await waitForClose(ws3)).toBe(1008)
  })
})
