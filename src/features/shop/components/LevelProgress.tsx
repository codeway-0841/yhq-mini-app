import { Coins } from 'lucide-react'
import { LEVEL_REWARDS } from '../data'

interface Props {
  totalCorrect: number
  lang: 'uz' | 'ru'
}

export function LevelProgress({ totalCorrect, lang }: Props) {
  const level = Math.floor(totalCorrect / 50) + 1
  const pointsInLevel = totalCorrect % 50
  const pointsNeeded = 50
  const percent = Math.min(100, (pointsInLevel / pointsNeeded) * 100)
  const nextReward = LEVEL_REWARDS.find((r) => r.level === level + 1)?.tokens ?? 3000

  return (
    <div className="mx-4 mt-4 rounded-2xl p-4 bg-pcard border border-pline">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-bold text-pfg">
          {lang === 'ru' ? 'Ваш уровень' : 'Darajangiz'}
        </h3>
        <span className="text-[12px] font-bold text-pprimary">
          {lang === 'ru' ? `Уровень ${level}` : `Daraja ${level}`}
        </span>
      </div>

      <div className="w-full h-2.5 rounded-full bg-pcanvas overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(90deg, var(--p-primary), color-mix(in srgb, var(--p-primary) 70%, #fff))',
          }}
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10.5px] text-psubtle">
          {pointsInLevel} / {pointsNeeded}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10.5px] text-pmuted">
            {lang === 'ru' ? 'Награда:' : 'Mukofot:'}
          </span>
          <Coins size={11} className="text-pgold" />
          <span className="text-[11px] font-bold text-pgold">{nextReward.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
