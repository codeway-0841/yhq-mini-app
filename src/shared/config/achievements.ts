/**
 * Yutuqlar (Achievements) konfiguratsiyasi — MARKAZIY RO'YXAT.
 * Badge qoidalari shu yerda; server faqat(`GET /api/achievements`) metrikalarni
 * beradi, shu config asosida holat/progress ko'rsatiladi.
 * Yangi yutuq qo'shish = 1 ta element qo'shish + i18n kalit.
 */
import { Flame, CheckCircle2, ListChecks, HeartCrack, Swords, Trophy, type LucideIcon } from 'lucide-react'
import type { AchievementStats } from '../api'
import type { t as tFunc } from '../i18n'

type TKey = Parameters<typeof tFunc>[1]

export interface AchievementDef {
  id:     string
  icon:   LucideIcon
  color:  string
  /** i18n kalith */
  titleKey: TKey
  target: number
  /** Joriy progress (stats'dan) */
  get: (s: AchievementStats) => number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'streak7',      icon: Flame,        color: '#ff9600', titleKey: 'achStreak7',     target: 7,    get: (s) => s.bestStreak },
  { id: 'streak14',     icon: Flame,        color: '#ffc800', titleKey: 'achStreak14',    target: 14,   get: (s) => s.bestStreak },
  { id: 'streak30',     icon: Flame,        color: '#ff4b4b', titleKey: 'achStreak30',    target: 30,   get: (s) => s.bestStreak },
  { id: 'correct100',   icon: CheckCircle2, color: '#58cc02', titleKey: 'achCorrect100',  target: 100,  get: (s) => s.totalCorrect },
  { id: 'correct500',   icon: CheckCircle2, color: '#58cc02', titleKey: 'achCorrect500',  target: 500,  get: (s) => s.totalCorrect },
  { id: 'correct1000',  icon: CheckCircle2, color: '#58cc02', titleKey: 'achCorrect1000', target: 1000, get: (s) => s.totalCorrect },
  { id: 'answered500',  icon: ListChecks,   color: '#1cb0f6', titleKey: 'achAnswered500', target: 500,  get: (s) => s.totalAnswered },
  { id: 'fixed10',      icon: HeartCrack,   color: '#ff4b4b', titleKey: 'achFixed10',     target: 10,   get: (s) => s.totalFixed },
  { id: 'fixed50',      icon: HeartCrack,   color: '#a855f7', titleKey: 'achFixed50',     target: 50,   get: (s) => s.totalFixed },
  { id: 'octagon10',    icon: Swords,       color: '#38bdf8', titleKey: 'achOctagon10',   target: 10,   get: (s) => s.octagonWins },
  { id: 'allsubjects80',icon: Trophy,       color: '#ffc800', titleKey: 'achAllSubj80',   target: 1,    get: (s) => (s.allPassed80 ? 1 : 0) },
]

export function isUnlocked(d: AchievementDef, s: AchievementStats): boolean {
  return d.get(s) >= d.target
}
