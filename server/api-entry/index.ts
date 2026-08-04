// Vercel serverless entry point — wraps the Express app.
// WebSocket (Octagon) not supported in serverless; use a dedicated server for WS.
import 'dotenv/config'
import '../utils/sentry'   // birinchi — xatolarni yig'ish uchun
import { assertProdConfig } from '../config'
import { createApp } from '../app'

assertProdConfig()   // production'da BOT_TOKEN'siz boot QILMAYDI (auth fail-open himoyasi)

const app = createApp()
export default app
