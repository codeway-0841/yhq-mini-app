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
      <div className="rounded-2xl p-4 bg-pcard border border-pline h-full">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-[13px] font-bold text-pfg">
            {lang === 'ru' ? 'Ваш уровень' : 'Darajangiz'}
          </h3>
          <img src="/shop/ui/medal.png" alt="" loading="lazy" draggable={false}
            className="w-12 h-12 object-contain -mt-1 pointer-events-none" />
        </div>

        <p className="text-[15px] font-bold text-pfg mb-2">
          {lang === 'ru' ? `Уровень ${level}` : `Daraja ${level}`}
        </p>

        <div className="w-full h-2.5 rounded-full bg-pcanvas overflow-hidden mb-1.5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percent}%`,
              background: 'linear-gradient(90deg, var(--p-primary), color-mix(in srgb, var(--p-primary) 70%, #fff))',
            }}
          />
        </div>
        <p className="text-[11px] text-psubtle font-medium mb-3">
          {pointsInLevel.toLocaleString()} / {pointsNeeded.toLocaleString()}
        </p>

        <div className="pt-2.5 border-t border-pline/50 flex items-center justify-between gap-2">
          <span className="text-[10px] text-pmuted">
            {lang === 'ru' ? 'Награда след. уровня' : 'Keyingi daraja mukofoti'}
          </span>
          <div className="flex items-center gap-1.5">
            <img src="/shop/ui/coins-sm.png" alt="" loading="lazy" draggable={false}
              className="w-6 h-6 object-contain pointer-events-none" />
            <span className="text-[13px] font-black text-pgold">{nextReward.toLocaleString()} token</span>
          </div>
        </div>
      </div>
    </div>
  )
}
