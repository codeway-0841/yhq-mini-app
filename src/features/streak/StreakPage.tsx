/**
 * Intizom (Streak) sahifasi — joriy fan bo'yicha kunlik faollik xaritasi.
 *
 *  - 🔥 Bosiladigan streak progress kartasidan ochiladi.
 *  - Har fanning ALohida seriyasi (server `daily_streaks` — fan bo'yicha).
 *  - Kalendar: kun yacheykasi rangi shu kunda yechilgan savollar SONIGA qarab
 *    to'qlashadi (ko'p yechsa — to'q yashil).
 *  - Kunning ustiga bossa — o'sha kun statistikasi: YECHILDI / XATO / TUZATILDI.
 *  - 1 kun o'tkazilsa seriya 0 ga tushadi (serverda effectiveStreak).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Flame, Trophy, CalendarCheck2, HeartCrack, ChevronLeft, ChevronRight, Snowflake } from 'lucide-react'
import { goBack } from '../../shared/lib/navigation'
import { api, type DailyHistory } from '../../shared/api'
import { useDailyStore, todayStr } from '../../shared/store/useDailyStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'

/** Yechilgan savollar soniga qarab yacheyka rangi (0..3 daraja) — aksent temaga bog'liq */
function heatBg(level: number): string {
  switch (level) {
    case 3:  return 'color-mix(in srgb, var(--p-primary) 88%, #000)'
    case 2:  return 'rgb(var(--p-primary-rgb) / 0.55)'
    case 1:  return 'rgb(var(--p-primary-rgb) / 0.28)'
    default: return 'var(--theme-elevated, rgba(148,163,184,0.08))'
  }
}
function heatLevel(answered: number): number {
  if (answered >= 15) return 3
  if (answered >= 7)  return 2
  if (answered > 0)   return 1
  return 0
}

