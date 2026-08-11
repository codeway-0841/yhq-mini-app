import { Coins, Award } from 'lucide-react'
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
    <div className="px-4">
      <div className="rounded-2xl p-4 bg-pcard border border-pline">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-bold text-pfg">
            {lang === 'ru' ? 'Ваш уровень' : 'Darajangiz'}
          </h3>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pprimary/10 border border-pprimary/30">
            <Award size={14} className="text-pprimary" />
            <span className="text-[12px] font-bold text-pprimary">
              {lang === 'ru' ? `Уровень ${level}` : `Daraja ${level}`}
            </span>
          </div>
        </div>

        <div className="w-full h-3 rounded-full bg-pcanvas overflow-hidden mb-2.5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percent}%`,
              background: 'linear-gradient(90deg, var(--p-primary), color-mix(in srgb, var(--p-primary) 70%, #fff))',
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-psubtle font-medium">
            {pointsInLevel.toLocaleString()} / {pointsNeeded.toLocaleString()}
          </span>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9.5px] text-pmuted">
              {lang === 'ru' ? 'Награда след. уровня' : 'Keyingi daraja mukofoti'}
            </span>
            <div className="flex items-center gap-1">
              <Coins size={12} className="text-pgold" />
              <span className="text-[12px] font-bold text-pgold">{nextReward.toLocaleString()} token</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
