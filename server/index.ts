/**
 * Server entry point — binds HTTP + WebSocket, nothing else.
 * Business logic lives in app.ts and modules/.
 * Yagona entry: standalone.ts birlashtirildi (Render `/health` app.ts'da alias).
 */

import 'dotenv/config'
import { Sentry } from './utils/sentry'
import { assertProdConfig } from './config'

assertProdConfig()   // production'da BOT_TOKEN'siz boot QILMAYDI (auth fail-open himoyasi)
import http                from 'http'
import { WebSocketServer } from 'ws'
import { config }          from './config'
import { createApp }       from './app'
import { attachOctagon, loadOctagonPools, getOctagonStats } from './octagon'
import { stopAllIntervals } from './utils/shutdown'

const app    = createApp()
const server = http.createServer(app)
// L-6 (audit): slow-loris himoyasi — header'lar 10s ichida to'liq kelishi SHART
// (Node default 60s juda bo'sh; minglab yarim-ochiq socket fd'ni tugatardi).
// requestTimeout'ga TEGILMAYDI (Node default 300s) — admin bulk-import kabi
// uzoq so'rovlar (~90s) sinib qolmasligi uchun.
server.headersTimeout = 10_000
const wss    = new WebSocketServer({ server, path: '/ws/octagon', maxPayload: 16 * 1024 })
// Diagnostika (PII'siz counter'lar) — WS transport muammolarini Render log'siz
// tashqi tomondan tekshirish uchun. Faqat son/qatorlar.
app.get('/ws/stats', (_req, res) => {
  res.json({ ok: true, ...getOctagonStats(wss.clients.size) })
})

/** Graceful shutdown — close listeners, finish in-flight requests, exit.
 *  (FIXPLAN #21): (a) modul interval'lari (join-sweep, bot login-cleanup,
 *  heartbeat) `stopAllIntervals` bilan to'xtatiladi; (b) WS clients → wss →
 *  http server CLOSE TARTIBI socket'lar "Server shutting down" sababin olishi
 *  uchun shunday; (c) Neon HTTP pool'siz per-request driver — DB close KERAK
 *  EMAS (db/connection.ts hujjati). */
function shutdown(signal: string): void {
  console.log(`\n${signal} received — shutting down gracefully...`)
  stopAllIntervals()                                    // (a) modul timmerlari
  for (const client of wss.clients) client.close(1001, 'Server shutting down')
  wss.close()                                           // → heartbeat clear ('close' handler)
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
  // Force exit if connections linger too long
  setTimeout(() => {
    console.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

// Process-level xavfsizlik tarmog'i (P0): bitta yutqazilgan async xato
// (masalan, WS handler'dagi DB timeout) butun WS+HTTP serverni jim qulatmasligi
// kerak — Node 15+ default'da unhandledRejection = FATAL crash.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason)
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)))
})
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception — shutting down:', err)
  Sentry.captureException(err)
  shutdown('uncaughtException')
})
// Malformed HTTP request (buzilgan header'lar va h.k.) server'ni qulatmasligi kerak.
server.on('clientError', (err, socket) => {
  console.warn('clientError:', err.message)
  socket.destroy()
})

loadOctagonPools()
  .then((pools) => {
    attachOctagon(wss, pools)
    const total = [...pools.values()].reduce((s, p) => s + p.length, 0)
    server.listen(config.server.port, () => {
      console.log(`Server :${config.server.port} (HTTP + WS) — ${total} questions (${pools.size} banks)`)
    })
  })
  .catch((err) => {
    console.error('Failed to load questions from DB at startup:', err)
    process.exit(1)
  })
