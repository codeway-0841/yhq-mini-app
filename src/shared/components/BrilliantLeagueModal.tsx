import { useEffect, useState } from 'react'
import { Trophy, X } from 'lucide-react'
import { BrilliantEndstateShell } from './BrilliantEndstateShell'
import { BrilliantExtrasRive, type BrilliantLeagueState } from './BrilliantExtrasRive'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'

export const BRILLIANT_LEAGUES = [
  { id: 'bronze',   level: 1,  uz: 'Bronza',   ru: 'Бронза',   color: '#d97706', glow: 'rgba(217,119,6,0.30)' },
  { id: 'silver',   level: 2,  uz: 'Kumush',   ru: 'Серебро',  color: '#94a3b8', glow: 'rgba(148,163,184,0.32)' },
  { id: 'gold',     level: 3,  uz: 'Oltin',    ru: 'Золото',   color: '#f6b31f', glow: 'rgba(246,179,31,0.38)' },
  { id: 'sapphire', level: 4,  uz: 'Sapfir',   ru: 'Сапфир',   color: '#3557ff', glow: 'rgba(53,87,255,0.32)' },
  { id: 'emerald',  level: 5,  uz: 'Zumrad',   ru: 'Изумруд',  color: '#29cc57', glow: 'rgba(41,204,87,0.32)' },
  { id: 'ruby',     level: 6,  uz: 'Rubin',    ru: 'Рубин',    color: '#ef4444', glow: 'rgba(239,68,68,0.32)' },
  { id: 'amethyst', level: 7,  uz: 'Ametist',  ru: 'Аметист',  color: '#a855f7', glow: 'rgba(168,85,247,0.32)' },
  { id: 'pearl',    level: 8,  uz: 'Marvarid', ru: 'Жемчуг',   color: '#06b6d4', glow: 'rgba(6,182,212,0.32)' },
  { id: 'obsidian', level: 9,  uz: 'Obsidian', ru: 'Обсидиан', color: '#64748b', glow: 'rgba(100,116,139,0.32)' },
  { id: 'diamond',  level: 10, uz: 'Olmos',    ru: 'Алмаз',    color: '#38bdf8', glow: 'rgba(56,189,248,0.38)' },
] as const

export function getLeagueTier(levelOrId: number | string, lang: 'uz' | 'ru' = 'uz') {
  if (typeof levelOrId === 'number') {
    const idx = Math.max(0, Math.min(BRILLIANT_LEAGUES.length - 1, Math.round(levelOrId) - 1))
    return { ...BRILLIANT_LEAGUES[idx], name: BRILLIANT_LEAGUES[idx][lang] }
  }
  const clean = String(levelOrId).toLowerCase().trim()
  const found = BRILLIANT_LEAGUES.find(
    (l) => l.id === clean || l.uz.toLowerCase() === clean || l.ru.toLowerCase() === clean,
  )
  if (found) return { ...found, name: found[lang] }
  if (clean === 'platinum' || clean === 'neon') return { ...BRILLIANT_LEAGUES[3], name: BRILLIANT_LEAGUES[3][lang] }
  return { ...BRILLIANT_LEAGUES[0], name: BRILLIANT_LEAGUES[0][lang] }
}

export interface BrilliantLeagueModalProps {
  isOpen?: boolean
  onClose: () => void
  leagueLevel?: number
  leagueState?: BrilliantLeagueState
  fromLeagueName?: string
  toLeagueName?: string
  rank?: number
  score?: number
  rivals?: Array<{ rank: number; name: string; xp: number; me?: boolean }>
}

/**
 * Brilliant 1:1 League Endstate Modal (Ixcham, toza, 1 ekranga to'liq sig'adigan):
 * - Rive nishon markazda chiroyli scale-pop va yaltiroq nur bilan ochiladi
 * - 500ms dan so'ng qisqa sarlavha va ixcham 4-qatorli reyting kartasi pastdan siljib chiqadi
 * - Ortiqcha matn va uzun bloklarsiz; pastda 1:1 Brilliant Royal Blue 3D CTA tugmasi
 */
