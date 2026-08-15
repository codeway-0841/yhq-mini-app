/**
 * Fanlar (subjects) — YAGONA MA'LUMOT MANBAI (frontend + backend umumiy).
 *
 * Yangi fan qo'shish uchun FAQAT shu ro'yxatga 1 element qo'shish kifoya:
 *   - Frontend (`src/shared/config/subjects.tsx`) icon/color qatlamini shu yerdaq
 *     `id` bo'yicha ulaydi;
 *   - Backend (`server/config/subjects.ts`) registry'ni shu yerdan quradi.
 *
 * available: false → UI'da "Tez kunda" (locked), backend'da isActive: false.
 * demoData:  true  → fan vaqtincha boshqa (YHQ) bazasidan ishlayapti; UI'da
 *                    "Vaqtinchalik demo ma'lumotlar" badge'i chiqadi.
 */
export interface SubjectBase {
  id: string
  name: string
  nameRu: string
  /** Emoji — backend registry (Telegram API javoblari) uchun */
  icon: string
  /** Ma'lumotlar bazasi manbai (server/providers/ dagi provider id) */
  dataSourceId: string
  available: boolean
  demoData: boolean
  /**
   * Rasmiy imtihon simulyatori preset'lari (shared/exam-presets.ts id'lari).
   * YHQ'ning o'z formati ('mock' rejimi) alohida — bu ro'yxat bo'sh.
   * Desync — tests/unit/config/exam-presets.test.ts ushlaydi.
   */
  examPresets: readonly string[]
}

/**
 * `as const` — har bir maydon literal type bo'ladi:
 *   - SubjectId union compile-time'da avtomatik hosil bo'ladi (typo'lar ushlanadi)
 *   - Ro'yxat o'zgarmas (readonly) — runtime'da tasodifiy mutatsiya imkonsiz
 */
export const SUBJECT_BASES = [
  { id: 'yhq',        name: "Yo'l harakati qoidalari", nameRu: 'Правила дорожного движения', icon: '🚗', dataSourceId: 'traffic_rules_db', available: true, demoData: false, examPresets: [] },
  { id: 'rustili',    name: 'Rus tili',                nameRu: 'Русский язык',               icon: '🇷🇺', dataSourceId: 'russian_db',       available: true, demoData: false, examPresets: ['milliy-sertifikat', 'attestatsiya'] },
  { id: 'fizika',     name: 'Fizika',                  nameRu: 'Физика',                     icon: '⚡', dataSourceId: 'physics_db',       available: true, demoData: false, examPresets: ['milliy-sertifikat', 'attestatsiya'] },
  { id: 'matematika', name: 'Matematika',              nameRu: 'Математика',                 icon: 'π',  dataSourceId: 'math_db',          available: true, demoData: false, examPresets: ['milliy-sertifikat', 'attestatsiya'] },
  { id: 'kimyo',      name: 'Kimyo',                   nameRu: 'Химия',                      icon: '🧪', dataSourceId: 'chemistry_db',     available: true, demoData: false, examPresets: ['milliy-sertifikat', 'attestatsiya'] },
  { id: 'ingliz',     name: 'Ingliz tili',             nameRu: 'Английский язык',            icon: '🇬🇧', dataSourceId: 'english_db',       available: true, demoData: false, examPresets: ['milliy-sertifikat', 'attestatsiya'] },
  { id: 'tarix',      name: 'Tarix',                   nameRu: 'История',                    icon: '📖', dataSourceId: 'history_db',       available: true, demoData: false, examPresets: ['milliy-sertifikat', 'attestatsiya'] },
  { id: 'biologiya',  name: 'Biologiya',               nameRu: 'Биология',                   icon: '🧬', dataSourceId: 'biology_db',       available: true, demoData: false, examPresets: ['milliy-sertifikat', 'attestatsiya'] },
] as const satisfies readonly SubjectBase[]

/**
 * Barcha mavjud fan id'lari — literal union.
 * 'yhq' | 'fizika' | 'matematika' | 'kimyo' | 'ingliz' | 'tarix' | 'biologiya'
 */
export type SubjectId = (typeof SUBJECT_BASES)[number]['id']

export const DEFAULT_SUBJECT_ID: SubjectId = 'yhq'

/**
 * Fan-bog'langan savol kaliti — multi-fan identity (P1-3).
 *
 * Savol id'lari har bir fan bankasida MUSTAQIL raqamlanadi; global ishlatish
 * bookmark/xato qaydlarini fanlar orasida chalkashtirardi (hozir demo fanlar
 * bitta bazani ulashgani uchun ham bu muammo real).
 *
 * Format: `${subjectId}:${questionId}` — masalan 'yhq:123', 'fizika:123'.
 * `wrongByTicket` kalitlari va `savedQuestions` elementlari SHU formatda.
 */
export function questionKey(subjectId: string, questionId: number): string {
  return `${subjectId}:${questionId}`
}

/** Composite kalitni parse qiladi; format noto'g'ri bo'lsa null. */
export function parseQuestionKey(key: string): { subjectId: string; questionId: number } | null {
  const i = key.indexOf(':')
  if (i <= 0) return null
  const questionId = Number(key.slice(i + 1))
  if (!Number.isInteger(questionId) || questionId < 1) return null
  return { subjectId: key.slice(0, i), questionId }
}
