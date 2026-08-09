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
import type { SQL } from 'drizzle-orm'
import * as schema from '../schema'
import { config } from '../config'

/** Neon endpoint'mi? (pooler/direct ikkalasi ham `*.neon.tech`) */
export const isNeonUrl = (url: string): boolean => url.includes('.neon.tech')

const isNeon = isNeonUrl(config.db.url)

// Store raw clients for transaction support
const postgresClient = isNeon ? null : postgres(config.db.url)
const neonClient = isNeon ? neon(config.db.url) : null

const instance = isNeon
  ? drizzleNeon(neonClient!, { schema })
  : drizzlePg(postgresClient!, { schema })

// Ikkala driver'ning query API'si identik (select/insert/execute); ixtisoslashgan
// NeonHttpDatabase tipi union bo'lmaydi — mavjud iste'molchilar uchun tip saqlanadi.
export const db = instance as unknown as NeonHttpDatabase<typeof schema>

export type DB = typeof db

/**
 * Raw SQL execute — DRIVERLARDAN MUSTAQIL natija shakli.
 * neon-http `{ rows: T[] }` qaytaradi, postgres-js esa to'g'ridan-to'g'ri
 * `T[]` massiv — shu helper QAYSI driver bo'lmasin massiv qaytaradi.
 * Raw `db.execute(sql\`...\`)` chaqiruvlari FAQAT shu orqali bo'lsin.
 *
 * @param txOrDb - Optional transaction or db instance (for transaction isolation)
 */
export async function executeRows<T = Record<string, unknown>>(query: SQL, txOrDb: DB = db): Promise<T[]> {
  const res = await (txOrDb as { execute: (q: SQL) => Promise<unknown> }).execute(query) as { rows?: T[] } | T[]
  return Array.isArray(res) ? res : (res.rows ?? [])
}

/**
 * Run callback in explicit transaction (isolated connection).
 *
 * DRIVER BEHAVIOR:
 * - postgres-js: Uses client.begin() → dedicated connection with ACID guarantees
 * - neon-http: Stateless HTTP driver → transactions NOT supported.
 *   Each query is independent HTTP request. For neon, callback runs WITHOUT
 *   transaction isolation. Use CTEs for atomic multi-step operations.
 *
 * Use for: adopt-merge, link-code consume (where postgres-js needs isolation)
 */
export async function transaction<T>(callback: (tx: DB) => Promise<T>): Promise<T> {
  if (!isNeon && postgresClient) {
    // postgres-js: native transaction with dedicated connection
    return postgresClient.begin((tx) => callback(drizzlePg(tx, { schema }) as DB))
  }
  // neon-http: no transaction support, run callback with shared db
  // Caller must use CTEs for atomicity
  return callback(db)
}
