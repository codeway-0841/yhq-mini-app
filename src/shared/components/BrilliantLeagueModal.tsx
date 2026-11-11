import { useEffect, useState } from 'react'
import { Check, Sparkles, Trophy, X } from 'lucide-react'
import {
  BrilliantCopyContainer,
  BrilliantEndstateShell,
  BrilliantRiveContainer,
} from './BrilliantEndstateShell'
import { BrilliantExtrasRive, type BrilliantLeagueState } from './BrilliantExtrasRive'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'

/**
 * Brilliant.org 10 League Tiers (1:1 Element progression):
 * 1: Hydrogen, 2: Lithium, 3: Carbon, 4: Neon, 5: Titanium,
 * 6: Xenon, 7: Barium, 8: Neodymium, 9: Tungsten, 10: Einsteinium
 */
export const BRILLIANT_LEAGUES = [
  { id: 'hydrogen',    level: 1,  code: 'H',  en: 'Hydrogen',    uz: 'Vodorod',     ru: 'Водород',     color: '#94a3b8', glow: 'rgba(148,163,184,0.35)' },
  { id: 'lithium',     level: 2,  code: 'Li', en: 'Lithium',     uz: 'Litiy',       ru: 'Литий',       color: '#38bdf8', glow: 'rgba(56,189,248,0.35)' },
  { id: 'carbon',      level: 3,  code: 'C',  en: 'Carbon',      uz: 'Uglerod',     ru: 'Углерод',     color: '#f6b31f', glow: 'rgba(246,179,31,0.38)' },
  { id: 'neon',        level: 4,  code: 'Ne', en: 'Neon',        uz: 'Neon',        ru: 'Неон',        color: '#3557ff', glow: 'rgba(53,87,255,0.35)' },
  { id: 'titanium',    level: 5,  code: 'Ti', en: 'Titanium',    uz: 'Titan',       ru: 'Титан',       color: '#29cc57', glow: 'rgba(41,204,87,0.35)' },
  { id: 'xenon',       level: 6,  code: 'Xe', en: 'Xenon',       uz: 'Ksenon',      ru: 'Ксенон',      color: '#a855f7', glow: 'rgba(168,85,247,0.35)' },
  { id: 'barium',      level: 7,  code: 'Ba', en: 'Barium',      uz: 'Bariy',       ru: 'Барий',       color: '#ef4444', glow: 'rgba(239,68,68,0.35)' },
  { id: 'neodymium',   level: 8,  code: 'Nd', en: 'Neodymium',   uz: 'Neodim',      ru: 'Неодим',      color: '#06b6d4', glow: 'rgba(6,182,212,0.35)' },
  { id: 'tungsten',    level: 9,  code: 'W',  en: 'Tungsten',    uz: 'Volfram',     ru: 'Вольфрам',    color: '#64748b', glow: 'rgba(100,116,139,0.35)' },
  { id: 'einsteinium', level: 10, code: 'Es', en: 'Einsteinium', uz: 'Eynshteyniy', ru: 'Эйнштейний',  color: '#e11d48', glow: 'rgba(225,29,72,0.40)' },
] as const

export type BrilliantLeagueTier = (typeof BRILLIANT_LEAGUES)[number]

export function getLeagueTier(levelOrId: number | string, lang: 'uz' | 'ru' = 'uz') {
  if (typeof levelOrId === 'number') {
    const idx = Math.max(0, Math.min(BRILLIANT_LEAGUES.length - 1, Math.round(levelOrId) - 1))
    return { ...BRILLIANT_LEAGUES[idx], name: BRILLIANT_LEAGUES[idx][lang] }
  }
  const clean = String(levelOrId).toLowerCase().trim()
  const legacyMap: Record<string, number> = {
    bronze: 1, bronza: 1, бронза: 1,
    silver: 2, kumush: 2, серебро: 2,
    gold: 3, oltin: 3, золото: 3,
    platinum: 4, platina: 4, платина: 4, sapphire: 4, sapfir: 4, сапфир: 4,
    emerald: 5, zumrad: 5, изумруд: 5,
    ruby: 6, rubin: 6, рубин: 6,
    amethyst: 7, ametist: 7, аметист: 7,
    pearl: 8, marvarid: 8, жемчуг: 8,
    obsidian: 9, обсидиан: 9,
    diamond: 10, olmos: 10, алмаз: 10,
  }
  if (legacyMap[clean]) {
    const idx = legacyMap[clean] - 1
    return { ...BRILLIANT_LEAGUES[idx], name: BRILLIANT_LEAGUES[idx][lang] }
  }
  const found = BRILLIANT_LEAGUES.find(
    (l) =>
      l.id === clean ||
      l.en.toLowerCase() === clean ||
      l.uz.toLowerCase() === clean ||
      l.ru.toLowerCase() === clean,
  )
  if (found) return { ...found, name: found[lang] }
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
  rivals?: Array<{ rank: number; name: string; xp: number; me?: boolean; avatar?: string }>
}

