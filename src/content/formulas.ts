/**
 * Shpargalkalar — fanlar bo'yicha formulalar to'plami (statik kontent).
 *
 * Tuzilma: fan → mavzu → formulalar. Formula matnlari Unicode bilan yoziladi
 * (² ³ √ π ₁₂ → ±) — KaTeX kerak emas, to'g'ridan-to'g'ri render qilinadi.
 *
 * Yangi formula/mavzu/fan qo'shish — shu faylga element qo'shish kifoya.
 * Icon/rang `src/shared/config/subjects.tsx` dagi subjectId'dan olinadi.
 */
export interface Formula {
  id: string
  title: string
  formula: string
  note?: string
}

export interface FormulaTopic {
  id: string
  name: string
  nameRu: string
  formulas: Formula[]
}

export interface FormulaSubject {
  /** shared/subjects.ts dagi id — icon/rang shu orqali olinadi */
  subjectId: 'matematika' | 'fizika' | 'kimyo' | 'biologiya' | 'ingliz'
  topics: FormulaTopic[]
}

const f = (id: string, title: string, formula: string, note?: string): Formula =>
  ({ id, title, formula, note })

export const FORMULA_SUBJECTS: FormulaSubject[] = [
  {
    subjectId: 'matematika',
    topics: [
      {
        id: 'algebra', name: 'Algebra', nameRu: 'Алгебра',
        formulas: [
          f('m-alg-1', 'Kvadrat tenglama', 'ax² + bx + c = 0', 'a ≠ 0'),
          f('m-alg-2', 'Ildizlar formulasi', 'x = (−b ± √(b² − 4ac)) / 2a'),
          f('m-alg-3', 'Diskriminant', 'D = b² − 4ac', 'D>0: 2 ildiz · D=0: 1 · D<0: yo‘q'),
          f('m-alg-4', 'Viyet teoremasi', 'x₁ + x₂ = −b/a ·  x₁·x₂ = c/a'),
          f('m-alg-5', 'Qisqa ko‘paytma', '(a ± b)² = a² ± 2ab + b²'),
          f('m-alg-6', 'Kvadratlar ayirmasi', 'a² − b² = (a − b)(a + b)'),
        ],
      },
      {
        id: 'geometriya', name: 'Geometriya', nameRu: 'Геометрия',
        formulas: [
          f('m-geo-1', 'Kvadratning yuzi', 'S = a²'),
          f('m-geo-2', 'To‘g‘ri to‘rtburchak yuzi', 'S = a · b'),
          f('m-geo-3', 'Uchburchak yuzi', 'S = (a · h) / 2'),
          f('m-geo-4', 'Aylana uzunligi', 'C = 2πr'),
          f('m-geo-5', 'Doira yuzi', 'S = πr²'),
          f('m-geo-6', 'Pifagor teoremasi', 'a² + b² = c²'),
        ],
      },
      {
        id: 'trigonometriya', name: 'Trigonometriya', nameRu: 'Тригонометрия',
        formulas: [
          f('m-trig-1', 'Asosiy ayniyat', 'sin²x + cos²x = 1'),
          f('m-trig-2', 'Tangens', 'tg x = sin x / cos x'),
          f('m-trig-3', 'Sinuslar teoremasi', 'a/sin A = b/sin B = c/sin C'),
          f('m-trig-4', 'Kosinuslar teoremasi', 'a² = b² + c² − 2bc·cos A'),
          f('m-trig-5', 'Yig‘indi sinusi', 'sin(α + β) = sin α·cos β + cos α·sin β'),
        ],
      },
      {
        id: 'analiz', name: 'Matematik analiz', nameRu: 'Мат. анализ',
        formulas: [
          f('m-an-1', 'Daraja hosilasi', '(xⁿ)′ = n·xⁿ⁻¹'),
          f('m-an-2', 'Ko‘paytma hosilasi', '(u·v)′ = u′v + uv′'),
          f('m-an-3', 'Integral', '∫ xⁿ dx = xⁿ⁺¹/(n+1) + C', 'n ≠ −1'),
          f('m-an-4', 'Nyuton-Leybnits', '∫ₐᵇ f(x)dx = F(b) − F(a)'),
        ],
      },
      {
        id: 'statistika', name: 'Statistika', nameRu: 'Статистика',
        formulas: [
          f('m-st-1', 'O‘rta arifmetik', 'x̄ = (x₁ + … + xₙ) / n'),
          f('m-st-2', 'Ehtimollik', 'P(A) = m / n'),
          f('m-st-3', 'Kombinatsiya', 'C(n,k) = n! / (k!(n−k)!)'),
          f('m-st-4', 'Joylashtirish', 'A(n,k) = n! / (n−k)!'),
        ],
      },
      {
        id: 'arifmetika', name: 'Arifmetika', nameRu: 'Арифметика',
        formulas: [
          f('m-ar-1', 'Arifmetik progressiya', 'aₙ = a₁ + (n − 1)d'),
          f('m-ar-2', 'AP yig‘indisi', 'Sₙ = (a₁ + aₙ)/2 · n'),
          f('m-ar-3', 'Geometrik progressiya', 'bₙ = b₁·qⁿ⁻¹'),
          f('m-ar-4', 'GP yig‘indisi', 'Sₙ = b₁(qⁿ − 1)/(q − 1)', 'q ≠ 1'),
        ],
      },
    ],
  },
  {
    subjectId: 'fizika',
    topics: [
      {
        id: 'mexanika', name: 'Mexanika', nameRu: 'Механика',
        formulas: [
          f('f-mx-1', 'Nyutonning ikkinchi qonuni', 'F = ma'),
          f('f-mx-2', 'Kinetik energiya', 'Eₖ = mv²/2'),
          f('f-mx-3', 'Potensial energiya', 'Eₚ = mgh'),
          f('f-mx-4', 'Impuls', 'p = mv'),
          f('f-mx-5', 'Quvvat', 'P = UI'),
          f('f-mx-6', 'Gravitatsiya qonuni', 'F = G·m₁m₂/r²'),
        ],
      },
      {
        id: 'elektrodinamika', name: 'Elektrodinamika', nameRu: 'Электродинамика',
        formulas: [
          f('f-el-1', 'Om qonuni', 'I = U/R'),
          f('f-el-2', 'Kulon qonuni', 'F = k·q₁q₂/r²'),
          f('f-el-3', 'Elektr quvvati', 'P = UI = I²R'),
          f('f-el-4', 'Kondensator sig‘imi', 'C = q/U'),
        ],
      },
      {
        id: 'optika', name: 'Optika', nameRu: 'Оптика',
        formulas: [
          f('f-op-1', 'Sinish qonuni', 'n₁·sin α = n₂·sin β'),
          f('f-op-2', 'Linza formulasi', '1/F = 1/d + 1/f'),
          f('f-op-3', 'Yorug‘lik tezligi', 'c = 3·10⁸ m/s'),
        ],
      },
      {
        id: 'termodinamika', name: 'Termodinamika', nameRu: 'Термодинамика',
        formulas: [
          f('f-td-1', 'Issiqlik miqdori', 'Q = cmΔT'),
          f('f-td-2', 'Ideal gaz holati', 'PV = nRT'),
          f('f-td-3', 'FIK (Carnot)', 'η = (T₁ − T₂)/T₁'),
        ],
      },
      {
        id: 'atom', name: 'Atom fizikasi', nameRu: 'Атомная физика',
        formulas: [
          f('f-at-1', 'Foton energiyasi', 'E = hν'),
          f('f-at-2', 'Eynshteyn tenglamasi', 'E = mc²'),
          f('f-at-3', 'Fotoefekt', 'hν = A + Eₖ'),
        ],
      },
    ],
  },
  {
    subjectId: 'kimyo',
    topics: [
      {
        id: 'neorganik', name: 'Neorganik kimyo', nameRu: 'Неорганическая',
        formulas: [
          f('k-ne-1', 'Suvning dissotsialanishi', '2H₂O ⇌ H₃O⁺ + OH⁻'),
          f('k-ne-2', 'Neytrallanish', 'HCl + NaOH → NaCl + H₂O'),
          f('k-ne-3', 'Avogadro doimiysi', 'Nₐ = 6.022·10²³ mol⁻¹'),
          f('k-ne-4', 'Modda miqdori', 'n = m/M'),
        ],
      },
      {
        id: 'organik', name: 'Organik kimyo', nameRu: 'Органическая',
        formulas: [
          f('k-or-1', 'Metanning yonishi', 'CH₄ + 2O₂ → CO₂ + 2H₂O'),
          f('k-or-2', 'Alkanlar umumiy', 'CₙH₂ₙ₊₂'),
          f('k-or-3', 'Alkenlar umumiy', 'CₙH₂ₙ'),
          f('k-or-4', 'Alkinlar umumiy', 'CₙH₂ₙ₋₂'),
        ],
      },
      {
        id: 'fizik-kimyo', name: 'Fizik kimyo', nameRu: 'Физическая',
        formulas: [
          f('k-fk-1', 'Ideal gaz', 'PV = nRT'),
          f('k-fk-2', 'Molyar konsentratsiya', 'C = n/V'),
          f('k-fk-3', 'Massa ulushi', 'ω = m(modda)/m(eritma) · 100%'),
        ],
      },
      {
        id: 'analitik', name: 'Analitik kimyo', nameRu: 'Аналитическая',
        formulas: [
          f('k-an-1', 'pH', 'pH = −lg[H⁺]'),
          f('k-an-2', 'pOH', 'pOH = 14 − pH'),
          f('k-an-3', 'Suyultirish', 'C₁V₁ = C₂V₂'),
        ],
      },
    ],
  },
  {
    subjectId: 'biologiya',
    topics: [
      {
        id: 'molekulyar', name: 'Molekulyar biologiya', nameRu: 'Молекулярная',
        formulas: [
          f('b-mb-1', 'DNK spirali diametri', 'd = 2 nm'),
          f('b-mb-2', 'Fotosintez', '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂'),
          f('b-mb-3', 'Nafas olish', 'C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP'),
        ],
      },
      {
        id: 'genetika', name: 'Genetika', nameRu: 'Генетика',
        formulas: [
          f('b-gn-1', 'Mendelning 1-qonuni', 'AA × aa → 100% Aa'),
          f('b-gn-2', 'Mendelning 2-qonuni', 'Aa × Aa → 1AA : 2Aa : 1aa'),
          f('b-gn-3', 'Xardi-Vaynberg', 'p² + 2pq + q² = 1'),
        ],
      },
      {
        id: 'fiziologiya', name: 'Fiziologiya', nameRu: 'Физиология',
        formulas: [
          f('b-fz-1', 'Yurak chiqarimi', 'Q = UHV × YCh'),
          f('b-fz-2', 'BMR (Harris-Benedict)', 'BMR ≈ 66 + 13.7w + 5h − 6.8a', 'erkaklar uchun'),
        ],
      },
      {
        id: 'ekologiya', name: 'Ekologiya', nameRu: 'Экология',
        formulas: [
          f('b-ek-1', '10% qoidasi', 'Eₙ₊₁ = 0.1 · Eₙ', 'energiya o‘tishi'),
          f('b-ek-2', 'Populyatsiya o‘sishi', 'Nₜ = N₀·eʳᵗ'),
        ],
      },
    ],
  },
  {
    subjectId: 'ingliz',
    topics: [
      {
        id: 'tenses', name: 'Zamonlar', nameRu: 'Времена',
        formulas: [
          f('e-tn-1', 'Present Simple', 'S + V₁ (he/she/it + s)'),
          f('e-tn-2', 'Present Continuous', 'S + am/is/are + V-ing'),
          f('e-tn-3', 'Past Simple', 'S + V₂'),
          f('e-tn-4', 'Future Simple', 'S + will + V₁'),
          f('e-tn-5', 'Present Perfect', 'S + have/has + V₃'),
        ],
      },
      {
        id: 'passive', name: 'Passive Voice', nameRu: 'Пассивный залог',
        formulas: [
          f('e-ps-1', 'Passive (umumiy)', 'S + be + V₃'),
          f('e-ps-2', 'Past Passive', 'S + was/were + V₃'),
          f('e-ps-3', 'Future Passive', 'S + will be + V₃'),
        ],
      },
      {
        id: 'conditionals', name: 'Shart gaplar', nameRu: 'Условные',
        formulas: [
          f('e-cd-1', 'Zero Conditional', 'If + S + V₁, S + V₁'),
          f('e-cd-2', 'First Conditional', 'If + S + V₁, S + will + V₁'),
          f('e-cd-3', 'Second Conditional', 'If + S + V₂, S + would + V₁'),
        ],
      },
    ],
  },
]

/** Fan bo'yicha jami formula soni */
export function formulaCount(s: FormulaSubject): number {
  return s.topics.reduce((n, t) => n + t.formulas.length, 0)
}
