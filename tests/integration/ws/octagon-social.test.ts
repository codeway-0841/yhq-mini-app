/**
 * Octagon "ijtimoiy" oqimlari — integration testlar (real WS server + test DB).
 *
 * Qamrov (avval testsiz qolgan uchta oqim):
 *  1. Online o'yinchilar  — `get_online` javobi + real-time `online_players`
 *     broadcast (ulanish/uzilishda), DB'da yo'q userlar ro'yxatga tushmasligi.
 *  2. Raqib topish        — navbat FAQAT bir xil fan ichida juftlaydi,
 *     `leave_queue` navbatdan chiqaradi.
 *  3. Do'stni taklif qilish — `duelCode` bilan navbatdan tashqari juftlash,
 *     `duel-`/`room-` prefiks va registr normalizatsiyasi, yaroqsiz kod oddiy
 *     navbatga tushishi, brute-force limiti (60s'da 8 urinish).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import { eq } from 'drizzle-orm'
import WebSocket, { WebSocketServer } from 'ws'
import { createApp } from '../../../server/app'
import { attachOctagon } from '../../../server/octagon'
import { db } from '../../../server/db/connection'
import { users } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'

const POOL = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, correct: 'A' }))

// Testlar bir process'da modul holatini (queue/duels/connsByUser) baham ko'radi —
// har test o'z user id'lari va o'z fani bilan ishlaydi, ta'sir o'tmasin.
const O1 = '990000009101'
const O2 = '990000009102'
const Q1 = '990000009103'
const Q2 = '990000009104'
const Q3 = '990000009105'
const F1 = '990000009106'
const F2 = '990000009107'
const F3 = '990000009108'
const F4 = '990000009109'
const BRUTE = '990000009110'
const GHOST = '990000009199'   // DB'da YO'Q — online ro'yxatida ko'rinmasligi kerak
const IDS = [O1, O2, Q1, Q2, Q3, F1, F2, F3, F4, BRUTE]

let server: http.Server
let wss: WebSocketServer
let port: number
const openClients: WebSocket[] = []
const messageLog = new Map<WebSocket, Record<string, unknown>[]>()

beforeAll(async () => {
  for (const id of IDS) await db.delete(users).where(eq(users.id, id))
  for (const [i, id] of IDS.entries()) {
    await usersRepository.initAtomic({ id, firstName: 'Duelist', lastName: `S${i + 1}`, username: '', photoUrl: '' })
  }

  const app = createApp()
  server = http.createServer(app)
  wss = new WebSocketServer({ server })
  attachOctagon(wss, new Map([['traffic_rules_db', POOL]]), {
    authDeadlineMs:    60_000,   // testlar davomida socket o'z-o'zidan yopilmasin
    heartbeatMs:       60_000,
    reconnectWindowMs: 500,      // test oxirida forfeit tez yakunlansin
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

/** Bufferdan berilgan turdagi (ixtiyoriy shart bilan) xabarni kutadi va uni iste'mol qiladi. */
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
async function expectNoMessage(ws: WebSocket, type: string, ms = 600): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
  expect(messageLog.get(ws)!.filter((m) => m['type'] === type)).toEqual([])
}

const playersOf = (msg: Record<string, unknown>) =>
  msg['players'] as Array<{ userId: string; isYou: boolean; name: string; score: number }>

async function authAs(userId: string): Promise<WebSocket> {
  const ws = await connect()
  send(ws, { type: 'auth', userId })
  await waitFor(ws, 'auth_ok')
  return ws
}

describe('Online o\'yinchilar', () => {
  it('get_online — o\'zini isYou bilan qaytaradi, DB\'da yo\'q user ro\'yxatda emas', async () => {
    const wsA = await authAs(O1)
    const wsGhost = await authAs(GHOST)   // DB'da yo'q — ro'yxatga tushmasligi kerak

    send(wsA, { type: 'get_online' })
    const res = await waitFor(wsA, 'online_players')
    const players = playersOf(res)

    const me = players.find((p) => p.userId === O1)
    expect(me).toBeDefined()
    expect(me!.isYou).toBe(true)
    expect(me!.name).toContain('Duelist')
    expect(players.find((p) => p.userId === GHOST)).toBeUndefined()
    expect(res['count']).toBe(players.length)

    wsGhost.close()
    wsA.close()
  })

  it('yangi o\'yinchi ulanganda/uzilganda real-time broadcast keladi', async () => {
    const wsA = await authAs(O1)
    await waitFor(wsA, 'online_players', (m) => playersOf(m).some((p) => p.userId === O1))

    const wsB = await authAs(O2)
    const joined = await waitFor(wsA, 'online_players', (m) => playersOf(m).some((p) => p.userId === O2))
    // Broadcast har bir mijozga o'z isYou bayrog'i bilan yuboriladi
    expect(playersOf(joined).find((p) => p.userId === O2)!.isYou).toBe(false)
    expect(playersOf(joined).find((p) => p.userId === O1)!.isYou).toBe(true)

    wsB.close()
    const left = await waitFor(wsA, 'online_players', (m) => !playersOf(m).some((p) => p.userId === O2))
    expect(playersOf(left).some((p) => p.userId === O1)).toBe(true)

    wsA.close()
  })
})

