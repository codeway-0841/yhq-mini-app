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

const app    = createApp()
const server = http.createServer(app)
const wss    = new WebSocketServer({ server, path: '/ws/octagon', maxPayload: 16 * 1024 })

/** Graceful shutdown — close listeners, finish in-flight requests, exit. */
function shutdown(signal: string): void {
  console.log(`\n${signal} received — shutting down gracefully...`)
  for (const client of wss.clients) client.close(1001, 'Server shutting down')
  wss.close()
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
