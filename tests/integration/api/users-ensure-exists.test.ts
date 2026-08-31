/**
 * L-2 (audit 2026-08-31): usersRepository.ensureExists — FAQAT FK-talqin.
 *
 * Regression: avval `successful_payment` yo'lida `upsert({photoUrl: null})`
 * chaqirilib, mavjud user'ning Telegram `photo_url`'i har Stars xaridida
 * bo'sh string'ga YOZILIB ketardi (avatar yo'qolardi).
 *
 * ensureExists kafolati:
 *  1. Yo'q user → yaratiladi (progress + settings bilan — initAtomic semantikasi)
 *  2. Mavjud user → photo_url / first_name / username SAQLANADI (DO NOTHING)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { users, progress, userSettings } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'

// Diapazon 950x — boshqa integration fayllar bilan collision YO'Q (qarang:
// octagon-exclusivity.test.ts'dagi diapazon xaritasi izohi).
const ID = '990000009501'

beforeAll(async () => { await db.delete(users).where(eq(users.id, ID)) })
afterAll(async () => { await db.delete(users).where(eq(users.id, ID)) })

describe('usersRepository.ensureExists (L-2 regression)', () => {
  it("yo'q user — yaratiladi (progress + settings bilan)", async () => {
    await usersRepository.ensureExists(ID, { firstName: 'Buyer', lastName: 'One', username: 'buyer1' })
    const row = await usersRepository.findById(ID)
    expect(row).not.toBeNull()
    expect(row!.firstName).toBe('Buyer')
    const prog = await db.select().from(progress).where(eq(progress.userId, ID))
    const sett = await db.select().from(userSettings).where(eq(userSettings.userId, ID))
    expect(prog.length).toBe(1)
    expect(sett.length).toBe(1)
  })

  it('mavjud user — photo_url va ism SAQLANADI (overwrite YO\'Q)', async () => {
    await db.update(users)
      .set({ photoUrl: 'https://t.me/i/userpic/320/ava.jpg', firstName: 'RealName', username: 'realuser' })
      .where(eq(users.id, ID))

    await usersRepository.ensureExists(ID, { firstName: 'OtherName', lastName: null, username: null })

    const row = await usersRepository.findById(ID)
    expect(row!.photoUrl).toBe('https://t.me/i/userpic/320/ava.jpg')   // ← L-2 regression nuqtasi
    expect(row!.firstName).toBe('RealName')
    expect(row!.username).toBe('realuser')
  })
})
