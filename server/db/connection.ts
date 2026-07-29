/**
 * Drizzle ORM connection — single instance for the whole server.
 * Import `db` everywhere; never import neon/drizzle directly outside this file.
 */

import { neon }    from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../schema'
import { config }  from '../config'

const sql = neon(config.db.url)
export const db = drizzle(sql, { schema })

export type DB = typeof db
