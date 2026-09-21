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

export interface AchievementDef {
  id:     string
  icon?:  LucideIcon
  badgeImage?: string
  color:  string
  category: AchievementCategory
  /** i18n kaliti */
  titleKey: TKey
  target: number
  /** Joriy progress (stats'dan) */
  get: (s: AchievementStats) => number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Marralar (Milestones — 14 ta) ──────────────────────────────────────
  { id: 'correct100',    icon: CheckCircle2, badgeImage: '/badges/badge-100.png',    color: '#941B44', category: 'milestone', titleKey: 'achCorrect100',    target: 100,    get: (s) => s.totalCorrect },
  { id: 'correct500',    icon: CheckCircle2, badgeImage: '/badges/badge-500.png',    color: '#7c4a21', category: 'milestone', titleKey: 'achCorrect500',    target: 500,    get: (s) => s.totalCorrect },
  { id: 'correct1000',   icon: CheckCircle2, badgeImage: '/badges/badge-1000.png',   color: '#1A3C8B', category: 'milestone', titleKey: 'achCorrect1000',   target: 1000,   get: (s) => s.totalCorrect },
  { id: 'correct2000',   icon: CheckCircle2, badgeImage: '/badges/badge-2000.png',   color: '#0B2E75', category: 'milestone', titleKey: 'achCorrect2000',   target: 2000,   get: (s) => s.totalCorrect },
  { id: 'correct10000',  icon: CheckCircle2, badgeImage: '/badges/badge-10000.png',  color: '#086e58', category: 'milestone', titleKey: 'achCorrect10000',  target: 10000,  get: (s) => s.totalCorrect },
  { id: 'correct15000',  icon: CheckCircle2, badgeImage: '/badges/badge-15000.png',  color: '#165b33', category: 'milestone', titleKey: 'achCorrect15000',  target: 15000,  get: (s) => s.totalCorrect },
  { id: 'correct20000',  icon: CheckCircle2, badgeImage: '/badges/badge-20000.png',  color: '#27578b', category: 'milestone', titleKey: 'achCorrect20000',  target: 20000,  get: (s) => s.totalCorrect },
  { id: 'correct25000',  icon: CheckCircle2, badgeImage: '/badges/badge-25000.png',  color: '#9e1b32', category: 'milestone', titleKey: 'achCorrect25000',  target: 25000,  get: (s) => s.totalCorrect },
  { id: 'correct30000',  icon: CheckCircle2, badgeImage: '/badges/badge-30000.png',  color: '#b57c00', category: 'milestone', titleKey: 'achCorrect30000',  target: 30000,  get: (s) => s.totalCorrect },
  { id: 'correct35000',  icon: CheckCircle2, badgeImage: '/badges/badge-35000.png',  color: '#5e1c50', category: 'milestone', titleKey: 'achCorrect35000',  target: 35000,  get: (s) => s.totalCorrect },
  { id: 'correct40000',  icon: CheckCircle2, badgeImage: '/badges/badge-40000.png',  color: '#006d77', category: 'milestone', titleKey: 'achCorrect40000',  target: 40000,  get: (s) => s.totalCorrect },
  { id: 'correct45000',  icon: CheckCircle2, badgeImage: '/badges/badge-45000.png',  color: '#c85a17', category: 'milestone', titleKey: 'achCorrect45000',  target: 45000,  get: (s) => s.totalCorrect },
  { id: 'correct50000',  icon: CheckCircle2, badgeImage: '/badges/badge-50000.png',  color: '#24208a', category: 'milestone', titleKey: 'achCorrect50000',  target: 50000,  get: (s) => s.totalCorrect },
  { id: 'correct100000', icon: CheckCircle2, badgeImage: '/badges/badge-100000.png', color: '#d4af37', category: 'milestone', titleKey: 'achCorrect100000', target: 100000, get: (s) => s.totalCorrect },

