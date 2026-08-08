/**
 * Drizzle ORM connection — single instance for the whole server.
 * Import `db` everywhere; never import neon/drizzle directly outside this file.
 *
 * Driver URL bo'yicha tanlanadi:
 *  - Neon (neon.tech)  → neon-http (serverless HTTP; Vercel/edge uchun)
 *  - Lokal/CI Postgres → postgres-js (TCP) — neon HTTP driver lokal
 *    PostgreSQL bilan ishlamaydi (CI integration job locale'da qotardi).
 */

import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import postgres from 'postgres'
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import * as schema from '../schema'
import { config } from '../config'

/** Neon endpoint'mi? (pooler/direct ikkalasi ham `*.neon.tech`) */
export const isNeonUrl = (url: string): boolean => url.includes('.neon.tech')

const isNeon = isNeonUrl(config.db.url)

const instance = isNeon
  ? drizzleNeon(neon(config.db.url), { schema })
  : drizzlePg(postgres(config.db.url), { schema })

// Ikkala driver'ning query API'si identik (select/insert/execute); ixtisoslashgan
// NeonHttpDatabase tipi union bo'lmaydi — mavjud iste'molchilar uchun tip saqlanadi.
export const db = instance as unknown as NeonHttpDatabase<typeof schema>

export type DB = typeof db
