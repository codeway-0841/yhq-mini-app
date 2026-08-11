/**
 * Integration test — DB-backed rate limit counter'lari (MB: multi-instance).
 *
 * `dbRateConsume` ATOMIK upsert-counter'ini REAL test DB'da tekshiradi:
 *  - oyna ichida limitdan oshganda rad etadi (allowed=false);
 *  - parallel so'rovlar aniq sanaladi (row-lock, yo'qolgan increment YO'Q);
 *  - eskirgan oyna (60s) RESET bo'ladi (yangi davr boshlanadi).
 *
 * REQUIREMENTS: TEST_DATABASE_URL. Bucket nomlari testga xos — boshqa testlar
 * bilan to'qnashmaydi; cleanup afterAll'da.
 */

import { describe, it, expect, afterAll } from 'vitest'
import { inArray, sql } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { rateLimits } from '../../../server/schema'
import { dbRateConsume } from '../../../server/middleware/db-rate-limiter'

const B1 = 'test-bucket:atomic:a'
const B2 = 'test-bucket:atomic:b'

afterAll(async () => {
  await db.delete(rateLimits).where(inArray(rateLimits.bucket, [B1, B2]))
})

describe('dbRateConsume (multi-instance rate limit)', () => {
  it('limit ichida ruxsat, limitdan oshganda rad', async () => {
    const first = await dbRateConsume(B1, 3)
    expect(first).toEqual({ allowed: true, count: 1 })
    expect((await dbRateConsume(B1, 3)).allowed).toBe(true)
    expect((await dbRateConsume(B1, 3)).allowed).toBe(true)
    const fourth = await dbRateConsume(B1, 3)
    expect(fourth.allowed).toBe(false)
    expect(fourth.count).toBe(4)
  })

  it('parallel 10 ta so\'rov — increment yo\'qolmaydi (row-lock)', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => dbRateConsume(B2, 100)))
    const counts = results.map((r) => r.count).sort((x, y) => x - y)
    // Oxirgi ko'rilgan count aynan 10 bo'lishi shart (yo'qolgan increment bo'lardi → kam chiqardi)
    expect(counts[counts.length - 1]).toBe(10)
    // Hammasi ruxsat ostida (limit 100)
    expect(results.every((r) => r.allowed)).toBe(true)
  })

  it('eskirgan oyna (>60s) — counter RESET bo\'ladi', async () => {
    // Bucket'ni otmishga o'girib, yangi consume oynani qayta boshlashi kerak
    await db.update(rateLimits)
      .set({ windowStart: new Date(Date.now() - 2 * 60_000), count: 99 })
      .where(sql`${rateLimits.bucket} = ${B1}`)
    const res = await dbRateConsume(B1, 3)
    expect(res).toEqual({ allowed: true, count: 1 })   // eski son o'chdi — yangi davr
  })
})
