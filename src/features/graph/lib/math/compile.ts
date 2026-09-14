import { FUNCTIONS } from './builtins'
import { parseExpression, type ExprNode } from './parse'
import { ExprError } from './errors'

/** O'zgaruvchi qiymatlari: { x: 1, v0: 5 } */
export type Scope = Record<string, number>

export type CompiledExpression = (scope: Scope) => number

/**
 * AST → closure daraxti. `eval`/`new Function` ISHLATILMAYDI — CSP'ga xavfsiz,
 * WebView'da ham bir xil ishlaydi. Har bir ifoda bir marta kompilyatsiya
 * qilinadi, keyin yuzlab namuna nuqtasi uchun qayta chaqiriladi.
 */
export function compileAst(node: ExprNode): CompiledExpression {
  switch (node.type) {
    case 'num': {
      const v = node.value
      return () => v
    }
    case 'const': {
      const v = node.value
      return () => v
    }
    case 'var': {
      const name = node.name
      return (scope) => {
        const v = scope[name]
        return v === undefined ? NaN : v
      }
    }
    case 'unary': {
      const arg = compileAst(node.arg)
      return node.op === '-' ? (scope) => -arg(scope) : arg
    }
    case 'binary': {
      const l = compileAst(node.left)
      const r = compileAst(node.right)
      switch (node.op) {
        case '+': return (s) => l(s) + r(s)
        case '-': return (s) => l(s) - r(s)
        case '*': return (s) => l(s) * r(s)
        case '/': return (s) => l(s) / r(s)
        case '%': return (s) => l(s) % r(s)
        case '^': return (s) => l(s) ** r(s)
      }
      return () => NaN
    }
    case 'call': {
      const def = FUNCTIONS[node.name]
      if (!def) return () => NaN
      const fns = node.args.map(compileAst)
      const fn = def.fn
      if (fns.length === 1) {
        const a0 = fns[0]
        return (s) => fn(a0(s))
      }
      if (fns.length === 2) {
        const a0 = fns[0]
        const a1 = fns[1]
        return (s) => fn(a0(s), a1(s))
      }
      return (s) => fn(...fns.map((f) => f(s)))
    }
  }
}

/** Qulaylik: matn → { fn, vars } (xatoda ExprError tashlaydi) */
export function compileExpression(input: string): { fn: CompiledExpression; vars: string[] } {
  const { node, vars } = parseExpression(input)
  return { fn: compileAst(node), vars }
}

export { ExprError }
