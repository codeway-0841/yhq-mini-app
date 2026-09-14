/**
 * Grafik quruvchi — matematik funksiyalar va konstantalar registri.
 *
 * Diqqat: `Math.tan(Math.PI / 2)` kabi nuqtalar cheksizlikka yaqin son
 * qaytaradi — sample qatlami buni uzilish (gap) sifatida chizadi, shuning
 * uchun bu yerda qo'shimcha clamp kerak emas.
 */

export interface BuiltinFunction {
  fn: (...args: number[]) => number
  minArgs: number
  maxArgs: number
}

const f1 = (fn: (x: number) => number): BuiltinFunction => ({ fn, minArgs: 1, maxArgs: 1 })
const f2 = (fn: (x: number, y: number) => number): BuiltinFunction => ({ fn, minArgs: 2, maxArgs: 2 })

export const FUNCTIONS: Record<string, BuiltinFunction> = {
  sin:   f1(Math.sin),
  cos:   f1(Math.cos),
  tan:   f1(Math.tan),
  cot:   f1((x) => 1 / Math.tan(x)),
  sec:   f1((x) => 1 / Math.cos(x)),
  csc:   f1((x) => 1 / Math.sin(x)),
  asin:  f1(Math.asin),
  acos:  f1(Math.acos),
  atan:  f1(Math.atan),
  atan2: f2(Math.atan2),
  sinh:  f1(Math.sinh),
  cosh:  f1(Math.cosh),
  tanh:  f1(Math.tanh),
  ln:    f1(Math.log),
  log:   f1(Math.log10),
  log10: f1(Math.log10),
  log2:  f1(Math.log2),
  sqrt:  f1(Math.sqrt),
  cbrt:  f1(Math.cbrt),
  abs:   f1(Math.abs),
  exp:   f1(Math.exp),
  floor: f1(Math.floor),
  ceil:  f1(Math.ceil),
  round: f1(Math.round),
  sign:  f1(Math.sign),
  min:   { fn: (...a: number[]) => Math.min(...a), minArgs: 2, maxArgs: 8 },
  max:   { fn: (...a: number[]) => Math.max(...a), minArgs: 2, maxArgs: 8 },
  mod:   f2((a, b) => a % b),
  pow:   f2((a, b) => a ** b),
  hypot: { fn: (...a: number[]) => Math.hypot(...a), minArgs: 1, maxArgs: 4 },
}

export const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e:  Math.E,
}

export function isFunctionName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(FUNCTIONS, name)
}

export function isConstantName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONSTANTS, name)
}

/** TokenPad / hujjat uchun ko'rsatiladigan funksiya nomlari */
export const FUNCTION_NAMES = Object.keys(FUNCTIONS)