describe('Raqib topish (navbat)', () => {
  it('turli fan tanlagan o\'yinchilar juftlanmaydi, bir xil fanda juftlanadi', async () => {
    const ws1 = await connect()
    const ws2 = await connect()
    send(ws1, { type: 'join_queue', userId: Q1, name: 'Q1', subjectId: 'fizika' })
    send(ws2, { type: 'join_queue', userId: Q2, name: 'Q2', subjectId: 'kimyo' })

    await expectNoMessage(ws1, 'matched')
    await expectNoMessage(ws2, 'matched')

    // Q1 bilan bir xil fan — endi juftlanadi
    const ws3 = await connect()
    send(ws3, { type: 'join_queue', userId: Q3, name: 'Q3', subjectId: 'fizika' })

    const [m1, m3] = await Promise.all([waitFor(ws1, 'matched'), waitFor(ws3, 'matched')])
    expect(m1['matchId']).toBe(m3['matchId'])
    expect(m1['opponentName']).toBe('Q3')

    // Boshqa fandagi o'yinchi hamon navbatda (juftlanmagan)
    expect(messageLog.get(ws2)!.filter((m) => m['type'] === 'matched')).toEqual([])
    send(ws2, { type: 'leave_queue' })

    ws1.close(); ws2.close(); ws3.close()
  })

  it('leave_queue navbatdan chiqaradi — keyingi o\'yinchi juftlanmaydi', async () => {
    const ws1 = await connect()
    send(ws1, { type: 'join_queue', userId: Q1, name: 'Q1', subjectId: 'tarix' })
    await new Promise((r) => setTimeout(r, 100))
    send(ws1, { type: 'leave_queue' })
    await new Promise((r) => setTimeout(r, 100))

    const ws2 = await connect()
    send(ws2, { type: 'join_queue', userId: Q2, name: 'Q2', subjectId: 'tarix' })

    await expectNoMessage(ws2, 'matched')
    send(ws2, { type: 'leave_queue' })
    ws1.close(); ws2.close()
  })
})

describe('Do\'stni taklif qilish (duel kodi)', () => {
  it('bir xil kod bilan navbatdan tashqari juftlaydi (prefiks/registr normalizatsiyasi)', async () => {
    const ws1 = await connect()
    const ws2 = await connect()

    // Yaratuvchi 'duel-' prefiksi bilan, do'st esa 'room-' + BOSH HARF bilan kiradi
    send(ws1, { type: 'join_queue', userId: F1, name: 'Host', subjectId: 'ingliz', duelCode: 'duel-ab12cd' })
    await new Promise((r) => setTimeout(r, 100))
    send(ws2, { type: 'join_queue', userId: F2, name: 'Guest', subjectId: 'biologiya', duelCode: 'room-AB12CD' })

    const [m1, m2] = await Promise.all([waitFor(ws1, 'matched'), waitFor(ws2, 'matched')])
    expect(m1['matchId']).toBe(m2['matchId'])
    expect(m1['opponentName']).toBe('Guest')
    expect(m2['opponentName']).toBe('Host')

    ws1.close(); ws2.close()
  })

  it('yaroqsiz (juda qisqa) kod oddiy navbatga tushadi', async () => {
    const ws1 = await connect()
    const ws2 = await connect()
    send(ws1, { type: 'join_queue', userId: F3, name: 'F3', subjectId: 'matematika', duelCode: '123' })
    await new Promise((r) => setTimeout(r, 100))
    // Kodsiz oddiy navbat — yaroqsiz kod ham navbatga tushgani uchun juftlanadi
    send(ws2, { type: 'join_queue', userId: F4, name: 'F4', subjectId: 'matematika' })

    const [m1, m2] = await Promise.all([waitFor(ws1, 'matched'), waitFor(ws2, 'matched')])
    expect(m1['matchId']).toBe(m2['matchId'])

    ws1.close(); ws2.close()
  })

  it('brute-force: 60s ichida 8 urinishdan keyin duel_join_rate_limited', async () => {
    const ws = await connect()
    for (let i = 0; i < 8; i++) {
      send(ws, { type: 'join_queue', userId: BRUTE, name: 'B', subjectId: 'rustili', duelCode: `guess${100 + i}` })
      await new Promise((r) => setTimeout(r, 20))
    }
    await expectNoMessage(ws, 'error', 200)

    send(ws, { type: 'join_queue', userId: BRUTE, name: 'B', subjectId: 'rustili', duelCode: 'guess999' })
    const err = await waitFor(ws, 'error')
    expect(err['message']).toBe('duel_join_rate_limited')

    send(ws, { type: 'leave_queue' })   // kutayotgan duel timerlarini tozalaydi
    ws.close()
  })
})
