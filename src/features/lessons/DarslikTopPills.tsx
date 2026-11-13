import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import './learning-path.css'
import { BrilliantStreakIcon } from '../../shared/components/BrilliantStreakIcon'
import ModalShell from '../../shared/components/ModalShell'
import { Button } from '../../shared/components/ui/button'
import { haptics } from '../../platform/haptics'
import { api, type DailyHistory, type DailyHistoryRow, type LeagueWeekly } from '../../shared/api'
import { useT } from '../../shared/i18n'
import { cn } from '../../shared/lib/cn'
import { leaderboardPageCaches } from '../../shared/lib/leaderboard-cache'
import { playSound } from '../../shared/lib/sounds'
import { useAppStore } from '../../shared/store/useAppStore'
import {
  isSubjectExtendedOnDate,
  selectDailyCharges,
  selectDailyStreak,
  todayStr,
  useDailyStore,
} from '../../shared/store/useDailyStore'
import { RUSSIAN_SUBJECT_ID } from '../../../shared/subjects'
import {
  BRILLIANT_LEAGUES,
  LeagueShield,
  getDaysLeftInWeek,
  resolveBrilliantLeagueId,
} from '../profile'

export interface BrilliantKeyIconProps {
  size?: number
  className?: string
}

/** Brilliant.org Home top-bar oltin qirrali kalit belgisi (yuqoridan 2 o'yiqli, pastda oltiburchak halqa). */
export const BrilliantKeyIcon = memo(function BrilliantKeyIcon({
  size = 22,
  className,
}: BrilliantKeyIconProps) {
  const maskId = useId()
  return (
    <svg
      viewBox="0 0 24 36"
      width={Math.round((size * 24) / 36)}
      height={size}
      fill="none"
      className={cn('shrink-0 select-none', className)}
      aria-hidden="true"
    >
      <defs>
        <mask id={maskId}>
          <rect width="24" height="36" fill="white" />
          {/* Tish kesiklari (yuqoridagi kalit tishlari) */}
          <rect x="12.2" y="5.8" width="4.4" height="2.6" rx="0.5" fill="black" />
          <rect x="12.2" y="10.4" width="4.4" height="2.6" rx="0.5" fill="black" />
          {/* Markazdagi teshik + kalit ariqchasi */}
          <circle cx="12" cy="24.5" r="3.4" fill="black" />
          <rect x="11.15" y="13.8" width="1.7" height="9.4" rx="0.85" fill="black" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        {/* Kalit dastasi */}
        <path
          d="M12 1.2L15.4 3.1V17.4H8.6V3.1L12 1.2Z"
          fill="#F5B815"
        />
        <path
          d="M12 1.2L15.4 3.1V17.4H12V1.2Z"
          fill="#FAD43B"
        />

        {/* Oltiburchak kalit boshi */}
        <path
          d="M12 15.2L20.8 20.1V29.1L12 34L3.2 29.1V20.1L12 15.2Z"
          fill="#F5B815"
        />
        <path
          d="M12 15.2L20.8 20.1V29.1L12 24.5V15.2Z"
          fill="#FAD43B"
        />
        <path
          d="M3.2 29.1L12 24.5L20.8 29.1L12 34L3.2 29.1Z"
          fill="#DD9707"
        />
      </g>
    </svg>
  )
})

