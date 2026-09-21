/**
 * Shared math engine — domain/assumption tekshiruvi (Faza 2).
 *
 * Faqat KONSTANT-fold bo'ladigan muammolar `domain_error` beradi:
 * nolga bo'lish, log(≤0), log asosi (≤0 yoki =1), manfiy sqrt, 0^0,
 * 0^manfiy, |asin/acos|>1. O'zgaruvchili holatlar (`x/x`, `log(x)`)
 * sampling'da yaroqsiz nuqta sifatida tashlanadi — `unknown` emas, xato emas.
 */

import { canonicalKey, constValue, powTotalByRule } from './normalize'
import { polyExpand } from './poly'
import type { CheckDetail, MathNode, StepNode } from './ast'

export interface DomainIssue {
  code: CheckDetail
  detail: string
}

function isConstNum(n: MathNode): number | null {
  return constValue(n)
}

/** Maxraj aynan nol polinommi (x-x, 2-2)? */
function isZeroPoly(n: MathNode): boolean {
  const p = polyExpand(n)
  return p !== null && p.size === 0
}

function checkNode(n: MathNode, out: DomainIssue[]): void {
  switch (n.type) {
    case 'num': case 'var': case 'const': return
    case 'unary': checkNode(n.arg, out); return
    case 'binary': {
      checkNode(n.left, out)
      checkNode(n.right, out)
      if (n.op === '/') {
        const d = isConstNum(n.right)
        if (d !== null && d === 0) out.push({ code: 'division_by_zero', detail: 'Nolga bo‘lish' })
        // P0-A: aynan nolga teng maxraj (1/(x-x)) — hamma joyda aniqlanmagan
        else if (d === null && isZeroPoly(n.right)) {
          out.push({ code: 'division_by_zero', detail: 'Nolga bo‘lish' })
        }
      }
      if (n.op === '^') {
        const b = isConstNum(n.left)
        const e = isConstNum(n.right)
        if (b !== null && e !== null) {
          if (b === 0 && e === 0) out.push({ code: 'zero_to_zero', detail: '0^0 aniqlanmagan' })
          else if (b === 0 && e < 0) out.push({ code: 'zero_to_negative', detail: '0 ning manfiy darajasi' })
        }
      }
      return
    }
    case 'call': {
      for (const a of n.args) checkNode(a, out)
      const c = (i: number): number | null => (n.args[i] ? isConstNum(n.args[i]) : null)
      if ((n.name === 'ln' || n.name === 'log' || n.name === 'log10' || n.name === 'log2' || n.name === 'lg') && n.args.length === 1) {
        const v = c(0)
        if (v !== null && v <= 0) out.push({ code: 'log_domain', detail: 'Logarifm argumenti musbat bo‘lishi shart' })
      }
      if (n.name === 'log' && n.args.length === 2) {
        const b = c(0)
        const v = c(1)
        if (b !== null && (b <= 0 || b === 1)) out.push({ code: 'log_base', detail: 'Logarifm asosi musbat va 1 dan farqli bo‘lishi shart' })
        if (v !== null && v <= 0) out.push({ code: 'log_domain', detail: 'Logarifm argumenti musbat bo‘lishi shart' })
      }
      if (n.name === 'sqrt') {
        const v = c(0)
        if (v !== null && v < 0) out.push({ code: 'sqrt_negative', detail: 'Manfiy sonning ildizi (haqiqiy)' })
      }
      if (n.name === 'asin' || n.name === 'acos') {
        const v = c(0)
        if (v !== null && Math.abs(v) > 1) out.push({ code: 'trig_domain', detail: 'Arcsinus/arckosinus domeni [-1,1]' })
      }
      // P1-B: pow(0,0)/pow(0,manfiy) — binary `^` bilan bir xil qoida
      if (n.name === 'pow' && n.args.length === 2) {
        const b = c(0)
        const e = c(1)
        if (b !== null && e !== null) {
          if (b === 0 && e === 0) out.push({ code: 'zero_to_zero', detail: '0^0 aniqlanmagan' })
          else if (b === 0 && e < 0) out.push({ code: 'zero_to_negative', detail: '0 ning manfiy darajasi' })
        }
      }
      // P1-B: mod(a,0) — nolga bo'lish ekvivalenti
      if (n.name === 'mod' && n.args.length === 2) {
        const d = c(1)
        if (d !== null && d === 0) out.push({ code: 'division_by_zero', detail: 'Nolga bo‘lish' })
      }
      return
    }
  }
}