export function BrilliantLeagueModal({
  isOpen = true,
  onClose,
  leagueLevel = 2,
  leagueState = 'promote',
  fromLeagueName,
  toLeagueName,
  rank = 2,
  score = 590,
  rivals,
}: BrilliantLeagueModalProps) {
  const language = useAppStore((s) => s.settings.language)
  const isRu = language === 'ru'
  const dark = typeof document !== 'undefined' && document.body.dataset.theme === 'dark'

  const [badgeMounted, setBadgeMounted] = useState(false)
  const [contentShown, setContentShown] = useState(false)

  const tier = getLeagueTier(leagueLevel, isRu ? 'ru' : 'uz')
  const currentTierName = toLeagueName || tier.name

  useEffect(() => {
    if (!isOpen) return
    playSound('win')
    haptics.achievement()

    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setBadgeMounted(true)
      setContentShown(true)
      return
    }

    setBadgeMounted(false)
    setContentShown(false)

    // 1-qadam: Nishon tezkor scale-pop bilan kirib keladi
    const tBadge = setTimeout(() => setBadgeMounted(true), 50)
    // 2-qadam: 500ms da sarlavha va reyting jadvali pastdan mayin ko'tariladi
    const tContent = setTimeout(() => {
      setContentShown(true)
      playSound('chime')
    }, 500)

    return () => {
      clearTimeout(tBadge)
      clearTimeout(tContent)
    }
  }, [isOpen, leagueLevel, leagueState])

  if (!isOpen) return null

  const defaultRows = (() => {
    if (rank === 1) {
      return [
        { rank: 1, name: isRu ? 'Вы' : 'Siz', xp: score, me: true },
        { rank: 2, name: 'Azizbek T.', xp: Math.max(10, score - 50), me: false },
        { rank: 3, name: 'Madina K.', xp: Math.max(10, score - 110), me: false },
        { rank: 4, name: 'Sardor R.', xp: Math.max(10, score - 160), me: false },
      ]
    }
    return [
      { rank: 1, name: 'Azizbek T.', xp: Math.max(score + 50, 640), me: false },
      { rank: rank, name: isRu ? 'Вы' : 'Siz', xp: score, me: true },
      { rank: rank === 3 ? 2 : 3, name: 'Madina K.', xp: Math.max(10, score - 60), me: false },
      { rank: 4, name: 'Sardor R.', xp: Math.max(10, score - 110), me: false },
    ].sort((a, b) => a.rank - b.rank)
  })()
  const rows = rivals && rivals.length > 0 ? rivals : defaultRows

  const titleText =
    leagueState === 'promote'
      ? isRu
        ? 'Повышение в лиге!'
        : 'Yangi ligaga ko‘tarildingiz!'
      : leagueState === 'demote'
        ? isRu
          ? 'Лига обновилась'
          : 'Liga yangilandi'
        : isRu
          ? 'Вы удержались в лиге!'
          : 'Ligada o‘rningizni saqladingiz!'

  const subtitleText =
    leagueState === 'promote'
      ? fromLeagueName
        ? isRu
          ? `Вы перешли из лиги ${fromLeagueName} в ${currentTierName} лигу.`
          : `Siz ${fromLeagueName} ligasidan ${currentTierName} ligasiga o‘tdingiz.`
        : isRu
          ? `Вы вошли в топ недели и перешли в ${currentTierName} лигу.`
          : `Siz haftalik reytingda yuqori o‘rinni egallab, ${currentTierName} ligasiga o‘tdingiz.`
      : isRu
        ? `Новая неделя — новые цели в ${currentTierName} лиге.`
        : `Yangi hafta — ${currentTierName} ligasida yangi marralar.`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="brilliant-league-title"
      className="fixed inset-0 z-[100] bg-pcanvas select-none"
    >
      <BrilliantEndstateShell
        primaryLabel={isRu ? 'Продолжить' : 'Davom etish'}
        onPrimaryClick={() => {
          playSound('click')
          haptics.impact('light')
          onClose()
        }}
        topSlot={
          <div className="absolute right-4 top-[calc(var(--safe-top,0px)+12px)] z-30">
            <button
              type="button"
              onClick={() => {
                playSound('click')
                haptics.impact('light')
                onClose()
              }}
              aria-label={isRu ? 'Закрыть' : 'Yopish'}
              className="flex size-9 items-center justify-center rounded-full bg-psurface/80 text-pmuted hover:text-pfg transition-colors active:scale-95 cursor-pointer"
            >
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center justify-center pt-2 sm:pt-4">
          {/* 1. Markaziy Brilliant Rive nishoni + Radial nur */}
          <div className="relative mx-auto flex w-full max-w-[360px] flex-col items-center justify-center">
            {/* Soft radial nur (fon aurası) */}
            <div
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-0 m-auto size-[260px] sm:size-[300px] rounded-full blur-3xl transition-all duration-700',
                badgeMounted ? 'scale-100 opacity-60' : 'scale-75 opacity-0',
              )}
              style={{
                background:
                  leagueState === 'demote'
                    ? 'radial-gradient(circle, rgba(148,163,184,0.25) 0%, transparent 68%)'
                    : tier.glow,
              }}
            />

            {/* Nishon: Spring scale-pop entrance (0.7 -> 1) */}
            <div
              className={cn(
                'relative z-10 size-[190px] sm:size-[220px] transition-all duration-500',
                badgeMounted
                  ? 'scale-100 opacity-100 [transition-timing-function:cubic-bezier(0.175,0.885,0.32,1.275)]'
                  : 'scale-75 opacity-0',
              )}
            >
              <BrilliantExtrasRive
                kind="league"
                leagueLevel={tier.level}
                leagueState={leagueState}
                dark={dark}
                label={`League ${currentTierName}`}
                className="size-full"
                fallback={
                  <div className="flex size-full items-center justify-center">
                    <Trophy size={64} style={{ color: tier.color }} />
                  </div>
                }
              />
            </div>
          </div>

          {/* 2. Sarlavha, qisqa izoh va ixcham reyting jadvali (Pastdan mayin siljib chiqadi) */}
          <div
            className={cn(
              'mt-2.5 w-full max-w-[360px] px-4 space-y-2.5 transition-all duration-500 ease-out',
              contentShown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
            )}
          >
            {/* Liga Chip va Sarlavha */}
            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-psurface px-3 py-0.5 text-[12px] font-extrabold text-pfg shadow-2xs">
                <Trophy size={13} style={{ color: tier.color }} />
                <span>
                  {currentTierName} {isRu ? 'лига' : 'ligasi'} ({tier.level}/10)
                </span>
              </span>
              <h1
                id="brilliant-league-title"
                className="text-[22px] sm:text-[25px] font-black tracking-tight text-pfg leading-tight"
              >
                {titleText}
              </h1>
              <p className="text-[13px] font-semibold text-pmuted leading-snug px-1">
                {subtitleText}
              </p>
            </div>

            {/* Toza, ixcham Brilliant 4-qatorli reyting kartasi */}
            <div className="rounded-2xl bg-psurface/85 overflow-hidden divide-y divide-pline/40 border-0 shadow-2xs">
              {rows.map((r) => (
                <div
                  key={`${r.name}-${r.rank}`}
                  className={cn(
                    'flex items-center justify-between px-3.5 py-2 text-[13.5px] transition-colors',
                    r.me ? 'bg-[#3557ff]/12 font-bold text-pfg' : 'text-pfg',
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className={cn(
                        'w-4 text-center font-black tabular-nums text-[12px]',
                        r.me ? 'text-pprimary' : r.rank === 1 ? 'text-[#f6b31f]' : 'text-pmuted',
                      )}
                    >
                      {r.rank}
                    </span>
                    <span className="truncate max-w-[190px]">
                      {r.me ? (isRu ? 'Вы' : 'Siz') : r.name}
                    </span>
                  </div>
                  <span className="font-extrabold text-[#29cc57] tabular-nums text-[13px] shrink-0">
                    {r.xp} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BrilliantEndstateShell>
    </div>
  )
}

export default BrilliantLeagueModal
