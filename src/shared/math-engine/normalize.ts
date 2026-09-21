/**
 * Shared math engine — aniq (exact) simvolik normalizatsiya + baholash (Faza 2).
 *
 * Prinsip: exact isbot TOR, sampling KENG. Bu yerda faqat domain'o'zgartirmaydigan
 * xavfsiz qoidalar: konstant folding, neytral/absorbsiya elementlari, kommutativ
 * kanonik tartib (+,*), `log_b(b)=1`, `log_b(1)=0`. Keng log xossalari
 * (`log(ab)=...`) sampling orqali `probably_correct` beradi — exact emas.
 */

import type { MathNode } from './ast'

export type Scope = Record<string, number>

function fn1(fn: (x: number) => number, args: number[]): number {
  return fn(args[0])
}

/**
 * Parsial (qisman-aniqlangan) operator/funksiyalar to'plami.
 * P1-B: `tan/cot/sec/csc` ham partial (izolyatsiyalangan singulyarliklar —
 * exact absorbsiyada yo'qoladi). `pow`/`mod` maxsus qoida bilan (pastda).
 */
const PARTIAL_CALLS = new Set([
  'log', 'ln', 'log10', 'log2', 'lg', 'sqrt', 'asin', 'acos',
  'tan', 'cot', 'sec', 'csc',
])

export function evaluate(node: MathNode, scope: Scope): number {
  switch (node.type) {
    case 'num': return node.value
    case 'const': return node.value
    case 'var': {
      const v = scope[node.name]
      return v === undefined ? NaN : v
    }
    case 'unary': {
      const a = evaluate(node.arg, scope)
      return node.op === '-' ? -a : a
    }
    case 'binary': {
      const l = evaluate(node.left, scope)
      const r = evaluate(node.right, scope)
      switch (node.op) {
        case '+': return l + r
        case '-': return l - r
        case '*': return l * r
        case '/': return l / r
        case '%': return l % r
        // 0^0 matematikada aniqlanmagan (domain.ts zero_to_zero bilan mos);
        // JS `0**0=1` bermasligi uchun ataylab NaN.
        case '^': return l === 0 && r === 0 ? NaN : l ** r
      }
      return NaN
    }
    case 'call': {
      const a = node.args.map((x) => evaluate(x, scope))
      switch (node.name) {
        case 'sin': return fn1(Math.sin, a)
        case 'cos': return fn1(Math.cos, a)
        case 'tan': return fn1(Math.tan, a)
        case 'cot': return 1 / Math.tan(a[0])
        case 'sec': return 1 / Math.cos(a[0])
        case 'csc': return 1 / Math.sin(a[0])
        case 'asin': return fn1(Math.asin, a)
        case 'acos': return fn1(Math.acos, a)
        case 'atan': return fn1(Math.atan, a)
        case 'atan2': return Math.atan2(a[0], a[1])
        case 'sinh': return fn1(Math.sinh, a)
        case 'cosh': return fn1(Math.cosh, a)
        case 'tanh': return fn1(Math.tanh, a)
        case 'ln': return fn1(Math.log, a)
        case 'log':
          // log(x) = o'nli logarifm; log(base, value) = asosli logarifm
          if (a.length === 2) return Math.log(a[1]) / Math.log(a[0])
          return fn1(Math.log10, a)
        case 'log10': return fn1(Math.log10, a)
        case 'log2': return fn1(Math.log2, a)
        case 'lg': return fn1(Math.log10, a)
        case 'sqrt': return fn1(Math.sqrt, a)
        case 'cbrt': return fn1(Math.cbrt, a)
        case 'abs': return fn1(Math.abs, a)
        case 'exp': return fn1(Math.exp, a)
        case 'floor': return fn1(Math.floor, a)
        case 'ceil': return fn1(Math.ceil, a)
        case 'round': return fn1(Math.round, a)
        case 'sign': return fn1(Math.sign, a)
        case 'min': return Math.min(...a)
        case 'max': return Math.max(...a)
        case 'mod': return a[0] % a[1]
        // P1-B: pow(0,0) JS'da 1 beradi — matematikada aniqlanmagan → NaN
        // (`^` binary bilan bir xil qoida; domain.ts zero_to_zero bilan mos).
        case 'pow': return a[0] === 0 && a[1] === 0 ? NaN : a[0] ** a[1]
        case 'hypot': return Math.hypot(...a)
        default: return NaN
      }
    }
  }
}

