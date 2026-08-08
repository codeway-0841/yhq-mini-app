/**
 * Rasmiy imtihon simulyatori preset'lari — YAGONA MANBA (frontend + testlar).
 *
 * Format rejami (Talent/DTM talabalari oqimi):
 *   - milliy-sertifikat: 45 savol / 3 soat (har bir fan uchun alohida)
 *   - attestatsiya:      50 savol / 2 soat
 *
 * QOIDALAR:
 *   - Pause YO'Q: timer wall-clock (useTimer) — background/reload orqali
 *     vaqtni to'xtatib qo'yib bo'lmaydi.
 *   - Natija bahosiz (o'tdi/o'tmadi mezoni qo'llanMAYDI) — faqat hisobot.
 *   - Yakunda mavzular kesimida diagnostika ko'rsatiladi (ResultsModal).
 *
 * Fanga qaysi preset'lar tegishliligi `shared/subjects.ts` dagi
 * `examPresets` maydonida (desync — tests/unit/config/exam-presets.test.ts).
 */

export interface ExamPreset {
  id: string
  questionCount: number
  durationMinutes: number
}

export const EXAM_PRESETS = [
  { id: 'milliy-sertifikat', questionCount: 45, durationMinutes: 180 },
  { id: 'attestatsiya',      questionCount: 50, durationMinutes: 120 },
] as const satisfies readonly ExamPreset[]

export type ExamPresetId = (typeof EXAM_PRESETS)[number]['id']

export function getExamPreset(id: string): ExamPreset | null {
  return EXAM_PRESETS.find((p) => p.id === id) ?? null
}

/**
 * Test rejimini preset'ga resolve qiladi.
 * Format: `exam:<presetId>` (masalan 'exam:attestatsiya').
 * Boshqa modellar ('exam', 'mock', 'random50'...) → null.
 */
export function resolveExamMode(mode: string | null | undefined): ExamPreset | null {
  if (!mode || !mode.startsWith('exam:')) return null
  return getExamPreset(mode.slice('exam:'.length))
}