/** Brilliant uslubidagi chaqmoq (faol bo'lmasa — nozik kulrang kontur va yumshoq fon, bugun faol — yashil). */
export const BrilliantBoltBadge = memo(function BrilliantBoltBadge({
  active,
  size = 18,
  className,
}: {
  active: boolean
  size?: number
  className?: string
}) {
  if (active) {
    return <BrilliantStreakIcon size={size} className={className} />
  }
  return (
    <svg
      viewBox="0 0 18 25"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none text-[#d3d5da] dark:text-[#3d3d42]', className)}
      aria-hidden="true"
    >
      <path
        d="M1.27498 12.516L10.1761 1.31828C10.7098 0.646883 11.7966 1.11739 11.6606 1.96094L10.3758 9.92921H15.8888C16.9368 9.92921 17.5236 11.1248 16.8757 11.94L7.97457 23.1377C7.44087 23.8091 6.35401 23.3386 6.49003 22.495L7.7748 14.5268H2.26186C1.21381 14.5268 0.62701 13.3312 1.27498 12.516Z"
        fill="#F4F5F7"
        className="dark:fill-[#1c1c1e]"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
    </svg>
  )
})

function ChargeBatteryIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 22 30" width={21} height={29} fill="none" aria-hidden="true">
      <rect
        x="7"
        y="1"
        width="8"
        height="3.1"
        rx="1.2"
        fill={active ? '#C6EF1D' : 'var(--yhq-sheet-battery-off, #e2e2e5)'}
      />
      <rect
        x="2"
        y="4.6"
        width="18"
        height="24"
        rx="4.5"
        fill={active ? '#D2F324' : 'var(--yhq-sheet-battery-off, #e2e2e5)'}
      />
      <path
        d="M7.2 16.4L11.4 11C11.67 10.67 12.18 10.89 12.1 11.3L11.46 15.1H14.12C14.62 15.1 14.9 15.66 14.59 16.05L10.38 21.42C10.11 21.75 9.6 21.53 9.68 21.12L10.31 17.32H7.65C7.15 17.32 6.87 16.76 7.2 16.4Z"
        fill={active ? '#111111' : 'var(--yhq-sheet-battery-bolt-off, #ffffff)'}
      />
    </svg>
  )
}

/** 5-kunlik zanjirda zaryad bilan saqlab qolingan (freeze) kun uchun qora batareya belgisi. */
function StreakDayBatteryGlyph() {
  return (
    <svg viewBox="0 0 18 24" width={16} height={21} fill="none" aria-hidden="true">
      <rect x="6" y="1" width="6" height="2.4" rx="1" fill="#111111" />
      <rect x="2" y="3.8" width="14" height="19" rx="3.4" fill="#111111" />
      <path
        d="M6.3 13.1L9.5 9C9.71 8.74 10.11 8.91 10.05 9.23L9.56 12.1H11.6C11.98 12.1 12.2 12.53 11.96 12.83L8.75 16.94C8.54 17.2 8.15 17.03 8.21 16.71L8.69 13.8H6.65C6.27 13.8 6.06 13.38 6.3 13.1Z"
        fill="#d6f329"
      />
    </svg>
  )
}

export interface DarslikTopPillsProps {
  /** Joriy fan ID (streak va kunlik faollik uchun) */
  subjectId: string
  /** Tugatilgan darslar soni */
  completedCount: number
  className?: string
}

const WEEKDAYS_UZ = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']
const WEEKDAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const AVATAR_COLORS = ['#f5b800', '#3557ff', '#ff5d5d', '#22c55e', '#a855f7', '#0ea5e9']

export type StreakDayStatus = 'completed' | 'saved' | 'idle'

export interface StreakWeekDay {
  key: string
  date: string
  label: string
  status: StreakDayStatus
  isToday: boolean
}

function shiftIsoDate(isoDate: string, deltaDays: number): { date: string; dayIndex: number } {
  const parts = isoDate.split('-').map(Number)
  const utc = new Date(Date.UTC(parts[0] || 2026, (parts[1] || 1) - 1, (parts[2] || 1) + deltaDays))
  return {
    date: utc.toISOString().slice(0, 10),
    dayIndex: utc.getUTCDay(),
  }
}

/**
 * Brilliant uslubidagi 5 kunlik oyna (chapdan o'ngga bugun o'ng chetda):
 * - completed: foydalanuvchi o'sha kuni topshiriq bajargan (chayqalmas chaqmoq)
 * - saved: faol zanjir ichida 1 kunlik tanaffus batareya zaryadi bilan saqlangan (batareya belgisi)
 * - idle: bo'sh/hali bajarilmagan kun
 */
