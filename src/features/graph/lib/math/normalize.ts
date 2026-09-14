/**
 * Ifodani tokenizatsiyadan oldin normallashtirish:
 *  - Unicode matematik belgilar (², √, π, ×, −) → ASCII ekvivalentlari
 *  - Grek harflari → lotin nomlari (θ → theta)
 *  - Harflar kichik registrga tushiriladi (`Sin(X)` = `sin(x)`)
 *  - `**` → `^`
 *
 * `normalizeWithMap` har bir chiqish belgisi uchun ASL matndagi indeksni
 * qaytaradi — parser xatolari `pos`ini input ichida to'g'ri belgilash uchun
 * (masalan `√x` normalizatsiyada `sqrt x` bo'ladi, pozitsiyalar siljiydi).
 */

export interface NormalizedExpression {
  text: string
  /** positions[i] — text[i] qaysi ASL indeksdan kelgan */
  positions: number[]
}

const CHAR_MAP: Record<string, string> = {
  'π': 'pi ',
  '×': '*',
  '·': '*',
  '⋅': '*',
  '÷': '/',
  '−': '-',
  '–': '-',
  '—': '-',
  '√': 'sqrt ',
  '²': '^2',
  '³': '^3',
  '¹': '^1',
  '⁰': '^0',
  '⁴': '^4',
  '⁵': '^5',
  '⁶': '^6',
  '⁷': '^7',
  '⁸': '^8',
  '⁹': '^9',
  'θ': 'theta',
  'ω': 'omega',
  'α': 'alpha',
  'β': 'beta',
  'γ': 'gamma',
  'δ': 'delta',
  'Δ': 'delta',
  'λ': 'lambda',
  'μ': 'mu',
  'ρ': 'rho',
  'σ': 'sigma',
  'τ': 'tau',
  'φ': 'phi',
}

export function normalizeWithMap(input: string): NormalizedExpression {
  let text = ''
  const positions: number[] = []
  const chars = Array.from(input)

  const emit = (value: string, sourceIndex: number): void => {
    for (const ch of value) {
      text += ch
      positions.push(sourceIndex)
    }
  }

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    // `**` → `^` (ikkala belgi ham bitta `^`ga — pozitsiya birinchisidan)
    if (ch === '*' && chars[i + 1] === '*') {
      emit('^', i)
      i++
      continue
    }
    const mapped = CHAR_MAP[ch]
    if (mapped !== undefined) {
      emit(mapped, i)
    } else if (ch >= 'A' && ch <= 'Z') {
      emit(ch.toLowerCase(), i)
    } else {
      emit(ch, i)
    }
  }

  return { text, positions }
}

export function normalizeExpression(input: string): string {
  return normalizeWithMap(input).text
}

/** Normalizatsiya qilingan `pos`ni ASL matn indeksiga qaytaradi */
export function mapNormalizedPosition(input: string, normalizedPos: number): number {
  const { positions } = normalizeWithMap(input)
  if (positions.length === 0) return 0
  if (normalizedPos >= positions.length) return input.length
  return positions[normalizedPos] ?? input.length
}
