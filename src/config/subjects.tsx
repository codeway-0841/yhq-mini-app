/**
 * Fanlar (subjects) — MARKAZIY KONFIGURATSIYA.
 * Yangi fan qo'shish uchun faqat shu ro'yxatga 1 element qo'shish kifoya:
 * Onboarding, Dashboard, Switcher — hammasi avtomatik ishlaydi.
 *
 * available: false → "Tez kunda" holatida ko'rsatiladi (locked).
 * available: true bo'lishi uchun fan ma'lumotlari (API/questions) tayyor bo'lishi kerak.
 */
import { Car, Zap, FlaskConical, Globe, BookOpen, type LucideIcon, type LucideProps } from 'lucide-react'

export interface SubjectConfig {
  id: string
  name: string
  nameRu: string
  icon: LucideIcon
  /** Asosiy accent rang (duo-palitraga mos) */
  color: string
  /** 3D-soya / gradient pastki rang */
  colorDark: string
  /** Backend'dagi baza manbasi (server/config/subjects.ts bilan bir xil) */
  dataSourceId: string
  /** true — fan hozircha boshqa (YHQ) bazasidan ishlayapti; UI'da
      "Vaqtinchalik demo ma'lumotlar" badge'i chiqadi */
  demoData: boolean
  available: boolean
}

/** π belgisi — lucide'da yo'qligi uchun maxsus ikonka */
import { forwardRef } from 'react'

const PiGlyph: LucideIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, ...rest }, ref) => (
    <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...rest}>
      <text x="12" y="17.5" textAnchor="middle" fontSize="17" fontWeight="900" fontFamily="Nunito, sans-serif">π</text>
    </svg>
  ),
)
PiGlyph.displayName = 'PiGlyph'

export const SUBJECTS: SubjectConfig[] = [
  {
    id: 'yhq',
    name: "Yo'l harakati qoidalari",
    nameRu: 'Правила дорожного движения',
    icon: Car,
    color: '#58cc02',
    colorDark: '#46a302',
    dataSourceId: 'traffic_rules_db',
    demoData: false,
    available: true,
  },
  {
    id: 'fizika',
    name: 'Fizika',
    nameRu: 'Физика',
    icon: Zap,
    color: '#ffc800',
    colorDark: '#e5b400',
    dataSourceId: 'traffic_rules_db',
    demoData: true,
    available: true,
  },
  {
    id: 'matematika',
    name: 'Matematika',
    nameRu: 'Математика',
    icon: PiGlyph,
    color: '#ce82ff',
    colorDark: '#a85ed4',
    dataSourceId: 'traffic_rules_db',
    demoData: true,
    available: true,
  },
  {
    id: 'kimyo',
    name: 'Kimyo',
    nameRu: 'Химия',
    icon: FlaskConical,
    color: '#1cb0f6',
    colorDark: '#1899d6',
    dataSourceId: 'traffic_rules_db',
    demoData: true,
    available: true,
  },
  {
    id: 'ingliz',
    name: 'Ingliz tili',
    nameRu: 'Английский язык',
    icon: Globe,
    color: '#ff9600',
    colorDark: '#e59400',
    dataSourceId: 'traffic_rules_db',
    demoData: true,
    available: true,
  },
  {
    id: 'tarix',
    name: 'Tarix',
    nameRu: 'История',
    icon: BookOpen,
    color: '#ff4b4b',
    colorDark: '#d93f3f',
    dataSourceId: 'traffic_rules_db',
    demoData: true,
    available: true,
  },
]

export const DEFAULT_SUBJECT_ID = 'yhq'

export function getSubject(id: string): SubjectConfig {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0]
}
