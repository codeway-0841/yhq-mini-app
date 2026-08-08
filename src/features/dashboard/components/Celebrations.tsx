import { memo, useEffect } from 'react'
import Confetti from '../../../shared/components/Confetti'
import { playSound } from '../../../shared/lib/sounds'

// ══ Streak MILESTONE sahna — 7/14/30/60/100 kunga yetganda to'liq ekran ═════
export const MILESTONES = [7, 14, 30, 60, 100] as const

export function milestoneSeen(subjectId: string): number[] {
  try { return JSON.parse(localStorage.getItem(`yhq-milestones-${subjectId}`) ?? '[]') } catch { return [] }
}
export function milestoneMark(subjectId: string, m: number): void {
  const seen = milestoneSeen(subjectId)
  if (!seen.includes(m)) localStorage.setItem(`yhq-milestones-${subjectId}`, JSON.stringify([...seen, m]))
}

export const MilestoneScene = memo(function MilestoneScene({ streak, lang, onClose }: {
  streak: number; lang: 'uz' | 'ru'; onClose: () => void
}) {
  useEffect(() => { playSound('win') }, [])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <Confetti count={40} />
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card-premium rounded-[28px] p-8 text-center max-w-[300px] w-full animate-premiumIn"
        style={{ borderColor: 'rgba(245, 158, 11, 0.40)', boxShadow: '0 0 60px -12px rgba(245, 158, 11, 0.40)' }}>
        <div className="text-6xl mb-3" style={{ filter: 'drop-shadow(0 0 16px rgba(245,158,11,0.7))' }}>🔥</div>
        <p className="text-[13px] font-semibold text-pwarning uppercase tracking-[0.14em] mb-1">
          {lang === 'ru' ? 'НОВЫЙ РЕКОРД' : 'YANGI YUTUQ'}
        </p>
        <p className="text-[42px] font-bold text-pfg leading-none tabular-nums">{streak}</p>
        <p className="text-[15px] font-semibold text-pmuted mt-1.5 mb-6">
          {lang === 'ru' ? 'дней подряд! Невероятная дисциплина 💪' : 'kun ketma-ket! Ajoyib intizom 💪'}
        </p>
        <button onClick={onClose} className="btn-premium w-full h-[52px] rounded-2xl text-[14px]">
          {lang === 'ru' ? 'Продолжить' : 'Davom etish'}
        </button>
      </div>
    </div>
  )
})

// ── Level-Up sahna — yangi darajaga yetganda ────────────────────────────────
export const LevelUpScene = memo(function LevelUpScene({ level, lang, onClose }: {
  level: number; lang: 'uz' | 'ru'; onClose: () => void
}) {
  useEffect(() => { playSound('win') }, [])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <Confetti count={40} />
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card-premium rounded-[28px] p-8 text-center max-w-[300px] w-full animate-premiumIn"
        style={{ borderColor: 'rgb(var(--p-purple-rgb) / 0.40)', boxShadow: '0 0 60px -12px rgb(var(--p-purple-rgb) / 0.40)' }}>
        <div className="text-6xl mb-3" style={{ filter: 'drop-shadow(0 0 16px rgb(var(--p-purple-rgb) / 0.7))' }}>🏆</div>
        <p className="text-[13px] font-semibold text-ppurple uppercase tracking-[0.14em] mb-1">
          {lang === 'ru' ? 'НОВЫЙ УРОВЕНЬ' : 'YANGI LEVEL'}
        </p>
        <p className="text-[42px] font-bold text-pfg leading-none tabular-nums">{level}</p>
        <p className="text-[15px] font-semibold text-pmuted mt-1.5 mb-6">
          {lang === 'ru' ? 'Так держать! Продолжайте в том же духе 🚀' : 'Barakalla! Xuddi shunday davom eting 🚀'}
        </p>
        <button onClick={onClose} className="btn-premium w-full h-[52px] rounded-2xl text-[14px]">
          {lang === 'ru' ? 'Вперёд!' : 'Oldinga!'}
        </button>
      </div>
    </div>
  )
})
