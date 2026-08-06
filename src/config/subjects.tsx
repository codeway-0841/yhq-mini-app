/**
 * Fanlar (subjects) — MARKAZIY KONFIGURATSIYA (frontend UI qatlami).
 * Asosiy ma'lumotlar (id, name, dataSourceId, available, demoData)
 * `shared/subjects.ts` dan olinadi — backend bilan yagona manba.
 * Bu fayl FAQAT UI xususiyatlarini (ikonka, rang) qo'shadi.
 *
 * Yangi fan qo'shish uchun `shared/subjects.ts` ga 1 element + shu fayldagi
 * UI_MAP ga 1 yozuv kifoya: Onboarding, Dashboard, Switcher avtomatik ishlaydi.
 *
 * available: false → "Tez kunda" holatida ko'rsatiladi (locked).
 */
import { Car, Zap, FlaskConical, Globe, BookOpen, Dna, type LucideIcon, type LucideProps } from 'lucide-react'
import { forwardRef } from 'react'
import { SUBJECT_BASES, DEFAULT_SUBJECT_ID, type SubjectId } from '../../shared/subjects'

export { DEFAULT_SUBJECT_ID }
export type { SubjectId }

export interface SubjectConfig {
  id: SubjectId
  name: string
  nameRu: string
  icon: LucideIcon
  /** Asosiy accent rang (duo-palitraga mos) */
  color: string
  /** 3D-soya / gradient pastki rang */
  colorDark: string
  /** Backend'dagi baza manbasi (shared/subjects.ts — backend bilan bir xil) */
  dataSourceId: string
  /** true — fan hozircha boshqa (YHQ) bazasidan ishlayapti; UI'da
      "Vaqtinchalik demo ma'lumotlar" badge'i chiqadi */
  demoData: boolean
  available: boolean
}

/** π belgisi — lucide'da yo'qligi uchun maxsus ikonka */
const PiGlyph: LucideIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, ...rest }, ref) => (
    <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...rest}>
      <text x="12" y="17.5" textAnchor="middle" fontSize="17" fontWeight="900" fontFamily="Nunito, sans-serif">π</text>
    </svg>
  ),
)
PiGlyph.displayName = 'PiGlyph'

/** UI xususiyatlari — shared/subjects.ts dagi `id` bo'yicha ulanadi.
    Record<SubjectId, ...> — fan qo'shilib UI_MAP unutilsa COMPILE-TIME xato */
const UI_MAP: Record<SubjectId, { icon: LucideIcon; color: string; colorDark: string }> = {
  yhq:        { icon: Car,          color: '#58cc02', colorDark: '#46a302' },
  fizika:     { icon: Zap,          color: '#ffc800', colorDark: '#e5b400' },
  matematika: { icon: PiGlyph,      color: '#ce82ff', colorDark: '#a85ed4' },
  kimyo:      { icon: FlaskConical, color: '#1cb0f6', colorDark: '#1899d6' },
  ingliz:     { icon: Globe,        color: '#ff9600', colorDark: '#e59400' },
  tarix:      { icon: BookOpen,     color: '#ff4b4b', colorDark: '#d93f3f' },
  biologiya:  { icon: Dna,          color: '#00cd9c', colorDark: '#00a87e' },
}

export const SUBJECTS: SubjectConfig[] = SUBJECT_BASES.map((s) => {
  const ui = UI_MAP[s.id] // Record<SubjectId,...> — compile-time'da kafolatlangan
  return {
    id: s.id,
    name: s.name,
    nameRu: s.nameRu,
    icon: ui.icon,
    color: ui.color,
    colorDark: ui.colorDark,
    dataSourceId: s.dataSourceId,
    demoData: s.demoData,
    available: s.available,
  }
})

export function getSubject(id: string): SubjectConfig {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0]
}
