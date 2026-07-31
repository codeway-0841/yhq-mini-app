/**
 * Server entry point — binds HTTP + WebSocket, nothing else.
 * Business logic lives in app.ts and modules/.
 */

import 'dotenv/config'
import http                from 'http'
import { WebSocketServer } from 'ws'
import { config }          from './config'
import { createApp }       from './app'
import { attachOctagon }   from './octagon'
import { db }              from './db/connection'
import { questions }       from './schema'

const app    = createApp()
const server = http.createServer(app)
const wss    = new WebSocketServer({ server, path: '/ws/octagon' })

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

db.select({ id: questions.id, correct: questions.correctAnswer })
  .from(questions)
  .then((pool) => {
    attachOctagon(wss, pool)
    server.listen(config.server.port, () => {
      console.log(`Server :${config.server.port} (HTTP + WS) — ${pool.length} questions loaded`)
    })
  })
  .catch((err) => {
    console.error('Failed to load questions from DB at startup:', err)
    process.exit(1)
  })
