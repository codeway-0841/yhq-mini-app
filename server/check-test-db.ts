import 'dotenv/config'
import { config } from './config'

if (!config.db.testUrl) {
  throw new Error('TEST_DATABASE_URL is required for integration tests')
}
if (config.db.testUrl === config.db.productionUrl) {
  throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL')
}

const parsed = new URL(config.db.testUrl)
if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
  throw new Error('TEST_DATABASE_URL must be a PostgreSQL URL')
}

console.log(`Integration DB guard passed: ${parsed.hostname}`)
