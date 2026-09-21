/**
 * Shared math engine — Faza 2 testlari.
 *
 * Qamrov: parser golden, domain edge, equation solution-set, seeded determinism,
 * property-based identities, mutation negative, AST-depth/long-input, conformance.
 */
import { describe, it, expect } from 'vitest'
import { checkStep, parseStep, type Problem } from '../../../src/shared/math-engine'

const PROB: Problem = {
  id: 'log-demo',
  promptLatex: 'log_2(32)',
  assumptions: [],
  goal: 'solve',
}

const check = (previousAcceptedStep: string, candidateStep: string, seed = 0xC0FFEE, first = false) =>
  checkStep({ problem: PROB, previousAcceptedStep, candidateStep, seed, first })

describe('math-engine parser golden', () => {
  it('algebra/kasr/ildiz/daraja/logarifm parse qiladi', () => {
    expect(parseStep('x+2').kind).toBe('expr')
    expect(parseStep('(x+1)/(x-1)').kind).toBe('expr')
    expect(parseStep('sqrt(x^2+1)').kind).toBe('expr')
    expect(parseStep('2^x+3').kind).toBe('expr')
    expect(parseStep('log2(32)').kind).toBe('expr')
    expect(parseStep('log(2, 8)').kind).toBe('expr')
    expect(parseStep('x=5').kind).toBe('equation')
    expect(parseStep('log2(32)=5').kind).toBe('equation')
  })

  it('unicode va yashirin kopaytirish', () => {
    const a = check('2x', '2*x')
    expect(a.status).toBe('correct')
    const b = check('2(x+1)', '2*x+2')
    expect(['correct', 'probably_correct']).toContain(b.status)
    expect(parseStep('√9').kind).toBe('expr')
    expect(parseStep('π').kind).toBe('expr')
  })

  it('xatolar: bosh, zanjirli tenglik, juda uzun', () => {
    expect(check('', 'x').status).toBe('syntax_error')
    expect(check('a=b=c', 'x').status).toBe('syntax_error')
    expect(check('x+', 'x').status).toBe('syntax_error')
    const long = `x+${'1+'.repeat(100)}1`
    expect(check(long, 'x').status).toBe('unknown')
  })

  it('juda chuqur AST → unknown (too_complex)', () => {
    const deep = '('.repeat(100) + 'x' + ')'.repeat(100)
    expect(check(deep, 'x').status).toBe('unknown')
  })
})

describe('math-engine exact correct', () => {
  it('bir xil ifoda → correct', () => {
    expect(check('x+1', 'x+1').status).toBe('correct')
  })

  it('kanonik tartib (1+x = x+1) → correct', () => {
    expect(check('1+x', 'x+1').status).toBe('correct')
  })

  it('konstant folding (2+2 → 4) → correct', () => {
    expect(check('2+2', '4').status).toBe('correct')
  })

  it('log_b(b)=1, log_b(1)=0 → correct', () => {
    expect(check('log(2,2)', '1').status).toBe('correct')
    expect(check('log(2,1)', '0').status).toBe('correct')
  })

  it('tomonlar almasuvi (x=5 → 5=x) → correct', () => {
    expect(check('x=5', '5=x').status).toBe('correct')
  })
})