export function buildStreakWeekDays({
  today,
  streak,
  isExtendedToday,
  historyRows = [],
  ru = false,
}: {
  today: string
  streak: number
  isExtendedToday: boolean
  historyRows?: DailyHistoryRow[]
  ru?: boolean
}): StreakWeekDay[] {
  const labels = ru ? WEEKDAYS_RU : WEEKDAYS_UZ
  const activeSet = new Set(historyRows.filter((r) => r.answered > 0).map((r) => r.date))
  if (isExtendedToday) activeSet.add(today)

  const savedDates = new Set<string>()
  if (streak > 0 && activeSet.size > 0) {
    const todayMinus1 = shiftIsoDate(today, -1).date
    const todayMinus2 = shiftIsoDate(today, -2).date
    let cursor: string | null = activeSet.has(today)
      ? today
      : activeSet.has(todayMinus1)
        ? todayMinus1
        : activeSet.has(todayMinus2)
          ? todayMinus2
          : null

    let counted = 0
    while (cursor && counted < streak) {
      counted += 1
      const prev1 = shiftIsoDate(cursor, -1).date
      if (activeSet.has(prev1)) {
        cursor = prev1
        continue
      }
      const prev2 = shiftIsoDate(cursor, -2).date
      if (counted < streak && activeSet.has(prev2)) {
        savedDates.add(prev1)
        cursor = prev2
        continue
      }
      break
    }
  }

  const coveredDays = isExtendedToday ? Math.max(0, streak - 1) : streak
  const useHistory = activeSet.size > 0

  return Array.from({ length: 5 }, (_, offsetIdx) => {
    const daysAgo = 4 - offsetIdx
    const { date, dayIndex } = shiftIsoDate(today, -daysAgo)
    let status: StreakDayStatus = 'idle'
    if (useHistory) {
      if (activeSet.has(date)) status = 'completed'
      else if (savedDates.has(date)) status = 'saved'
    } else if (daysAgo === 0 ? isExtendedToday : streak > 0 && daysAgo <= coveredDays) {
      status = 'completed'
    }

    return {
      key: `${offsetIdx}-${date}`,
      date,
      label: labels[dayIndex],
      status,
      isToday: daysAgo === 0,
    }
  })
}

