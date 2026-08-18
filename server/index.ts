/**
 * Server entry point — binds HTTP + WebSocket, nothing else.
 * Business logic lives in app.ts and modules/.
 * Yagona entry: standalone.ts birlashtirildi (Render `/health` app.ts'da alias).
 */

import 'dotenv/config'
import './utils/sentry'
import { assertProdConfig } from './config'

assertProdConfig()   // production'da BOT_TOKEN'siz boot QILMAYDI (auth fail-open himoyasi)
import http                from 'http'
import { WebSocketServer } from 'ws'
import { config }          from './config'
import { createApp }       from './app'
import { attachOctagon, loadOctagonPools } from './octagon'
import { stopAllIntervals } from './utils/shutdown'

const app    = createApp()
const server = http.createServer(app)
const wss    = new WebSocketServer({ server, path: '/ws/octagon', maxPayload: 16 * 1024 })

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
