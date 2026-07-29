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
import { questions }       from '../src/data/questions'

const octagonPool = questions.map((q) => ({ id: q.id, correct: q.correct }))

const app    = createApp()
const server = http.createServer(app)

const wss = new WebSocketServer({ server, path: '/ws/octagon' })
attachOctagon(wss, octagonPool)

server.listen(config.server.port, () => {
  console.log(`Server :${config.server.port} (HTTP + WS)`)
})
