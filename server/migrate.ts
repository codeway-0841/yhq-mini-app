import 'dotenv/config'
import { neon }    from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import { config }  from './config'

const sql = neon(config.db.url)
const db  = drizzle(sql)

await migrate(db, { migrationsFolder: './migrations' })
console.log('Migrations done')
