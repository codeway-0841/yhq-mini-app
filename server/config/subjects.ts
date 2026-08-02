/**
 * SubjectRegistry (backend) — fanlar va ularning DATA SOURCE'lari.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * YANGI FAN BAZASI QO'SHISH TARTIBI (kelajakda):
 *   1. `server/providers/` ichida yangi provider class yozing
 *      (QuestionBankProvider interfeysini implementatsiya qilsin)
 *   2. `server/providers/index.ts` dagi PROVIDERS map'ga qo'shing
 *   3. Shu faylda tegishli fanning `dataSourceId`sini yangi provayder id'siga
 *      o'zgartiring — QOLGAN KOD UMUMAN O'ZGARMAYDI (frontend ham).
 * ═══════════════════════════════════════════════════════════════════════
 *
 * fan (id) !== baza (dataSourceId): hozir barcha fanlar vaqtincha
 * "traffic_rules_db" dan foydalanadi (demoData: true — UI'da badge chiqadi).
 */
export interface SubjectRegistryEntry {
  id: string
  name: string
  nameRu: string
  icon: string
  dataSourceId: string
  isActive: boolean
  /** true — fan hozircha boshqa (YHQ) bazasidan ishlayapti;
      UI'da "Vaqtinchalik demo ma'lumotlar" badge'i chiqadi */
  demoData: boolean
}

export const SUBJECT_REGISTRY: SubjectRegistryEntry[] = [
  { id: 'yhq',        name: "Yo'l harakati qoidalari", nameRu: 'Правила дорожного движения', icon: '🚗', dataSourceId: 'traffic_rules_db', isActive: true, demoData: false },
  { id: 'fizika',     name: 'Fizika',                  nameRu: 'Физика',                     icon: '⚡', dataSourceId: 'traffic_rules_db', isActive: true, demoData: true },
  { id: 'matematika', name: 'Matematika',              nameRu: 'Математика',                 icon: 'π',  dataSourceId: 'traffic_rules_db', isActive: true, demoData: true },
  { id: 'kimyo',      name: 'Kimyo',                   nameRu: 'Химия',                      icon: '🧪', dataSourceId: 'traffic_rules_db', isActive: true, demoData: true },
  { id: 'ingliz',     name: 'Ingliz tili',             nameRu: 'Английский язык',            icon: '🇬🇧', dataSourceId: 'traffic_rules_db', isActive: true, demoData: true },
  { id: 'tarix',      name: 'Tarix',                   nameRu: 'История',                    icon: '📖', dataSourceId: 'traffic_rules_db', isActive: true, demoData: true },
]

export const DEFAULT_SUBJECT_ID = 'yhq'

export function resolveSubject(subjectId: string | undefined): SubjectRegistryEntry {
  const entry = SUBJECT_REGISTRY.find((s) => s.id === subjectId)
  return entry ?? SUBJECT_REGISTRY.find((s) => s.id === DEFAULT_SUBJECT_ID)!
}

export const SUBJECT_IDS = SUBJECT_REGISTRY.map((s) => s.id)