describe('math-engine domain edge', () => {
  it('nolga bolish → domain_error', () => {
    expect(check('x', '1/0').status).toBe('domain_error')
  })
  it('log(0)/log(-1) → domain_error', () => {
    expect(check('x', 'log(0)').status).toBe('domain_error')
    expect(check('x', 'log(-1)').status).toBe('domain_error')
  })
  it('sqrt(-4) → domain_error', () => {
    expect(check('x', 'sqrt(0-4)').status).toBe('domain_error')
  })
  it('0^0 → domain_error', () => {
    expect(check('x', '0^0').status).toBe('domain_error')
  })
  it('log asosi 1 → domain_error', () => {
    expect(check('x', 'log(1, 8)').status).toBe('domain_error')
  })
  it('x/x vs 1 — HECH QACHON correct emas, uncertain (x=0 farqi)', () => {
    const r = check('x/x', '1')
    expect(r.status).toBe('uncertain')
    expect(r.detail).toBe('domain_mismatch')
  })

  it('P1: log(x,x) vs 1 → uncertain (x≤0/x=1 da yaroqsiz)', () => {
    const r = check('log(x,x)', '1')
    expect(r.status).not.toBe('correct')
  })

  it('P1: (1/x)-(1/x) vs 0 → uncertain (cancellation bloklangan)', () => {
    expect(check('(1/x)-(1/x)', '0').status).toBe('uncertain')
  })

  it('P1: 0*(1/x) vs 0 → uncertain (absorbsiya bloklangan)', () => {
    expect(check('0*(1/x)', '0').status).toBe('uncertain')
  })

  it('P1: x^0 vs 1 → uncertain (0^0 aniqlanmagan)', () => {
    expect(check('x^0', '1').status).toBe('uncertain')
  })

  it('P1: oddiy x-x vs 0 → correct (x total)', () => {
    expect(check('x-x', '0').status).toBe('correct')
  })

  it('P1-A: (x-4)/(x-4) vs 1 → uncertain (fixed sample x=4 ni topolmaydi)', () => {
    const r = check('(x-4)/(x-4)', '1')
    expect(r.status).toBe('uncertain')
    expect(r.detail).toBe('domain_mismatch')
  })

  it('P1-A: 0*(1/(x-4)) vs 0 → uncertain', () => {
    expect(check('0*(1/(x-4))', '0').status).toBe('uncertain')
  })

  it('P1-A: bir xil cheklov (x+1 vs 1+x denominatorida) → probably', () => {
    // Ikkala tomonda den(x+1): cheklov teng → sampling hal qiladi
    const r = check('(x+1)/(x+2)', '(x+1)/(x+2)')
    expect(r.status).toBe('correct')
  })

  it('P1-B: pow(x,0)-pow(x,0) vs 0 → correct EMAS (uncertain)', () => {
    expect(check('pow(x,0)-pow(x,0)', '0').status).toBe('uncertain')
  })

  it('P1-B: mod(x,0)-mod(x,0) vs 0 → correct EMAS', () => {
    expect(check('mod(x,0)-mod(x,0)', '0').status).not.toBe('correct')
  })

  it('P1-B: pow(0,0) kandidat → domain_error', () => {
    expect(check('x', 'pow(0,0)').status).toBe('domain_error')
  })

  it('P1-B: tan(x)-tan(x) vs 0 → uncertain (izolyatsiyalangan singulyarlik)', () => {
    expect(check('tan(x)-tan(x)', '0').status).toBe('uncertain')
  })

  it('P1-B: soglom pow/mod saqlanadi (pow(2,10)=1024 correct, mod(x,2) total)', () => {
    expect(check('pow(2,10)', '1024').status).toBe('correct')
    // mod(x,2) hamma joyda aniqlangan → x-x qoidasi qonuniy
    expect(check('mod(x,2)-mod(x,2)', '0').status).toBe('correct')
  })
})