export default function StreakPage() {
  const navigate  = useNavigate()
  const lang      = useAppStore((s) => s.settings.language)
  const userId    = useAppStore((s) => s.user?.id)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
  const subject   = useSubjectStore((s) => s.subject)
  const tt        = useT(lang)

  const today     = todayStr()
  const [history, setHistory]     = useState<DailyHistory | null>(null)
  const [month, setMonth]         = useState(() => today.slice(0, 7))          // 'YYYY-MM'
  const [selected, setSelected]   = useState(today)                            // 'YYYY-MM-DD'
  // Server javobi kelgunicha — lokal (cache) streak darhol ko'rinadi, 0 emas
  const cachedStreak = useDailyStore((s) => s.streaks[subject.id] ?? 0)

  const subjectId = subject.id
  useEffect(() => {
    if (!userId || userId === '0') return
    api.getDailyHistory(userId, today, subjectId)
      .then(setHistory)
      .catch(() => { /* offline — jim */ })
  }, [userId, today, subjectId])

  /** date → {answered, correct, fixed} xarita */
  const byDate = useMemo(() => {
    const m = new Map<string, { answered: number; correct: number; fixed: number }>()
    for (const r of history?.rows ?? []) {
      const prev = m.get(r.date) ?? { answered: 0, correct: 0, fixed: 0 }
      m.set(r.date, {
        answered: prev.answered + r.answered,
        correct:  prev.correct + r.correct,
        fixed:    prev.fixed + r.fixed,
      })
    }
    return m
  }, [history])

  // Kalendar geometriyasi (dushanba — hafta boshi)
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const firstOffset = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const cells: (string | null)[] = [
    ...Array.from({ length: firstOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]

  const shiftMonth = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (key <= today.slice(0, 7)) setMonth(key) // kelajak oyga o'tilmaydi
  }

  const sel    = byDate.get(selected) ?? { answered: 0, correct: 0, fixed: 0 }
  const streak = history?.dailyStreak ?? cachedStreak
  const months = tt('monthsList').split('|')
  const weeks  = tt('weekdaysList').split('|')

  return (
    <div className="px-5 pt-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="grid size-11 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h1 className="text-xl font-semibold">{tt('intizomTitle')}</h1>
      </div>

      {/* Streak hero */}
      <div className="rounded-container border border-pline bg-pcard p-5 flex flex-col items-center text-center mb-4">
        <div className="w-20 h-20 rounded-container bg-[rgb(var(--p-warning-rgb)/0.12)] border border-[rgb(var(--p-warning-rgb)/0.30)] flex items-center justify-center mb-3">
          <Flame size={38} strokeWidth={1.75} className={streak > 0 ? 'text-pwarning' : 'text-psubtle'} />
        </div>
        <p className="font-display text-[40px] font-semibold leading-none tabular-nums text-pfg">
          {streak} <span className="text-lg font-semibold text-psubtle">{tt('daysWord')}</span>
        </p>
        <p className="text-[13px] text-psubtle mt-2 font-semibold">
          {streak > 0 ? tt('intizomStreakGood') : tt('intizomStreakStart')}
        </p>
        <div className="mt-3 flex items-center gap-1.5 bg-psurface rounded-full px-3.5 py-1.5">
          <Trophy size={13} strokeWidth={1.75} className="text-pwarning" />
          <span className="text-[12px] font-semibold text-psubtle">
            {tt('intizomBest')}: {history?.bestStreak ?? 0} {tt('daysWord')}
          </span>
        </div>
        {/* Streak Freeze — Premium himoya (1 kunlik chegara) */}
        {isPremium && (
          <div className="mt-2 flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
            style={{
              background: 'color-mix(in srgb, var(--p-blue) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--p-blue) 30%, transparent)',
            }}>
            <Snowflake size={13} strokeWidth={1.75} style={{ color: 'var(--p-blue)' }} />
            <span className="text-[11.5px] font-semibold" style={{ color: 'var(--p-blue)' }}>
              {lang === 'ru' ? 'Заморозка серии активна (1 день)' : 'Streak Freeze faol (1 kun himoya)'}
            </span>
          </div>
        )}
      </div>

      {/* Tanlangan kun statistikasi — server javobini kutishda skeleton (0'lar flash bo'lmasin) */}
      {history ? (
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { v: sel.answered,              label: tt('solvedWord'), color: 'text-pprimary' },
            { v: sel.answered - sel.correct, label: tt('wrongUpper'), color: 'text-pdanger' },
            { v: sel.fixed,                  label: tt('fixedUpper'), color: 'text-pblue' },
          ].map((c) => (
            <div key={c.label} className="rounded-container border border-pline bg-pcard p-3 text-center">
              <p className={`text-[24px] font-semibold leading-none ${c.color}`}>{c.v}</p>
              <p className="text-[10px] font-semibold text-psubtle mt-1.5 tracking-wide">{c.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-container border border-pline bg-pcard p-3 text-center animate-pulse">
              <div className="h-6 w-8 mx-auto rounded-md bg-psurface" />
              <div className="h-2.5 w-14 mx-auto rounded bg-psurface mt-2" />
            </div>
          ))}
        </div>
      )}

      {/* Kalendar */}
      <div className="rounded-container border border-pline bg-pcard p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => shiftMonth(-1)} aria-label={lang === 'ru' ? 'Предыдущий месяц' : 'Oldingi oy'}
            className="grid size-9 place-items-center rounded-control text-psubtle transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <p className="text-[14px] font-semibold text-pfg capitalize">
            {months[m - 1]} {y}
          </p>
          <button onClick={() => shiftMonth(1)} aria-label={lang === 'ru' ? 'Следующий месяц' : 'Keyingi oy'}
            disabled={month >= today.slice(0, 7)}
            className="grid size-9 place-items-center rounded-control text-psubtle transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary disabled:opacity-30">
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weeks.map((w) => (
            <p key={w} className="text-[10px] font-semibold text-psubtle uppercase py-1">{w}</p>
          ))}
          {/* Yuklanish skeleti — yashil kataklar "0 holati"da miltillamasin */}
          {!history && cells.map((date, i) =>
            date ? <span key={`sk${date}`} className="aspect-square rounded-control bg-psurface animate-pulse" />
                 : <span key={`e${i}`} />)}
          {history && cells.map((date, i) => {
            if (!date) return <span key={`e${i}`} />
            const future = date > today
            // Har qanday faollik (test, xato tuzatish, dars) — kamida 1-daraja yashil
            const rec    = byDate.get(date)
            const level  = future || !rec ? 0 : Math.max(1, heatLevel(rec.answered))
            const isSel  = date === selected
            const isNow  = date === today
            return (
              <button key={date} disabled={future}
                onClick={() => setSelected(date)}
                className={`aspect-square rounded-control flex items-center justify-center text-[13px] font-semibold transition-all ${
                  level > 0 ? 'text-ponprimary' : 'text-psubtle'} ${isSel ? 'ring-2 ring-pprimary scale-105' : ''
                } ${isNow && !isSel ? 'ring-1 ring-pblue/60' : ''} ${future ? 'opacity-25' : 'active:scale-95'}`}
                style={{ background: heatBg(level) }}>
                {Number(date.slice(8))}
              </button>
            )
          })}
        </div>
      </div>


      {/* Qanday ishlaydi? */}
      <div className="rounded-container border border-pline bg-pcard p-4">
        <h2 className="text-[15px] font-semibold text-pfg mb-1">{tt('howItWorks')}</h2>
        <p className="text-[12px] text-psubtle mb-4">{tt('intizomDesc')}</p>
        {([
          { icon: Zap,            color: 'text-pwarning bg-pwarning/15 border-pwarning/40', t: 'hw1Title', d: 'hw1Desc' },
          { icon: CalendarCheck2, color: 'text-pprimary  bg-pprimary/15  border-pprimary/40',  t: 'hw2Title', d: 'hw2Desc' },
          { icon: Trophy,         color: 'text-pwarning bg-pwarning/15 border-pwarning/40', t: 'hw3Title', d: 'hw3Desc' },
          { icon: HeartCrack,     color: 'text-pdanger    bg-pdanger/15    border-pdanger/40',    t: 'hw4Title', d: 'hw4Desc' },
        ] as const).map(({ icon: Icon, color, t: tKey, d: dKey }) => (
          <div key={tKey} className="flex items-start gap-3 mb-3.5 last:mb-0">
            <div className={`w-10 h-10 rounded-control border flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-pfg">{tt(tKey)}</p>
              <p className="text-[12px] text-psubtle leading-snug mt-0.5">{tt(dKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
