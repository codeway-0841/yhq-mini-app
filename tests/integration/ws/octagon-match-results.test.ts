/**
 * Octagon match yakuni — DB'ga yozilish oqimi (real WS server + test DB).
 *
 * Bu yerda to'liq duel o'ynaladi va NATIJA DB'da tekshiriladi:
 *  - `duel_results`ga har ikkala o'yinchiga qator yoziladi (win/lose, hisob, forfeit)
 *  - g'olibning `progress.octagon_wins` counteri oshadi
 *  - raqib uzilib qolganda (forfeit) ham xuddi shunday yoziladi
 *
 * Kunlik/haftalik/oylik duel reytingi shu qatorlardan agregatlanadi, ya'ni bu
 * test yozuv yo'li buzilsa reyting jimgina bo'sh qolishini ushlaydi.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import { and, eq } from 'drizzle-orm'
import WebSocket, { WebSocketServer } from 'ws'
import { createApp } from '../../../server/app'
import { attachOctagon } from '../../../server/octagon'
import { db } from '../../../server/db/connection'
import { users, progress, duelResults } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'

/** Havzadagi barcha savollarning to'g'ri javobi 'A' — natijani boshqarish uchun */
const POOL = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, correct: 'A' }))

const W1 = '990000009201'   // to'g'ri javob beradi — g'olib
const L1 = '990000009202'   // xato javob beradi — mag'lub
const W2 = '990000009203'   // forfeit g'olibi (raqib uzildi)
const L2 = '990000009204'   // uziladi — forfeit mag'lubi
const R1 = '990000009205'   // reaksiya yuboruvchi
const R2 = '990000009206'   // reaksiya oluvchi (raqib)
const OUT = '990000009207'  // matchda YO'Q — reaksiyasi tashlab yuboriladi
const IDS = [W1, L1, W2, L2, R1, R2, OUT]

let server: http.Server
let wss: WebSocketServer
let port: number
const openClients: WebSocket[] = []
const messageLog = new Map<WebSocket, Record<string, unknown>[]>()

beforeAll(async () => {
  for (const id of IDS) await db.delete(users).where(eq(users.id, id))
  for (const [i, id] of IDS.entries()) {
    await usersRepository.initAtomic({ id, firstName: 'Fighter', lastName: `M${i + 1}`, username: '', photoUrl: '' })
  }

  const app = createApp()
  server = http.createServer(app)
  wss = new WebSocketServer({ server })
  attachOctagon(wss, new Map([['traffic_rules_db', POOL]]), {
    authDeadlineMs:    60_000,
    heartbeatMs:       60_000,
    reconnectWindowMs: 300,   // forfeit testi tez yakunlansin
    pauseBudgetMs:     300,
    maxMsgsPerWindow:  500,   // 10 raund × 2 o'yinchi xabarlari limitga urilmasin
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

function waitFor(ws: WebSocket, type: string, timeoutMs = 20_000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(poller)
      reject(new Error(`"${type}" xabari kutilmadi`))
    }, timeoutMs)
    const poller = setInterval(() => {
      const log = messageLog.get(ws)!
      const idx = log.findIndex((m) => m['type'] === type)
      if (idx >= 0) {
        const [msg] = log.splice(idx, 1)
        clearTimeout(timeout)
        clearInterval(poller)
        resolve(msg!)
      }
    }, 10)
  })
}

/** Ikkala o'yinchini navbat orqali juftlaydi va matchId qaytaradi */
async function startMatch(
  a: { ws: WebSocket; userId: string; name: string },
  b: { ws: WebSocket; userId: string; name: string },
  subjectId: string,
): Promise<string> {
  send(a.ws, { type: 'join_queue', userId: a.userId, name: a.name, subjectId })
  await new Promise((r) => setTimeout(r, 100))
  send(b.ws, { type: 'join_queue', userId: b.userId, name: b.name, subjectId })
  const [m] = await Promise.all([waitFor(a.ws, 'matched'), waitFor(b.ws, 'matched')])
  return String(m['matchId'])
}

/** Berilgan foydalanuvchining shu matchdagi `duel_results` qatorini o'qiydi */
async function readResult(matchId: string, userId: string) {
  const rows = await db.select().from(duelResults)
    .where(and(eq(duelResults.matchId, matchId), eq(duelResults.userId, userId)))
  return rows[0]
}

/** Yozuv fire-and-forget — qator paydo bo'lguncha qisqa poll */
async function waitForResultRow(matchId: string, userId: string, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const row = await readResult(matchId, userId)
    if (row) return row
    if (Date.now() > deadline) throw new Error(`duel_results qatori yozilmadi: ${userId}`)
    await new Promise((r) => setTimeout(r, 200))
  }
}

const winsOf = async (userId: string) => {
  const rows = await db.select({ w: progress.octagonWins }).from(progress).where(eq(progress.userId, userId))
  return Number(rows[0]?.w ?? 0)
}