/**
 * Brilliant 1:1 League Celebration Modal (`36qja4cbbolyk.js`):
 * - 100dvh `BrilliantEndstateShell`
 * - Centered atmospheric radial glow matching tier element color
 * - 280px Rive Badge (`leagues-badges.45867fa0.riv`, artboard: `MAIN_leagues`, SM: `leagueBadges`)
 * - Smooth fade-in of learner's personal achievement metrics (Rank, Weekly XP, Next Target progress track)
 * - Optional promotion group podium if real rivals are provided
 * - Brilliant 1:1 Royal Blue 3D CTA button (`<Button variant="primary">`)
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

  const [copyShown, setCopyShown] = useState(false)

  const tier = getLeagueTier(leagueLevel, isRu ? 'ru' : 'uz')
  const currentTierName = toLeagueName || tier.name
  const nextTier = getLeagueTier(Math.min(10, tier.level + 1), isRu ? 'ru' : 'uz')

  useEffect(() => {
    if (!isOpen) return
    playSound('win')
    haptics.achievement()

    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setCopyShown(true)
      return
    }

    setCopyShown(false)
    const tCopy = setTimeout(() => {
      setCopyShown(true)
      playSound('chime')
    }, 450)

    return () => clearTimeout(tCopy)
  }, [isOpen, leagueLevel, leagueState])

  if (!isOpen) return null

  const titleText =
    leagueState === 'promote'
      ? isRu
        ? 'Повышение в лиге!'
        : 'Yangi ligaga ko‘tarildingiz!'
      : leagueState === 'demote'
        ? isRu
          ? 'Итоги недели в лиге'
          : 'Haftalik natijalar yakunlandi'
        : isRu
          ? 'Вы удержались в лиге!'
          : 'Ligada o‘rningizni saqladingiz!'

  const subtitleText =
    leagueState === 'promote'
      ? fromLeagueName
        ? isRu
          ? `Вы перешли из лиги ${fromLeagueName} в лигу ${currentTierName}. Отличный результат!`
          : `Siz ${fromLeagueName} ligasidan ${currentTierName} ligasiga o‘tdingiz. Ajoyib natija!`
        : isRu
          ? `Поздравляем! Вы вошли в топ недели и перешли в ${currentTierName} лигу.`
          : `Tabriklaymiz! Siz haftalik reytingda eng yuqori natija ko‘rsatib, ${currentTierName} ligasiga o‘tdingiz.`
      : leagueState === 'demote'
        ? isRu
          ? `Новая неделя — отличный шанс вернуться на вершину в ${currentTierName} лиге.`
          : `Yangi hafta — ${currentTierName} ligasida yangi g‘alabalarga erishish uchun yangi imkoniyat.`
        : isRu
          ? `Вы сохранили место в ${currentTierName} лиге. Продолжайте в том же духе!`
          : `Siz ${currentTierName} ligasida o‘rningizni saqlab qoldingiz. Faollikni davom ettiring!`

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
        {/* 1. Yuqori qism: Rive konteyner + Markazlashgan radial fon aurasi */}
        <BrilliantRiveContainer className="relative flex items-center justify-center overflow-visible">
          {/* Rangli radial nur fon — faqat markaziy nishon orqasida */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto size-[280px] sm:size-[340px] rounded-full blur-3xl opacity-60 transition-all duration-700"
            style={{
              background:
                leagueState === 'demote'
                  ? 'radial-gradient(circle, rgba(148,163,184,0.3) 0%, transparent 68%)'
                  : tier.glow,
            }}
          />

          {/* 1:1 Brilliant Rive nishoni (250-290px) */}
          <div className="relative z-10 size-[230px] sm:size-[270px] lg:size-[290px] flex items-center justify-center">
            <BrilliantExtrasRive
              kind="league"
              leagueLevel={tier.level}
              leagueState={leagueState}
              dark={dark}
              label={`League ${currentTierName}`}
              className="size-full"
              fallback={
                <img
                  src={`/leagues/${tier.id}.png`}
                  alt={currentTierName}
                  className="size-[190px] object-contain drop-shadow-lg"
                  onError={(e) => {
                    e.currentTarget.src = '/leagues/hydrogen.png'
                  }}
                />
              }
            />
          </div>
        </BrilliantRiveContainer>

        {/* 2. Pastki qism: Matn, O'rin/XP ko'rsatkichlari va Daraja shkalasi */}
        <BrilliantCopyContainer
          className={cn(
            'transition-all duration-600 ease-out',
            copyShown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
          )}
        >
          {/* Eyebrow Chip */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-psurface px-3.5 py-1 text-[12px] font-extrabold text-pfg shadow-2xs">
            <Trophy size={13} style={{ color: tier.color }} />
            <span>
              {currentTierName} {isRu ? 'лига' : 'ligasi'} · {tier.level}/10
            </span>
          </div>

          {/* Sarlavha & Izoh */}
          <div className="space-y-1.5 px-2">
            <h1
              id="brilliant-league-title"
              className="text-[25px] sm:text-[29px] font-black tracking-tight text-pfg leading-tight"
            >
              {titleText}
            </h1>
            <p className="text-[13.5px] sm:text-[14px] font-semibold text-pmuted leading-relaxed max-w-[340px] mx-auto">
              {subtitleText}
            </p>
          </div>

          {/* Brilliant 1:1 Shaxsiy Yutuqlar Kartasi (O'rin va XP) */}
          <div className="w-full max-w-[360px] rounded-2xl bg-psurface/85 p-3.5 shadow-2xs space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              {/* O'rin */}
              <div className="rounded-xl bg-pcanvas/90 p-3 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-pmuted">
                  {isRu ? 'Место в лиге' : 'Haftalik o‘rin'}
                </span>
                <span className="mt-0.5 text-[24px] font-black tabular-nums text-pfg">
                  #{rank}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#29cc57]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#29cc57]">
                  <Check size={10} strokeWidth={3} />
                  {isRu ? 'Топ 20%' : 'Ko‘tarilish'}
                </span>
              </div>

              {/* To'plangan XP */}
              <div className="rounded-xl bg-pcanvas/90 p-3 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-pmuted">
                  {isRu ? 'Набрано за неделю' : 'To‘plangan ball'}
                </span>
                <span className="mt-0.5 text-[24px] font-black tabular-nums text-[#3557ff]">
                  +{score}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#3557ff]/12 px-2 py-0.5 text-[10px] font-extrabold text-[#3557ff]">
                  <Sparkles size={10} />
                  XP
                </span>
              </div>
            </div>

            {/* 10-darajali ligalar progress trassasi */}
            <div className="pt-1 border-t border-pline/40">
              <div className="flex items-center justify-between text-[11px] font-bold text-pmuted mb-1.5">
                <span>{isRu ? 'Путь в лигах' : 'Ligalar bosqichi'}</span>
                <span className="text-pfg">
                  {tier.level < 10
                    ? isRu
                      ? `Следующая: ${nextTier.name}`
                      : `Keyingi marra: ${nextTier.name}`
                    : isRu
                      ? 'Максимальная лига!'
                      : 'Eng yuqori liga!'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {BRILLIANT_LEAGUES.map((l) => {
                  const isCurrent = l.level === tier.level
                  const isPast = l.level < tier.level
                  return (
                    <div
                      key={l.id}
                      title={`${l.level}. ${l[isRu ? 'ru' : 'uz']}`}
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-all duration-300',
                        isCurrent
                          ? 'h-2 bg-[#3557ff] shadow-[0_0_8px_rgba(53,87,255,0.6)]'
                          : isPast
                            ? 'bg-[#29cc57]'
                            : 'bg-pline/50',
                      )}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Agar haqiqiy raqiblar (rivals) berilgan bo'lsa, ixcham podium kartasi */}
          {rivals && rivals.length > 0 && (
            <div className="w-full max-w-[360px] rounded-2xl bg-psurface/85 overflow-hidden divide-y divide-pline/40 shadow-2xs">
              <div className="px-3 py-1.5 text-left text-[11px] font-extrabold uppercase tracking-wider text-pmuted">
                {isRu ? 'Топ недели' : 'Haftalik peshqadamlar'}
              </div>
              {rivals.slice(0, 3).map((r) => (
                <div
                  key={r.rank}
                  className={cn(
                    'flex items-center justify-between px-3.5 py-2 text-[13px]',
                    r.me ? 'bg-[#3557ff]/12 font-bold text-pfg' : 'text-pfg',
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className={cn(
                        'w-4 text-center font-black tabular-nums text-[12px]',
                        r.rank === 1 ? 'text-[#f6b31f]' : r.me ? 'text-pprimary' : 'text-pmuted',
                      )}
                    >
                      {r.rank}
                    </span>
                    <span className="truncate max-w-[180px]">
                      {r.me ? (isRu ? 'Вы' : 'Siz') : r.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-extrabold text-[#29cc57] tabular-nums text-[12.5px]">
                      {r.xp} XP
                    </span>
                    {r.rank <= 3 && (
                      <span className="text-[10px] font-bold text-[#29cc57] bg-[#29cc57]/15 rounded px-1">
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </BrilliantCopyContainer>
      </BrilliantEndstateShell>
    </div>
  )
}

export default BrilliantLeagueModal
