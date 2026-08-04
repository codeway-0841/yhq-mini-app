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
import { Zap, Trophy, CalendarCheck2, HeartCrack } from 'lucide-react'
import { goBack } from '../../lib/navigation'
import { api, type DailyHistory } from '../../lib/api'
import { todayStr } from '../../store/useDailyStore'
import { useAppStore } from '../../store/useAppStore'
import { useSubjectStore } from '../../store/useSubjectStore'
import { useT } from '../../shared/i18n'

/** Yechilgan savollar soniga qarab yacheyka rangi (0..3 daraja) */
function heatBg(level: number): string {
  switch (level) {
    case 3:  return '#3d9603'
    case 2:  return 'rgba(88, 204, 2, 0.55)'
    case 1:  return 'rgba(88, 204, 2, 0.28)'
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
  const subject   = useSubjectStore((s) => s.subject)
  const tt        = useT(lang)

  const today     = todayStr()
  const [history, setHistory]     = useState<DailyHistory | null>(null)
  const [month, setMonth]         = useState(() => today.slice(0, 7))          // 'YYYY-MM'
  const [selected, setSelected]   = useState(today)                            // 'YYYY-MM-DD'

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
  const streak = history?.dailyStreak ?? 0
  const months = tt('monthsList').split('|')
  const weeks  = tt('weekdaysList').split('|')

  return (
    <div className="px-4 pt-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="text-subtle hover:text-fg text-xl px-1 transition-colors">←</button>
        <h1 className="text-xl font-black">{tt('intizomTitle')}</h1>
      </div>

      {/* Streak hero */}
      <div className="card-neon p-5 flex flex-col items-center text-center mb-4">
        <div className="w-20 h-20 rounded-3xl bg-duo-yellow/15 border border-duo-yellow/40 flex items-center justify-center mb-3"
          style={{ boxShadow: streak > 0 ? '0 0 30px rgba(255,200,0,0.25)' : undefined }}>
          <Zap size={44} className={streak > 0 ? 'text-duo-yellow' : 'text-subtle'}
            fill="currentColor" />
        </div>
        <p className="text-[38px] font-black leading-none text-fg">
          {streak} <span className="text-lg font-bold text-subtle">{tt('daysWord')}</span>
        </p>
        <p className="text-[13px] text-subtle mt-2 font-semibold">
          {streak > 0 ? tt('intizomStreakGood') : tt('intizomStreakStart')}
        </p>
        <div className="mt-3 flex items-center gap-1.5 bg-elevated rounded-full px-3.5 py-1.5">
          <Trophy size={13} className="text-duo-yellow" />
          <span className="text-[12px] font-bold text-subtle">
            {tt('intizomBest')}: {history?.bestStreak ?? 0} {tt('daysWord')}
          </span>
        </div>
      </div>

      {/* Tanlangan kun statistikasi */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { v: sel.answered,              label: tt('solvedWord'), color: 'text-duo-green' },
          { v: sel.answered - sel.correct, label: tt('wrongUpper'), color: 'text-duo-red' },
          { v: sel.fixed,                  label: tt('fixedUpper'), color: 'text-duo-blue' },
        ].map((c) => (
          <div key={c.label} className="card-neon p-3 text-center">
            <p className={`text-[24px] font-black leading-none ${c.color}`}>{c.v}</p>
            <p className="text-[10px] font-bold text-subtle mt-1.5 tracking-wide">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Kalendar */}
      <div className="card-neon p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => shiftMonth(-1)} aria-label="‹"
            className="btn-3d-ghost w-8 h-8 rounded-xl flex items-center justify-center text-subtle">‹</button>
          <p className="text-[14px] font-black text-fg capitalize">
            {months[m - 1]} {y}
          </p>
          <button onClick={() => shiftMonth(1)} aria-label="›"
            disabled={month >= today.slice(0, 7)}
            className="btn-3d-ghost w-8 h-8 rounded-xl flex items-center justify-center text-subtle disabled:opacity-30">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weeks.map((w) => (
            <p key={w} className="text-[10px] font-bold text-subtle uppercase py-1">{w}</p>
          ))}
          {cells.map((date, i) => {
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
                className={`aspect-square rounded-xl flex items-center justify-center text-[13px] font-bold transition-all ${
                  isSel ? 'ring-2 ring-duo-green text-white scale-105' : level > 0 ? 'text-white' : 'text-subtle'
                } ${isNow && !isSel ? 'ring-1 ring-duo-blue/60' : ''} ${future ? 'opacity-25' : 'active:scale-95'}`}
                style={{ background: heatBg(level) }}>
                {Number(date.slice(8))}
              </button>
            )
          })}
        </div>
      </div>

      {/* Qanday ishlaydi? */}
      <div className="card-neon p-4">
        <h2 className="text-[15px] font-black text-fg mb-1">{tt('howItWorks')}</h2>
        <p className="text-[12px] text-subtle mb-4">{tt('intizomDesc')}</p>
        {([
          { icon: Zap,            color: 'text-duo-yellow bg-duo-yellow/15 border-duo-yellow/40', t: 'hw1Title', d: 'hw1Desc' },
          { icon: CalendarCheck2, color: 'text-duo-green  bg-duo-green/15  border-duo-green/40',  t: 'hw2Title', d: 'hw2Desc' },
          { icon: Trophy,         color: 'text-duo-yellow bg-duo-yellow/15 border-duo-yellow/40', t: 'hw3Title', d: 'hw3Desc' },
          { icon: HeartCrack,     color: 'text-duo-red    bg-duo-red/15    border-duo-red/40',    t: 'hw4Title', d: 'hw4Desc' },
        ] as const).map(({ icon: Icon, color, t: tKey, d: dKey }) => (
          <div key={tKey} className="flex items-start gap-3 mb-3.5 last:mb-0">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-black text-fg">{tt(tKey)}</p>
              <p className="text-[12px] text-subtle leading-snug mt-0.5">{tt(dKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
