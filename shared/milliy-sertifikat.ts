/**
 * Milliy sertifikat baholash tizimi va Rash modeli konvertori — YAGONA MANBA.
 *
 * Vazirlar Mahkamasining 646-son qarori (2024-yil 17-son tahriri) va
 * Bilim va malakalarni baholash agentligi (UzBMB) rasmiy mezonlari asosida.
 *
 * Shkala:
 *   - Rash modeli bo'yicha maksimal 75 ball.
 *   - Sertifikat olish uchun minimal o'tish bali: 46 ball (C darajasi).
 *   - 46 balldan past (< 46.0) bo'lsa sertifikat berilmaydi.
 *
 * DTM imtiyozlari:
 *   - A+ (70+) va A (65–69.9): Mutaxassislik fandan 100% maksimal ball (93 / 63)
 *   - B+ (60–64.9), B (55–59.9), C+ (50–54.9), C (46–49.9): Proporsional ball
 *   - Majburiy fanlar (ona tili, matematika, tarix): Darajadan qat'i nazar (C bo'lsa ham)
 *     belgilangan eng yuqori maksimal ball beriladi.
 */

export type CertificateGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C'

export const MILLIY_SERTIFIKAT_MIN_PASS = 46
export const MILLIY_SERTIFIKAT_MAX_SCORE = 75
export const MAJOR_1_MAX_SCORE = 93
export const MAJOR_2_MAX_SCORE = 63

export interface GradeMeta {
  grade: CertificateGrade
  minScore: number
  maxScore: number
  isMaxBenefit: boolean
  labelUz: string
  labelRu: string
  color: string
  bg: string
}

export const GRADE_CONFIG: readonly GradeMeta[] = [
  {
    grade: 'A+',
    minScore: 70.0,
    maxScore: 75.0,
    isMaxBenefit: true,
    labelUz: 'Maksimal imtiyoz (A+)',
    labelRu: 'Максимальная льгота (A+)',
    color: '#10b981', // emerald-500
    bg: 'rgba(16, 185, 129, 0.12)',
  },
  {
    grade: 'A',
    minScore: 65.0,
    maxScore: 69.9,
    isMaxBenefit: true,
    labelUz: 'Maksimal imtiyoz (A)',
    labelRu: 'Максимальная льгота (A)',
    color: '#059669', // emerald-600
    bg: 'rgba(5, 150, 105, 0.12)',
  },
  {
    grade: 'B+',
    minScore: 60.0,
    maxScore: 64.9,
    isMaxBenefit: false,
    labelUz: 'Proporsional imtiyoz (80%)',
    labelRu: 'Пропорциональная льгота (80%)',
    color: '#3b82f6', // blue-500
    bg: 'rgba(59, 130, 246, 0.12)',
  },
  {
    grade: 'B',
    minScore: 55.0,
    maxScore: 59.9,
    isMaxBenefit: false,
    labelUz: 'Proporsional imtiyoz (73.3%)',
    labelRu: 'Пропорциональная льгота (73.3%)',
    color: '#6366f1', // indigo-500
    bg: 'rgba(99, 102, 241, 0.12)',
  },
  {
    grade: 'C+',
    minScore: 50.0,
    maxScore: 54.9,
    isMaxBenefit: false,
    labelUz: 'Proporsional imtiyoz (66.7%)',
    labelRu: 'Пропорциональная льгота (66.7%)',
    color: '#f59e0b', // amber-500
    bg: 'rgba(245, 158, 11, 0.12)',
  },
  {
    grade: 'C',
    minScore: 46.0,
    maxScore: 49.9,
    isMaxBenefit: false,
    labelUz: 'Proporsional imtiyoz (61.3%)',
    labelRu: 'Пропорциональная льгота (61.3%)',
    color: '#d97706', // amber-600
    bg: 'rgba(217, 119, 6, 0.12)',
  },
]

export interface DtmBenefit {
  grade: CertificateGrade | null
  rashScore: number
  isPassed: boolean
  percentOfMax: number
  major1Score: number
  major2Score: number
  mandatoryFullScore: boolean
  gradeMeta: GradeMeta | null
  summaryUz: string
  summaryRu: string
}

/**
 * Rash ballidan (0–75) darajani aniqlaydi.
 * 46 dan past bo'lsa null qaytaradi.
 */
export function getCertificateGrade(rashScore: number): CertificateGrade | null {
  if (rashScore < MILLIY_SERTIFIKAT_MIN_PASS) return null
  for (const item of GRADE_CONFIG) {
    if (rashScore >= item.minScore) return item.grade
  }
  return null
}

/**
 * To'g'ri javoblar sonidan Rash shkalasidagi taxminiy ballni hisoblaydi (0–75).
 */
export function calculateRashScore(correctCount: number, totalQuestions: number): number {
  if (totalQuestions <= 0 || correctCount <= 0) return 0
  const boundedCorrect = Math.min(correctCount, totalQuestions)
  const ratio = boundedCorrect / totalQuestions
  // Rash shkalasiga 0.1 aniqlikda yaxlitlash
  const rawScore = ratio * MILLIY_SERTIFIKAT_MAX_SCORE
  return Math.round(rawScore * 10) / 10
}

/**
 * Sertifikat balli (0–75) bo'yicha DTM imtiyozlarini to'liq hisoblaydi.
 */
export function calculateDtmBenefit(rashScore: number): DtmBenefit {
  const boundedScore = Math.max(0, Math.min(MILLIY_SERTIFIKAT_MAX_SCORE, Math.round(rashScore * 10) / 10))
  const grade = getCertificateGrade(boundedScore)
  const isPassed = grade !== null
  const gradeMeta = GRADE_CONFIG.find((m) => m.grade === grade) ?? null

  if (!isPassed) {
    return {
      grade: null,
      rashScore: boundedScore,
      isPassed: false,
      percentOfMax: 0,
      major1Score: 0,
      major2Score: 0,
      mandatoryFullScore: false,
      gradeMeta: null,
      summaryUz: "Sertifikat berilmaydi (< 46 ball)",
      summaryRu: 'Сертификат не выдается (< 46 баллов)',
    }
  }

  if (grade === 'A+' || grade === 'A') {
    return {
      grade,
      rashScore: boundedScore,
      isPassed: true,
      percentOfMax: 100,
      major1Score: MAJOR_1_MAX_SCORE,
      major2Score: MAJOR_2_MAX_SCORE,
      mandatoryFullScore: true,
      gradeMeta,
      summaryUz: "100% maksimal ball (testdan ozod)",
      summaryRu: '100% максимальный балл (освобождение)',
    }
  }

  // B+, B, C+, C — proporsional hisob
  const ratio = boundedScore / MILLIY_SERTIFIKAT_MAX_SCORE
  const percentOfMax = Math.round(ratio * 1000) / 10
  const major1Score = Math.round(ratio * MAJOR_1_MAX_SCORE * 10) / 10
  const major2Score = Math.round(ratio * MAJOR_2_MAX_SCORE * 10) / 10

  return {
    grade,
    rashScore: boundedScore,
    isPassed: true,
    percentOfMax,
    major1Score,
    major2Score,
    mandatoryFullScore: true, // Majburiy fanda darajadan qat'i nazar maksimal ball!
    gradeMeta,
    summaryUz: `Proporsional ball: ${major1Score} / ${major2Score}`,
    summaryRu: `Пропорциональный балл: ${major1Score} / ${major2Score}`,
  }
}
