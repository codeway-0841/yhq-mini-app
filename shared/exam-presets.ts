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

/**
 * Rasmiy fan spetsifikatsiyalari (UzBMB / 5ball.uz) bo'yicha Milliy sertifikat
 * davomiyligi va savollar soni taqsimoti.
 * Boshqa fanlar (yoki berilmagan holat) default 45 savol / 180 daqiqadan foydalanadi.
 */
export const SUBJECT_MILLIY_OVERRIDES: Record<string, { questionCount?: number; durationMinutes?: number }> = {
  matematika: { questionCount: 45, durationMinutes: 150 },
  fizika:     { questionCount: 45, durationMinutes: 150 },
  tarix:      { questionCount: 45, durationMinutes: 90 },
  geografiya: { questionCount: 45, durationMinutes: 150 },
  kimyo:      { questionCount: 43, durationMinutes: 180 },
  biologiya:  { questionCount: 45, durationMinutes: 180 },
  onatili:    { questionCount: 45, durationMinutes: 180 },
  adabiyot:   { questionCount: 45, durationMinutes: 180 },
  rustili:    { questionCount: 45, durationMinutes: 180 },
}

/** Runtime validation (zod/API) uchun ham ayni SSOT'dan hosil qilingan ID'lar. */
export const EXAM_PRESET_IDS = EXAM_PRESETS.map((preset) => preset.id) as [
  ExamPresetId,
  ...ExamPresetId[],
]

/**
 * Barqaror obyekt referenslari keshi (Audit H6 himoyasi):
 * Har renderda yangi obyekt yaratilsa, React hooks (useMemo, useEffect) dependency
 * tekshiruvi buzilib, test savollari va javoblari har soniyada qayta aralashib ketadi.
 * Barcha kombinatsiyalar 1 marta yaratilib, keshlanadi.
 */
const PRESET_CACHE = new Map<string, ExamPreset>()

for (const preset of EXAM_PRESETS) {
  PRESET_CACHE.set(preset.id, preset)
  if (preset.id === 'milliy-sertifikat') {
    for (const [subj, override] of Object.entries(SUBJECT_MILLIY_OVERRIDES)) {
      PRESET_CACHE.set(
        `${preset.id}:${subj}`,
        Object.freeze({
          id: preset.id,
          questionCount: override.questionCount ?? preset.questionCount,
          durationMinutes: override.durationMinutes ?? preset.durationMinutes,
        }),
      )
    }
  }
}

export function getExamPreset(id: string, subjectId?: string): ExamPreset | null {
  if (subjectId) {
    const key = `${id}:${subjectId}`
    const hit = PRESET_CACHE.get(key)
    if (hit) return hit
  }
  return PRESET_CACHE.get(id) ?? null
}

/**
 * Test rejimini preset'ga resolve qiladi.
 * Format: `exam:<presetId>` (masalan 'exam:attestatsiya' yoki 'exam:milliy-sertifikat').
 * Boshqa modellar ('exam', 'mock', 'marathon'...) → null.
 */
export function resolveExamMode(mode: string | null | undefined, subjectId?: string): ExamPreset | null {
  if (!mode || !mode.startsWith('exam:')) return null
  return getExamPreset(mode.slice('exam:'.length), subjectId)
}
