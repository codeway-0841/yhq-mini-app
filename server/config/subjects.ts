/**
 * SubjectRegistry (backend) — fanlar va ularning DATA SOURCE'lari.
 * Ma'lumotlar `shared/subjects.ts` dan olinadi (frontend bilan yagona manba).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * YANGI FAN BAZASI QO'SHISH TARTIBI (kelajakda):
 *   1. `server/providers/` ichida yangi provider class yozing
 *      (QuestionBankProvider interfeysini implementatsiya qilsin)
 *   2. `server/providers/index.ts` dagi PROVIDERS map'ga qo'shing
 *   3. `shared/subjects.ts` da tegishli fanning `dataSourceId`sini yangi
 *      provayder id'siga o'zgartiring — QOLGAN KOD UMUMAN O'ZGARMAYDI.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * fan (id) !== baza (dataSourceId): hozir barcha fanlar vaqtincha
 * "traffic_rules_db" dan foydalanadi (demoData: true — UI'da badge chiqadi).
 */
import { SUBJECT_BASES, DEFAULT_SUBJECT_ID } from '../../shared/subjects'

export { DEFAULT_SUBJECT_ID }

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

export const SUBJECT_REGISTRY: SubjectRegistryEntry[] = SUBJECT_BASES.map((s) => ({
  id: s.id,
  name: s.name,
  nameRu: s.nameRu,
  icon: s.icon,
  dataSourceId: s.dataSourceId,
  isActive: s.available,
  demoData: s.demoData,
}))

export function resolveSubject(subjectId: string | undefined): SubjectRegistryEntry {
  const entry = SUBJECT_REGISTRY.find((s) => s.id === subjectId)
  return entry ?? SUBJECT_REGISTRY.find((s) => s.id === DEFAULT_SUBJECT_ID)!
}

export const SUBJECT_IDS = SUBJECT_REGISTRY.map((s) => s.id)