describe('math-engine solution-set (tenglamalar)', () => {
  it('x=1 → x+1=2 saqlanadi (P0-A: poly-identical → correct)', () => {
    expect(check('x=1', 'x+1=2').status).toBe('correct')
  })
  it('x=1 → x^2=1 BEGONA ildiz → invalid_transition', () => {
    const r = check('x=1', 'x^2=1')
    expect(r.status).toBe('invalid_transition')
    expect(r.detail).toBe('extraneous_or_not_equivalent')
  })
  it('yopiq yolgon (2+2=5) → wrong', () => {
    const r = check('2+2=4', '2+2=5')
    expect(r.status).toBe('wrong')
  })
  it('yopiq rost lekin boglanmagan (2+2=4 → 3+3=6) → invalid_transition', () => {
    expect(check('2+2=4', '3+3=6').status).toBe('invalid_transition')
  })
  it('logarifm workflow: log2(32) → log2(32)=5', () => {
    const r = check('log2(32)', 'log2(32)=5')
    expect(['correct', 'probably_correct']).toContain(r.status)
  })

  it('P1-4 first: 2^5=32 ochilish → opening_true (log↔exp)', () => {
    const r = check('log(2,32)', '2^5=32', 0xC0FFEE, true)
    expect(r).toEqual({ status: 'probably_correct', detail: 'opening_true' })
  })

  it('P1-4 first: 2+2=4 bog‘lanmagan → unrelated_true', () => {
    const r = check('log(2,32)', '2+2=4', 0xC0FFEE, true)
    expect(r).toEqual({ status: 'invalid_transition', detail: 'unrelated_true' })
  })

  it('P1-4 first: 1=1 bog‘lanmagan → unrelated_true', () => {
    expect(check('log(2,32)', '1=1', 0xC0FFEE, true).detail).toBe('unrelated_true')
  })

  it('P1-4 first: log(2,32)=5 qiymat-e’lon → correct', () => {
    expect(check('log(2,32)', 'log(2,32)=5', 0xC0FFEE, true).status).toBe('correct')
  })
  it('notogri qadam baza bolmaydi — invariant (caller convention)', () => {
    // Engine har doim previousAcceptedStep'ga nisbatan tekshiradi;
    // caller noto'g'ri qadamni baza qilmasligi shart (hujjatlangan).
    const bad = check('x=1', 'x=2')
    expect(bad.status).toBe('invalid_transition')
    const next = check('x=1', 'x+1=2')
    expect(next.status).toBe('correct')
  })
})

describe('math-engine seeded determinism + property + mutation', () => {
  it('P0-A REGRESSIYA: x*(x^2-1)*(x^2-9) vs 0 accepted EMAS', () => {
    // Sparse ildizlar (0,±1,±3) sample'larni aldashi mumkin — faqat
    // trivial kelishuv. Hech qachon correct/probably bo'lmasligi shart.
    const r = check('x*(x^2-1)*(x^2-9)', '0')
    expect(['correct', 'probably_correct'].includes(r.status)).toBe(false)
  })

  it('P0-A: nontrivial kelishuv talab qilinadi (transsendent saqlanadi)', () => {
    // sin(x)^2+cos(x)^2 vs 1 — hamma joyda nontrivial → probably ruxsat
    const r = check('sin(x)^2+cos(x)^2', '1')
    expect(['correct', 'probably_correct']).toContain(r.status)
  })

  it('bir xil seed → bir xil natija', () => {
    const a = check('x^2-1', '(x-1)*(x+1)', 42)
    const b = check('x^2-1', '(x-1)*(x+1)', 42)
    expect(a).toEqual(b)
  })

  it('property: (x+1)(x-1) = x^2-1 (sampling → probably_correct)', () => {
    const r = check('x^2-1', '(x-1)*(x+1)')
    expect(['correct', 'probably_correct']).toContain(r.status)
    expect(r.status).not.toBe('wrong')
  })

  it('P2-F: sin(2x) ≠ sin(2)*x (implicit multiplication golden)', () => {
    // Konvertor `\\sin 2x` → `sin(2x)` bog'laydi; parser farqni ko'rishi shart
    const r = check('sin(2*x)', 'sin(2)*x')
    expect(r.status).toBe('invalid_transition')
  })

  it('property: kommutativlik a+b=b+a (har xil qiymatlarda)', () => {
    for (const seed of [1, 7, 99]) {
      expect(check('a+b', 'b+a', seed).status).toBe('correct')
    }
  })

  it('mutation: ishora ozgarishi ushlanadi', () => {
    expect(check('x+1=2', 'x-1=2').status).toBe('invalid_transition')
    expect(check('x^2', 'x^3').status).toBe('invalid_transition')
  })

  it('tur mos kelmasligi → invalid_transition', () => {
    expect(check('x+1', 'x=5').status).toBe('invalid_transition')
  })

  it('identik-nol maxraj → domain_error (1/(x-x))', () => {
    const r = check('1/(x-x)=1', '1/(x-x)=2')
    expect(r.status).toBe('domain_error')
  })
})
