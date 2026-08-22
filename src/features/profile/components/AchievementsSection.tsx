import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { api, type AchievementStats } from '../../../shared/api'
import { ACHIEVEMENTS, isUnlocked } from '../../../shared/config/achievements'
import { type Lang, type useT } from '../../../shared/i18n'
import { cn } from '../../../shared/lib/cn'
import { Section } from './Section'

// ── Yutuqlar (Achievements) — server metrikalari asosida badge'lar ──────
export function AchievementsSection({ lang, tt, userId }: {
  lang: Lang
  tt: ReturnType<typeof useT>
  userId?: string
}) {
  const [stats, setStats] = useState<AchievementStats | null>(null)

  useEffect(() => {
    if (!userId || userId === '0') return
    api.getAchievements(userId).then((d) => setStats(d.stats)).catch(() => {})
  }, [userId, lang])

  if (!stats) return null
  const unlockedCount = ACHIEVEMENTS.filter((a) => isUnlocked(a, stats)).length

  return (
    <Section title={tt('achTitle').toUpperCase()}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-[11px] font-semibold tabular-nums text-pmuted">
          {unlockedCount} / {ACHIEVEMENTS.length}
        </span>
        <div className="h-[3px] flex-1 overflow-hidden rounded-[2px] bg-plineStrong">
          <div className="h-full rounded-[2px] bg-pprimary transition-[width] duration-[400ms] ease-out"
            style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-y-4 p-4">
        {/* Olingan yutuqlar birinchi — keyin eng yaqinlari */}
        {[...ACHIEVEMENTS]
          .sort((a, b) => Number(isUnlocked(b, stats)) - Number(isUnlocked(a, stats)))
          .map((a) => {
          const unlocked = isUnlocked(a, stats)
          const cur      = Math.min(a.get(stats), a.target)
          const pct      = a.target > 1 ? Math.round((cur / a.target) * 100) : (unlocked ? 100 : 0)
          const Icon     = a.icon
          return (
            <div key={a.id} className="flex flex-col items-center px-1 text-center">
              {/* v3: radial gradient + glow + grayscale MEDAL o'rniga squircle tile.
                  Ochilgan — yutuq rangida tint; yopiq — neytral sirt, past opacity. */}
              <div className="relative mb-2">
                <div
                  className={cn(
                    'flex size-[52px] items-center justify-center rounded-[16px] transition-colors duration-[120ms] ease-out',
                    !unlocked && 'border border-pline bg-psurface opacity-50',
                  )}
                  style={unlocked
                    ? {
                        background: `color-mix(in srgb, ${a.color} 12%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${a.color} 26%, transparent)`,
                      }
                    : undefined}
                >
                  <Icon size={22} strokeWidth={1.75} style={{ color: unlocked ? a.color : 'var(--p-subtle)' }} />
                </div>
                {unlocked && (
                  <span className="absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full border-2 border-pcard bg-psuccess">
                    <Check size={9} strokeWidth={3} className="text-white" />
                  </span>
                )}
              </div>
              <p className={cn('line-clamp-2 text-[10.5px] font-semibold leading-tight text-pfg', !unlocked && 'opacity-60')}>
                {tt(a.titleKey)}
              </p>
              {/* Progress */}
              <div className="mt-2 h-[2px] w-full max-w-[64px] overflow-hidden rounded-[1px] bg-plineStrong">
                <div className="h-full rounded-[1px] transition-[width] duration-[400ms] ease-out"
                  style={{ width: `${pct}%`, background: unlocked ? a.color : 'var(--p-subtle)' }} />
              </div>
              <p className="mt-1 text-[9.5px] font-semibold tabular-nums"
                style={{ color: unlocked ? a.color : 'var(--p-subtle)' }}>
                {/* Ochilganda ham RAQAM ko'rsatiladi (✓ belgisi emas) — ustun
                    bo'ylab bir xil o'qiladi; "ochilgan" holati allaqachon
                    tile rangi va burchakdagi check nishoni bilan berilgan. */}
                {cur}/{a.target}
              </p>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
