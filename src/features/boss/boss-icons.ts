import { Shield, Flame, Crown, Mountain, Swords, type LucideIcon } from 'lucide-react'

/**
 * Boss id → lucide ikonka (v3: emoji avatarlar o'rniga).
 *
 * NEGA BU YERDA: `shared/boss-battle.ts` — server ham o'qiydigan kontrakt,
 * unga React/lucide bog'liqligi kiritilmaydi. Bu esa sof UI mapping,
 * `subjects.tsx` dagi UI_MAP bilan bir xil naqsh.
 *
 * Yangi boss qo'shilsa bu yerga ham yozing — bo'lmasa `Swords` fallback ishlaydi
 * (interfeys sinmaydi, faqat ikonka umumiy bo'ladi).
 */
const BOSS_ICONS: Record<string, LucideIcon> = {
  'xavf-timsoli':      Shield,
  'sirpanchiq-ajdar':  Flame,
  'qoida-sheri':       Crown,
  'tirbandlik-maxluq': Mountain,
}

export function getBossIcon(bossKey: string): LucideIcon {
  return BOSS_ICONS[bossKey] ?? Swords
}
