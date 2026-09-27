/**
 * Yutuqlar (Achievements) konfiguratsiyasi — MARKAZIY RO'YXAT.
 * Badge qoidalari shu yerda; server faqat(`GET /api/achievements`) metrikalarni
 * beradi, shu config asosida holat/progress ko'rsatiladi.
 * Yangi yutuq qo'shish = 1 ta element qo'shish + i18n kalit.
 */
import { CheckCircle2, type LucideIcon } from 'lucide-react'
import type { AchievementStats } from '../api'
import type { t as tFunc } from '../i18n'
import { resolveBadgeUrl } from './cdn'

type TKey = Parameters<typeof tFunc>[1]

export type AchievementCategory = 'milestone' | 'badge'
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'mythic'

export interface AchievementDef {
  id:     string
  icon?:  LucideIcon
  badgeImage?: string
  color:  string
  category: AchievementCategory
  tier:   AchievementTier
  /** i18n kaliti */
  titleKey: TKey
  descKey:  TKey
  target: number
  reward: { xp: number; coins: number }
  rarityPercent: number
  /** Joriy progress (stats'dan) */
  get: (s: AchievementStats) => number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Marralar (Milestones — 14 ta) ──────────────────────────────────────
  { id: 'correct100',    icon: CheckCircle2, badgeImage: '/badges/badge-100.webp',    color: '#941B44', category: 'milestone', tier: 'bronze', titleKey: 'achCorrect100',    descKey: 'achCorrect100Desc',    target: 100,    reward: { xp: 50, coins: 10 },    rarityPercent: 65,  get: (s) => s.totalCorrect },
  { id: 'correct500',    icon: CheckCircle2, badgeImage: '/badges/badge-500.webp',    color: '#7c4a21', category: 'milestone', tier: 'bronze', titleKey: 'achCorrect500',    descKey: 'achCorrect500Desc',    target: 500,    reward: { xp: 100, coins: 20 },   rarityPercent: 42,  get: (s) => s.totalCorrect },
  { id: 'correct1000',   icon: CheckCircle2, badgeImage: '/badges/badge-1000.webp',   color: '#1A3C8B', category: 'milestone', tier: 'silver', titleKey: 'achCorrect1000',   descKey: 'achCorrect1000Desc',   target: 1000,   reward: { xp: 200, coins: 35 },   rarityPercent: 28,  get: (s) => s.totalCorrect },
  { id: 'correct2000',   icon: CheckCircle2, badgeImage: '/badges/badge-2000.webp',   color: '#0B2E75', category: 'milestone', tier: 'silver', titleKey: 'achCorrect2000',   descKey: 'achCorrect2000Desc',   target: 2000,   reward: { xp: 300, coins: 50 },   rarityPercent: 18,  get: (s) => s.totalCorrect },
  { id: 'correct10000',  icon: CheckCircle2, badgeImage: '/badges/badge-10000.webp',  color: '#086e58', category: 'milestone', tier: 'gold',   titleKey: 'achCorrect10000',  descKey: 'achCorrect10000Desc',  target: 10000,  reward: { xp: 600, coins: 100 },  rarityPercent: 8.5, get: (s) => s.totalCorrect },
  { id: 'correct15000',  icon: CheckCircle2, badgeImage: '/badges/badge-15000.webp',  color: '#165b33', category: 'milestone', tier: 'gold',   titleKey: 'achCorrect15000',  descKey: 'achCorrect15000Desc',  target: 15000,  reward: { xp: 800, coins: 130 },  rarityPercent: 6.2, get: (s) => s.totalCorrect },
  { id: 'correct20000',  icon: CheckCircle2, badgeImage: '/badges/badge-20000.webp',  color: '#27578b', category: 'milestone', tier: 'gold',   titleKey: 'achCorrect20000',  descKey: 'achCorrect20000Desc',  target: 20000,  reward: { xp: 1000, coins: 160 }, rarityPercent: 4.8, get: (s) => s.totalCorrect },
  { id: 'correct25000',  icon: CheckCircle2, badgeImage: '/badges/badge-25000.webp',  color: '#9e1b32', category: 'milestone', tier: 'gold',   titleKey: 'achCorrect25000',  descKey: 'achCorrect25000Desc',  target: 25000,  reward: { xp: 1200, coins: 200 }, rarityPercent: 3.5, get: (s) => s.totalCorrect },
  { id: 'correct30000',  icon: CheckCircle2, badgeImage: '/badges/badge-30000.webp',  color: '#b57c00', category: 'milestone', tier: 'mythic', titleKey: 'achCorrect30000',  descKey: 'achCorrect30000Desc',  target: 30000,  reward: { xp: 1500, coins: 250 }, rarityPercent: 2.4, get: (s) => s.totalCorrect },
  { id: 'correct35000',  icon: CheckCircle2, badgeImage: '/badges/badge-35000.webp',  color: '#5e1c50', category: 'milestone', tier: 'mythic', titleKey: 'achCorrect35000',  descKey: 'achCorrect35000Desc',  target: 35000,  reward: { xp: 1800, coins: 300 }, rarityPercent: 1.8, get: (s) => s.totalCorrect },
  { id: 'correct40000',  icon: CheckCircle2, badgeImage: '/badges/badge-40000.webp',  color: '#006d77', category: 'milestone', tier: 'mythic', titleKey: 'achCorrect40000',  descKey: 'achCorrect40000Desc',  target: 40000,  reward: { xp: 2000, coins: 350 }, rarityPercent: 1.2, get: (s) => s.totalCorrect },
  { id: 'correct45000',  icon: CheckCircle2, badgeImage: '/badges/badge-45000.webp',  color: '#c85a17', category: 'milestone', tier: 'mythic', titleKey: 'achCorrect45000',  descKey: 'achCorrect45000Desc',  target: 45000,  reward: { xp: 2500, coins: 400 }, rarityPercent: 0.9, get: (s) => s.totalCorrect },
  { id: 'correct50000',  icon: CheckCircle2, badgeImage: '/badges/badge-50000.webp',  color: '#24208a', category: 'milestone', tier: 'mythic', titleKey: 'achCorrect50000',  descKey: 'achCorrect50000Desc',  target: 50000,  reward: { xp: 3000, coins: 500 }, rarityPercent: 0.6, get: (s) => s.totalCorrect },
  { id: 'correct100000', icon: CheckCircle2, badgeImage: '/badges/badge-100000.webp', color: '#d4af37', category: 'milestone', tier: 'mythic', titleKey: 'achCorrect100000', descKey: 'achCorrect100000Desc', target: 100000, reward: { xp: 5000, coins: 1000 },rarityPercent: 0.1, get: (s) => s.totalCorrect },

