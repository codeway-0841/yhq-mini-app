import { describe, it, expect, vi } from 'vitest'
import { drawResultCard, buildResultShareText, type ResultCardData } from '../../../src/features/test/result-canvas'

describe('Result Card Canvas (#48)', () => {
  const mockCtx = {
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    roundRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 200 })),
    // JSON-model: measureText qayta ishlatiladigan obyekt kerak
    textAlign: 'left',
    textBaseline: 'alphabetic',
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    font: '',
  }

  const createMockCanvas = () => ({
    width: 0,
    height: 0,
    getContext: vi.fn((type: string) => (type === '2d' ? mockCtx : null)),
  } as unknown as HTMLCanvasElement)

  const base: ResultCardData = {
    userName: 'Aziza Karimova',
    subjectName: 'Yo‘l Harakati Qoidalari',
    correct: 38,
    wrong: 2,
    unanswered: 0,
    total: 40,
    percent: 95,
    passed: true,
    streak: 7,
    date: '20-avgust, 2026',
    lang: 'uz',
  }

  it('kvadrat story o\'lchami (1080x1080) o\'rnatiladi', () => {
    const canvas = createMockCanvas()
    drawResultCard(canvas, base)
    expect(canvas.width).toBe(1080)
    expect(canvas.height).toBe(1080)
    expect(mockCtx.createRadialGradient).toHaveBeenCalled()
  })

  it('streak > 1 bo\'lsa measureText orqali pill chiziladi', () => {
    mockCtx.measureText.mockClear()
    drawResultCard(createMockCanvas(), base)
    expect(mockCtx.measureText).toHaveBeenCalled()
  })

  it('streak <= 1 bo\'lsa pill chizilmaydi', () => {
    mockCtx.measureText.mockClear()
    drawResultCard(createMockCanvas(), { ...base, streak: 1 })
    expect(mockCtx.measureText).not.toHaveBeenCalled()
  })

  it('ctx null (jsdom) bo\'lsa jimgina chiqadi', () => {
    const bad = { getContext: () => null } as unknown as HTMLCanvasElement
    expect(() => drawResultCard(bad, base)).not.toThrow()
  })

  it("uzun ismlar 26 belgida qisqartiriladi", () => {
    mockCtx.fillText.mockClear()
    drawResultCard(createMockCanvas(), { ...base, userName: 'A'.repeat(40) })
    const texts = mockCtx.fillText.mock.calls.map((c) => String(c[0]))
    expect(texts.some((t) => t.includes('…') && t.length === 26)).toBe(true)
  })
})

describe('buildResultShareText (#48)', () => {
  it('UZ: o\'tgan + streak', () => {
    const t = buildResultShareText({ correct: 38, total: 40, percent: 95, passed: true, streak: 5, lang: 'uz' })
    expect(t).toContain('🏆')
    expect(t).toContain('95%')
    expect(t).toContain("(to'g'ri 38/40)")
    expect(t).toContain('Seriya: 5 kun ketma-ket!')
    expect(t).toContain("San ham sinab ko'r:")
  })

  it('RU: o\'tmagan + streaksiz', () => {
    const t = buildResultShareText({ correct: 10, total: 40, percent: 25, passed: false, streak: 0, lang: 'ru' })
    expect(t).toContain('💪')
    expect(t).toContain('правильно 10/40')
    expect(t).not.toContain('Серия')
    expect(t).toContain('Попробуй и ты:')
  })
})