function pickAvatarColor(seed: string): string {
  let sum = 0
  for (let i = 0; i < seed.length; i += 1) sum += seed.charCodeAt(i)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

/**
 * Brilliant League karuselidagi bitta qalqon uyasining kengligi (px).
 * Markaziy 84px qalqon va yonma-yon 64-68px qo'shni qalqonlar + chetdagi qisman ko'rinish uchun.
 */
const LEAGUE_ITEM_PITCH = 96

/**
 * Brilliant.org Home top baridagi Kalit (🔑), Liga qalqoni (🛡️) va Seriya chaqmog'i (⚡) pill'lari
 * hamda ularni bosganda ochiladigan bottom sheet'lar.
 */
export const DarslikTopPills = memo(function DarslikTopPills({
  subjectId,
  completedCount,
  className,
}: DarslikTopPillsProps) {
  const navigate = useNavigate()
  const user = useAppStore((s) => s.user)
  const displayName = useAppStore((s) => s.displayName)
  const storeLeague = useAppStore((s) => s.league)
  const lang = useAppStore((s) => s.settings.language)
  const noAnimation = useAppStore((s) => s.settings.noAnimation)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
  const tt = useT(lang)
  const ru = lang === 'ru'

  const streak = useDailyStore((s) => selectDailyStreak(s, subjectId))
  const charges = useDailyStore((s) => selectDailyCharges(s, subjectId))
  const globalStreak = useDailyStore((s) => s.globalStreak)
  const globalExtendedDate = useDailyStore((s) => s.globalExtendedDate)
  const activityKey = useDailyStore((s) => s.activityKey)
  const extendedDates = useDailyStore((s) => s.extendedDates)
  const today = todayStr()
  const isExtendedToday = isSubjectExtendedOnDate(
    { globalExtendedDate, activityKey, extendedDates },
    today,
    subjectId,
  )

  const [weekly, setWeekly] = useState<LeagueWeekly | null>(() => leaderboardPageCaches.weekly.peek())
  const [globalHistory, setGlobalHistory] = useState<DailyHistory | undefined>(undefined)
  const [sheet, setSheet] = useState<'keys' | 'league' | 'streak' | null>(null)
  const keyCount = isPremium ? Math.max(1, completedCount) : 1
  const currentHistory = globalHistory

  useEffect(() => {
    if (!user?.id || user.id === '0') return
    let alive = true
    const currentDate = todayStr()
    useDailyStore.getState().sync(user.id, currentDate, subjectId)
    api.getDailyHistory(user.id, currentDate, subjectId, { global: true })
      .then((hist) => {
        if (!alive) return
        setGlobalHistory(hist)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [user?.id, subjectId, activityKey, globalStreak, sheet])

  useEffect(() => {
    if (!user?.id || user.id === '0') return
    let alive = true
    leaderboardPageCaches.weekly
      .fetch(user.id)
      .then((data) => {
        if (alive) setWeekly(data)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [user?.id, sheet])

  const currentTierId = useMemo(
    () => resolveBrilliantLeagueId(weekly?.myLeague || storeLeague),
    [weekly?.myLeague, storeLeague],
  )
  const currentTierIndex = Math.max(0, BRILLIANT_LEAGUES.findIndex((l) => l.id === currentTierId))
  const currentLeague = BRILLIANT_LEAGUES[currentTierIndex] ?? BRILLIANT_LEAGUES[0]
  const [selectedTierIdx, setSelectedTierIdx] = useState<number>(currentTierIndex)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    moved: boolean
    dx: number
  } | null>(null)
  const suppressClickRef = useRef(false)
  const leagueListRef = useRef<HTMLDivElement>(null)
  const youRowRef = useRef<HTMLDivElement>(null)

  const daysLeft = useMemo(() => getDaysLeftInWeek(), [])

  useEffect(() => {
    if (sheet === 'league') {
      setSelectedTierIdx(currentTierIndex)
      setDragOffset(0)
      setIsDragging(false)
    }
  }, [sheet, currentTierIndex])

  const selectLeagueTier = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(BRILLIANT_LEAGUES.length - 1, idx))
    if (clamped !== selectedTierIdx) {
      haptics.impact('light')
      setSelectedTierIdx(clamped)
    }
  }, [selectedTierIdx])

  const handleCarouselPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      dx: 0,
    }
    suppressClickRef.current = false
  }, [])

  const handleCarouselPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragRef.current
    if (!st || st.pointerId !== e.pointerId) return
    if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return
    const dx = e.clientX - st.startX
    const dy = e.clientY - st.startY
    if (!st.moved) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      if (Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null
        return
      }
      st.moved = true
      suppressClickRef.current = true
      setIsDragging(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // jsdom / fallback
      }
    }
    st.dx = dx
    const atStartEdge = selectedTierIdx === 0 && dx > 0
    const atEndEdge = selectedTierIdx === BRILLIANT_LEAGUES.length - 1 && dx < 0
    setDragOffset(atStartEdge || atEndEdge ? dx * 0.28 : dx)
  }, [selectedTierIdx])

  const finishCarouselDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragRef.current
    if (!st || st.pointerId !== e.pointerId) return
    dragRef.current = null
    if (st.moved) {
      let step = Math.round(-st.dx / LEAGUE_ITEM_PITCH)
      if (step === 0 && Math.abs(st.dx) > 26) {
        step = st.dx < 0 ? 1 : -1
      }
      selectLeagueTier(selectedTierIdx + step)
    }
    setDragOffset(0)
    setIsDragging(false)
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // jsdom / fallback
    }
  }, [selectLeagueTier, selectedTierIdx])

  const handleCarouselKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      selectLeagueTier(selectedTierIdx + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      selectLeagueTier(selectedTierIdx - 1)
    }
  }, [selectLeagueTier, selectedTierIdx])

  const selectedLeague = BRILLIANT_LEAGUES[selectedTierIdx] ?? currentLeague
  const isCurrentLeagueSelected = selectedLeague.id === currentTierId

  const leagueEntries = useMemo(() => {
    const entries = weekly?.entries ?? []
    if (entries.length > 0) {
      return entries.map((e) => ({
        rank: e.rank,
        userId: e.userId,
        name: e.name,
        score: e.score,
        isYou: Boolean(e.isYou || (user?.id && e.userId === user.id)),
      }))
    }
    const myName = displayName || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || tt('guestName')
    return [{ rank: 1, userId: user?.id || 'you', name: myName, score: 0, isYou: true }]
  }, [weekly?.entries, user, displayName, tt])

  // Brilliant kabi liga ochilganda foydalanuvchi qatorini ro'yxat o'rtasiga silliq olib kelish
  useEffect(() => {
    if (sheet !== 'league') return
    const raf = window.requestAnimationFrame(() => {
      const list = leagueListRef.current
      const row = youRowRef.current
      if (!list || !row) return
      const listRect = list.getBoundingClientRect()
      const rowRect = row.getBoundingClientRect()
      const relativeTop = listRect.height > 0 && rowRect.height > 0
        ? list.scrollTop + (rowRect.top - listRect.top)
        : row.offsetTop
      const rowHeight = rowRect.height > 0 ? rowRect.height : row.clientHeight
      const targetTop = Math.max(0, relativeTop - list.clientHeight / 2 + rowHeight / 2)
      list.scrollTo({ top: targetTop, behavior: noAnimation ? 'auto' : 'smooth' })
    })
    return () => window.cancelAnimationFrame(raf)
  }, [sheet, leagueEntries, noAnimation])

  // Brilliant uslubidagi 5 kunlik hafta oynasi (so'nggi 5 kun: bugungi kun o'ng chetda)
  const weekDays = useMemo(
    () => buildStreakWeekDays({
      today,
      streak,
      isExtendedToday,
      historyRows: currentHistory?.rows,
      ru,
    }),
    [today, streak, isExtendedToday, currentHistory?.rows, ru],
  )
  const maxStreak = Math.max(streak, currentHistory?.bestStreak ?? 0)

  const openSheet = (target: 'keys' | 'league' | 'streak') => {
    playSound('click')
    haptics.impact('light')
    setSheet(target)
  }

  return (
    <>
      <div className={cn('yhq-home-status flex items-center justify-between gap-2', className)}>
        <button
          type="button"
          data-testid="brilliant-keys-pill"
          onClick={() => openSheet('keys')}
          aria-label={ru ? `Ключи: ${keyCount}` : `Kalitlar: ${keyCount}`}
          className="yhq-home-pill inline-flex h-[48px] min-w-[72px] items-center justify-center gap-2 rounded-full border-2 border-[#e5e5e5] dark:border-[#2c2c2c] bg-transparent px-3.5 transition-opacity focus-visible:outline-none cursor-pointer select-none"
        >
          <span className="text-[16px] font-extrabold leading-none tabular-nums">
            {keyCount}
          </span>
          <BrilliantKeyIcon size={21} />
        </button>

        <div className="yhq-home-status-right flex items-center gap-1.5">
          <button
            type="button"
            data-testid="brilliant-league-pill"
            onClick={() => openSheet('league')}
            aria-label={ru ? `Лига: ${currentLeague.name}` : `Liga: ${currentLeague.name}`}
            className="yhq-home-pill inline-flex h-[48px] min-w-[72px] items-center justify-center rounded-full border-2 border-[#e5e5e5] dark:border-[#2c2c2c] bg-transparent px-3.5 transition-opacity focus-visible:outline-none cursor-pointer select-none"
          >
            <LeagueShield tierId={currentTierId} size={26} />
          </button>

          <button
            type="button"
            data-testid="brilliant-streak-pill"
            onClick={() => openSheet('streak')}
            aria-label={ru ? `Серия: ${streak}` : `Seriya: ${streak}`}
            className="yhq-home-pill inline-flex h-[48px] min-w-[74px] items-center justify-center gap-1.5 rounded-full border-2 border-[#e5e5e5] dark:border-[#2c2c2c] bg-transparent px-3.5 transition-opacity focus-visible:outline-none cursor-pointer select-none"
          >
            <span className="text-[16px] font-extrabold leading-none tabular-nums">
              {streak}
            </span>
            <BrilliantBoltBadge active={isExtendedToday} size={18} />
          </button>
        </div>
      </div>

      {sheet === 'keys' && (
        <ModalShell
          title={ru ? 'Ключи уроков' : 'Dars kalitlari'}
          showHeader={false}
          showHandle={false}
          onClose={() => setSheet(null)}
          closeLabel={tt('close')}
          className="yhq-brilliant-sheet"
        >
          <div className="flex flex-col items-center text-center pt-5 pb-2">
            <div className="flex items-center justify-center gap-3.5 my-2">
              <span className="font-display text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
                {keyCount}
              </span>
              <BrilliantKeyIcon size={64} />
            </div>

            <h2 className="mt-4 font-display text-[22px] font-extrabold tracking-tight">
              {isPremium
                ? (ru ? 'Все уроки открыты' : 'Barcha darslar ochiq')
                : (ru ? `У вас осталось ${keyCount} ключ на сегодня` : `Sizda bugun ${keyCount} ta kalit qoldi`)}
            </h2>
            <p className="mt-2 text-[15px] max-w-[300px]" style={{ color: 'var(--yhq-sheet-muted)' }}>
              {isPremium
                ? (ru ? 'С подпиской Premium все темы доступны без ограничений.' : 'Premium bilan barcha mavzular cheklovsiz ochiq.')
                : (ru ? 'Используйте ключи для открытия уроков' : 'Darslarni ochish uchun kalitlardan foydalaning')}
            </p>

            {!isPremium && (
              <Button
                variant="primary"
                size="lg"
                className="w-full rounded-full mt-7"
                onClick={() => {
                  setSheet(null)
                  navigate('/premium')
                }}
              >
                {ru ? 'Открыть все уроки' : 'Barcha darslarni ochish'}
              </Button>
            )}
          </div>
        </ModalShell>
      )}

      {sheet === 'league' && (
        <ModalShell
          title={`${selectedLeague.name} League`}
          showHeader={false}
          showHandle={false}
          bodyScroll={false}
          bodyClassName="pt-4 pb-2 flex flex-col"
          onClose={() => setSheet(null)}
          closeLabel={tt('close')}
          className="yhq-brilliant-sheet"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Brilliant 1:1 gorizontal swipe + tap liga qalqonlari karuseli */}
            <div
              role="region"
              aria-roledescription="carousel"
              aria-label={ru ? 'Лиги' : 'Ligalar'}
              tabIndex={0}
              data-testid="league-carousel"
              onPointerDown={handleCarouselPointerDown}
              onPointerMove={handleCarouselPointerMove}
              onPointerUp={finishCarouselDrag}
              onPointerCancel={finishCarouselDrag}
              onKeyDown={handleCarouselKeyDown}
              className="-mx-5 relative h-[96px] overflow-hidden select-none touch-pan-y focus:outline-none"
              style={{
                maskImage: 'linear-gradient(to right, transparent 0%, black 13%, black 87%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 13%, black 87%, transparent 100%)',
              }}
            >
              <div
                className="flex h-full items-center"
                style={{
                  position: 'relative',
                  left: '50%',
                  width: 'max-content',
                  transform: `translate3d(${-(selectedTierIdx * LEAGUE_ITEM_PITCH + LEAGUE_ITEM_PITCH / 2) + dragOffset}px, 0, 0)`,
                  transition: isDragging || noAnimation
                    ? 'none'
                    : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {BRILLIANT_LEAGUES.map((tier, idx) => {
                  const distance = Math.abs(idx - selectedTierIdx)
                  const isSelected = distance === 0
                  const isLocked = idx > currentTierIndex
                  const label = ru ? `Лига ${tier.name}` : `${tier.name} ligasi`
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      data-testid={`league-tier-${tier.id}`}
                      aria-label={label}
                      aria-pressed={isSelected}
                      onClick={() => {
                        if (suppressClickRef.current) {
                          suppressClickRef.current = false
                          return
                        }
                        selectLeagueTier(idx)
                      }}
                      className={cn(
                        'flex h-full shrink-0 items-center justify-center rounded-2xl focus:outline-none',
                        noAnimation ? '' : 'transition-[transform,opacity] duration-300 ease-out',
                        isSelected
                          ? 'scale-100 opacity-100'
                          : distance === 1
                            ? 'scale-[0.78] opacity-80'
                            : 'scale-[0.72] opacity-55',
                      )}
                      style={{ width: LEAGUE_ITEM_PITCH }}
                    >
                      <LeagueShield tierId={tier.id} locked={isLocked} size={86} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Qattiq balandlikdagi sarlavha zonasi: joriy ligada muddat/top-15 ko'rinadi, qulflanganida faqat nom markazlashadi */}
            <div className="mt-3 flex min-h-[54px] flex-col items-center justify-center text-center">
              <h2
                data-testid="league-modal-title"
                className="font-display text-[22px] font-extrabold leading-tight tracking-tight"
              >
                {ru ? `Лига ${selectedLeague.name}` : `${selectedLeague.name} ligasi`}
              </h2>
              {isCurrentLeagueSelected && (
                <p
                  data-testid="league-modal-subtitle"
                  className="mt-1 text-[14.5px] leading-snug"
                  style={{ color: 'var(--yhq-sheet-muted)' }}
                >
                  <strong className="font-bold text-current">
                    {ru ? `${daysLeft} дн.` : `${daysLeft} kun qoldi`}
                  </strong>
                  {ru ? ' · Топ 15 выше' : ' · Top 15 ko‘tariladi'}
                </p>
              )}
            </div>

            <div className="-mx-5 mt-4 border-t" style={{ borderColor: 'var(--yhq-sheet-divider)' }} />

            <div
              ref={leagueListRef}
              data-testid="league-entries-list"
              className="relative h-[376px] max-h-[52dvh] min-h-0 overflow-y-auto overscroll-contain pt-3 pb-2 space-y-1"
              style={{
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
              }}
            >
              {leagueEntries.map((entry) => (
                <div
                  key={`${entry.rank}-${entry.userId}`}
                  ref={entry.isYou ? youRowRef : undefined}
                  data-testid={entry.isYou ? 'league-you-row' : undefined}
                  className="flex min-h-[64px] items-center gap-3.5 rounded-2xl px-3.5 py-2.5"
                  style={entry.isYou ? { backgroundColor: 'var(--yhq-sheet-you-bg)' } : undefined}
                >
                  <span
                    className="w-7 text-center text-[15.5px] font-medium tabular-nums shrink-0"
                    style={entry.isYou ? undefined : { color: 'var(--yhq-sheet-muted)' }}
                  >
                    {entry.rank}
                  </span>
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white"
                    style={{ backgroundColor: pickAvatarColor(entry.userId || entry.name) }}
                  >
                    {(entry.name[0] || '?').toUpperCase()}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-[16px] font-medium">
                    {entry.name}
                  </span>
                  <span className="text-[15.5px] font-medium tabular-nums shrink-0">
                    {entry.score} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ModalShell>
      )}

      {sheet === 'streak' && (
        <ModalShell
          title={ru ? 'Серия' : 'Kunlik seriya'}
          showHeader={false}
          showHandle={false}
          onClose={() => setSheet(null)}
          closeLabel={tt('close')}
          className="yhq-brilliant-sheet"
        >
          <div className="pt-3 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-display text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
                  {streak}
                </span>
                <BrilliantBoltBadge active={isExtendedToday} size={30} />
              </div>
              <div className="flex items-center gap-2" aria-label={ru ? `Заряды: ${charges}/2` : `Zaryadlar: ${charges}/2`}>
                {[0, 1].map((slot) => (
                  <ChargeBatteryIcon key={slot} active={slot < charges} />
                ))}
              </div>
            </div>

            <p className="mt-4 text-[15px]" style={{ color: 'var(--yhq-sheet-muted)' }}>
              {isExtendedToday
                ? (ru ? 'Отлично! Сегодняшняя серия уже засчитана.' : 'Ajoyib! Bugungi seriya hisobga olindi.')
                : subjectId === RUSSIAN_SUBJECT_ID
                  ? (ru
                    ? <>Пройдите <strong className="font-bold">1 урок</strong>, чтобы продлить серию</>
                    : <>Seriyani uzaytirish uchun <strong className="font-bold">1 ta dars</strong> yeching</>)
                  : (ru
                    ? <>Решите <strong className="font-bold">5+ вопросов</strong> теста, чтобы продлить серию</>
                    : <>Seriyani uzaytirish uchun <strong className="font-bold">5+ savollik</strong> test yeching</>)}
            </p>

            <div className="mt-5 grid grid-cols-5 gap-2 text-center">
              {weekDays.map((day) => {
                const isLit = day.status === 'completed' || day.status === 'saved'
                return (
                  <div key={day.key} className="flex flex-col items-center gap-2">
                    <div
                      data-status={day.status}
                      className="flex size-[54px] items-center justify-center rounded-full transition-colors"
                      style={isLit
                        ? { backgroundColor: '#d6f329', color: '#111111' }
                        : { border: '2px solid var(--yhq-sheet-ring)', color: 'var(--yhq-sheet-bolt-muted)' }}
                    >
                      {day.status === 'saved' ? (
                        <StreakDayBatteryGlyph />
                      ) : (
                        <svg viewBox="0 0 18 25" width={18} height={22} fill="none" aria-hidden="true">
                          <path
                            d="M1.27498 12.516L10.1761 1.31828C10.7098 0.646883 11.7966 1.11739 11.6606 1.96094L10.3758 9.92921H15.8888C16.9368 9.92921 17.5236 11.1248 16.8757 11.94L7.97457 23.1377C7.44087 23.8091 6.35401 23.3386 6.49003 22.495L7.7748 14.5268H2.26186C1.21381 14.5268 0.62701 13.3312 1.27498 12.516Z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </div>
                    <span
                      className="text-[13.5px] leading-none font-bold"
                      style={day.isToday ? undefined : { color: 'var(--yhq-sheet-muted)' }}
                    >
                      {day.label}
                    </span>
                  </div>
                )
              })}
            </div>

            <div
              className="mt-6 grid grid-cols-2 rounded-2xl py-4 text-center"
              style={{ backgroundColor: 'var(--yhq-sheet-surface)' }}
            >
              <div className="flex flex-col items-center justify-center px-2">
                <span className="font-display text-[22px] font-extrabold leading-tight tabular-nums">
                  {maxStreak}
                </span>
                <span className="mt-1 text-[13.5px]" style={{ color: 'var(--yhq-sheet-muted)' }}>
                  {ru ? 'Макс. серия' : 'Eng uzun seriya'}
                </span>
              </div>
              <div
                className="flex flex-col items-center justify-center border-l px-2"
                style={{ borderColor: 'var(--yhq-sheet-divider)' }}
              >
                <span className="font-display text-[22px] font-extrabold leading-tight tabular-nums">
                  {completedCount}
                </span>
                <span className="mt-1 text-[13.5px]" style={{ color: 'var(--yhq-sheet-muted)' }}>
                  {ru ? 'Пройдено уроков' : 'Tugatilgan darslar'}
                </span>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  )
})
