import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import { leaderboardPageCaches } from '../../../shared/lib/leaderboard-cache'
import type { LeagueWeekly } from '../../../shared/api'
import { haptics } from '../../../platform/haptics'
import { cn } from '../../../shared/lib/cn'
import ModalShell from '../../../shared/components/ModalShell'

export const BRILLIANT_LEAGUES = [
  { id: 'hydrogen', name: 'Hydrogen', level: 1 },
  { id: 'lithium', name: 'Lithium', level: 2 },
  { id: 'carbon', name: 'Carbon', level: 3 },
  { id: 'neon', name: 'Neon', level: 4 },
  { id: 'titanium', name: 'Titanium', level: 5 },
  { id: 'xenon', name: 'Xenon', level: 6 },
  { id: 'barium', name: 'Barium', level: 7 },
  { id: 'neodymium', name: 'Neodymium', level: 8 },
  { id: 'tungsten', name: 'Tungsten', level: 9 },
  { id: 'einsteinium', name: 'Einsteinium', level: 10 },
] as const

export type BrilliantLeagueId = (typeof BRILLIANT_LEAGUES)[number]['id']

export const LOCKED_SHIELD_IMG = '/leagues/locked.png'

const AVATAR_GRADIENTS = [
  'from-amber-400 to-yellow-500',
  'from-emerald-400 to-green-600',
  'from-rose-400 to-red-500',
  'from-fuchsia-400 to-pink-500',
  'from-violet-400 to-purple-600',
  'from-sky-400 to-blue-500',
  'from-teal-400 to-emerald-500',
]

function getAvatarGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

function getDaysLeftInWeek(): number {
  const now = new Date()
  const tashkentTime = new Date(now.getTime() + 5 * 3600 * 1000)
  const day = tashkentTime.getUTCDay()
  return day === 0 ? 1 : 7 - day
}

/**
 * Brilliant liganing haqiqiy rasmi (Shield) komponenti
 */
export function LeagueShield({
  tierId,
  locked = false,
  size = 46,
  className,
}: {
  tierId: string
  locked?: boolean
  size?: number
  className?: string
}) {
  const imgSrc = locked ? LOCKED_SHIELD_IMG : `/leagues/${tierId}.png`

  return (
    <div
      style={{ width: size, height: size * 1.05 }}
      className={cn('relative flex items-center justify-center shrink-0 select-none', className)}
    >
      <img
        src={imgSrc}
        alt={tierId}
        className="size-full object-contain filter drop-shadow-sm transition-transform duration-150"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.src = locked ? LOCKED_SHIELD_IMG : '/leagues/hydrogen.png'
        }}
      />
    </div>
  )
}

