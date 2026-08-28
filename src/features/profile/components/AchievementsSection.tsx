import { useEffect, useState } from 'react'
import { ChevronRight, Trophy } from 'lucide-react'
import { api, type AchievementStats } from '../../../shared/api'
import { ACHIEVEMENTS, isUnlocked } from '../../../shared/config/achievements'
import { type Lang, type useT } from '../../../shared/i18n'
import AchievementsScreen from './AchievementsScreen'
import { Section } from './Section'

// ── Yutuqlar (Achievements) — profilda IXCHAM qator (ko'p joy olmaydi);
//    bosilganda to'liq ekran panjara ochiladi (AchievementsScreen) ──────
export function AchievementsItem({ lang, tt, userId }: {
  lang: Lang
  tt: ReturnType<typeof useT>
  userId?: string
}) {
  const [stats, setStats] = useState<AchievementStats | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId || userId === '0') return
    api.getAchievements(userId).then((d) => setStats(d.stats)).catch(() => {})
  }, [userId, lang])

  if (!stats) return null
  const unlockedCount = ACHIEVEMENTS.filter((a) => isUnlocked(a, stats)).length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[50px] w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-[120ms] ease-out hover:bg-psurface active:bg-psurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pprimary border-b border-pline last:border-0"
      >
        <Trophy size={20} strokeWidth={1.75} className="shrink-0 text-pmuted" />
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-medium text-pfg">{tt('achTitle')}</p>
          <div className="mt-1.5 h-[3px] w-full max-w-[140px] overflow-hidden rounded-[2px] bg-plineStrong">
            <div className="h-full rounded-[2px] bg-pprimary transition-[width] duration-[400ms] ease-out"
              style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }} />
          </div>
        </div>
        <span className="text-[12px] font-semibold tabular-nums text-pmuted">
          {unlockedCount}/{ACHIEVEMENTS.length}
        </span>
        <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-psubtle" />
      </button>

      {open && (
        <AchievementsScreen stats={stats} tt={tt} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

export function AchievementsSection({ lang, tt, userId }: {
  lang: Lang
  tt: ReturnType<typeof useT>
  userId?: string
}) {
  return (
    <Section title={tt('achTitle').toUpperCase()}>
      <AchievementsItem lang={lang} tt={tt} userId={userId} />
    </Section>
  )
}
