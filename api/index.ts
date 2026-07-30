// Vercel serverless entry point — wraps the Express app.
// WebSocket (Octagon) not supported in serverless; use a dedicated server for WS.
import 'dotenv/config'
import { createApp } from '../server/app'

const app = createApp()
export default app
