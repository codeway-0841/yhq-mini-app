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

db.select({ id: questions.id, correct: questions.correctAnswer })
  .from(questions)
  .then((pool) => {
    attachOctagon(wss, pool)
    server.listen(config.server.port, () => {
      console.log(`Server :${config.server.port} (HTTP + WS) — ${pool.length} questions loaded`)
    })
  })
