/**
 * Drizzle ORM connection — single instance for the whole server.
 * Import `db` everywhere; never import neon/drizzle directly outside this file.
 *
 * Driver URL bo'yicha tanlanadi:
 *  - Neon (neon.tech)  → neon-http (serverless HTTP; Vercel/edge uchun)
 *  - Lokal/CI Postgres → postgres-js (TCP) — neon HTTP driver lokal
 *    PostgreSQL bilan ishlamaydi (CI integration job locale'da qotardi).
 */

import {
  neon,
  type NeonQueryFunction,
  type NeonQueryFunctionInTransaction,
  type NeonQueryInTransaction,
} from '@neondatabase/serverless'
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

let sqlTxInstance: postgres.Sql | null = null

/**
 * Interactive tranzaksiya talab qiladigan oqimlar (masalan, coins purchase row lock)
 * uchun reusable postgres-js transactional client.
 * Neon HTTP drayveri stateless bo'lgani sababli interaktiv tx va FOR UPDATE locklarni
 * qo'llab-quvvatlamaydi; ushbu singleton client to'g'ridan-to'g'ri TCP/pooler orqali
 * haqiqiy PostgreSQL tranzaksiyalarini (`sqlTx.begin`) ta'minlaydi.
 */
export function getSqlTx(): postgres.Sql {
  if (!sqlTxInstance) {
    sqlTxInstance = postgresClient ?? postgres(config.db.url, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  }
  return sqlTxInstance
}

/**
 * Raw Neon HTTP driver — FAQAT `transactionHttp` kabi maxsus yo'llar uchun.
 * drizzle neon-http `db.transaction()` ni qo'llab-quvvatLAMAYDI (driver HTTP
 * stateless); oddiy so'rovlar uchun `db`/`executeRows` ishlating.
 */
export const neonRaw: NeonQueryFunction<false, false> | null = neonClient ?? null

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
 * M-7 (audit 2026-08-31): NOM O'ZGARTIRILDI (`transaction` → `transactionBestEffort`).
 * Eski nom yolg'on ACID kafolati tuyg'usi berardi — kelajakdagi dasturchi
 * multi-statement oqimni "xavfsiz" deb ishonib yozishi mumkin edi (Neon'da
 * jimgina race condition).
 *
 * DRIVER BEHAVIOR:
 * - postgres-js (lokal/CI): `client.begin()` → dedicated connection, HAQIQIY ACID tx.
 * - neon-http (PROD): drizzle neon-http `db.transaction()` QO'LLAB-QUVVATLAMAYDI
 *   (stateless HTTP). Callback umumiy `db` ustida IZOLYATSIYASIZ yuradi —
 *   shu sababli barcha multi-step oqimlar BITTA atomik CTE bo'lishi SHART
 *   (guard'lar SQL ichida). 2+ statement'ga ajralib ketadigan atomik
 *   bloklar uchun `transactionHttp()` dan foydalaning.
 */

let drizzleTxInstance: any = null

function getDrizzleTxDb(): any {
  if (!drizzleTxInstance) {
    drizzleTxInstance = drizzlePg(getSqlTx(), { schema })
  }
  return drizzleTxInstance
}

/**
 * Multi-statement tranzaksiyalar uchun haqiqiy ACID tranzaksiya (postgres-js / Neon TCP pooler — ID 03).
 * Neon HTTP stateless bo'lgani sababli, interaktiv tranzaksiyalar (masalan account linking,
 * email register va row locklar) `getSqlTx()` orqali haqiqiy PostgreSQL tranzaksiyasida (`BEGIN ... COMMIT/ROLLBACK`)
 * izolyatsiyalangan holda bajariladi.
 */
export async function transactionBestEffort<T>(callback: (tx: DB) => Promise<T>): Promise<T> {
  const txDb = getDrizzleTxDb()
  return txDb.transaction((tx: DB) => callback(tx))
}

/**
 * Bir nechta RAW SQL so'rovni Neon HTTP driveri orqali BITTA non-interactive
 * tranzaksiyada yuboradi (`BEGIN ... COMMIT` — bitta HTTP roundtrip).
 *
 * NIMA UCHUN: drizzle neon-http `db.transaction()` throw qiladi, lekin ayrim
 * oqimlar (masalan, adopt-merge'dagi delete+rename va keyingi identity INSERT)
 * Pg CTE + RI trigger tuzog'i tufayli BITTA statement'ga sig'maydi — faqat
 * shunday holatda ishlating. postgres-js/CI muhitida `transaction()` yetarli.
 */
export async function transactionHttp(
  build: (sql: NeonQueryFunctionInTransaction<false, false>) => NeonQueryInTransaction[],
): Promise<unknown[][]> {
  if (!neonClient) throw new Error('transactionHttp: faqat Neon driver mavjud')
  const results = await neonClient.transaction(build)
  return results as unknown as unknown[][]
}