  // ── Nishonlar: Fanlar bo'yicha 100 ta test yutuqlari (9 ta) ───────────────
  { id: 'subject_matematika_100', icon: CheckCircle2, badgeImage: '/badges/badge-subject-matematika.webp', color: '#27578b', category: 'badge', tier: 'silver', titleKey: 'achSubjectMatematika100', descKey: 'achSubjectMatematika100Desc', target: 100, reward: { xp: 150, coins: 30 }, rarityPercent: 24, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'matematika')?.answered ?? 0 },
  { id: 'subject_fizika_100',     icon: CheckCircle2, badgeImage: '/badges/badge-subject-fizika.webp',     color: '#1A3C8B', category: 'badge', tier: 'silver', titleKey: 'achSubjectFizika100',     descKey: 'achSubjectFizika100Desc',     target: 100, reward: { xp: 150, coins: 30 }, rarityPercent: 21, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'fizika')?.answered ?? 0 },
  { id: 'subject_biologiya_100',  icon: CheckCircle2, badgeImage: '/badges/badge-subject-biologiya.webp',  color: '#165b33', category: 'badge', tier: 'silver', titleKey: 'achSubjectBiologiya100',  descKey: 'achSubjectBiologiya100Desc',  target: 100, reward: { xp: 150, coins: 30 }, rarityPercent: 19, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'biologiya')?.answered ?? 0 },
  { id: 'subject_tarix_100',      icon: CheckCircle2, badgeImage: '/badges/badge-subject-tarix.webp',      color: '#7c4a21', category: 'badge', tier: 'silver', titleKey: 'achSubjectTarix100',      descKey: 'achSubjectTarix100Desc',      target: 100, reward: { xp: 150, coins: 30 }, rarityPercent: 22, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'tarix')?.answered ?? 0 },
  { id: 'subject_geografiya_100', icon: CheckCircle2, badgeImage: '/badges/badge-subject-geografiya.webp', color: '#086e58', category: 'badge', tier: 'silver', titleKey: 'achSubjectGeografiya100', descKey: 'achSubjectGeografiya100Desc', target: 100, reward: { xp: 150, coins: 30 }, rarityPercent: 18, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'geografiya')?.answered ?? 0 },
  { id: 'subject_onatili_100',    icon: CheckCircle2, badgeImage: '/badges/badge-subject-onatili.webp',    color: '#165b33', category: 'badge', tier: 'silver', titleKey: 'achSubjectOnatili100',    descKey: 'achSubjectOnatili100Desc',    target: 100, reward: { xp: 150, coins: 30 }, rarityPercent: 26, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'onatili')?.answered ?? 0 },
  { id: 'subject_adabiyot_100',   icon: CheckCircle2, badgeImage: '/badges/badge-subject-adabiyot.webp',   color: '#b57c00', category: 'badge', tier: 'silver', titleKey: 'achSubjectAdabiyot100',   descKey: 'achSubjectAdabiyot100Desc',   target: 100, reward: { xp: 150, coins: 30 }, rarityPercent: 20, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'adabiyot')?.answered ?? 0 },
  { id: 'subject_rustili_100',    icon: CheckCircle2, badgeImage: '/badges/badge-subject-rustili.webp',    color: '#1A3C8B', category: 'badge', tier: 'silver', titleKey: 'achSubjectRustili100',    descKey: 'achSubjectRustili100Desc',    target: 100, reward: { xp: 150, coins: 30 }, rarityPercent: 23, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'rustili')?.answered ?? 0 },
  { id: 'subject_kimyo_100',      icon: CheckCircle2, badgeImage: '/badges/badge-subject-kimyo.webp',      color: '#006d77', category: 'badge', tier: 'silver', titleKey: 'achSubjectKimyo100',      descKey: 'achSubjectKimyo100Desc',      target: 100, reward: { xp: 150, coins: 30 }, rarityPercent: 17, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'kimyo')?.answered ?? 0 },

  // ── Nishonlar: Maxsus Yutuqlar (Special / Mythic Badges — 9 ta) ────────────
  { id: 'perfectRun',           icon: CheckCircle2, badgeImage: '/badges/badge-target-accuracy.webp', color: '#7c3aed', category: 'badge', tier: 'gold',   titleKey: 'achPerfectRun',           descKey: 'achPerfectRunDesc',           target: 1,     reward: { xp: 400, coins: 75 },   rarityPercent: 12,  get: (s) => s.bestStreak >= 30 ? 1 : (s.allPassed80 ? 1 : 0) },
  { id: 'winStreak10',          icon: CheckCircle2, badgeImage: '/badges/badge-league-champion.webp', color: '#6366f1', category: 'badge', tier: 'gold',   titleKey: 'achWinStreak10',          descKey: 'achWinStreak10Desc',          target: 10,    reward: { xp: 500, coins: 100 },  rarityPercent: 9.4, get: (s) => s.octagonWins },
  { id: 'speedMaster',          icon: CheckCircle2, badgeImage: '/badges/badge-speed-master.webp',    color: '#06b6d4', category: 'badge', tier: 'silver', titleKey: 'achSpeedMaster',          descKey: 'achSpeedMasterDesc',          target: 30,    reward: { xp: 250, coins: 40 },   rarityPercent: 16,  get: (s) => s.totalCorrect },
  { id: 'streak7',              icon: CheckCircle2, badgeImage: '/badges/badge-streak-7.webp',        color: '#ea580c', category: 'badge', tier: 'bronze', titleKey: 'ach7DayStreak',           descKey: 'ach7DayStreakDesc',           target: 7,     reward: { xp: 100, coins: 20 },   rarityPercent: 35,  get: (s) => s.bestStreak },
  { id: 'streak30',             icon: CheckCircle2, badgeImage: '/badges/badge-streak-7.webp',        color: '#b45309', category: 'badge', tier: 'gold',   titleKey: 'ach30DayStreak',          descKey: 'ach30DayStreakDesc',          target: 30,    reward: { xp: 600, coins: 120 },  rarityPercent: 7.8, get: (s) => s.bestStreak },
  { id: 'allSubjectsMaster',    icon: CheckCircle2, badgeImage: '/badges/badge-all-subjects-80.webp', color: '#059669', category: 'badge', tier: 'gold',   titleKey: 'achAllSubjectsMaster',    descKey: 'achAllSubjectsMasterDesc',    target: 3,     reward: { xp: 750, coins: 150 },  rarityPercent: 6.5, get: (s) => s.subjectAccuracy?.filter((x) => x.answered >= 20).length ?? 0 },
  { id: 'errorHunter',          icon: CheckCircle2, badgeImage: '/badges/badge-target-accuracy.webp', color: '#dc2626', category: 'badge', tier: 'silver', titleKey: 'achErrorHunter',          descKey: 'achErrorHunterDesc',          target: 100,   reward: { xp: 300, coins: 50 },   rarityPercent: 14,  get: (s) => s.totalFixed },
  { id: 'achievementCollector', icon: CheckCircle2, badgeImage: '/badges/badge-octagon-10.webp',      color: '#2563eb', category: 'badge', tier: 'mythic', titleKey: 'achAchievementCollector', descKey: 'achAchievementCollectorDesc', target: 20,    reward: { xp: 1500, coins: 300 }, rarityPercent: 2.1, get: (s) => s.totalCorrect >= 5000 ? 20 : Math.floor(s.totalCorrect / 250) },
  { id: 'kivviLegend',          icon: CheckCircle2, badgeImage: '/badges/badge-kivvi-master.webp',    color: '#d97706', category: 'badge', tier: 'mythic', titleKey: 'achKivviLegend',          descKey: 'achKivviLegendDesc',          target: 50000, reward: { xp: 3500, coins: 777 }, rarityPercent: 0.4, get: (s) => s.totalCorrect },
]

export const MILESTONES = ACHIEVEMENTS.filter((a) => a.category === 'milestone')
export const BADGES = ACHIEVEMENTS.filter((a) => a.category === 'badge')

export function isUnlocked(d: AchievementDef, s: AchievementStats): boolean {
  return d.get(s) >= d.target
}

export function getBadgeUrl(def: AchievementDef): string | null {
  return resolveBadgeUrl(def.badgeImage)
}