  // ── Nishonlar: Fanlar bo'yicha 100 ta test yutuqlari (9 ta) ───────────────
  { id: 'subject_matematika_100', icon: CheckCircle2, badgeImage: '/badges/badge-subject-matematika.png', color: '#27578b', category: 'badge', titleKey: 'achSubjectMatematika100', target: 100, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'matematika')?.answered ?? 0 },
  { id: 'subject_fizika_100',     icon: CheckCircle2, badgeImage: '/badges/badge-subject-fizika.png',     color: '#1A3C8B', category: 'badge', titleKey: 'achSubjectFizika100',     target: 100, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'fizika')?.answered ?? 0 },
  { id: 'subject_biologiya_100',  icon: CheckCircle2, badgeImage: '/badges/badge-subject-biologiya.png',  color: '#165b33', category: 'badge', titleKey: 'achSubjectBiologiya100',  target: 100, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'biologiya')?.answered ?? 0 },
  { id: 'subject_tarix_100',      icon: CheckCircle2, badgeImage: '/badges/badge-subject-tarix.png',      color: '#7c4a21', category: 'badge', titleKey: 'achSubjectTarix100',      target: 100, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'tarix')?.answered ?? 0 },
  { id: 'subject_geografiya_100', icon: CheckCircle2, badgeImage: '/badges/badge-subject-geografiya.png', color: '#086e58', category: 'badge', titleKey: 'achSubjectGeografiya100', target: 100, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'geografiya')?.answered ?? 0 },
  { id: 'subject_onatili_100',    icon: CheckCircle2, badgeImage: '/badges/badge-subject-onatili.png',    color: '#165b33', category: 'badge', titleKey: 'achSubjectOnatili100',    target: 100, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'onatili')?.answered ?? 0 },
  { id: 'subject_adabiyot_100',   icon: CheckCircle2, badgeImage: '/badges/badge-subject-adabiyot.png',   color: '#b57c00', category: 'badge', titleKey: 'achSubjectAdabiyot100',   target: 100, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'adabiyot')?.answered ?? 0 },
  { id: 'subject_rustili_100',    icon: CheckCircle2, badgeImage: '/badges/badge-subject-rustili.png',    color: '#1A3C8B', category: 'badge', titleKey: 'achSubjectRustili100',    target: 100, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'rustili')?.answered ?? 0 },
  { id: 'subject_kimyo_100',      icon: CheckCircle2, badgeImage: '/badges/badge-subject-kimyo.png',      color: '#006d77', category: 'badge', titleKey: 'achSubjectKimyo100',      target: 100, get: (s) => s.subjectAccuracy?.find((x) => x.subjectId === 'kimyo')?.answered ?? 0 },

  // ── Nishonlar: Maxsus Yutuqlar (Special / Mythic Badges — 9 ta) ────────────
  { id: 'perfectRun',           icon: CheckCircle2, badgeImage: '/badges/badge-target-accuracy.png', color: '#7c3aed', category: 'badge', titleKey: 'achPerfectRun',           target: 1,     get: (s) => s.bestStreak >= 30 ? 1 : (s.allPassed80 ? 1 : 0) },
  { id: 'winStreak10',          icon: CheckCircle2, badgeImage: '/badges/badge-league-champion.png', color: '#6366f1', category: 'badge', titleKey: 'achWinStreak10',          target: 10,    get: (s) => s.octagonWins },
  { id: 'speedMaster',          icon: CheckCircle2, badgeImage: '/badges/badge-speed-master.png',    color: '#06b6d4', category: 'badge', titleKey: 'achSpeedMaster',          target: 30,    get: (s) => s.totalCorrect },
  { id: 'streak7',              icon: CheckCircle2, badgeImage: '/badges/badge-streak-7.png',        color: '#ea580c', category: 'badge', titleKey: 'ach7DayStreak',           target: 7,     get: (s) => s.bestStreak },
  { id: 'streak30',             icon: CheckCircle2, badgeImage: '/badges/badge-streak-7.png',        color: '#b45309', category: 'badge', titleKey: 'ach30DayStreak',          target: 30,    get: (s) => s.bestStreak },
  { id: 'allSubjectsMaster',    icon: CheckCircle2, badgeImage: '/badges/badge-all-subjects-80.png', color: '#059669', category: 'badge', titleKey: 'achAllSubjectsMaster',    target: 3,     get: (s) => s.subjectAccuracy?.filter((x) => x.answered >= 20).length ?? 0 },
  { id: 'errorHunter',          icon: CheckCircle2, badgeImage: '/badges/badge-target-accuracy.png', color: '#dc2626', category: 'badge', titleKey: 'achErrorHunter',          target: 100,   get: (s) => s.totalFixed },
  { id: 'achievementCollector', icon: CheckCircle2, badgeImage: '/badges/badge-octagon-10.png',      color: '#2563eb', category: 'badge', titleKey: 'achAchievementCollector', target: 20,    get: (s) => s.totalCorrect >= 5000 ? 20 : Math.floor(s.totalCorrect / 250) },
  { id: 'kivviLegend',          icon: CheckCircle2, badgeImage: '/badges/badge-kivvi-master.png',    color: '#d97706', category: 'badge', titleKey: 'achKivviLegend',          target: 50000, get: (s) => s.totalCorrect },
]

export const MILESTONES = ACHIEVEMENTS.filter((a) => a.category === 'milestone')
export const BADGES = ACHIEVEMENTS.filter((a) => a.category === 'badge')

export function isUnlocked(d: AchievementDef, s: AchievementStats): boolean {
  return d.get(s) >= d.target
}

export function getBadgeUrl(def: AchievementDef): string | null {
  return resolveBadgeUrl(def.badgeImage)
}
