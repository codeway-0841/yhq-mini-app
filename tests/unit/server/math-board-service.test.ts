/**
 * Math Board server — parseRecognitionJson unit testlari (Faza 4).
 *
 * Network'siz: Gemini xom javobidan {latex, alternatives, confidence} ajratish,
 * markdown fence, noto'g'ri JSON, bo'sh latex, confidence clamp.
 */
import { describe, it, expect } from 'vitest'
import {
  parseRecognitionJson, sanitizeHintQuestion, parseBlockResults, parseHintResponse,
} from '../../../server/modules/math-board/math-board.service'

describe('parseRecognitionJson', () => {
  it('toza JSON parse qiladi', () => {
    const r = parseRecognitionJson('{"latex":"\\\\frac{1}{2}","alternatives":["1/2"],"confidence":0.9}')
    expect(r.latex).toBe('\\frac{1}{2}')
    expect(r.alternatives).toEqual(['1/2'])
    expect(r.confidence).toBe(0.9)
  })

  it('markdown fence tozalaydi', () => {
    const r = parseRecognitionJson('```json\n{"latex":"x=5","confidence":0.7}\n```')
    expect(r.latex).toBe('x=5')
    expect(r.alternatives).toEqual([])
  })

  it("bo'sh latex → 502", () => {
    expect(() => parseRecognitionJson('{"latex":"  "}')).toThrow()
  })

  it("noto'g'ri JSON → 502", () => {
    expect(() => parseRecognitionJson('not json')).toThrow()
  })

  it('confidence clamp [0,1] + default 0.5', () => {
    expect(parseRecognitionJson('{"latex":"x"}').confidence).toBe(0.5)
    expect(parseRecognitionJson('{"latex":"x","confidence":5}').confidence).toBe(1)
    expect(parseRecognitionJson('{"latex":"x","confidence":-2}').confidence).toBe(0)
  })

  it('alternatives max 3 + faqat string', () => {
    const r = parseRecognitionJson('{"latex":"x","alternatives":["a","b","c","d",42,"  "]}')
    expect(r.alternatives).toEqual(['a', 'b', 'c'])
  })
})

describe('sanitizeHintQuestion (review: schema-bitta-savol validatsiyasi)', () => {
  it('oddiy savolni tozalaydi', () => {
    expect(sanitizeHintQuestion('  Qaysi qadamda ishora xato?\n')).toBe('Qaysi qadamda ishora xato?')
  })

  it('fence/quote/bullet tozalaydi', () => {
    expect(sanitizeHintQuestion('```\n- Nima uchun bu teng?\n```')).toBe('Nima uchun bu teng?')
    expect(sanitizeHintQuestion('"Qanday davom etasan?"')).toBe('Qanday davom etasan?')
  })

  it('P2-E: savol belgisi yo‘q (yechim) → null', () => {
    expect(sanitizeHintQuestion('x=5.')).toBeNull()
    expect(sanitizeHintQuestion('Javob beshga teng')).toBeNull()
  })

  it('P2-E: ikki savol → null', () => {
    expect(sanitizeHintQuestion('Birinchi savol? Ikkinchi savol?')).toBeNull()
  })

  it('P2-E: tenglik belgisi → null (deklarativ yechim)', () => {
    expect(sanitizeHintQuestion('Nima uchun x=5?')).toBeNull()
  })

  it("bo'sh/juda qisqa → null (client fallback'ga tushadi)", () => {
    expect(sanitizeHintQuestion('   ')).toBeNull()
    expect(sanitizeHintQuestion('ok')).toBeNull()
  })

  it('500 cap (qisqa savol butun qoladi)', () => {
    const q = 'Qanday davom etasan?'
    expect(sanitizeHintQuestion(q)?.length).toBeLessThanOrEqual(500)
    expect(sanitizeHintQuestion(q)).toBe(q)
  })
})

describe('parseHintResponse (Faza 5 structured)', () => {
  it('savol + tanish highlight', () => {
    const r = parseHintResponse('{"question":"Qayerda xato?", "highlightBlockId":"b1"}', ['b1', 'b2'])
    expect(r).toEqual({ question: 'Qayerda xato?', highlightBlockId: 'b1' })
  })

  it('highlight known ro‘yxatda bo‘lmasa — tashlanadi, savol qoladi', () => {
    const r = parseHintResponse('{"question":"Qanday?", "highlightBlockId":"begona"}', ['b1'])
    expect(r).toEqual({ question: 'Qanday?' })
  })

  it('savol sanitizerdan o‘tmasa → null', () => {
    expect(parseHintResponse('{"question":"x=5."}', [])).toBeNull()
    expect(parseHintResponse('{"question":"a? b?"}', [])).toBeNull()
    expect(parseHintResponse('not json', [])).toBeNull()
    expect(parseHintResponse('{"nope":1}', [])).toBeNull()
  })
})

describe('parseBlockResults (Faza 4: qat’iy schema, per-block fail-closed)', () => {
  it('tartibli array parse qiladi', () => {
    const r = parseBlockResults(
      '[{"blockId":"b1","type":"equation","latex":"x=1","confidence":0.9,"alternatives":["x = 1"]}]',
      ['b1'],
    )
    expect(r).toEqual([{
      blockId: 'b1', type: 'equation', latex: 'x=1', confidence: 0.9, alternatives: ['x = 1'],
    }])
  })

  it('javobda yo‘q blok → failed entry', () => {
    const r = parseBlockResults('[{"blockId":"b1","latex":"x"}]', ['b1', 'b2'])
    expect(r).toHaveLength(2)
    expect(r[1]).toMatchObject({ blockId: 'b2', latex: '', confidence: 0 })
  })

  it('yaroqsiz item → failed, qolganlari yashaydi', () => {
    const r = parseBlockResults('[{"blockId":"b1","latex":""}, {"blockId":"b2","latex":"y=2"}]', ['b1', 'b2'])
    expect(r[0].latex).toBe('')
    expect(r[1].latex).toBe('y=2')
  })

  it('array bo‘lmasa → 502', () => {
    expect(() => parseBlockResults('{"latex":"x"}', ['b1'])).toThrow()
    expect(() => parseBlockResults('bema’ni', ['b1'])).toThrow()
  })

  it('type faqat equation/text (boshqasi equation default)', () => {
    const r = parseBlockResults('[{"blockId":"b1","latex":"x","type":"picture"}]', ['b1'])
    expect(r[0].type).toBe('equation')
  })
})
