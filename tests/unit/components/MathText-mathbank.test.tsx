import { describe, it, expect } from 'vitest'
import { parseMathSegments, renderKaTeXToString } from '../../../src/shared/components/MathText'

/**
 * Math-bank v3 renderer contract: bank LaTeX is preserved by extraction,
 * so the tokenizer must understand every command the extractor emits.
 * No raw LaTeX may stay visible in text segments.
 */
describe('MathText math-bank v3 contract', () => {
  it('\\operatorname{tg}/\\operatorname{ctg} math sifatida ajratiladi (xom ko‘rinmaydi)', () => {
    const segs = parseMathSegments('Agar \\operatorname{ctg} \\alpha = - \\frac{1}{3} bo‘lsa, toping.')
    const math = segs.filter(s => s.type === 'math').map(s => s.content)
    expect(math).toContain('\\operatorname{ctg}')
    const texts = segs.filter(s => s.type === 'text').map(s => s.content).join('|')
    expect(texts).not.toMatch(/\\operatorname/)
    for (const m of math) {
      expect(renderKaTeXToString(m)).not.toBeNull()
    }
  })

  it('\\sqrt[3]{...} indeksli ildiz math sifatida ajratiladi', () => {
    const segs = parseMathSegments('Tenglama: \\sqrt[3]{x + 1} = 2 ni yeching.')
    const math = segs.filter(s => s.type === 'math').map(s => s.content)
    expect(math).toContain('\\sqrt[3]{x + 1}')
    expect(segs.find(s => s.type === 'text' && s.content.includes('Tenglama'))).toBeDefined()
  })

  it('juft \\left...\\right span bitta math segment bo‘ladi', () => {
    const segs = parseMathSegments('2 cos \\left(4 \\alpha + \\frac{\\pi}{4} \\right) .')
    const math = segs.filter(s => s.type === 'math')
    expect(math.length).toBeGreaterThan(0)
    expect(math.map(s => s.content).join('')).toContain('\\left(')
    for (const m of math) {
      expect(renderKaTeXToString(m.content, m.displayMode)).not.toBeNull()
    }
  })

  it('yakka \\left( / \\right) xom qolmaydi (delimiter render bo‘ladi)', () => {
    const segs = parseMathSegments('ifoda \\left( buzilgan')
    const texts = segs.filter(s => s.type === 'text').map(s => s.content).join('|')
    expect(texts).not.toMatch(/\\left/)
  })

  it('nasr (prose) math-italic‘ga yutilmaydi: tinish belgili so‘zlar hisoblanadi', () => {
    const segs = parseMathSegments('\\frac{1}{2} + \\frac{1}{3} = p bo‘lsa, yig‘indi qancha?')
    const mathContents = segs.filter(s => s.type === 'math').map(s => s.content)
    // Prose must stay text; only real formulas are math
    expect(mathContents).toContain('\\frac{1}{2}')
    expect(mathContents).toContain('\\frac{1}{3}')
    const wholeAsMath = segs.length === 1 && segs[0].type === 'math'
    expect(wholeAsMath).toBe(false)
    const texts = segs.filter(s => s.type === 'text').map(s => s.content).join('')
    expect(texts).toContain('yig‘indi')
  })

  it('U+2018 (‘) so‘zlar ham prose deb hisoblanadi (yutilish regressiyasi)', () => {
    // 'ko‘paytmani' uses U+2018; the whole sentence must not become math.
    const segs = parseMathSegments('y = x + 1 ko‘paytmani hisoblang.')
    const wholeAsMath = segs.length === 1 && segs[0].type === 'math'
    expect(wholeAsMath).toBe(false)
  })

  it('bitta prose so‘z + apostrof ham yutilmaydi', () => {
    const segs = parseMathSegments('f^{′} (x) > f (x) ni toping.')
    const wholeAsMath = segs.length === 1 && segs[0].type === 'math'
    expect(wholeAsMath).toBe(false)
  })

  it('buyruq nomi keyingi harfga yopishmaydi (\\alphax regressiyasi)', () => {
    const segs = parseMathSegments('(ax + 2y)(x - by) = c, bunda x, y noma’lum.')
    const texts = segs.filter(s => s.type === 'text').map(s => s.content).join('|')
    expect(texts).not.toMatch(/\\alpha/)
    const segs2 = parseMathSegments('qiymat \\alpha x va \\beta y bo‘lsa.')
    const math2 = segs2.filter(s => s.type === 'math').map(s => s.content)
    expect(math2).toContain('\\alpha')
    expect(math2).not.toContain('\\alphax')
  })

  it('funksiya+pastki indeks bir math segment (log_{0,5})', () => {
    const segs = parseMathSegments('tengsizlik: log_{0,5} (2x - 7) ni yeching.')
    const math = segs.filter(s => s.type === 'math').map(s => s.content)
    expect(math).toContain('\\log_{0,5}')
    for (const m of math) {
      expect(renderKaTeXToString(m)).not.toBeNull()
    }
  })

  it('foiz belgisi prose dalil (% + so‘z yutilmaydi)', () => {
    const segs = parseMathSegments('A) 4. B) 2, agar x \\ge - 2.')
    const wholeAsMath = segs.length === 1 && segs[0].type === 'math'
    expect(wholeAsMath).toBe(false)
  })

  it('noma’lum uzun buyruq eng uzun renderlanuvchi prefiksga tushadi', () => {
    const segs = parseMathSegments('qiymat \\alphax va \\betay bo‘lsa.')
    const math = segs.filter(s => s.type === 'math').map(s => s.content)
    expect(math).toContain('\\alpha')
    expect(math).toContain('\\beta')
    expect(math.join('|')).not.toMatch(/\\alphax|\\betay/)
  })

  it('prose qavs ichidagi left/right jufti math bo‘lmaydi', () => {
    const segs = parseMathSegments('tengsizlik \\left(bo‘lsa, x\\right) da berilgan.')
    const math = segs.filter(s => s.type === 'math').map(s => s.content).join('|')
    expect(math).not.toContain('bo‘lsa')
  })

  it('xom LaTeX buyruqlari text segmentlarda qolmaydi (1058-maydon regressiyasi)', () => {
    const samples = [
      'x = \\operatorname{arcctg} (tgx) ni yeching.',
      'qiymat \\left(4 \\alpha\\right) ga teng.',
      'ildiz \\sqrt[2]{a} topilsin.',
      'kasr \\frac{a}{b} katta.',
    ]
    for (const text of samples) {
      const segs = parseMathSegments(text)
      for (const s of segs) {
        if (s.type === 'text') {
          expect(s.content).not.toMatch(/\\(operatorname|left|right|sqrt|frac)(?![a-zA-Z])/)
        } else {
          expect(renderKaTeXToString(s.content, s.displayMode)).not.toBeNull()
        }
      }
    }
  })
})
