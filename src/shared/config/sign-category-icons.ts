import {
  TriangleAlert, Milestone, Ban, CircleCheck, Info, Hospital, ClipboardList, Car,
  type LucideIcon,
} from 'lucide-react'

/**
 * Belgi kategoriyasi id → lucide ikonka (v3: emoji o'rniga).
 *
 * NEGA BU YERDA: `content/signs.ts` sof statik ma'lumot (arxitektura qoidasi:
 * content/ hech qanday kod import qilmaydi). `shared/config/` da turishi
 * `subjects.tsx` UI_MAP naqshiga mos — bir nechta feature (signs, flashcards)
 * shu mappingdan foydalanadi.
 */
const SIGN_CATEGORY_ICONS: Record<string, LucideIcon> = {
  ogohlantiruvchi: TriangleAlert,
  imtiyoz:         Milestone,
  taqiqlovchi:     Ban,
  buyuruvchi:      CircleCheck,
  axborot:         Info,
  servis:          Hospital,
  qoshimcha:       ClipboardList,
  transport:       Car,
  taniqlik:        Car,
}

export function getSignCategoryIcon(id: string): LucideIcon {
  return SIGN_CATEGORY_ICONS[id] ?? Info
}