/** Sodda assumption parser: "x>0", "x>=0" kabi yozuvlarni qo'llaydi (Faza 2 minimal) */
function parseAssumption(text: string): { name: string; kind: 'gt0' | 'ge0' } | null {
  const t = text.replace(/\s+/g, '')
  const m = t.match(/^([a-z][a-z0-9_]*)?(>=|>)0$/)
  if (!m) return null
  return { name: m[1] ?? 'x', kind: m[2] === '>' ? 'gt0' : 'ge0' }
}

export function checkDomain(step: StepNode, assumptions: string[]): DomainIssue[] {
  const out: DomainIssue[] = []
  const nodes = step.kind === 'expr' ? [step.node] : [step.left, step.right]
  for (const n of nodes) checkNode(n, out)
  // Assumption'lar hozircha metadata sifatida saqlanadi; sampling ularni hurmat
  // qiladi (check-step.ts). Bu yerda faqat noto'g'ri formatni e'tiborsiz qoldiramiz.
  for (const a of assumptions) parseAssumption(a)
  return out
}

const LOG1_NAMES = new Set(['ln', 'log10', 'log2', 'lg'])
const TRIG_PARTIAL = new Set(['tan', 'cot', 'sec', 'csc'])

/**
 * AST'dan domain cheklovlar to'plami (P1-A).
 *
 * Fixed sample'lar ixtiyoriy singulyar nuqtani (x=4) topolmaydi — shuning uchun
 * cheklovlar STRUKTURAVIY solishtiriladi: `(x-4)/(x-4)` → {den(x-4)},
 * `1` → {} — farq bor → `uncertain`. Kalitlar kanonik (normalize) — `x+1`
 * va `1+x` bir xil cheklov beradi.
 */
export function exclusions(node: MathNode): string[] {
  const out: string[] = []
  const walk = (n: MathNode): void => {
    switch (n.type) {
      case 'num': case 'var': case 'const': return
      case 'unary': walk(n.arg); return
      case 'binary': {
        // Noldan farqli KONSTANTA maxraj hech qachon teshik emas (2, 3, 4) —
        // faqat o'zgaruvchili maxraj cheklov beradi (P1-A refinement).
        if (n.op === '/' || n.op === '%') {
          const d = constValue(n.right)
          if (d === null || d === 0) out.push(`den(${canonicalKey(n.right)})`)
        } else if (n.op === '^') {
          if (!powTotalByRule(n.left, n.right)) {
            out.push(`pow(${canonicalKey(n.left)},${canonicalKey(n.right)})`)
          }
        }
        walk(n.left)
        walk(n.right)
        return
      }
      case 'call': {
        if (n.name === 'log' && n.args.length === 2) {
          out.push(`logbase(${canonicalKey(n.args[0])})`, `logarg(${canonicalKey(n.args[1])})`)
        } else if (LOG1_NAMES.has(n.name) && n.args.length === 1) {
          // 1-arg log: log2/log10/lg/ln baza fixed-valid — faqat argument
          out.push(`logarg(${canonicalKey(n.args[0])})`)
        } else if (n.name === 'log' && n.args.length === 1) {
          out.push(`logarg(${canonicalKey(n.args[0])})`)
        } else if (n.name === 'sqrt' && n.args.length === 1) {
          out.push(`sqrtarg(${canonicalKey(n.args[0])})`)
        } else if ((n.name === 'asin' || n.name === 'acos') && n.args.length === 1) {
          out.push(`trigarg(${canonicalKey(n.args[0])})`)
        } else if (n.name === 'pow' && n.args.length === 2) {
          if (!powTotalByRule(n.args[0], n.args[1])) {
            out.push(`pow(${canonicalKey(n.args[0])},${canonicalKey(n.args[1])})`)
          }
        } else if (n.name === 'mod' && n.args.length === 2) {
          const d = constValue(n.args[1])
          if (d === null || d === 0) out.push(`den(${canonicalKey(n.args[1])})`)
        } else if (TRIG_PARTIAL.has(n.name) && n.args.length >= 1) {
          out.push(`${n.name}(${canonicalKey(n.args[0])})`)
        }
        for (const a of n.args) walk(a)
        return
      }
    }
  }
  walk(node)
  return out.sort()
}

/** Ikki tomon cheklov to'plami bir xilmi (multiset taqqoslash)? */
export function sameExclusions(left: MathNode[], right: MathNode[]): boolean {
  const a = left.flatMap(exclusions).sort()
  const b = right.flatMap(exclusions).sort()
  return a.length === b.length && a.every((v, i) => v === b[i])
}
