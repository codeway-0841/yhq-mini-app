/**
 * Xavfsiz kalkulyator ifoda hisoblagichi.
 * `eval` yoki `Function` konstruktoridan foydalanilmaydi.
 * Operatorlar ustuvorligi (Shunting-yard algoritmi asosida) bo'yicha hisoblaydi.
 */

export interface CalculatorState {
  expression: string
  display: string
  hasResult: boolean
}

export function initialCalculatorState(): CalculatorState {
  return {
    expression: '',
    display: '0',
    hasResult: false,
  }
}

/**
 * IEEE 754 float xatoliklarini to'g'rilash (masalan 0.1 + 0.2 = 0.30000000000000004 -> 0.3)
 */
export function formatCalculatorNumber(num: number): string {
  if (!Number.isFinite(num)) {
    if (Number.isNaN(num)) return 'Xato'
    return num > 0 ? 'Cheksiz' : '-Cheksiz'
  }
  const abs = Math.abs(num)
  if (abs !== 0 && (abs < 1e-7 || abs >= 1e12)) {
    return num.toExponential(6).replace(/\.?0+e/, 'e')
  }
  return Number(num.toPrecision(12)).toString()
}

type TokenType = 'num' | 'op' | 'lparen' | 'rparen'
interface Token {
  type: TokenType
  value: string
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const clean = expr.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/')

  while (i < clean.length) {
    const ch = clean[i]

    if (/\d|\./.test(ch)) {
      let numStr = ''
      while (i < clean.length && (/\d|\./.test(clean[i]))) {
        numStr += clean[i]
        i++
      }
      tokens.push({ type: 'num', value: numStr })
      continue
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '^') {
      if (ch === '-' && (tokens.length === 0 || tokens[tokens.length - 1].type === 'op' || tokens[tokens.length - 1].type === 'lparen')) {
        let numStr = '-'
        i++
        while (i < clean.length && (/\d|\./.test(clean[i]))) {
          numStr += clean[i]
          i++
        }
        if (numStr === '-') {
          tokens.push({ type: 'op', value: '-' })
        } else {
          tokens.push({ type: 'num', value: numStr })
        }
        continue
      }
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch })
      i++
      continue
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch })
      i++
      continue
    }

    i++
  }

  return tokens
}

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
  '^': 3,
}

export function evaluateExpression(expr: string): number {
  const tokens = tokenize(expr)
  if (tokens.length === 0) return 0

  const outputQueue: Token[] = []
  const opStack: Token[] = []

  for (const token of tokens) {
    if (token.type === 'num') {
      outputQueue.push(token)
    } else if (token.type === 'op') {
      while (
        opStack.length > 0 &&
        opStack[opStack.length - 1].type === 'op' &&
        PRECEDENCE[opStack[opStack.length - 1].value] >= PRECEDENCE[token.value]
      ) {
        outputQueue.push(opStack.pop()!)
      }
      opStack.push(token)
    } else if (token.type === 'lparen') {
      opStack.push(token)
    } else if (token.type === 'rparen') {
      while (opStack.length > 0 && opStack[opStack.length - 1].type !== 'lparen') {
        outputQueue.push(opStack.pop()!)
      }
      if (opStack.length > 0 && opStack[opStack.length - 1].type === 'lparen') {
        opStack.pop()
      }
    }
  }

  while (opStack.length > 0) {
    const top = opStack.pop()!
    if (top.type !== 'lparen' && top.type !== 'rparen') {
      outputQueue.push(top)
    }
  }

  const evalStack: number[] = []

  for (const token of outputQueue) {
    if (token.type === 'num') {
      const val = parseFloat(token.value)
      evalStack.push(Number.isNaN(val) ? 0 : val)
    } else if (token.type === 'op') {
      const b = evalStack.pop() ?? 0
      const a = evalStack.pop() ?? 0

      switch (token.value) {
        case '+': evalStack.push(a + b); break
        case '-': evalStack.push(a - b); break
        case '*': evalStack.push(a * b); break
        case '/':
          if (b === 0) throw new Error('Division by zero')
          evalStack.push(a / b)
          break
        case '%': evalStack.push(a * (b / 100)); break
        case '^': evalStack.push(Math.pow(a, b)); break
        default: evalStack.push(0)
      }
    }
  }

  if (evalStack.length === 0) return 0
  return evalStack[evalStack.length - 1]
}
