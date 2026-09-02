import { memo, useEffect } from 'react'
import { Flame, Trophy } from 'lucide-react'
import Confetti from '../../../shared/components/Confetti'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { playSound } from '../../../shared/lib/sounds'
import { Button } from '../../../shared/components/ui/button'

// ══ Streak MILESTONE sahna — 7/14/30/60/100 kunga yetganda to'liq ekran ═════
export const MILESTONES = [7, 14, 30, 60, 100] as const

export function milestoneSeen(subjectId: string): number[] {
  try { return JSON.parse(localStorage.getItem(`yhq-milestones-${subjectId}`) ?? '[]') } catch { return [] }
}
export function milestoneMark(subjectId: string, m: number): void {
  const seen = milestoneSeen(subjectId)
  if (!seen.includes(m)) localStorage.setItem(`yhq-milestones-${subjectId}`, JSON.stringify([...seen, m]))
}

/**
 * Nishonlash sahnasi uchun umumiy qobiq.
 *
 * v3: 60px glow soya, emoji va drop-shadow olib tashlandi. Bayram hissi
 * konfetti + katta tabular raqam + aksentlangan ikonka tile bilan beriladi —
 * "yorug'lik portlashi" bilan emas.
 */
const Scene = memo(function Scene({
  icon: Icon, tone, eyebrow, value, message, cta, labelId, onClose,
}: {
  icon: typeof Flame
  /** CSS o'zgaruvchi nomi, masalan `--p-warning` */
  tone: string
  eyebrow: string
  value: number
  message: string
  cta: string
  labelId: string
  onClose: () => void
}) {
  useEffect(() => { playSound('win') }, [])
  return (
    <DialogOverlay
      onClose={onClose}
      position="center"
      zIndex={70}
      labelId={labelId}
      backdropClassName="bg-black/70 backdrop-blur-sm"
      className="p-6"
    >
      <Confetti count={40} />
      <div className="relative w-full max-w-[300px] rounded-3xl bg-pcard p-8 text-center shadow-2xl motion-safe:animate-premiumIn">
        <div
          className="mx-auto mb-4 flex size-14 items-center justify-center rounded-[16px]"
          style={{
            background: `color-mix(in srgb, var(${tone}) 12%, transparent)`,
            border: `1px solid color-mix(in srgb, var(${tone}) 26%, transparent)`,
          }}
        >
          <Icon size={26} strokeWidth={1.75} style={{ color: `var(${tone})` }} />
        </div>
        <p id={labelId} className="mb-1 text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: `var(${tone})` }}>
          {eyebrow}
        </p>
        <p className="font-display text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-pfg">
          {value}
        </p>
        <p className="mb-6 mt-2 text-[14px] text-pmuted">{message}</p>
        <Button block onClick={onClose}>{cta}</Button>
      </div>
    </DialogOverlay>
  )
})

export const MilestoneScene = memo(function MilestoneScene({ streak, lang, onClose }: {
  streak: number; lang: 'uz' | 'ru'; onClose: () => void
}) {
  return (
    <Scene
      icon={Flame}
      tone="--p-warning"
      labelId="milestone-title"
      eyebrow={lang === 'ru' ? 'Новый рекорд' : 'Yangi yutuq'}
      value={streak}
      message={lang === 'ru' ? 'дней подряд. Невероятная дисциплина.' : 'kun ketma-ket. Ajoyib intizom.'}
      cta={lang === 'ru' ? 'Продолжить' : 'Davom etish'}
      onClose={onClose}
    />
  )
})

// ── Level-Up sahna — yangi darajaga yetganda ────────────────────────────────
export const LevelUpScene = memo(function LevelUpScene({ level, lang, onClose }: {
  level: number; lang: 'uz' | 'ru'; onClose: () => void
}) {
  return (
    <Scene
      icon={Trophy}
      tone="--p-purple"
      labelId="levelup-title"
      eyebrow={lang === 'ru' ? 'Новый уровень' : 'Yangi level'}
      value={level}
      message={lang === 'ru' ? 'Так держать — продолжайте в том же духе.' : 'Barakalla — xuddi shunday davom eting.'}
      cta={lang === 'ru' ? 'Вперёд' : 'Oldinga'}
      onClose={onClose}
    />
  )
})
