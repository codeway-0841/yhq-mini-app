/**
 * Fanlar (subjects) — YAGONA MA'LUMOT MANBAI (frontend + backend umumiy).
 *
 * Yangi fan qo'shish uchun FAQAT shu ro'yxatga 1 element qo'shish kifoya:
 *   - Frontend (`src/config/subjects.tsx`) icon/color qatlamini shu yerdaq
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
}

/**
 * `as const` — har bir maydon literal type bo'ladi:
 *   - SubjectId union compile-time'da avtomatik hosil bo'ladi (typo'lar ushlanadi)
 *   - Ro'yxat o'zgarmas (readonly) — runtime'da tasodifiy mutatsiya imkonsiz
 */
export const SUBJECT_BASES = [
  { id: 'yhq',        name: "Yo'l harakati qoidalari", nameRu: 'Правила дорожного движения', icon: '🚗', dataSourceId: 'traffic_rules_db', available: true, demoData: false },
  { id: 'fizika',     name: 'Fizika',                  nameRu: 'Физика',                     icon: '⚡', dataSourceId: 'traffic_rules_db', available: true, demoData: true },
  { id: 'matematika', name: 'Matematika',              nameRu: 'Математика',                 icon: 'π',  dataSourceId: 'traffic_rules_db', available: true, demoData: true },
  { id: 'kimyo',      name: 'Kimyo',                   nameRu: 'Химия',                      icon: '🧪', dataSourceId: 'traffic_rules_db', available: true, demoData: true },
  { id: 'ingliz',     name: 'Ingliz tili',             nameRu: 'Английский язык',            icon: '🇬🇧', dataSourceId: 'traffic_rules_db', available: true, demoData: true },
  { id: 'tarix',      name: 'Tarix',                   nameRu: 'История',                    icon: '📖', dataSourceId: 'traffic_rules_db', available: true, demoData: true },
  { id: 'biologiya',  name: 'Biologiya',               nameRu: 'Биология',                   icon: '🧬', dataSourceId: 'traffic_rules_db', available: true, demoData: true },
] as const satisfies readonly SubjectBase[]

/**
 * Barcha mavjud fan id'lari — literal union.
 * 'yhq' | 'fizika' | 'matematika' | 'kimyo' | 'ingliz' | 'tarix' | 'biologiya'
 */
export type SubjectId = (typeof SUBJECT_BASES)[number]['id']

export const DEFAULT_SUBJECT_ID: SubjectId = 'yhq'