describe('To\'liq duel — natija DB\'ga yoziladi', () => {
  it('10 raund o\'ynaladi: g\'olibga win, mag\'lubga lose qatori + octagon_wins oshadi', async () => {
    const wsW = await connect()
    const wsL = await connect()
    const winsBefore = await winsOf(W1)

    const matchId = await startMatch(
      { ws: wsW, userId: W1, name: 'Winner' },
      { ws: wsL, userId: L1, name: 'Loser' },
      'fizika',
    )

    // Har raundda g'olib to'g'ri ('A'), mag'lub xato ('B') javob beradi
    for (let round = 0; round < POOL.length; round++) {
      const q = await waitFor(wsW, 'question')
      await waitFor(wsL, 'question')
      const index = Number(q['index'])
      send(wsW, { type: 'answer', matchId, index, optionId: 'A' })
      send(wsL, { type: 'answer', matchId, index, optionId: 'B' })
      await Promise.all([waitFor(wsW, 'round_result'), waitFor(wsL, 'round_result')])
    }

    const [endW, endL] = await Promise.all([waitFor(wsW, 'match_end'), waitFor(wsL, 'match_end')])
    expect(endW['result']).toBe('win')
    expect(endW['yourScore']).toBe(POOL.length)
    expect(endL['result']).toBe('lose')
    expect(endL['yourScore']).toBe(0)

    const rowW = await waitForResultRow(matchId, W1)
    const rowL = await waitForResultRow(matchId, L1)

    expect(rowW!.result).toBe('win')
    expect(rowW!.opponentId).toBe(L1)
    expect(rowW!.selfScore).toBe(POOL.length)
    expect(rowW!.oppScore).toBe(0)
    expect(rowW!.forfeit).toBe(false)

    expect(rowL!.result).toBe('lose')
    expect(rowL!.opponentId).toBe(W1)
    expect(rowL!.selfScore).toBe(0)

    expect(await winsOf(W1)).toBe(winsBefore + 1)
    expect(await winsOf(L1)).toBe(0)

    wsW.close(); wsL.close()
  }, 60_000)

  it('raqib uzilib qolsa — forfeit bayrog\'i bilan win/lose yoziladi', async () => {
    const wsWin  = await connect()
    const wsQuit = await connect()

    const matchId = await startMatch(
      { ws: wsWin,  userId: W2, name: 'Stayer' },
      { ws: wsQuit, userId: L2, name: 'Quitter' },
      'kimyo',
    )
    await waitFor(wsWin, 'question')

    wsQuit.close()
    await waitFor(wsWin, 'opp_disconnected')

    const rowWin  = await waitForResultRow(matchId, W2)
    const rowQuit = await waitForResultRow(matchId, L2)

    expect(rowWin!.result).toBe('win')
    expect(rowWin!.forfeit).toBe(true)
    expect(rowQuit!.result).toBe('lose')
    expect(rowQuit!.forfeit).toBe(true)
    expect(await winsOf(W2)).toBe(1)

    wsWin.close()
  }, 30_000)
})

describe('Match ichidagi reaksiyalar', () => {
  it("reaksiya ikkala o'yinchiga yetadi; spam, begona va bo'sh reaksiya to'siladi", async () => {
    const ws1 = await connect()
    const ws2 = await connect()
    const matchId = await startMatch(
      { ws: ws1, userId: R1, name: 'React1' },
      { ws: ws2, userId: R2, name: 'React2' },
      'ingliz',
    )
    await waitFor(ws1, 'question')

    // 1. Oddiy reaksiya — yuboruvchiga ham, raqibga ham qaytadi
    send(ws1, { type: 'reaction', matchId, kind: 'emoji', content: '🔥' })
    const [r1, r2] = await Promise.all([waitFor(ws1, 'reaction'), waitFor(ws2, 'reaction')])
    expect(r1['senderId']).toBe(R1)
    expect(r1['content']).toBe('🔥')
    expect(r2['kind']).toBe('emoji')

    // 2. Anti-spam: 1.2s ichidagi ikkinchi reaksiya tashlab yuboriladi
    send(ws1, { type: 'reaction', matchId, kind: 'emoji', content: 'spam' })
    await new Promise((r) => setTimeout(r, 300))
    expect(messageLog.get(ws2)!.filter((m) => m['type'] === 'reaction')).toEqual([])

    // 3. Noma'lum kind → 'emoji'ga tushadi, 120 belgidan uzun matn kesiladi
    await new Promise((r) => setTimeout(r, 1_000))   // cooldown tugasin
    send(ws1, { type: 'reaction', matchId, kind: 'hack', content: 'a'.repeat(200) })
    const clamped = await waitFor(ws2, 'reaction')
    expect(clamped['kind']).toBe('emoji')
    expect(String(clamped['content'])).toHaveLength(120)

    // 4. Matchda bo'lmagan user reaksiyasi tarqatilmaydi
    const wsOut = await connect()
    send(wsOut, { type: 'auth', userId: OUT })
    await waitFor(wsOut, 'auth_ok')
    send(wsOut, { type: 'reaction', matchId, kind: 'emoji', content: 'begona' })

    // 5. Bo'sh content ham tarqatilmaydi
    await new Promise((r) => setTimeout(r, 1_300))
    send(ws1, { type: 'reaction', matchId, kind: 'emoji', content: '' })
    await new Promise((r) => setTimeout(r, 300))
    expect(messageLog.get(ws2)!.filter((m) => m['type'] === 'reaction')).toEqual([])

    wsOut.close(); ws1.close(); ws2.close()
  }, 30_000)
})
