/**
 * Shared math engine — polinomial exact proof (P0-A).
 *
 * Sampling sparse ildizlarda aldadi (`x*(x²-1)*(x²-9)` vs `0` root'larda
 * 0 bo'ladi) — shuning uchun polinom/rasional tenglik ANIQ isbotlanadi,
 * isbotsiz numeric `uncertain` bo'ladi (correct HECH QACHON sampling'dan).
 *
 * Qamrov: ko'phad (+,-,*, butun musbat daraja, unar minus, konstantalar).
 * Bo'linma/transsendent ildiz bo'lsa `null` (isbot yo'q → sampling fallback).
 */

import type { MathNode } from './ast'

/** Monom kaliti: `x^2*y^3`, konstanta had: '' */
export type Poly = Map<string, number>

const TOL = 1e-9

function monoKey(exps: Map<string, number>): string {
  const parts: string[] = []
  const names = [...exps.keys()].sort()
  for (const name of names) {
    const e = exps.get(name) ?? 0
    if (e !== 0) parts.push(e === 1 ? name : `${name}^${e}`)
  }
  return parts.join('*')
}

function addPoly(a: Poly, b: Poly, sign: 1 | -1): Poly {
  const out = new Map(a)
  for (const [k, v] of b) {
    const nv = (out.get(k) ?? 0) + sign * v
    if (Math.abs(nv) < TOL) out.delete(k)
    else out.set(k, nv)
  }
  return out
}

export function mulPoly(a: Poly, b: Poly): Poly {
  const out: Poly = new Map()
  for (const [ka, va] of a) {
    for (const [kb, vb] of b) {
      const exps = new Map<string, number>()
      const addExp = (key: string): void => {
        if (!key) return
        for (const part of key.split('*')) {
          const [name, exp] = part.split('^')
          exps.set(name, (exps.get(name) ?? 0) + (exp ? Number(exp) : 1))
        }
      }
      addExp(ka)
      addExp(kb)
      const key = monoKey(exps)
      const nv = (out.get(key) ?? 0) + va * vb
      if (Math.abs(nv) < TOL) out.delete(key)
      else out.set(key, nv)
    }
  }
  return out
}

/** Tugunni kanonik polinomga yoyadi; bo'lmasa null */
export function polyExpand(node: MathNode): Poly | null {
  switch (node.type) {
    case 'num': return new Map([['', node.value]])
    case 'const': return new Map([['', node.value]])
    case 'var': return new Map([[node.name, 1]])
    case 'unary': {
      const inner = polyExpand(node.arg)
      if (!inner) return null
      return node.op === '-' ? addPoly(new Map(), inner, -1) : inner
    }
    case 'binary': {
      const l = polyExpand(node.left)
      const r = polyExpand(node.right)
      if (!l || !r) return null
      switch (node.op) {
        case '+': return addPoly(l, r, 1)
        case '-': return addPoly(l, r, -1)
        case '*': return mulPoly(l, r)
        case '^': {
          // Faqat butun musbat konstanta daraja (kichik limit bilan)
          if (node.right.type === 'num' && Number.isInteger(node.right.value)
            && node.right.value >= 0 && node.right.value <= 20) {
            let acc: Poly = new Map([['', 1]])
            for (let i = 0; i < node.right.value; i++) acc = mulPoly(acc, l)
            return acc
          }
          return null
        }
        default: return null
      }
    }
    case 'call': return null
  }
}

/** Ikki polinom tengmi (tol bilan)? */
export function polyEqual(a: Poly, b: Poly): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) {
    const w = b.get(k)
    if (w === undefined) return false
    const denom = Math.max(1, Math.abs(v), Math.abs(w))
    if (Math.abs(v - w) > TOL * denom) return false
  }
  return true
}

/**
 * `b` = k*`a` (k≠0 konstanta)? Qaytaradi: k yoki null.
 * Tenglama differentiallari uchun: d2 ≡ k*d1 → bir xil ildizlar.
 */
export function polyScaleFactor(a: Poly, b: Poly): number | null {
  if (a.size === 0 || b.size === 0) return null
  let k: number | null = null
  const keys = new Set([...a.keys(), ...b.keys()])
  for (const key of keys) {
    const va = a.get(key) ?? 0
    const vb = b.get(key) ?? 0
    if (Math.abs(va) < TOL && Math.abs(vb) < TOL) continue
    if (Math.abs(va) < TOL || Math.abs(vb) < TOL) return null
    const ki = vb / va
    if (!Number.isFinite(ki) || Math.abs(ki) < TOL) return null
    if (k === null) k = ki
    else if (Math.abs(ki - k) > TOL * Math.max(1, Math.abs(k))) return null
  }
  return k
}

/**
 * Rasional tenglik (exact): A/B ≡ C/D ⟺ A*D ≡ B*C (polinomial).
 * Faqat to'rtlik polinom bo'lsa isbotlaydi, aks holda null (isbot yo'q).
 * Domain tengligi ALOHIDA tekshiriladi (sameExclusions) — bu funksiya
 * faqat algebraik tenglikni tasdiqlaydi.
 */
export function rationalEqual(a: MathNode, b: MathNode): boolean {
  const ra = rationalForm(a)
  const rb = rationalForm(b)
  if (!ra || !rb) return false
  return polyEqual(mulPoly(ra.num, rb.den), mulPoly(rb.num, ra.den))
}

export function rationalForm(node: MathNode): { num: Poly; den: Poly } | null {
  const ONE: Poly = new Map([['', 1]])
  const direct = polyExpand(node)
  if (direct) return { num: direct, den: ONE }
  if (node.type === 'binary' && node.op === '/') {
    const l = rationalForm(node.left)
    const r = rationalForm(node.right)
    if (!l || !r) return null
    // (a/b)/(c/d) = (a*d)/(b*c)
    return { num: mulPoly(l.num, r.den), den: mulPoly(l.den, r.num) }
  }
  if (node.type === 'binary' && (node.op === '*' || node.op === '+' || node.op === '-')) {
    const l = rationalForm(node.left)
    const r = rationalForm(node.right)
    if (!l || !r) return null
    if (node.op === '*') return { num: mulPoly(l.num, r.num), den: mulPoly(l.den, r.den) }
    // a/b ± c/d = (ad ± cb)/bd
    const num = node.op === '+'
      ? addPoly(mulPoly(l.num, r.den), mulPoly(r.num, l.den), 1)
      : addPoly(mulPoly(l.num, r.den), mulPoly(r.num, l.den), -1)
    return { num, den: mulPoly(l.den, r.den) }
  }
  if (node.type === 'unary') {
    const inner = rationalForm(node.arg)
    if (!inner) return null
    return node.op === '-' ? { num: addPoly(new Map(), inner.num, -1), den: inner.den } : inner
  }
  return null
}
