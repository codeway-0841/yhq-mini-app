/**
 * Grafik ifodasini AVTOMATIK aniqlash — foydalanuvchi rejim tanlamaydi:
 *
 *   sin(x)              → y = f(x)
 *   y = sin(x)          → y = f(x)   (LHS y/f(x)/f(t) tashlanadi)
 *   r = 2sin(3θ)        → polyar   r(θ)
 *   x=cos(t); y=sin(t)  → parametrik (x(t), y(t)), `;` bilan ajratiladi
 *   x^2 + y^2 = 1       → implicit (kontur)
 *   x^2 + y^2 < 1       → tengsizlik (soha bo'yaladi)
 *
 * Taqqoslash belgilari faqat qavs tashqarisida (depth 0) hisobga olinadi.
 */
import { parseExpression } from './parse'
import { compileAst, type CompiledExpression } from './compile'
import { ExprError } from './errors'
import { normalizeExpression } from './normalize'

export type Relation = '=' | '<' | '>' | '<=' | '>='
export type GraphExprKind = 'y' | 'polar' | 'parametric' | 'implicit'

export type ParsedGraphExpression =
  | { kind: 'y'; fn: CompiledExpression; vars: string[] }
  | { kind: 'polar'; fn: CompiledExpression; vars: string[]; angleVar: string }
  | { kind: 'parametric'; xFn: CompiledExpression; yFn: CompiledExpression; vars: string[]; paramVar: string }
  | { kind: 'implicit'; fn: CompiledExpression; vars: string[]; relation: Relation }

interface TopSplit {
  parts: string[]
  seps: string[]
}

/** Matnni depth-0 separatorlar bo'yicha bo'ladi */
export function splitTopLevel(text: string, separators: string[]): TopSplit {
  const parts: string[] = []
  const seps: string[] = []
  let depth = 0
  let start = 0
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (depth === 0) {
      const two = text.slice(i, i + 2)
      if (separators.includes(two)) {
        parts.push(text.slice(start, i))
        seps.push(two)
        i += 2
        start = i
        continue
      }
      if (separators.includes(ch)) {
        parts.push(text.slice(start, i))
        seps.push(ch)
        i++
        start = i
        continue
      }
    }
    i++
  }
  parts.push(text.slice(start))
  return { parts, seps }
}

export function parseGraphExpression(input: string): ParsedGraphExpression {
  const text = normalizeExpression(input).trim()
  if (!text) throw new ExprError('empty', 0)

  // ── Parametrik: `x=...; y=...` (ikki qism, ikkalasida `=`) ────────────────
  const semi = splitTopLevel(text, [';'])
  if (semi.parts.length > 1) {
    if (semi.parts.length !== 2) throw new ExprError('unexpected_token', 0, ';')
    const lhsNames = semi.parts.map((p) => {
      const eq = splitTopLevel(p, ['='])
      return eq.parts.length === 2 ? eq.parts[0].trim() : null
    })
    const [l0, l1] = lhsNames
    const isParametric = l0 !== null && l1 !== null &&
      l0 !== l1 && ['x', 'y'].includes(l0) && ['x', 'y'].includes(l1)
    if (!isParametric) throw new ExprError('unexpected_token', 0, ';')

    const parsed = semi.parts.map((p) => {
      const eq = splitTopLevel(p, ['='])
      return parseExpression(eq.parts[1])
    })
    const xIdx = l0 === 'x' ? 0 : 1
    const xParsed = parsed[xIdx]
    const yParsed = parsed[1 - xIdx]
    const vars: string[] = []
    for (const v of [...xParsed.vars, ...yParsed.vars]) if (!vars.includes(v)) vars.push(v)
    const xFn = compileAst(xParsed.node)
    const yFn = compileAst(yParsed.node)
    return { kind: 'parametric', xFn, yFn, vars, paramVar: vars[0] ?? 't' }
  }

  // ── Taqqoslash: `=`, `<`, `>`, `<=`, `>=` ─────────────────────────────────
  const cmp = splitTopLevel(text, ['<=', '>=', '=', '<', '>'])
  if (cmp.parts.length > 2) throw new ExprError('unexpected_token', 0, cmp.seps[0])
  if (cmp.parts.length === 2) {
    const lhs = cmp.parts[0].trim()
    const rhs = cmp.parts[1].trim()
    const relation = cmp.seps[0] as Relation
    if (!lhs || !rhs) throw new ExprError('unexpected_token', 0, relation)

    const rhsParsed = parseExpression(rhs)

    if (relation === '=' && lhs === 'r') {
      return {
        kind: 'polar',
        fn: compileAst(rhsParsed.node),
        vars: rhsParsed.vars,
        angleVar: rhsParsed.vars[0] ?? 'theta',
      }
    }

    if (relation === '=' && (lhs === 'y' || /^f(\(.*\))?$/.test(lhs))) {
      return { kind: 'y', fn: compileAst(rhsParsed.node), vars: rhsParsed.vars }
    }

    // Implicit/tengsizlik: F = lhs − rhs, shart F (rel) 0
    const lhsParsed = parseExpression(lhs)
    const lhsFn = compileAst(lhsParsed.node)
    const rhsFn = compileAst(rhsParsed.node)
    const diff: CompiledExpression = (scope) => lhsFn(scope) - rhsFn(scope)
    const vars: string[] = []
    for (const v of [...lhsParsed.vars, ...rhsParsed.vars]) if (!vars.includes(v)) vars.push(v)
    return { kind: 'implicit', fn: diff, vars, relation }
  }

  // ── Oddiy y = f(x) ────────────────────────────────────────────────────────
  const parsed = parseExpression(text)
  return { kind: 'y', fn: compileAst(parsed.node), vars: parsed.vars }
}

/** Ifodaning asosiy o'zgaruvchisi (slayderlar uchun emas) */
export function axisVarsOf(parsed: ParsedGraphExpression): string[] {
  switch (parsed.kind) {
    case 'implicit': return ['x', 'y']
    case 'parametric': return [parsed.paramVar]
    case 'polar': return [parsed.angleVar]
    case 'y': return []
  }
}
