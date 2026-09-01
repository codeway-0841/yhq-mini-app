/**
 * AI Kunlik Test GRADER (server/modules/ai-tests/grader.ts) — deterministik
 * baholash + AI'siz degradatsiya yo'llari.
 *
 * Nega: coin mint shu hisob-kitobga tayanadi — xato baholash = noto'g'ri mint.
 * AI chaqiriqlar mock'lanmaydi: bu testlar FAQAT deterministik + aiAllowed=false
 * yo'llarini tekshiradi (AI yo'lini integration qoplaydi).
 */
import { describe, it, expect } from 'vitest'
import {
  AI_TEST_COIN_PER_CORRECT,
  type AiTestAnswers,
} from '../../../shared/ai-daily-test'
import { gradeDeterministic, gradeAiDailyTest, needsAiReview } from '../../../server/modules/ai-tests/grader'
import { buildValidPayload } from '../config/ai-daily-test.test'

function emptyAnswers(): AiTestAnswers {
  return { mcq: {}, matching: {}, short: {}, essay: '' }
}

/** Hamma topshiriqqa TO'G'RI javob */
function allCorrectAnswers(): AiTestAnswers {
  const p = buildValidPayload()
  const a = emptyAnswers()
  for (const t of p.tasks) {
    if (t.kind === 'mcq') a.mcq[t.id] = t.correctOptionId
    if (t.kind === 'matching') a.matching[t.id] = { ...t.correct }
    if (t.kind === 'short') a.short[t.id] = t.acceptedAnswers[0]
  }
  return a
}

describe('ai-test grader — deterministik', () => {
  it('hammasi to\'g\'ri: correctCount=44, esse bo\'sh (AI kerak emas)', () => {
    const p = buildValidPayload()
    const { grading, failedShort } = gradeDeterministic(p, allCorrectAnswers())
    expect(grading.correctCount).toBe(44)
    expect(failedShort.length).toBe(0)
    expect(needsAiReview(p, allCorrectAnswers())).toBe(false)
  })

  it('hammasi bo\'sh: correctCount=0, AI kerak emas (javobsiz ≠ qayta-ko\'rik)', () => {
    const p = buildValidPayload()
    const { grading, failedShort } = gradeDeterministic(p, emptyAnswers())
    expect(grading.correctCount).toBe(0)
    expect(failedShort.length).toBe(0)
    expect(needsAiReview(p, emptyAnswers())).toBe(false)
  })

  it('mcq: faqat aniq variant mosligi; xato javob → correctOptionId reveal', () => {
    const p = buildValidPayload()
    const a = emptyAnswers()
    a.mcq['mcq-1'] = 'A2'   // to'g'ri
    a.mcq['mcq-2'] = 'A1'   // xato
    const { grading } = gradeDeterministic(p, a)
    expect(grading.mcq['mcq-1']).toEqual({ correct: true, correctOptionId: 'A2' })
    expect(grading.mcq['mcq-2']).toEqual({ correct: false, correctOptionId: 'A2' })
    expect(grading.correctCount).toBe(1)
  })

  it('matching: FAQAT to\'liq to\'g\'ri kombinatsiya hisoblanadi (qisman emas)', () => {
    const p = buildValidPayload()
    const a = emptyAnswers()
    a.matching['match-1'] = { L1: 'R2', L2: 'R3', L3: 'R1' }  // to'liq to'g'ri
    a.matching['match-2'] = { L1: 'R2', L2: 'R3', L3: 'R4' }  // 1 ta xato
    const { grading } = gradeDeterministic(p, a)
    expect(grading.matching['match-1'].correct).toBe(true)
    expect(grading.matching['match-2'].correct).toBe(false)
    expect(grading.correctCount).toBe(1)
  })

  it('short: normalize — case/punktuatsiya/ё farqi hisobga olinmaydi', () => {
    const p = buildValidPayload()
    const a = emptyAnswers()
    a.short['short-1'] = '  БЕРЕДИТ ДУШУ 1! '   // acceptedAnswers[0] = 'бередит душу 1'
    const { grading, failedShort } = gradeDeterministic(p, a)
    expect(grading.short['short-1'].correct).toBe(true)
    expect(failedShort.length).toBe(0)
  })

  it('short: mos kelmagan BO\'SH bo\'lmagan javob → AI qayta-ko\'rig\'iga tushadi', () => {
    const p = buildValidPayload()
    const a = emptyAnswers()
    a.short['short-3'] = 'birorta boshqa javob'
    const { grading, failedShort } = gradeDeterministic(p, a)
    expect(grading.short['short-3'].correct).toBe(false)
    expect(failedShort.map((t) => t.id)).toEqual(['short-3'])
    expect(needsAiReview(p, a)).toBe(true)
  })

  it('esse matni → AI review kerak; bo\'sh esse → kerak emas', () => {
    const p = buildValidPayload()
    const a = emptyAnswers()
    a.essay = 'Произвольный текст эссе на тему равнодушия.'
    expect(needsAiReview(p, a)).toBe(true)
  })
})

describe('ai-test grader — gradeAiDailyTest (aiAllowed=false, AI chaqiriq YO\'Q)', () => {
  it('esse yozilgan, lekin kvota yo\'q → essay=null, coin faqat deterministik', async () => {
    const p = buildValidPayload()
    const a = allCorrectAnswers()
    a.essay = 'Эссе тексти камида юз эллик сўздан иборат бўлиши керак.'
    const g = await gradeAiDailyTest(p, a, false)
    expect(g.essay).toBeNull()                     // baholanmadi
    expect(g.correctCount).toBe(44)
    expect(g.coinsAwarded).toBe(44 * AI_TEST_COIN_PER_CORRECT)  // esse coin'siz
  })

  it('esse bo\'sh → essay={score:0}, coin 0 qo\'shiladi', async () => {
    const p = buildValidPayload()
    const g = await gradeAiDailyTest(p, allCorrectAnswers(), false)
    expect(g.essay).toEqual({ score: 0, feedback: '' })
    expect(g.essayScore).toBe(0)
    expect(g.coinsAwarded).toBe(44 * AI_TEST_COIN_PER_CORRECT)
  })

  it('hammasi xato/bo\'sh → coinsAwarded=0 (chk_delta_nonzero: ledger yozilmaydi)', async () => {
    const p = buildValidPayload()
    const g = await gradeAiDailyTest(p, emptyAnswers(), false)
    expect(g.coinsAwarded).toBe(0)
  })
})
