/**
 * AST → LaTeX serializatori (KaTeX preview uchun).
 *
 * Konstantalar AST'da `const` tugun sifatida saqlanadi — shu sababli `pi`
 * chiroyli `\pi` bo'lib chiqadi, son qiymati emas. Xato bo'lsa `null`
 * qaytaradi (preview jim yashiriladi).
 */
import { parseExpression, type ExprNode } from './parse'
import { ExprError } from './errors'
import { splitTopLevel } from './graph-expr'
import { normalizeExpression } from './normalize'

const GREEK: Record<string, string> = {
  alpha: '\\alpha',
  beta: '\\beta',
  gamma: '\\gamma',
  delta: '\\delta',
  theta: '\\theta',
  lambda: '\\lambda',
  mu: '\\mu',
  rho: '\\rho',
  sigma: '\\sigma',
  tau: '\\tau',
  phi: '\\phi',
  omega: '\\omega',
}

const TRIG: Record<string, string> = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot',
  sec: '\\sec', csc: '\\csc',
  asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan',
  sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh',
  ln: '\\ln', log: '\\log_{10}', log10: '\\log_{10}', log2: '\\log_{2}',
}

function varToLatex(name: string): string {
  const m = name.match(/^([a-z]+?)(\d+)$/)
  const base = m ? m[1] : name
  const sub = m ? m[2] : null
  const baseTex = GREEK[base] ?? (base.length === 1 ? base : `\\mathrm{${base}}`)
  return sub ? `${baseTex}_{${sub}}` : baseTex
}

function precedence(n: ExprNode): number {
  switch (n.type) {
    case 'binary':
      switch (n.op) {
        case '+': case '-': return 1
        case '*': case '/': case '%': return 2
        case '^': return 3
      }
      return 4
    case 'unary': return 2
    default: return 4
  }
}

function texOf(node: ExprNode): string {
  switch (node.type) {
    case 'num': return String(node.value)
    case 'const': return node.name === 'pi' ? '\\pi' : node.name
    case 'var': return varToLatex(node.name)
    case 'unary': {
      const arg = sub(node.arg, 2.5)
      return node.op === '-' ? `-${arg}` : arg
    }
    case 'binary': {
      const l = node.left
      const r = node.right
      switch (node.op) {
        case '+': return `${sub(l, 1)} + ${sub(r, 1)}`
        case '-': return `${sub(l, 1)} - ${sub(r, 2)}`
        case '*': return `${sub(l, 2)} \\cdot ${sub(r, 3)}`
        case '/': return `\\frac{${texOf(l)}}{${texOf(r)}}`
        case '%': return `${sub(l, 2)} \\bmod ${sub(r, 3)}`
        case '^': return `{${texOf(l)}}^{${texOf(r)}}`
      }
      return ''
    }
    case 'call': {
      const [a0, a1] = node.args
      switch (node.name) {
        case 'sqrt': return `\\sqrt{${texOf(a0)}}`
        case 'cbrt': return `\\sqrt[3]{${texOf(a0)}}`
        case 'abs': return `\\left|${texOf(a0)}\\right|`
        case 'exp': return `e^{${texOf(a0)}}`
        case 'floor': return `\\left\\lfloor ${texOf(a0)} \\right\\rfloor`
        case 'ceil': return `\\left\\lceil ${texOf(a0)} \\right\\rceil`
        case 'pow': return `{${texOf(a0)}}^{${texOf(a1)}}`
        case 'mod': return `${sub(a0, 2)} \\bmod ${sub(a1, 3)}`
        default: break
      }
      const fn = TRIG[node.name] ?? `\\operatorname{${node.name}}`
      const args = node.args.map(texOf).join(',\\;')
      return `${fn}\\left(${args}\\right)`
    }
  }
}

function sub(node: ExprNode, minPrec: number): string {
  const tex = texOf(node)
  return precedence(node) < minPrec ? `\\left(${tex}\\right)` : tex
}

export function astToLatex(node: ExprNode): string {
  return texOf(node)
}

/** Matn → LaTeX (xatoda null) */
export function expressionToLatex(input: string): string | null {
  if (!input.trim()) return null
  try {
    const { node } = parseExpression(input)
    return astToLatex(node)
  } catch (err) {
    if (err instanceof ExprError) return null
    return null
  }
}

/**
 * To'liq grafik ifodasi: `y=...`, `r=...`, `x=...; y=...`, implicit/tengsizlik.
 * Xato bo'lsa null.
 */
export function graphExpressionToLatex(input: string): string | null {
  const text = normalizeExpression(input).trim()
  if (!text) return null

  /** Qismni `lhs = rhs` ko'rinishida ham qo'llab-quvvatlaydi */
  const partTex = (part: string): string | null => {
    const eq = splitTopLevel(part, ['='])
    if (eq.parts.length === 2) {
      const l = expressionToLatex(eq.parts[0])
      const r = expressionToLatex(eq.parts[1])
      if (!l || !r) return null
      return `${l} = ${r}`
    }
    return expressionToLatex(part)
  }

  const semi = splitTopLevel(text, [';'])
  if (semi.parts.length > 1) {
    const parts = semi.parts.map(partTex)
    if (parts.some((p) => p === null)) return null
    return parts.join(',\\quad ')
  }

  const cmp = splitTopLevel(text, ['<=', '>=', '=', '<', '>'])
  if (cmp.parts.length === 2) {
    const left = expressionToLatex(cmp.parts[0])
    const right = expressionToLatex(cmp.parts[1])
    if (!left || !right) return null
    const op: Record<string, string> = { '=': '=', '<': '\\lt', '>': '\\gt', '<=': '\\le', '>=': '\\ge' }
    return `${left} ${op[cmp.seps[0]] ?? '='} ${right}`
  }
  if (cmp.parts.length > 2) return null

  return expressionToLatex(text)
}