export const LeagueLeaderboardCard = memo(function LeagueLeaderboardCard() {
  const user = useAppStore((s) => s.user)
  const settings = useAppStore((s) => s.settings)
  const storeLeague = useAppStore((s) => s.league)
  const displayName = useAppStore((s) => s.displayName)
  const xp = useAppStore((s) => s.xp)
  const tt = useT(settings.language)

  const [weekly, setWeekly] = useState<LeagueWeekly | null>(() => leaderboardPageCaches.weekly.peek())
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [selectedModalTierId, setSelectedModalTierId] = useState<BrilliantLeagueId | null>(null)

  const listRef = useRef<HTMLDivElement | null>(null)
  const userRowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    leaderboardPageCaches.weekly.fetch(user?.id).then(setWeekly).catch(() => {})
  }, [user?.id])

  // KIVVI ligasini Brilliant ligasiga moslashtirish (default: hydrogen)
  const currentTierId: BrilliantLeagueId = useMemo(() => {
    const raw = (weekly?.myLeague || storeLeague || 'bronze').toLowerCase()
    if (raw === 'silver') return 'lithium'
    if (raw === 'gold') return 'carbon'
    if (raw === 'platinum') return 'neon'
    const found = BRILLIANT_LEAGUES.find((l) => l.id === raw)
    return found ? found.id : 'hydrogen'
  }, [weekly?.myLeague, storeLeague])

  const daysLeft = useMemo(() => getDaysLeftInWeek(), [])

  const currentTierIndex = BRILLIANT_LEAGUES.findIndex((l) => l.id === currentTierId)
  const activeModalTierId: BrilliantLeagueId = selectedModalTierId || currentTierId
  const activeModalLeague = BRILLIANT_LEAGUES.find((l) => l.id === activeModalTierId) || BRILLIANT_LEAGUES[0]

  const currentLeagueObj = BRILLIANT_LEAGUES.find((l) => l.id === currentTierId) || BRILLIANT_LEAGUES[0]
  const leagueTitle = currentLeagueObj.name
  const subtitle = `${daysLeft}d left · Top 15 advance`

  // Haqiqiy o'yinchilar ro'yxati (hech qanday soxta o'yinchi qo'shilmaydi)
  const displayEntries = useMemo(() => {
    const all = weekly?.entries ?? []
    if (all.length > 0) {
      return all.map((entry) => ({
        rank: entry.rank,
        userId: entry.userId,
        name: entry.name,
        score: entry.score,
        isYou: Boolean(entry.isYou || (user?.id && entry.userId === user.id)),
        photoUrl: entry.photoUrl ?? null,
      }))
    }

    if (user) {
      const myName = displayName || `${user.firstName} ${user.lastName ?? ''}`.trim() || tt('guestName')
      return [
        {
          rank: 1,
          userId: user.id || 'you',
          name: myName,
          score: xp ?? 0,
          isYou: true,
          photoUrl: null,
        },
      ]
    }

    return []
  }, [weekly?.entries, user, displayName, xp, tt])

  // Foydalanuvchining o'z qatoriga avtomatik markaziy scroll qilish
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userRowRef.current && listRef.current) {
        const container = listRef.current
        const row = userRowRef.current
        const offsetTop = row.offsetTop - container.offsetTop
        const centerPos = offsetTop - container.clientHeight / 2 + row.clientHeight / 2
        container.scrollTo({ top: Math.max(0, centerPos), behavior: 'smooth' })
      }
    }, 120)
    return () => clearTimeout(timer)
  }, [displayEntries])

  return (
    <>
      <div className="mx-4 mb-2 rounded-2xl bg-pcard border-2 border-pline p-3.5 shadow-[0_2px_0_var(--p-line)] transition-colors">
        {/* ── Karta Sarlavhasi (Brilliant rasmi, Liga nomi, 5d left va info ikonkasi) ── */}
        <div className="flex items-center justify-between pb-2.5">
          <div className="flex items-center gap-3">
            <LeagueShield tierId={currentTierId} size={40} />
            <div>
              <h3 className="font-display text-[17.5px] font-bold tracking-tight text-pfg leading-tight">
                {leagueTitle}
              </h3>
              <p className="mt-0.5 text-[12.5px] font-semibold text-pmuted">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.impact('light')
              setSelectedModalTierId(currentTierId)
              setShowInfoModal(true)
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-xl text-pmuted transition-colors hover:bg-pline/40 hover:text-pfg active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pprimary"
            aria-label="Liga ma'lumotlari"
          >
            <Info size={20} strokeWidth={2} />
          </button>
        </div>

        {/* ── Standart balandlikdagi (scroll) Reyting Jadvali ── */}
        <div
          ref={listRef}
          className="mt-1 divide-y divide-transparent space-y-1 max-h-[210px] overflow-y-auto overscroll-contain pr-1 touch-pan-y focus:outline-none"
          aria-label="Liga reyting jadvali"
        >
          {displayEntries.length === 0 ? (
            <div className="py-8 text-center text-[13.5px] font-medium text-pmuted">
              {settings.language === 'ru' ? 'Пока нет данных' : "Hozircha ma'lumot yo'q"}
            </div>
          ) : (
            displayEntries.map((entry) => {
              const isUser = entry.isYou
              return (
                <div
                  ref={isUser ? userRowRef : undefined}
                  key={`${entry.rank}-${entry.userId || entry.name}`}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors duration-150',
                    isUser
                      ? 'bg-psurface'
                      : 'hover:bg-psurface/40'
                  )}
                >
                  {/* O'rin raqami */}
                  <span className="w-5 text-center font-display text-[13.5px] font-semibold text-pmuted tabular-nums shrink-0">
                    {entry.rank}
                  </span>

                  {/* Avatar doirasi */}
                  <div
                    className={cn(
                      'size-8 rounded-full flex items-center justify-center font-bold text-[12.5px] text-white shadow-xs shrink-0 overflow-hidden bg-gradient-to-br',
                      getAvatarGradient(entry.name)
                    )}
                  >
                    {entry.photoUrl ? (
                      <img src={entry.photoUrl} alt={entry.name} className="size-full object-cover" />
                    ) : (
                      entry.name[0]?.toUpperCase() || '?'
                    )}
                  </div>

                  {/* Foydalanuvchi ismi */}
                  <span
                    className={cn(
                      'flex-1 min-w-0 truncate text-[14px] font-semibold tracking-tight',
                      isUser ? 'text-pfg font-bold' : 'text-pfg'
                    )}
                  >
                    {entry.name}
                  </span>

                  {/* XP bali */}
                  <span className="text-[13px] font-bold tabular-nums text-pmuted shrink-0">
                    {entry.score} XP
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Brilliant Liga Modali (2-rasm: Shield karusel + Title + Okay) ── */}
      {showInfoModal && (
        <ModalShell
          title=""
          showHeader={false}
          onClose={() => setShowInfoModal(false)}
          closeLabel={tt('close')}
          zIndex={50}
          backdropClassName="bg-black/60"
          bodyClassName="px-4 pt-6 pb-6 flex flex-col items-center"
        >
          {/* Ligalar nishonlari qatori (Brilliant rasmlari) */}
          <div className="flex items-center gap-3 sm:gap-4 py-2 overflow-x-auto no-scrollbar max-w-full px-2">
            {BRILLIANT_LEAGUES.map((league, idx) => {
              const isLocked = idx > currentTierIndex
              const isSelected = league.id === activeModalTierId
              return (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => {
                    haptics.impact('light')
                    setSelectedModalTierId(league.id)
                  }}
                  className={cn(
                    'relative p-2 rounded-2xl transition-all duration-150 active:scale-95 flex flex-col items-center shrink-0',
                    isSelected ? 'ring-2 ring-pprimary/50 bg-psurface/80 scale-105' : 'opacity-85 hover:opacity-100'
                  )}
                  aria-label={`${league.name} League`}
                >
                  <LeagueShield tierId={league.id} locked={isLocked} size={62} />
                </button>
              )
            })}
          </div>

          {/* Tanlangan liga sarlavhasi (2-rasmdagi: Lithium League) */}
          <h4 className="mt-5 font-display text-[22px] font-extrabold text-pfg text-center tracking-tight">
            {activeModalLeague.name} League
          </h4>

          {/* Qoidalar matni */}
          <p className="mt-2 text-center text-[13.5px] text-pmuted max-w-sm leading-relaxed">
            {settings.language === 'ru'
              ? 'Каждую неделю топ-15 активных участников переходят в следующую лигу. Рейтинг обновляется каждый понедельник.'
              : "Har haftada eng faol TOP 15 ishtirokchilar keyingi ligaga ko'tariladi. Reyting har dushanba yangilanadi."}
          </p>

          {/* 2-rasmdagi 'Okay' katta tugmasi */}
          <button
            type="button"
            onClick={() => {
              haptics.impact('light')
              setShowInfoModal(false)
            }}
            className="mt-6 w-full py-3.5 rounded-2xl bg-pfg text-pcanvas font-bold text-[16px] active:scale-[0.98] transition-transform shadow-xs cursor-pointer"
          >
            Okay
          </button>
        </ModalShell>
      )}
    </>
  )
})