function isNum(n: MathNode, v?: number): n is { type: 'num'; value: number } {
  return n.type === 'num' && (v === undefined || n.value === v)
}

/**
 * Konstant-fold bo'ladigan qiymat (num/const/unary/binary/const-call zanjiri).
 * Domain tekshiruvi ham shu funksiyadan foydalanadi (yagona manba).
 */
export function constValue(n: MathNode): number | null {
  if (n.type === 'num') return n.value
  if (n.type === 'const') return n.value
  if (n.type === 'unary') {
    const v = constValue(n.arg)
    return v === null ? null : n.op === '-' ? -v : v
  }
  if (n.type === 'binary') {
    const l = constValue(n.left)
    const r = constValue(n.right)
    if (l === null || r === null) return null
    const v = evaluate(n, {})
    return Number.isFinite(v) ? v : null
  }
  if (n.type === 'call' && n.args.every((a) => constValue(a) !== null)) {
    const v = evaluate(n, {})
    return Number.isFinite(v) ? v : null
  }
  return null
}

/**
 * Daraja total qoidasi (P1-B: `^` binary va `pow()` call BIR XIL qoida).
 * - 0-daraja: faqat noldan farqli konstanta baza (0^0 tuynuk).
 * - Butun musbat daraja: baza total bo'lsa (x^2).
 * - Musbat konstanta baza: daraja total bo'lsa (2^x).
 */
export function powTotalByRule(base: MathNode, exp: MathNode): boolean {
  if (exp.type === 'num' && Number.isInteger(exp.value) && exp.value === 0) {
    return (base.type === 'num' || base.type === 'const') && base.value !== 0
  }
  if (exp.type === 'num' && Number.isInteger(exp.value) && exp.value > 0) return isTotal(base)
  if (base.type === 'num' && base.value > 0) return isTotal(exp)
  return false
}

/**
 * Hamma haqiqiy nuqtada aniqlanganmi? Exact absorbsiya/cancellation
 * (`x*0→0`, `x-x→0`, `x^0→1`, log xossalari) FAQAT total operandda xavfsiz:
 * `0*(1/x)`, `(1/x)-(1/x)`, `(1/x)^0` singulyar nuqtalarni yo'qotadi.
 */
export function isTotal(n: MathNode): boolean {
  switch (n.type) {
    case 'num': case 'var': case 'const': return true
    case 'unary': return isTotal(n.arg)
    case 'call': {
      // P1-B: pow/mod maxsus; PARTIAL blanket (const-arg'lar folding'da ketadi)
      if (n.name === 'pow' && n.args.length === 2) return powTotalByRule(n.args[0], n.args[1])
      if (n.name === 'mod' && n.args.length === 2) {
        const d = constValue(n.args[1])
        return d !== null && d !== 0 && isTotal(n.args[0]) && isTotal(n.args[1])
      }
      return !PARTIAL_CALLS.has(n.name) && n.args.every(isTotal)
    }
    case 'binary': {
      // Noldan farqli konstanta maxraj total (2, 3) — exclusions() bilan mos (P1-A).
      if (n.op === '/' || n.op === '%') {
        const d = constValue(n.right)
        if (d !== null && d !== 0) return isTotal(n.left) && isTotal(n.right)
        return false
      }
      if (n.op === '^') return powTotalByRule(n.left, n.right)
      return isTotal(n.left) && isTotal(n.right)
    }
  }
}

/** Log asosi exact-qoida uchun yaroqlimi (konstanta, >0, ≠1) */
export function validConstBase(b: MathNode): boolean {
  const v = constValue(b)
  return v !== null && v > 0 && v !== 1
}

