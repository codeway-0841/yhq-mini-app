/**
 * CamAi sof logika testlari — seeded rand bilan deterministik.
 */
import { describe, it, expect } from 'vitest'
import {
  matchDetectionsToSlots,
  buildQuestionQueue,
  drawNext,
  roulettePlan,
  applyMark,
  ranking,
  parseCustomQuestions,
  computeFaceCrop,
  MAX_SLOTS,
  MISS_TOLERANCE,
  type FaceBox,
  type Slot,
} from '../../../src/features/camai/camai-logic'

/** Deterministik rand (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const box = (x: number, y: number, w = 0.1, h = 0.1): FaceBox => ({ x, y, width: w, height: h })

describe('camai-logic / matchDetectionsToSlots', () => {
  it('yangi yuzlar yangi slot oladi (id ketma-ket)', () => {
    const r = matchDetectionsToSlots([], [box(0.1, 0.1), box(0.5, 0.5)], 1)
    expect(r.slots).toHaveLength(2)
    expect(r.slots.map((s) => s.id)).toEqual([1, 2])
    expect(r.nextId).toBe(3)
  })

  it('yaqin yuz — o\'sha slot davomi (id saqlanadi, missed reset)', () => {
    const prev: Slot[] = [{ id: 7, box: box(0.1, 0.1), missed: 3 }]
    const r = matchDetectionsToSlots(prev, [box(0.12, 0.11)], 8)
    expect(r.slots).toHaveLength(1)
    expect(r.slots[0].id).toBe(7)
    expect(r.slots[0].missed).toBe(0)
    expect(r.nextId).toBe(8) // yangi slot ochilmadi
  })

  it('uzoq yuz — yangi slot (eskisi missed oshadi)', () => {
    const prev: Slot[] = [{ id: 1, box: box(0.1, 0.1), missed: 0 }]
    const r = matchDetectionsToSlots(prev, [box(0.7, 0.7)], 2)
    expect(r.slots).toHaveLength(2)
    expect(r.slots[1].id).toBe(2)
    expect(r.slots[0].missed).toBe(1)
  })

  it('bir slotga bir kadrda ikki yuz yozilmaydi', () => {
    const prev: Slot[] = [{ id: 1, box: box(0.1, 0.1), missed: 0 }]
    const r = matchDetectionsToSlots(prev, [box(0.1, 0.1), box(0.12, 0.1)], 2)
    // Birinchi yuz slot 1'ga, ikkinchisi — yangi slot'ga
    expect(r.slots).toHaveLength(2)
    expect(r.slots.filter((s) => s.missed === 0)).toHaveLength(2)
  })

  it(`tolerance'dan keyin slot o'chadi`, () => {
    const prev: Slot[] = [{ id: 1, box: box(0.1, 0.1), missed: MISS_TOLERANCE }]
    const r = matchDetectionsToSlots(prev, [], 2)
    expect(r.slots).toHaveLength(0)
  })

  it(`tolerance ICHIDA slot saqlanadi (kamera aylantirishda yig'iladi)`, () => {
    const prev: Slot[] = [{ id: 1, box: box(0.1, 0.1), missed: MISS_TOLERANCE - 1 }]
    const r = matchDetectionsToSlots(prev, [], 2)
    expect(r.slots).toHaveLength(1)
    expect(r.slots[0].missed).toBe(MISS_TOLERANCE)
  })

  it(`MAX_SLOTS dan oshib ketmaydi`, () => {
    const prev: Slot[] = Array.from({ length: MAX_SLOTS }, (_, i) => ({ id: i + 1, box: box(0.01 * i, 0), missed: 0 }))
    const r = matchDetectionsToSlots(prev, [box(0.95, 0.95)], MAX_SLOTS + 1)
    expect(r.slots.length).toBeLessThanOrEqual(MAX_SLOTS)
    expect(r.nextId).toBe(MAX_SLOTS + 1) // ortiqcha yuz slot ochmadi
  })
})

describe('camai-logic / buildQuestionQueue', () => {
  it('count dan oshmaydi va subset qaytaradi', () => {
    const qs = Array.from({ length: 50 }, (_, i) => i)
    const q = buildQuestionQueue(qs, 10, seeded(42))
    expect(q).toHaveLength(10)
    for (const x of q) expect(qs).toContain(x)
    expect(new Set(q).size).toBe(10) // takror yo'q
  })

  it('savollar count\'dan kam bo\'lsa — hammasi qaytaradi', () => {
    expect(buildQuestionQueue([1, 2, 3], 10, seeded(1))).toHaveLength(3)
  })
})

describe('camai-logic / drawNext (cheksiz deck)', () => {
  const pool = Array.from({ length: 5 }, (_, i) => ({ id: `q${i}` }))

  it('deck\'dan bitta oladi, qolgani qisqaradi', () => {
    const full = [...pool]
    const r = drawNext(pool, full, null, seeded(1))
    expect(r.question).not.toBeNull()
    expect(r.deck).toHaveLength(4)
  })

  it('deck tugasa — pool\'dan yangi deck ochadi (lastId chiqariladi)', () => {
    const r = drawNext(pool, [], 'q2', seeded(7))
    expect(r.question).not.toBeNull()
    expect(r.question!.id).not.toBe('q2')
    expect(r.deck).toHaveLength(3) // 4 ta qoldiq (5 - lastId - olingan)
    expect(r.deck.every((q) => q.id !== 'q2')).toBe(true)
  })

  it('bitta savolli pool cheksiz ishlaydi (lastId filtri chetlab o\'tiladi)', () => {
    const single = [{ id: 'only' }]
    const r1 = drawNext(single, [], 'only', seeded(1))
    expect(r1.question!.id).toBe('only')
    const r2 = drawNext(single, r1.deck, r1.question!.id, seeded(1))
    expect(r2.question!.id).toBe('only')
  })

  it('uzun seriyada HECH QACHON null qaytarmaydi (cheksizlik)', () => {
    let deck: typeof pool = []
    let lastId: string | null = null
    const rand = seeded(42)
    for (let i = 0; i < 50; i++) {
      const r = drawNext(pool, deck, lastId, rand)
      expect(r.question).not.toBeNull()
      lastId = r.question!.id
      deck = r.deck
    }
  })

  it('bo\'sh pool — null', () => {
    expect(drawNext([], [], null, seeded(1)).question).toBeNull()
  })
})

describe('camai-logic / roulettePlan', () => {
  it('0 slot — null', () => {
    expect(roulettePlan(0, seeded(1))).toBeNull()
  })

  it('winner sequence oxirgi elementi bilan mos keladi', () => {
    for (const seed of [1, 7, 99, 12345]) {
      const plan = roulettePlan(6, seeded(seed))!
      expect(plan.sequence[plan.sequence.length - 1]).toBe(plan.winner)
      expect(plan.winner).toBeGreaterThanOrEqual(0)
      expect(plan.winner).toBeLessThan(6)
      expect(plan.sequence.length).toBeGreaterThanOrEqual(6) // kamida 1 aylana
    }
  })

  it('barcha indekslar diapazonda', () => {
    const plan = roulettePlan(3, seeded(5))!
    for (const i of plan.sequence) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(3)
    }
  })
})

describe('camai-logic / applyMark + ranking', () => {
  it('✓/✗ alohida sanaladi', () => {
    let s: Record<number, import('../../../src/features/camai/camai-logic').SlotStats> = {}
    s = applyMark(s, 1, true)
    s = applyMark(s, 1, true)
    s = applyMark(s, 1, false)
    s = applyMark(s, 2, false)
    expect(s[1]).toEqual({ correct: 2, wrong: 1 })
    expect(s[2]).toEqual({ correct: 0, wrong: 1 })
  })

  it('ranking: ko\'p ✓ → kam ✗ → kichik id tartibida', () => {
    const r = ranking({
      1: { correct: 3, wrong: 0 },
      2: { correct: 3, wrong: 1 },
      3: { correct: 5, wrong: 2 },
      4: { correct: 0, wrong: 0 }, // javob bermagan — kirmaydi
    })
    expect(r.map((e) => e.slotId)).toEqual([3, 1, 2])
  })

  it('accuracy: foiz to\'g\'ri hisoblanadi', () => {
    const r = ranking({ 1: { correct: 3, wrong: 1 } })
    expect(r[0].accuracy).toBe(75)
    expect(ranking({ 2: { correct: 0, wrong: 3 } })[0].accuracy).toBe(0)
  })

  it('bo\'sh hisob — bo\'sh reyting', () => {
    expect(ranking({})).toEqual([])
    expect(ranking({ 1: { correct: 0, wrong: 0 } })).toEqual([])
  })
})

describe('camai-logic / parseCustomQuestions', () => {
  it('har qator — bitta savol, bo\'sh qatorlar tashlanadi', () => {
    const qs = parseCustomQuestions('Birinchi savol\n\n  \nIkkinchi savol  \nUchinchi')
    expect(qs).toHaveLength(3)
    expect(qs[0].text).toBe('Birinchi savol')
    expect(qs[1].text).toBe('Ikkinchi savol')
    expect(qs[2].id).toBe('custom-2')
    expect(qs[0].options).toEqual([])
    expect(qs[0].answer).toBeNull()
  })

  it('"||" bilan kutilgan javob parse qilinadi', () => {
    const qs = parseCustomQuestions('2+2 nechaga teng? || 4\nPoytaxt?||Toshkent\nJavobsiz savol')
    expect(qs[0]).toMatchObject({ text: '2+2 nechaga teng?', answer: '4' })
    expect(qs[1]).toMatchObject({ text: 'Poytaxt?', answer: 'Toshkent' })
    expect(qs[2]).toMatchObject({ text: 'Javobsiz savol', answer: null })
  })

  it('bo\'sh javob ("||" dan keyin hech narsa) — answer null', () => {
    const qs = parseCustomQuestions('Savol ||  ')
    expect(qs[0].answer).toBeNull()
  })

  it('faqat javob qolgan qator ("|| javob") — savol bo\'sh, tashlanadi', () => {
    const qs = parseCustomQuestions('|| javob\nNormal savol')
    expect(qs).toHaveLength(1)
    expect(qs[0].text).toBe('Normal savol')
  })

  it('bo\'sh matn — bo\'sh massiv', () => {
    expect(parseCustomQuestions('  \n\n')).toEqual([])
  })
})

describe('camai-logic / computeFaceCrop', () => {
  it('markaziy yuz — kvadrat, padding marta kengaytirilgan', () => {
    // 1280x720 kadr, markazda 0.1x0.1 box (128x72 px)
    const r = computeFaceCrop(box(0.45, 0.45, 0.1, 0.1), 1280, 720, 2)!
    // size = max(128, 72) * 2 = 256
    expect(r.size).toBe(256)
    // markaz (640, 360) → x=512, y=232
    expect(r.x).toBe(512)
    expect(r.y).toBe(232)
  })

  it('chekkadagi yuz — kadr chegarasidan chiqmaydi', () => {
    const r = computeFaceCrop(box(0.0, 0.0, 0.1, 0.1), 1280, 720, 2)!
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.size).toBeLessThanOrEqual(1280)
    expect(r.y + r.size).toBeLessThanOrEqual(720)
  })

  it('o\'ng chekkadagi yuz — crop kadr ichida qisqaradi', () => {
    const r = computeFaceCrop(box(0.9, 0.9, 0.1, 0.1), 1280, 720, 2)!
    expect(r.x + r.size).toBeLessThanOrEqual(1280)
    expect(r.y + r.size).toBeLessThanOrEqual(720)
  })

  it('juda katta yuz — size kadr o\'lchamidan oshmaydi', () => {
    const r = computeFaceCrop(box(0.1, 0.1, 0.8, 0.8), 1280, 720, 2)!
    expect(r.size).toBeLessThanOrEqual(720)
  })

  it('yaroqsiz kiritma — null', () => {
    expect(computeFaceCrop(box(0, 0, 0, 0), 1280, 720)).toBeNull()
    expect(computeFaceCrop(box(0.1, 0.1), 0, 720)).toBeNull()
    expect(computeFaceCrop(box(0.1, 0.1), 1280, -5)).toBeNull()
  })
})
