/**
 * Sentry — `@sentry/node` bloklovchi import EMAS.
 *
 * Nima uchun test bor: `import * as Sentry from '@sentry/node'` top-level
 * turganda cold start'ga ~900 ms qo'shilardi va bu har bir sovuq so'rovga,
 * hatto DB'ga tegmaydigan `/api/health` ga ham tushardi. Yuklash dinamik
 * qilindi. Bu testlar ikki narsani ushlab turadi:
 *
 *   1. modul init'i kutubxonani KUTMAYDI (boot bloklanmaydi),
 *   2. shu oraliqda kelgan xatolar YO'QOLMAYDI — navbatga tushib keyin ketadi.
 *
 * Kimdir top-level import'ni qaytarsa yoki navbatni olib tashlasa, shu yerda
 * yiqiladi.
 *
 * DIQQAT — `import()` mikrotaskda bajariladi: sentry.ts modul sifatida
 * qaytgan payt mock factory HALI chaqirilmagan bo'lishi mumkin. Shuning uchun
 * kuzatuv `vi.waitFor` orqali, darhol `expect` bilan emas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  importCount: 0,
  resolveImport: undefined as (() => void) | undefined,
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('@sentry/node', async () => {
  state.importCount += 1
  // Yuklanishni ataylab osib qo'yamiz — "hali tayyor emas" oynasini shu
  // yaratadi. Testlar `finishImport()` bilan uni ochadi.
  await new Promise<void>((resolve) => { state.resolveImport = resolve })
  return {
    init: state.init,
    captureException: state.captureException,
    captureMessage: state.captureMessage,
  }
})

const DSN = 'https://key@example.ingest.sentry.io/1'

async function loadSentryModule() {
  vi.resetModules()
  return await import('../../../server/utils/sentry')
}

/** Mock factory chaqirilishini kutamiz — ya'ni dinamik import boshlandi. */
async function importStarted() {
  await vi.waitFor(() => expect(state.resolveImport).toBeDefined())
}

/** Osilgan importni ochib, init va navbat bo'shashini kutamiz. */
async function finishImport() {
  await importStarted()
  state.resolveImport?.()
  await vi.waitFor(() => expect(state.init).toHaveBeenCalled())
}

/** Bir necha tikni o'tkazamiz — "hech nima sodir bo'lmadi" ni tekshirish uchun. */
async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}

beforeEach(() => {
  vi.unstubAllEnvs()
  state.importCount = 0
  state.resolveImport = undefined
  state.init.mockClear()
  state.captureException.mockClear()
  state.captureMessage.mockClear()
})

describe('Sentry — dinamik yuklash', () => {
  it("DSN sozlanmagan bo'lsa @sentry/node UMUMAN yuklanmaydi", async () => {
    const { Sentry } = await loadSentryModule()
    Sentry.captureException(new Error('e'))
    Sentry.captureMessage('m')
    await settle()

    expect(state.importCount).toBe(0)
    expect(state.init).not.toHaveBeenCalled()
  })

  /**
   * Osilgan import oynasi BITTA testda tekshiriladi: vitest mock factory'ni
   * bir marta muvaffaqiyatli bajarilgach keshlaydi, ya'ni oynani har testda
   * qayta yarata olmaymiz. Uchala xossa bir xil holatga tegishli, shuning
   * uchun ularni ajratish sun'iy bo'lardi.
   */
  it('yuklanish oynasi: boot bloklanmaydi, hodisalar navbatda saqlanadi, navbat chegaralangan', async () => {
    vi.stubEnv('SENTRY_DSN', DSN)
    const { Sentry, MAX_PENDING } = await loadSentryModule()

    // 1. Modul qo'lda, import esa hali osilib turibdi — boot bloklanmadi.
    expect(Sentry).toBeDefined()
    await importStarted()
    expect(state.init).not.toHaveBeenCalled()
    expect(state.importCount).toBe(1)

    // 2. Shu oynada kelgan hodisalar hech qayerga ketmaydi...
    const err = new Error('boot paytidagi xato')
    Sentry.captureException(err, { tags: { stage: 'boot' } })
    Sentry.captureMessage('erta signal')
    expect(state.captureException).not.toHaveBeenCalled()
    expect(state.captureMessage).not.toHaveBeenCalled()

    // 3. ...lekin chegaradan ortig'i tashlanadi.
    const extra = MAX_PENDING * 4
    for (let i = 0; i < extra; i++) Sentry.captureException(new Error(`xato ${i}`))
    expect(extra).toBeGreaterThan(MAX_PENDING)

    await finishImport()

    // Birinchi xato yetkazildi va tartib saqlandi.
    expect(state.captureException).toHaveBeenNthCalledWith(1, err, { tags: { stage: 'boot' } })
    expect(state.captureMessage).toHaveBeenCalledWith('erta signal', undefined)
    // Jami MAX_PENDING ta hodisa saqlangan (1 exception + 1 message + qolgani).
    const delivered = state.captureException.mock.calls.length + state.captureMessage.mock.calls.length
    expect(delivered).toBe(MAX_PENDING)
  })

  it("yuklangandan keyin to'g'ridan-to'g'ri ketadi, navbatsiz", async () => {
    vi.stubEnv('SENTRY_DSN', DSN)
    const { Sentry } = await loadSentryModule()
    // Bu nuqtada kutubxona allaqachon keshda — init darhol bo'ladi.
    await vi.waitFor(() => expect(state.init).toHaveBeenCalled())

    const err = new Error('keyingi xato')
    Sentry.captureException(err)

    expect(state.captureException).toHaveBeenCalledWith(err, undefined)
  })
})
