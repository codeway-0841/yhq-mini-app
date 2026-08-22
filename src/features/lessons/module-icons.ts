import {
  Signpost, Route, CircleParking, CornerUpLeft, AlertTriangle,
  Gauge, Footprints, ShieldCheck, BookOpen, type LucideIcon,
} from 'lucide-react'

/**
 * Darslik moduli id → lucide ikonka (v3: emoji o'rniga).
 *
 * NEGA BU YERDA: `src/content/modules.ts` — sof statik ma'lumot (arxitektura
 * qoidasi: content/ hech qanday kod import qilmaydi). Bu esa UI mapping,
 * `subjects.tsx` UI_MAP naqshi bo'yicha.
 *
 * Yangi modul qo'shilsa bu yerga ham yozing — bo'lmasa `BookOpen` fallback.
 */
const MODULE_ICONS: Record<number, LucideIcon> = {
  1: Signpost,        // Yo'l belgilari
  2: Route,           // Chorrahalar
  3: CircleParking,   // To'xtash va to'xtab turish
  4: CornerUpLeft,    // Asosiy manyovrlar
  5: AlertTriangle,   // Maxsus vaziyatlar
  6: Gauge,           // Tezlik va masofa
  7: Footprints,      // Piyodalar va velosipedlar
  8: ShieldCheck,     // Xavfsizlik va yakuniy
}

export function getModuleIcon(id: number): LucideIcon {
  return MODULE_ICONS[id] ?? BookOpen
}
