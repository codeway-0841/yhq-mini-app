import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { BrilliantEndstateShell } from './BrilliantEndstateShell'
import { BrilliantExtrasRive, type BrilliantLeagueState } from './BrilliantExtrasRive'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'

export const BRILLIANT_LEAGUES = [
  { id: 'bronze',   level: 1,  uz: 'Bronza',   ru: 'Бронза' },
  { id: 'silver',   level: 2,  uz: 'Kumush',   ru: 'Серебро' },
  { id: 'gold',     level: 3,  uz: 'Oltin',    ru: 'Золото' },
  { id: 'sapphire', level: 4,  uz: 'Sapfir',   ru: 'Сапфир' },
  { id: 'emerald',  level: 5,  uz: 'Zumrad',   ru: 'Изумруд' },
  { id: 'ruby',     level: 6,  uz: 'Rubin',    ru: 'Рубин' },
  { id: 'amethyst', level: 7,  uz: 'Ametist',  ru: 'Аметист' },
  { id: 'pearl',    level: 8,  uz: 'Marvarid', ru: 'Жемчуг' },
  { id: 'obsidian', level: 9,  uz: 'Obsidian', ru: 'Обсидиан' },
  { id: 'diamond',  level: 10, uz: 'Olmos',    ru: 'Алмаз' },
] as const

export function getLeagueTier(levelOrId: number | string, lang: 'uz' | 'ru' = 'uz') {
  if (typeof levelOrId === 'number') {
    const idx = Math.max(0, Math.min(BRILLIANT_LEAGUES.length - 1, Math.round(levelOrId) - 1))
    return { ...BRILLIANT_LEAGUES[idx], name: BRILLIANT_LEAGUES[idx][lang] }
  }
  const clean = String(levelOrId).toLowerCase().trim()
  const found = BRILLIANT_LEAGUES.find((l) => l.id === clean || l.uz.toLowerCase() === clean || l.ru.toLowerCase() === clean)
  if (found) return { ...found, name: found[lang] }
  if (clean === 'platinum') return { ...BRILLIANT_LEAGUES[3], name: BRILLIANT_LEAGUES[3][lang] }
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

  const [slidUp, setSlidUp] = useState(false)
  const [boardShown, setBoardShown] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    playSound('achievement')
    haptics.achievement()

    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setSlidUp(true)
      setBoardShown(true)
      return
    }

    setSlidUp(false)
    setBoardShown(false)
    const t1 = setTimeout(() => setSlidUp(true), 900)
    const t2 = setTimeout(() => setBoardShown(true), 1100)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [isOpen, leagueLevel, leagueState])

  if (!isOpen) return null

  const tier = getLeagueTier(leagueLevel, isRu ? 'ru' : 'uz')
  const currentTierName = toLeagueName || tier.name

  const defaultRows = [
    { rank: 1, name: 'Azizbek T.', xp: 640, me: false },
    { rank: rank, name: isRu ? 'Вы' : 'Siz', xp: score, me: true },
    { rank: 3, name: 'Madina K.', xp: 520, me: false },
    { rank: 4, name: 'Sardor R.', xp: 475, me: false },
  ]
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
          ? `Поздравляем! Вы перешли из лиги ${fromLeagueName} в ${currentTierName} лигу.`
          : `Tabriklaymiz! Siz ${fromLeagueName} ligasidan ${currentTierName} ligasiga muvaffaqiyatli o‘tdingiz.`
        : isRu
          ? `Поздравляем! Вы вошли в топ недели и перешли в ${currentTierName} лигу.`
          : `Tabriklaymiz! Siz haftalik reytingda yuqori o‘rinni egallab, ${currentTierName} ligasiga o‘tdingiz.`
      : isRu
        ? `Новая неделя — новые цели в ${currentTierName} лиге.`
        : `Yangi hafta — ${currentTierName} ligasida yangi marralar.`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-celebration-title"
      className="fixed inset-0 z-[100] bg-pcanvas select-none"
    >
      <BrilliantEndstateShell
        primaryLabel={isRu ? 'Продолжить' : 'Davom etish'}
        onPrimaryClick={() => {
          playSound('click')
          haptics.impact('light')
          onClose()
        }}
      >
        <div
          className="flex flex-col items-center transition-transform duration-700 ease-out"
          style={{ transform: slidUp ? 'translateY(0%)' : 'translateY(24%)' }}
        >
          {/* Radial glow + Brilliant 1:1 League Rive Badge */}
          <div className="relative mx-auto flex w-full max-w-[536px] flex-col items-center px-4">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-[110px] left-1/2 h-[320px] w-[500px] -translate-x-1/2 rounded-full opacity-60"
              style={{
                background:
                  leagueState === 'demote'
                    ? 'radial-gradient(circle, rgba(148,163,184,0.22) 0%, transparent 68%)'
                    : 'radial-gradient(circle, rgba(246,179,31,0.28) 0%, rgba(53,87,255,0.12) 45%, transparent 72%)',
              }}
            />
            <div className="relative z-10 mt-4 size-[190px] sm:size-[220px]">
              <BrilliantExtrasRive
                kind="league"
                leagueLevel={tier.level}
                leagueState={leagueState}
                dark={dark}
                label={`League ${currentTierName}`}
                className="size-full"
              />
            </div>
          </div>

          {/* Sarlavha, Liga Chip va Jadval Fade In */}
          <div
            className="mt-3 w-full max-w-[393px] px-4 space-y-3 transition-opacity duration-700 ease-out"
            style={{ opacity: boardShown ? 1 : 0 }}
          >
            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-psurface px-3.5 py-1 text-[12px] font-extrabold text-pfg border-0 shadow-2xs">
                <Trophy size={13} className="text-[#f6b31f]" />
                {currentTierName} {isRu ? 'лига' : 'ligasi'} ({tier.level}/10)
              </span>
              <h1 id="league-celebration-title" className="text-[24px] sm:text-[26px] font-black tracking-tight text-pfg">
                {titleText}
              </h1>
              <p className="text-[13px] font-semibold text-pmuted leading-snug px-2">
                {subtitleText}
              </p>
            </div>

            {/* Toza, bordersiz minimalist reyting kartasi */}
            <div className="rounded-2xl bg-psurface/80 overflow-hidden divide-y divide-pline/40 border-0 shadow-xs">
              {rows.map((r) => (
                <div
                  key={r.rank}
                  className={cn(
                    'flex items-center justify-between px-4 py-2.5 text-[13.5px]',
                    r.me ? 'bg-[#3557ff]/12 font-bold text-pfg' : 'text-pfg',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn('w-5 text-center font-black tabular-nums', r.me ? 'text-pprimary' : 'text-pmuted')}>
                      {r.rank}
                    </span>
                    <span className="truncate max-w-[170px]">{r.name}</span>
                  </div>
                  <span className="font-extrabold text-[#29cc57] tabular-nums">{r.xp} XP</span>
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
