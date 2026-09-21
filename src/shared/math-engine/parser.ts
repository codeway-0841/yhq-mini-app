/**
 * Shared math engine — parser (Faza 2).
 *
 * Graph parseridan G'OYA olingan, lekin kod mustaqil (qoida 1a: feature'dan
 * import YO'Q). Vaqtinchalik duplikatsiya — graph'ni shu engine'ga ko'chirish
 * TODO sifatida index.ts'da qayd etilgan; conformance test uni qo'riqlaydi.
 *
 * Qo'llab-quvvatlash: sonlar, o'zgaruvchilar, pi/e, + - * / % ^, qavslar,
 * funksiyalar (sin cos tan cot sec csc asin acos atan atan2 sinh cosh tanh
 * ln log log10 log2 sqrt cbrt abs exp floor ceil round sign min max mod pow
 * hypot), `log(base, value)` ikki-argumentli overload, yashirin ko'paytirish
 * (`2x`, `2(x+1)`), bitta `=` bilan tenglama. Zanjirli `a=b=c` — syntax_error.
 */

import { ENGINE_LIMITS, type BinaryOp, type MathNode, type StepNode } from './ast'

export type EngineParseErrorCode = 'empty' | 'too_long' | 'too_complex' | 'syntax_error'

export class EngineParseError extends Error {
  readonly code: EngineParseErrorCode
  readonly pos: number
  constructor(code: EngineParseErrorCode, pos: number, message: string) {
    super(message)
    this.name = 'EngineParseError'
    this.code = code
    this.pos = pos
  }
}

const CHAR_MAP: Record<string, string> = {
  'π': 'pi ', '×': '*', '·': '*', '⋅': '*', '÷': '/', '−': '-', '–': '-', '—': '-',
  '√': 'sqrt ', '²': '^2', '³': '^3', '¹': '^1', '⁰': '^0', '⁴': '^4',
  '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
  'θ': 'theta', 'ω': 'omega', 'α': 'alpha', 'β': 'beta', 'γ': 'gamma',
  'δ': 'delta', 'Δ': 'delta', 'λ': 'lambda', 'μ': 'mu', 'ρ': 'rho',
  'σ': 'sigma', 'τ': 'tau', 'φ': 'phi',
}

export function normalizeInput(input: string): string {
  const chars = Array.from(input)
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch === '*' && chars[i + 1] === '*') { out += '^'; i++; continue }
    const mapped = CHAR_MAP[ch]
    if (mapped !== undefined) out += mapped
    else if (ch >= 'A' && ch <= 'Z') out += ch.toLowerCase()
    else out += ch
  }
  return out
}

const FUNCTION_ARITY: Record<string, { min: number; max: number }> = {
  sin: { min: 1, max: 1 }, cos: { min: 1, max: 1 }, tan: { min: 1, max: 1 },
  cot: { min: 1, max: 1 }, sec: { min: 1, max: 1 }, csc: { min: 1, max: 1 },
  asin: { min: 1, max: 1 }, acos: { min: 1, max: 1 }, atan: { min: 1, max: 1 },
  atan2: { min: 2, max: 2 }, sinh: { min: 1, max: 1 }, cosh: { min: 1, max: 1 },
  tanh: { min: 1, max: 1 }, ln: { min: 1, max: 1 },
  log: { min: 1, max: 2 }, log10: { min: 1, max: 1 }, log2: { min: 1, max: 1 },
  lg: { min: 1, max: 1 }, sqrt: { min: 1, max: 1 }, cbrt: { min: 1, max: 1 },
  abs: { min: 1, max: 1 }, exp: { min: 1, max: 1 }, floor: { min: 1, max: 1 },
  ceil: { min: 1, max: 1 }, round: { min: 1, max: 1 }, sign: { min: 1, max: 1 },
  min: { min: 2, max: 8 }, max: { min: 2, max: 8 }, mod: { min: 2, max: 2 },
  pow: { min: 2, max: 2 }, hypot: { min: 1, max: 4 },
}

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E }

function isFunctionName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(FUNCTION_ARITY, name)
}

function isConstantName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONSTANTS, name)
}

type TokenType = 'num' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma'
interface Token { type: TokenType; value: string; pos: number }

const OPERATORS = new Set(['+', '-', '*', '/', '%', '^'])

function tokenize(src: string): Token[] {
  const raw: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t') { i++; continue }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      const start = i
      while (i < src.length && ((src[i] >= '0' && src[i] <= '9') || src[i] === '.')) i++
      const text = src.slice(start, i)
      if (text === '.' || (text.match(/\./g)?.length ?? 0) > 1) {
        throw new EngineParseError('syntax_error', start, `Yaroqsiz son: ${text}`)
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
    throw new EngineParseError('syntax_error', i, `Kutilmagan belgi: ${ch}`)
  }
  return insertImplicitMultiplication(raw)
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

function insertImplicitMultiplication(tokens: Token[]): Token[] {
  const out: Token[] = []
  for (const t of tokens) {
    const prev = out[out.length - 1]
    if (prev && needsMultiplication(prev, t)) out.push({ type: 'op', value: '*', pos: t.pos })
    out.push(t)
  }
  return out
}

/** `=` ni faqat depth-0 da ajratadi (qavs ichidagi `=` yo'q — syntax_error) */
function splitTopLevelEquals(src: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === '=' && depth === 0) {
      parts.push(src.slice(start, i))
      start = i + 1
    }
  }
  parts.push(src.slice(start))
  return parts
}