/** Kanonik kalit — kommutativ tartiblash uchun barqaror string */
function keyOf(n: MathNode): string {
  switch (n.type) {
    case 'num': return `n${n.value}`
    case 'var': return `v${n.name}`
    case 'const': return `c${n.name}`
    case 'unary': return `u${n.op}(${keyOf(n.arg)})`
    case 'binary': return `b${n.op}(${keyOf(n.left)},${keyOf(n.right)})`
    case 'call': return `f${n.name}(${n.args.map(keyOf).join(',')})`
  }
}

function flatten(op: '+' | '*', n: MathNode): MathNode[] {
  if (n.type === 'binary' && n.op === op) return [...flatten(op, n.left), ...flatten(op, n.right)]
  return [n]
}

function rebuild(op: '+' | '*', terms: MathNode[]): MathNode {
  const sorted = [...terms].sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0))
  let acc = sorted[0]
  for (let i = 1; i < sorted.length; i++) acc = { type: 'binary', op, left: acc, right: sorted[i] }
  return acc
}

function once(n: MathNode): MathNode {
  switch (n.type) {
    case 'num': case 'var': case 'const': return n
    case 'unary': {
      const arg = once(n.arg)
      if (n.op === '+') return arg
      if (arg.type === 'unary' && arg.op === '-') return arg.arg
      if (isNum(arg)) return { type: 'num', value: -arg.value }
      return { type: 'unary', op: '-', arg }
    }
    case 'call': {
      const args = n.args.map(once)
      // log_b(b) = 1, log_b(1) = 0 — FAQAT baza konstanta-valid bo'lsa.
      // `log(x,x)→1` x≤0/x=1 da yaroqsiz (P1-1): baza isbotlanmagan → skip.
      if ((n.name === 'log' && args.length === 2) || n.name === 'log2' || n.name === 'log10' || n.name === 'lg' || n.name === 'ln') {
        const baseName = n.name === 'ln' ? 'e' : n.name === 'log2' ? '2' : n.name === 'lg' || n.name === 'log10' ? '10' : null
        if (n.name === 'log' && args.length === 2) {
          const [b, v] = args
          if (validConstBase(b) && keyOf(b) === keyOf(v)) return { type: 'num', value: 1 }
          if (validConstBase(b) && isNum(v, 1)) return { type: 'num', value: 0 }
        } else if (baseName && args.length === 1) {
          const [v] = args
          const baseNode: MathNode = baseName === 'e'
            ? { type: 'const', name: 'e', value: Math.E }
            : { type: 'num', value: Number(baseName) }
          if (keyOf(baseNode) === keyOf(v)) return { type: 'num', value: 1 }
          if (isNum(v, 1)) return { type: 'num', value: 0 }
        }
      }
      // EHTIYOT: `every(isNum)` yozilmaydi — every index'ni 2-arg (v) sifatida
      // uzatadi va folding amalda o'ladi. Aniq lambda shart.
      if (args.every((a): a is { type: 'num'; value: number } => isNum(a))) {
        // P1-B: pow(0,0) fold QILINMAYDI (0^0 aniqlanmagan — domain flag uchun)
        const argsNum = args as { type: 'num'; value: number }[]
        if (n.name === 'pow' && argsNum[0]?.value === 0 && argsNum[1] !== undefined && argsNum[1].value <= 0) {
          return { type: 'call', name: n.name, args }
        }
        const v = evaluate({ type: 'call', name: n.name, args }, {})
        if (Number.isFinite(v)) return { type: 'num', value: v }
      }
      return { type: 'call', name: n.name, args }
    }
    case 'binary': {
      const l = once(n.left)
      const r = once(n.right)
      // Son qiymatlar bir marta olinadi (isNum guard-zanjiri TS narrowing'ni
      // `never`ga tushiradi — discriminant orqali to'g'ridan-to'g'ri).
      const lNum = l.type === 'num' ? l.value : null
      const rNum = r.type === 'num' ? r.value : null
      // Konstant folding — lekin 0^0/0^manfiy fold QILINMAYDI (domain flag uchun)
      if (lNum !== null && rNum !== null) {
        if (!(n.op === '^' && lNum === 0 && rNum <= 0)) {
          const v = evaluate({ type: 'binary', op: n.op, left: l, right: r }, {})
          if (Number.isFinite(v)) return { type: 'num', value: v }
        }
      }
      switch (n.op) {
        case '+': {
          if (rNum === 0) return l
          if (lNum === 0) return r
          return rebuild('+', [...flatten('+', l), ...flatten('+', r)])
        }
        case '-': {
          if (rNum === 0) return l
          // x-x→0 FAQAT total x da: (1/x)-(1/x) singulyarlikni yo'qotadi (P1-2)
          if (isTotal(l) && keyOf(l) === keyOf(r)) return { type: 'num', value: 0 }
          return { type: 'binary', op: '-', left: l, right: r }
        }
        case '*': {
          // Absorbsiya FAQAT total tomonda: 0*(1/x) x=0 da aniqlanmagan (P1-2)
          if (lNum === 0) return isTotal(r) ? { type: 'num', value: 0 } : { type: 'binary', op: '*', left: l, right: r }
          if (rNum === 0) return isTotal(l) ? { type: 'num', value: 0 } : { type: 'binary', op: '*', left: l, right: r }
          if (rNum === 1) return l
          if (lNum === 1) return r
          if (lNum === -1) return { type: 'unary', op: '-', arg: r }
          if (rNum === -1) return { type: 'unary', op: '-', arg: l }
          return rebuild('*', [...flatten('*', l), ...flatten('*', r)])
        }
        case '/': {
          if (rNum === 1) return l
          // 0/x→0 YO'Q (const-fold yetarli): 0/x x=0 da aniqlanmagan (P1-2).
          // EHTIYOT (x/x): bir xil surat/maxrajni 1 ga fold QILMAYMIZ —
          // x=0 da domain farq qiladi (x/x aniqlanmagan, 1 aniqlangan).
          // Ekvivalentlik sampling orqali `probably_correct` beradi, `correct` emas.
          return { type: 'binary', op: '/', left: l, right: r }
        }
        case '^': {
          // x^0→1 FAQAT noldan farqli KONSTANTA bazada: var (x^0) x=0 da
          // 0^0 tuynukka tushadi (P1-2). (2^0 kabi const'lar folding'da ketadi.)
          if (r.type === 'num' && r.value === 0) {
            const nonzeroConst = (l.type === 'num' || l.type === 'const') && l.value !== 0
            return nonzeroConst
              ? { type: 'num', value: 1 }
              : { type: 'binary', op: '^', left: l, right: r }
          }
          if (rNum === 1) return l
          if (lNum === 1) return { type: 'num', value: 1 }
          // 0^x→0 FAQAT musbat konstanta darajada (0^manfiy aniqlanmagan)
          if (lNum === 0) {
            return rNum !== null && rNum > 0
              ? { type: 'num', value: 0 }
              : { type: 'binary', op: '^', left: l, right: r }
          }
          return { type: 'binary', op: '^', left: l, right: r }
        }
        case '%': return { type: 'binary', op: '%', left: l, right: r }
        }
      }
    }
}

/** Fiks-nuqtagacha (maks 25 iteratsiya) — exact kanonik forma */
export function normalize(node: MathNode): MathNode {
  let cur = node
  for (let i = 0; i < 25; i++) {
    const next = once(cur)
    if (keyOf(next) === keyOf(cur)) return cur
    cur = next
  }
  return cur
}

/** Aniq tenglik — faqat normalize'dan keyin strukturaviy moslik */
export function exactEqual(a: MathNode, b: MathNode): boolean {
  return keyOf(normalize(a)) === keyOf(normalize(b))
}

/** Kanonik kalit (domain-constraint taqqoslash uchun) */
export function canonicalKey(node: MathNode): string {
  return keyOf(normalize(node))
}
