import 'dotenv/config'
import { neon }    from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { migrate as migrateNeon } from 'drizzle-orm/neon-http/migrator'
import postgres   from 'postgres'
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator'
import { config }  from './config'
import { isNeonUrl } from './db/connection'

// Neon HTTP driver faqat Neon endpoint'larda ishlaydi — CI'dagi lokal
// PostgreSQL'ga TCP driver (postgres-js) orqali ulanamiz.
if (isNeonUrl(config.db.url)) {
  await migrateNeon(drizzleNeon(neon(config.db.url)), { migrationsFolder: './migrations' })
} else {
  const client = postgres(config.db.url)
  await migratePg(drizzlePg(client), { migrationsFolder: './migrations' })
  await client.end()
}
console.log('Migrations done')
