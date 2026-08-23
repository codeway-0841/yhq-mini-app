/**
 * Octagon reconnect / rejoin — integration testlar (real WS server).
 *
 * Ilova qayta ochilganda yoki tarmoq uzilganda o'yinchi grace oynasi ichida
 * matchga qaytadi: raqib `opp_waiting` → `opp_reconnected` oladi, qaytgan
 * o'yinchi esa `match_state` bilan hisob, joriy savol va QOLGAN vaqtni oladi.
 *
 * Bu yo'l ilgari testsiz edi — buzilsa o'yinchi "searching" holatida qotib
 * qoladi yoki forfeit bo'lib ketadi.
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

const ROUND_TIMEOUT = 15_000   // server konstantasi (octagon.ts)
const POOL = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, correct: 'A' }))

const P1 = '990000009301'
const P2 = '990000009302'
const P3 = '990000009303'
const P4 = '990000009304'
const P5 = '990000009305'
const P6 = '990000009306'
const P7 = '990000009307'   // hech qachon matchga kirmaydi
const IDS = [P1, P2, P3, P4, P5, P6, P7]

let server: http.Server
let wss: WebSocketServer
let port: number
const openClients: WebSocket[] = []
const messageLog = new Map<WebSocket, Record<string, unknown>[]>()

beforeAll(async () => {
  for (const id of IDS) await db.delete(users).where(eq(users.id, id))
  for (const [i, id] of IDS.entries()) {
    await usersRepository.initAtomic({ id, firstName: 'Rejoin', lastName: `P${i + 1}`, username: '', photoUrl: '' })
  }

  const app = createApp()
  server = http.createServer(app)
  wss = new WebSocketServer({ server })
  attachOctagon(wss, new Map([['traffic_rules_db', POOL]]), {
    authDeadlineMs:    60_000,
    heartbeatMs:       60_000,
    reconnectWindowMs: 8_000,    // qaytib ulgurish uchun keng oyna
    pauseBudgetMs:     20_000,
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

function waitFor(ws: WebSocket, type: string, timeoutMs = 10_000): Promise<Record<string, unknown>> {
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

async function startMatch(
  a: { ws: WebSocket; userId: string; name: string },
  b: { ws: WebSocket; userId: string; name: string },
  subjectId: string,
): Promise<string> {
  send(a.ws, { type: 'join_queue', userId: a.userId, name: a.name, subjectId })
  await new Promise((r) => setTimeout(r, 100))
  send(b.ws, { type: 'join_queue', userId: b.userId, name: b.name, subjectId })
  const [m] = await Promise.all([waitFor(a.ws, 'matched'), waitFor(b.ws, 'matched')])
  await Promise.all([waitFor(a.ws, 'question'), waitFor(b.ws, 'question')])
  return String(m['matchId'])
}

describe('Rejoin — grace oynasi ichida matchga qaytish', () => {
  it('uzilgan o\'yinchi qaytadi: raqibga opp_waiting → opp_reconnected, o\'ziga match_state', async () => {
    const wsA = await connect()
    const wsB = await connect()
    const matchId = await startMatch(
      { ws: wsA, userId: P1, name: 'Uzilgan' },
      { ws: wsB, userId: P2, name: 'Kutgan' },
      'fizika',
    )

    wsA.close()
    const waiting = await waitFor(wsB, 'opp_waiting')
    expect(Number(waiting['waitSeconds'])).toBeGreaterThan(0)

    // Yangi socketda qaytamiz
    const wsA2 = await connect()
    send(wsA2, { type: 'rejoin', userId: P1, matchId })

    const state = await waitFor(wsA2, 'match_state')
    expect(state['matchId']).toBe(matchId)
    expect(state['index']).toBe(0)
    expect(typeof state['questionId']).toBe('number')
    expect(state['roundCount']).toBe(POOL.length)
    expect(state['opponentName']).toBe('Kutgan')
    expect(state['yourScore']).toBe(0)
    // Qaytgan o'yinchiga TO'LIQ 15s emas, qolgan vaqt beriladi
    expect(Number(state['timeLimit'])).toBeGreaterThan(0)
    expect(Number(state['timeLimit'])).toBeLessThanOrEqual(ROUND_TIMEOUT)

    await waitFor(wsB, 'opp_reconnected')

    // O'yin davom etadi — raund qaytgan socketda ham yakunlanadi
    send(wsA2, { type: 'answer', matchId, index: 0, optionId: 'A' })
    send(wsB,  { type: 'answer', matchId, index: 0, optionId: 'B' })
    const rr = await waitFor(wsA2, 'round_result')
    expect(rr['yourScore']).toBe(1)
    expect(rr['oppScore']).toBe(0)

    wsA2.close(); wsB.close()
  }, 40_000)

  it('hisob va berilgan javob rejoin\'dan keyin saqlanadi (reveal bilan)', async () => {
    const wsA = await connect()
    const wsB = await connect()
    const matchId = await startMatch(
      { ws: wsA, userId: P3, name: 'Javobchi' },
      { ws: wsB, userId: P4, name: 'Raqib' },
      'kimyo',
    )

    // 1-raund: A to'g'ri, B xato → A hisobi 1
    send(wsA, { type: 'answer', matchId, index: 0, optionId: 'A' })
    send(wsB, { type: 'answer', matchId, index: 0, optionId: 'B' })
    await Promise.all([waitFor(wsA, 'round_result'), waitFor(wsB, 'round_result')])
    await Promise.all([waitFor(wsA, 'question'), waitFor(wsB, 'question')])

    // 2-raundda A javob beradi va shundan keyin uziladi
    send(wsA, { type: 'answer', matchId, index: 1, optionId: 'A' })
    await waitFor(wsA, 'answer_ack')
    wsA.close()
    await waitFor(wsB, 'opp_waiting')

    const wsA2 = await connect()
    send(wsA2, { type: 'rejoin', userId: P3, matchId })
    const state = await waitFor(wsA2, 'match_state')

    expect(state['index']).toBe(1)
    expect(state['yourScore']).toBe(1)      // 1-raunddagi g'alaba saqlangan
    expect(state['oppScore']).toBe(0)
    expect(state['yourAnswer']).toBe('A')   // berilgan javob unutilmagan
    expect(state['correctOptionId']).toBe('A')   // javob berilgani uchun reveal
    expect(state['oppAnswered']).toBe(false)

    wsA2.close(); wsB.close()
  }, 40_000)

  it('jonli match ichida join_queue — yangi match emas, avtomatik rejoin', async () => {
    const wsA = await connect()
    const wsB = await connect()
    const matchId = await startMatch(
      { ws: wsA, userId: P5, name: 'Qaytgan' },
      { ws: wsB, userId: P6, name: 'Raqib' },
      'tarix',
    )

    wsA.close()
    await waitFor(wsB, 'opp_waiting')

    // Ilova qayta ochildi — client oddiy join_queue yuboradi
    const wsA2 = await connect()
    send(wsA2, { type: 'join_queue', userId: P5, name: 'Qaytgan', subjectId: 'tarix' })

    const state = await waitFor(wsA2, 'match_state')
    expect(state['matchId']).toBe(matchId)   // eski match, yangisi EMAS
    await waitFor(wsB, 'opp_reconnected')

    wsA2.close(); wsB.close()
  }, 40_000)

  it('jonli matchsiz rejoin → rejoin_failed', async () => {
    const ws = await connect()
    send(ws, { type: 'rejoin', userId: P7, matchId: 'yoq-bunday-match' })

    const err = await waitFor(ws, 'error')
    expect(err['message']).toBe('rejoin_failed')

    ws.close()
  }, 20_000)
})
