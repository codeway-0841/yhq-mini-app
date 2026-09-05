/**
 * Vercel Hobby (2 cron slot) fanout suite'lari regression-guard:
 *  - /api/cron/daily-suite  → cleanup-answer-tokens + daily-reminder IKKALASI
 *    bitta so'rovda ishlaydi (alohida slot'lar o'chirildi, vercel.json);
 *  - /api/cron/weekly-suite → league-rollover + boss-rollover izchil;
 *  - suite CRON_SECRET middleware orqali himoyalangan (router.use('/cron')).
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import cronRouter from '../../../server/modules/cron/cron.router'
import { cronRepository } from '../../../server/modules/cron/cron.repository'
import { config } from '../../../server/config'

let app: express.Express
const origSecret = config.cron.secret
const origToken = config.telegram.botToken

beforeAll(() => {
  config.telegram.botToken = '1:test' // runDailyReminder BOT_TOKEN guard'idan o'tish uchun
  app = express()
  app.use('/api', cronRouter) // app.ts'dagi mount bilan bir xil prefiks
})

beforeEach(() => {
  config.cron.secret = 'test-cron-secret'
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(() => {
  config.cron.secret = origSecret
  config.telegram.botToken = origToken
})

describe('cron fanout suite (Vercel Hobby 2-slot)', () => {
  it("daily-suite: cleanup + daily-reminder ikkalasi ham bitta javobda (CRON_SECRET bilan)", async () => {
    // tryStart=false → komponentlar DB'ga bormasdan 'skipped' qaytadi (deterministik)
    vi.spyOn(cronRepository, 'tryStart').mockResolvedValue(false)

    const res = await request(app)
      .get('/api/cron/daily-suite')
      .set('Authorization', 'Bearer test-cron-secret')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.suite).toBe('daily')
    expect(res.body['cleanup-answer-tokens']?.skipped).toBe(true)
    expect(res.body['daily-reminder']?.skipped).toBe(true)
  })

  it("weekly-suite: league + boss izchil, ikkalasi ham bitta javobda", async () => {
    vi.spyOn(cronRepository, 'tryStart').mockResolvedValue(false)

    const res = await request(app)
      .get('/api/cron/weekly-suite')
      .set('Authorization', 'Bearer test-cron-secret')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.suite).toBe('weekly')
    expect(res.body['league-rollover']?.skipped).toBe(true)
    expect(res.body['boss-rollover']?.skipped).toBe(true)
  })

  it("suite'lar CRON_SECRET'siz 401 (himoya regressiyasi)", async () => {
    const res = await request(app).get('/api/cron/daily-suite')
    expect(res.status).toBe(401)
  })

  it("daily-suite bitta bosqich yiqilganda 500 va ok: false qaytaradi (ID 14)", async () => {
    vi.spyOn(cronRepository, 'tryStart').mockImplementation(async (name) => {
      if (name === 'daily-reminder') {
        throw new Error('Telegram API connection timeout')
      }
      return false
    })

    const res = await request(app)
      .get('/api/cron/daily-suite')
      .set('Authorization', 'Bearer test-cron-secret')

    expect(res.status).toBe(500)
    expect(res.body.ok).toBe(false)
    expect(res.body.suite).toBe('daily')
    expect(res.body['daily-reminder']?.ok).toBe(false)
    expect(res.body['daily-reminder']?.error).toContain('Telegram API connection timeout')
  })

  it("weekly-suite bitta bosqich yiqilganda 500 va ok: false qaytaradi (ID 14)", async () => {
    vi.spyOn(cronRepository, 'tryStart').mockImplementation(async (name) => {
      if (name === 'league-rollover') {
        throw new Error('Database pooler connection lost')
      }
      return false
    })

    const res = await request(app)
      .get('/api/cron/weekly-suite')
      .set('Authorization', 'Bearer test-cron-secret')

    expect(res.status).toBe(500)
    expect(res.body.ok).toBe(false)
    expect(res.body.suite).toBe('weekly')
    expect(res.body['league-rollover']?.ok).toBe(false)
  })

  it("alohida endpoint'lar saqlanib qolgan (manual trigger/instrumentatsiya)", async () => {
    vi.spyOn(cronRepository, 'tryStart').mockResolvedValue(false)

    for (const path of ['daily-reminder', 'league-rollover', 'boss-rollover', 'cleanup-answer-tokens']) {
      const res = await request(app)
        .get(`/api/cron/${path}`)
        .set('Authorization', 'Bearer test-cron-secret')
      expect(res.status, path).toBe(200)
      expect(res.body.ok ?? res.body.skipped, path).toBeTruthy()
    }
  })
})
