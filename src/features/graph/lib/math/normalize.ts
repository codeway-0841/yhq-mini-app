/**
 * Ifodani tokenizatsiyadan oldin normallashtirish:
 *  - Unicode matematik belgilar (², √, π, ×, −) → ASCII ekvivalentlari
 *  - Grek harflari → lotin nomlari (θ → theta) — slider label'ida asl belgi
 *    ko'rsatilmaydi, lekin formula ishlaydi
 *  - Harflar kichik registrga tushiriladi (`Sin(X)` = `sin(x)`)
 *  - `**` → `^`
 */

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

export function normalizeExpression(input: string): string {
  let out = ''
  for (const ch of input) {
    const mapped = CHAR_MAP[ch]
    if (mapped !== undefined) {
      out += mapped
    } else if (ch >= 'A' && ch <= 'Z') {
      out += ch.toLowerCase()
    } else {
      out += ch
    }
  }
  return out.replace(/\*\*/g, '^')
}
