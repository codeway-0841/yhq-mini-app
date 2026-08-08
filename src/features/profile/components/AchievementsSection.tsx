import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { api, type AchievementStats } from '../../../shared/api'
import { ACHIEVEMENTS, isUnlocked } from '../../../shared/config/achievements'
import { type Lang, type useT } from '../../../shared/i18n'
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
      <div className="px-4 py-2 flex items-center gap-2 border-b border-line/50">
        <span className="text-[11px] font-bold text-muted">
          {unlockedCount} / {ACHIEVEMENTS.length}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
          <div className="h-full rounded-full bg-duo-yellow transition-all"
            style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-y-3 p-3">
        {/* Olingan yutuqlar birinchi — keyin eng yaqinlari */}
        {[...ACHIEVEMENTS]
          .sort((a, b) => Number(isUnlocked(b, stats)) - Number(isUnlocked(a, stats)))
          .map((a) => {
          const unlocked = isUnlocked(a, stats)
          const cur      = Math.min(a.get(stats), a.target)
          const pct      = a.target > 1 ? Math.round((cur / a.target) * 100) : (unlocked ? 100 : 0)
          const Icon     = a.icon
          return (
            <div key={a.id} className="flex flex-col items-center text-center px-1">
              {/* Medal: aylana + tashqi halqa/glow */}
              <div className="relative mb-1.5">
                <div className="w-[58px] h-[58px] rounded-full flex items-center justify-center transition-all"
                  style={unlocked
                    ? {
                        background: `radial-gradient(circle at 35% 30%, ${a.color}55, ${a.color}1a 70%), ${a.color}14`,
                        border: `2.5px solid ${a.color}`,
                        boxShadow: `0 0 18px ${a.color}66, inset 0 2px 6px rgba(255,255,255,0.12)`,
                      }
                    : {
                        background: 'var(--theme-elevated)',
                        border: '2.5px solid var(--theme-line)',
                        filter: 'grayscale(1)',
                        opacity: 0.55,
                      }}>
                  <Icon size={24} style={{ color: unlocked ? a.color : 'var(--theme-fg-muted)' }} />
                </div>
                {unlocked && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-duo-green border-2 border-surface flex items-center justify-center">
                    <Check size={11} strokeWidth={3.5} className="text-white" />
                  </div>
                )}
              </div>
              <p className="text-[10.5px] font-bold text-fg leading-tight line-clamp-2"
                style={{ opacity: unlocked ? 1 : 0.6 }}>
                {tt(a.titleKey)}
              </p>
              {/* Progress bar */}
              <div className="w-full max-w-[64px] h-1 rounded-full bg-elevated overflow-hidden mt-1.5">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: unlocked ? a.color : 'var(--theme-fg-muted)' }} />
              </div>
              <p className="text-[9.5px] font-bold mt-1" style={{ color: unlocked ? a.color : 'var(--theme-fg-muted)' }}>
                {unlocked ? '✓' : `${cur}/${a.target}`}
              </p>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
