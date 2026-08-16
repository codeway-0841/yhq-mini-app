import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { migrate as migrateNeon } from 'drizzle-orm/neon-http/migrator'
import postgres from 'postgres'
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator'
import { isNeonUrl } from './db/connection'

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!
if (!url) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL must be defined')
}

console.log('Migrating target DB:', new URL(url).hostname)

if (isNeonUrl(url)) {
  await migrateNeon(drizzleNeon(neon(url)), { migrationsFolder: './migrations' })
} else {
  const client = postgres(url)
  await migratePg(drizzlePg(client), { migrationsFolder: './migrations' })
  await client.end()
}
console.log('Target DB Migrations completed successfully')