const BP_ADD = 10
const BP_MUL = 20
const BP_UNARY = 25
const BP_POW = 30

function bpOf(op: string): number {
  switch (op) {
    case '+': case '-': return BP_ADD
    case '*': case '/': case '%': return BP_MUL
    case '^': return BP_POW
    default: return -1
  }
}

function parseExpressionTokens(tokens: Token[], sourceLength: number): MathNode {
  let idx = 0
  let nodeCount = 0
  const peek = (): Token | undefined => tokens[idx]
  const next = (): Token | undefined => tokens[idx++]
  const make = <T extends MathNode>(n: T): T => {
    if (++nodeCount > ENGINE_LIMITS.maxNodes) {
      throw new EngineParseError('too_complex', 0, 'Ifoda juda murakkab')
    }
    return n
  }

  function parseExpr(minBp: number, depth: number): MathNode {
    if (depth > ENGINE_LIMITS.maxDepth) {
      throw new EngineParseError('too_complex', 0, 'Ifoda juda chuqur')
    }
    const t = next()
    if (!t) throw new EngineParseError('syntax_error', sourceLength, 'Ifoda tugallanmagan')

    let left: MathNode
    if (t.type === 'num') {
      left = make({ type: 'num', value: Number(t.value) })
    } else if (t.type === 'ident') {
      if (isFunctionName(t.value)) {
        const def = FUNCTION_ARITY[t.value]
        if (peek()?.type === 'lparen') {
          next()
          const args: MathNode[] = []
          if (peek()?.type !== 'rparen') {
            args.push(parseExpr(0, depth + 1))
            while (peek()?.type === 'comma') {
              next()
              args.push(parseExpr(0, depth + 1))
            }
          }
          const close = next()
          if (!close || close.type !== 'rparen') {
            throw new EngineParseError('syntax_error', close?.pos ?? sourceLength, 'Qavs yopilmagan')
          }
          if (args.length < def.min || args.length > def.max) {
            throw new EngineParseError('syntax_error', t.pos, `Noto'g'ri argument soni: ${t.value}`)
          }
          left = make({ type: 'call', name: t.value, args })
        } else {
          if (def.min > 1) throw new EngineParseError('syntax_error', t.pos, `Qavs kerak: ${t.value}`)
          const arg = parseExpr(BP_UNARY, depth + 1)
          left = make({ type: 'call', name: t.value, args: [arg] })
        }
      } else if (isConstantName(t.value)) {
        left = make({ type: 'const', name: t.value, value: CONSTANTS[t.value] })
      } else {
        left = make({ type: 'var', name: t.value })
      }
    } else if (t.type === 'lparen') {
      left = parseExpr(0, depth + 1)
      const close = next()
      if (!close || close.type !== 'rparen') {
        throw new EngineParseError('syntax_error', close?.pos ?? sourceLength, 'Qavs yopilmagan')
      }
    } else if (t.type === 'op' && (t.value === '-' || t.value === '+')) {
      const arg = parseExpr(BP_UNARY, depth + 1)
      left = t.value === '-' ? make({ type: 'unary', op: '-', arg }) : arg
    } else {
      throw new EngineParseError('syntax_error', t.pos, `Kutilmagan belgi: ${t.value}`)
    }

    for (;;) {
      const nxt = peek()
      if (!nxt || nxt.type !== 'op') break
      const bp = bpOf(nxt.value)
      if (bp <= minBp) break
      next()
      const right = parseExpr(nxt.value === '^' ? bp - 1 : bp, depth + 1)
      left = make({ type: 'binary', op: nxt.value as BinaryOp, left, right })
    }
    return left
  }

  const node = parseExpr(0, 0)
  const trailing = peek()
  if (trailing) throw new EngineParseError('syntax_error', trailing.pos, `Ortiqcha belgi: ${trailing.value}`)
  return node
}

/** Qadam parse: ifoda yoki bitta `=` li tenglama */
export function parseStep(input: string): StepNode {
  const normalized = normalizeInput(input)
  if (normalized.trim().length === 0) throw new EngineParseError('empty', 0, 'Ifoda bo‘sh')
  if (normalized.length > ENGINE_LIMITS.maxInputLength) {
    throw new EngineParseError('too_long', ENGINE_LIMITS.maxInputLength, 'Ifoda juda uzun')
  }
  const parts = splitTopLevelEquals(normalized)
  if (parts.length > 2) {
    throw new EngineParseError('syntax_error', 0, 'Zanjirli tenglik qo‘llanmaydi (a=b=c)')
  }
  if (parts.length === 2) {
    const left = parseExpressionTokens(tokenize(parts[0]), normalized.length)
    const right = parseExpressionTokens(tokenize(parts[1]), normalized.length)
    return { kind: 'equation', left, right }
  }
  return { kind: 'expr', node: parseExpressionTokens(tokenize(normalized), normalized.length) }
}
