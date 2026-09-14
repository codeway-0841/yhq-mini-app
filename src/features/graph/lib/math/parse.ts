import { ExprError } from './errors'
import { tokenize, type Token } from './tokenize'
import { FUNCTIONS, CONSTANTS, isFunctionName, isConstantName } from './builtins'

export type BinaryOp = '+' | '-' | '*' | '/' | '%' | '^'

export type ExprNode =
  | { type: 'num'; value: number }
  | { type: 'const'; name: string; value: number }
  | { type: 'var'; name: string }
  | { type: 'unary'; op: '-' | '+'; arg: ExprNode }
  | { type: 'binary'; op: BinaryOp; left: ExprNode; right: ExprNode }
  | { type: 'call'; name: string; args: ExprNode[] }

export interface ParsedExpression {
  node: ExprNode
  /** Erkin o'zgaruvchilar (slayder uchun) — paydo bo'lish tartibida */
  vars: string[]
}

const BP_ADD = 10
const BP_MUL = 20
const BP_UNARY = 25
const BP_POW = 30

const MAX_NODES = 500
const MAX_DEPTH = 80

function bpOf(op: string): number {
  switch (op) {
    case '+': case '-': return BP_ADD
    case '*': case '/': case '%': return BP_MUL
    case '^': return BP_POW
    default: return -1
  }
}

export function parseExpression(input: string): ParsedExpression {
  const tokens = tokenize(input)
  const sourceLength = input.length
  let idx = 0
  let nodeCount = 0

  const peek = (): Token | undefined => tokens[idx]
  const next = (): Token | undefined => tokens[idx++]
  const make = <T extends ExprNode>(n: T): T => {
    if (++nodeCount > MAX_NODES) throw new ExprError('too_complex', 0)
    return n
  }

  function parseExpr(minBp: number, depth: number): ExprNode {
    if (depth > MAX_DEPTH) throw new ExprError('too_complex', 0)
    const t = next()
    if (!t) throw new ExprError('unexpected_end', sourceLength)

    let left: ExprNode

    if (t.type === 'num') {
      left = make({ type: 'num', value: Number(t.value) })
    } else if (t.type === 'ident') {
      if (isFunctionName(t.value)) {
        const def = FUNCTIONS[t.value]
        if (peek()?.type === 'lparen') {
          next()
          const args: ExprNode[] = []
          if (peek()?.type !== 'rparen') {
            args.push(parseExpr(0, depth + 1))
            while (peek()?.type === 'comma') {
              next()
              args.push(parseExpr(0, depth + 1))
            }
          }
          const close = next()
          if (!close || close.type !== 'rparen') {
            throw new ExprError('unexpected_token', close?.pos ?? sourceLength, close?.value ?? '(')
          }
          if (args.length < def.minArgs || args.length > def.maxArgs) {
            throw new ExprError('arity', t.pos, t.value)
          }
          left = make({ type: 'call', name: t.value, args })
        } else {
          if (def.minArgs > 1) throw new ExprError('arity', t.pos, t.value)
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
        throw new ExprError('unexpected_token', close?.pos ?? sourceLength, close?.value ?? '(')
      }
    } else if (t.type === 'op' && (t.value === '-' || t.value === '+')) {
      const arg = parseExpr(BP_UNARY, depth + 1)
      left = t.value === '-' ? make({ type: 'unary', op: '-', arg }) : arg
    } else {
      throw new ExprError('unexpected_token', t.pos, t.value)
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
  if (trailing) throw new ExprError('unexpected_token', trailing.pos, trailing.value)
  return { node, vars: collectVars(node) }
}

export function collectVars(node: ExprNode): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const walk = (n: ExprNode): void => {
    switch (n.type) {
      case 'var':
        if (!seen.has(n.name)) { seen.add(n.name); out.push(n.name) }
        break
      case 'unary': walk(n.arg); break
      case 'binary': walk(n.left); walk(n.right); break
      case 'call': for (const a of n.args) walk(a); break
      case 'num': case 'const': break
    }
  }
  walk(node)
  return out
}
