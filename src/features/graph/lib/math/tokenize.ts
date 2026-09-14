import { ExprError } from './errors'
import { normalizeExpression } from './normalize'
import { isFunctionName } from './builtins'

export type TokenType = 'num' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma'

export interface Token {
  type: TokenType
  value: string
  pos: number
}

const OPERATORS = new Set(['+', '-', '*', '/', '%', '^'])

/**
 * Ifodani tokenlarga ajratadi va YOPIQ ko'paytirishni (`*`) qo'shadi:
 * `2x`, `2(x+1)`, `(x+1)(x-1)`, `2pi`, `2sin(x)`.
 *
 * Funksiya identifikatori keyin `(` bilan kelsa — chaqiruv (`sin(x)`),
 * ident bilan kelsa — qavssiz chaqiruv (`sin x`, `sqrt x`) — `*` QO'YILMAYDI.
 */
export function tokenize(input: string): Token[] {
  const src = normalizeExpression(input)
  if (src.trim().length === 0) throw new ExprError('empty', 0)
  if (src.length > 200) throw new ExprError('too_long', 200)

  const raw: Token[] = []
  let i = 0

  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t') { i++ ; continue }

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      const start = i
      while (i < src.length && ((src[i] >= '0' && src[i] <= '9') || src[i] === '.')) i++
      const text = src.slice(start, i)
      if (text === '.' || (text.match(/\./g)?.length ?? 0) > 1) {
        throw new ExprError('unexpected_token', start, text)
      }
      raw.push({ type: 'num', value: text, pos: start })
      continue
    }

    if (/[a-z_]/.test(ch)) {
      const start = i
      while (i < src.length && /[a-z0-9_]/.test(src[i])) i++
      raw.push({ type: 'ident', value: src.slice(start, i), pos: start })
      continue
    }

    if (ch === '(') { raw.push({ type: 'lparen', value: ch, pos: i }); i++; continue }
    if (ch === ')') { raw.push({ type: 'rparen', value: ch, pos: i }); i++; continue }
    if (ch === ',') { raw.push({ type: 'comma', value: ch, pos: i }); i++; continue }
    if (OPERATORS.has(ch)) { raw.push({ type: 'op', value: ch, pos: i }); i++; continue }

    throw new ExprError('unexpected_token', i, ch)
  }

  return insertImplicitMultiplication(raw)
}

function insertImplicitMultiplication(tokens: Token[]): Token[] {
  const out: Token[] = []
  for (const t of tokens) {
    const prev = out[out.length - 1]
    if (prev && needsMultiplication(prev, t)) {
      out.push({ type: 'op', value: '*', pos: t.pos })
    }
    out.push(t)
  }
  return out
}

function needsMultiplication(prev: Token, next: Token): boolean {
  const prevValue = prev.type === 'num' || prev.type === 'ident' || prev.type === 'rparen'
  const nextValue = next.type === 'num' || next.type === 'ident' || next.type === 'lparen'
  if (!prevValue || !nextValue) return false

  if (prev.type === 'ident' && isFunctionName(prev.value)) {
    if (next.type === 'lparen') return false
    if (next.type === 'num' || next.type === 'ident') return false
  }
  if (prev.type === 'num' && next.type === 'num') return false
  return true
}
