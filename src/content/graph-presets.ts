/**
 * Grafik quruvchi — tayyor formulalar (statik kontent, SOF ma'lumot).
 *
 * `expr` — grafik quruvchining o'z sintaksisi (ASCII): `^` daraja, `pi` doimiy,
 * `sqrt` ildiz. `xVar` — X o'qi bo'ylab o'zgaruvchi; qolgan `vars` slayder
 * bo'ladi. Yangi preset qo'shish — shu massivga yozuv qo'shish kifoya.
 */

export interface GraphPresetVar {
  value: number
  min: number
  max: number
  step: number
}

export interface GraphPreset {
  id: string
  subjectId: 'matematika' | 'fizika'
  title: string
  titleRu: string
  expr: string
  xVar: string
  vars: Record<string, GraphPresetVar>
  note?: string
  noteRu?: string
}

export const GRAPH_PRESETS: GraphPreset[] = [
  // ── Matematika ────────────────────────────────────────────────────────────
  {
    id: 'math-sin', subjectId: 'matematika',
    title: "Sinus to'lqini", titleRu: 'Синусоида',
    expr: 'sin(x)', xVar: 'x', vars: {},
    note: 'Davri 2π', noteRu: 'Период 2π',
  },
  {
    id: 'math-sin-ab', subjectId: 'matematika',
    title: 'Amplituda va chastota', titleRu: 'Амплитуда и частота',
    expr: 'a*sin(b*x)', xVar: 'x',
    vars: { a: { value: 1, min: -5, max: 5, step: 0.1 }, b: { value: 1, min: 0.1, max: 5, step: 0.1 } },
  },
  {
    id: 'math-linear', subjectId: 'matematika',
    title: 'Chiziqli funksiya', titleRu: 'Линейная функция',
    expr: 'k*x + b', xVar: 'x',
    vars: { k: { value: 1, min: -5, max: 5, step: 0.1 }, b: { value: 0, min: -10, max: 10, step: 0.5 } },
  },
  {
    id: 'math-quadratic', subjectId: 'matematika',
    title: 'Kvadrat funksiya', titleRu: 'Квадратичная функция',
    expr: 'a*x^2 + b*x + c', xVar: 'x',
    vars: {
      a: { value: 1, min: -3, max: 3, step: 0.1 },
      b: { value: 0, min: -10, max: 10, step: 0.5 },
      c: { value: 0, min: -10, max: 10, step: 0.5 },
    },
  },
  {
    id: 'math-cubic', subjectId: 'matematika',
    title: 'Kub funksiya', titleRu: 'Кубическая функция',
    expr: 'x^3 - 3*x', xVar: 'x', vars: {},
  },
  {
    id: 'math-hyperbola', subjectId: 'matematika',
    title: 'Giperbola', titleRu: 'Гипербола',
    expr: 'k/x', xVar: 'x',
    vars: { k: { value: 1, min: -10, max: 10, step: 0.5 } },
    note: 'x = 0 da asimptota', noteRu: 'Асимптота при x = 0',
  },
  {
    id: 'math-sqrt', subjectId: 'matematika',
    title: 'Kvadrat ildiz', titleRu: 'Квадратный корень',
    expr: 'sqrt(x)', xVar: 'x', vars: {},
    note: 'x ≥ 0 da aniqlangan', noteRu: 'Определена при x ≥ 0',
  },
  {
    id: 'math-ln', subjectId: 'matematika',
    title: 'Natural logarifm', titleRu: 'Натуральный логарифм',
    expr: 'ln(x)', xVar: 'x', vars: {},
    note: 'x > 0 da aniqlangan', noteRu: 'Определена при x > 0',
  },
  {
    id: 'math-exp', subjectId: 'matematika',
    title: 'Eksponenta', titleRu: 'Экспонента',
    expr: 'exp(x)', xVar: 'x', vars: {},
  },
  {
    id: 'math-abs', subjectId: 'matematika',
    title: 'Modul', titleRu: 'Модуль',
    expr: 'abs(x)', xVar: 'x', vars: {},
  },

  // ── Fizika ────────────────────────────────────────────────────────────────
  {
    id: 'phy-uniform', subjectId: 'fizika',
    title: 'Tekis harakat tezligi', titleRu: 'Скорость равномерного движения',
    expr: 'v0 + a*t', xVar: 't',
    vars: {
      v0: { value: 5, min: 0, max: 30, step: 1 },
      a:  { value: 2, min: -10, max: 10, step: 0.5 },
    },
    note: 'v = v₀ + at', noteRu: 'v = v₀ + at',
  },
  {
    id: 'phy-displacement', subjectId: 'fizika',
    title: "Ko'chish (tekis tezlanuvchan)", titleRu: 'Перемещение (равноускоренное)',
    expr: 'v0*t + (a*t^2)/2', xVar: 't',
    vars: {
      v0: { value: 5, min: 0, max: 30, step: 1 },
      a:  { value: 2, min: -10, max: 10, step: 0.5 },
    },
    note: 's = v₀t + at²/2', noteRu: 's = v₀t + at²/2',
  },
  {
    id: 'phy-freefall', subjectId: 'fizika',
    title: 'Erkin tushish', titleRu: 'Свободное падение',
    expr: '(g*t^2)/2', xVar: 't',
    vars: { g: { value: 9.81, min: 0, max: 20, step: 0.01 } },
    note: 'h = gt²/2', noteRu: 'h = gt²/2',
  },
  {
    id: 'phy-projectile', subjectId: 'fizika',
    title: 'Vertikal otish', titleRu: 'Бросок вертикально вверх',
    expr: 'v0*t - (g*t^2)/2', xVar: 't',
    vars: {
      v0: { value: 20, min: 1, max: 50, step: 1 },
      g:  { value: 9.81, min: 0, max: 20, step: 0.01 },
    },
    note: 'h = v₀t − gt²/2', noteRu: 'h = v₀t − gt²/2',
  },
  {
    id: 'phy-oscillation', subjectId: 'fizika',
    title: 'Garmonik tebranish', titleRu: 'Гармонические колебания',
    expr: 'a*sin(2*pi*f*t)', xVar: 't',
    vars: {
      a: { value: 1, min: 0, max: 5, step: 0.1 },
      f: { value: 1, min: 0.1, max: 5, step: 0.1 },
    },
    note: 'x = A·sin(2πft)', noteRu: 'x = A·sin(2πft)',
  },
  {
    id: 'phy-newton', subjectId: 'fizika',
    title: 'Nyuton II qonuni', titleRu: 'Второй закон Ньютона',
    expr: 'm*a', xVar: 'a',
    vars: { m: { value: 2, min: 0.1, max: 20, step: 0.1 } },
    note: 'F = ma', noteRu: 'F = ma',
  },
  {
    id: 'phy-momentum', subjectId: 'fizika',
    title: 'Impuls', titleRu: 'Импульс',
    expr: 'm*v', xVar: 'v',
    vars: { m: { value: 2, min: 0.1, max: 20, step: 0.1 } },
    note: 'p = mv', noteRu: 'p = mv',
  },
  {
    id: 'phy-kinetic', subjectId: 'fizika',
    title: 'Kinetik energiya', titleRu: 'Кинетическая энергия',
    expr: '(m*v^2)/2', xVar: 'v',
    vars: { m: { value: 1, min: 0.1, max: 20, step: 0.1 } },
    note: 'Eₖ = mv²/2', noteRu: 'Eₖ = mv²/2',
  },
  {
    id: 'phy-ohm', subjectId: 'fizika',
    title: 'Om qonuni', titleRu: 'Закон Ома',
    expr: 'u/r', xVar: 'r',
    vars: { u: { value: 12, min: 1, max: 220, step: 1 } },
    note: 'I = U/R', noteRu: 'I = U/R',
  },
  {
    id: 'phy-power', subjectId: 'fizika',
    title: 'Elektr quvvati', titleRu: 'Электрическая мощность',
    expr: 'u*i', xVar: 'i',
    vars: { u: { value: 220, min: 1, max: 380, step: 1 } },
    note: 'P = UI', noteRu: 'P = UI',
  },
  {
    id: 'phy-hooke', subjectId: 'fizika',
    title: 'Guk qonuni', titleRu: 'Закон Гука',
    expr: 'k*x', xVar: 'x',
    vars: { k: { value: 100, min: 1, max: 1000, step: 10 } },
    note: 'F = kx', noteRu: 'F = kx',
  },
  {
    id: 'phy-density', subjectId: 'fizika',
    title: 'Zichlik', titleRu: 'Плотность',
    expr: 'm/v', xVar: 'v',
    vars: { m: { value: 10, min: 0.1, max: 100, step: 0.1 } },
    note: 'ρ = m/V', noteRu: 'ρ = m/V',
  },
]

export function presetsBySubject(subjectId: string): GraphPreset[] {
  return GRAPH_PRESETS.filter((p) => p.subjectId === subjectId)
}
