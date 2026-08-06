/**
 * Testlar sahifasi (v1.1) — test rejimini tanlash.
 * Mock'dagi vertikal neon kartalar: glow icon + sarlavha + meta + difficulty tag + progress ring.
 * Barcha ko'rsatilgan raqamlar HAQIQIY (vaqt/savollar soni/foydalanuvchi accuracy).
 * Soxta "N marta yechilgan" ijtimoiy-dalillarni QO'SHMADIK (ma'lumot yo'q — yolg'on bo'lardi).
 */

import { useNavigate } from 'react-router-dom'
import { Zap, ClipboardCheck } from 'lucide-react'
import { track } from '../../lib/analytics'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../store/useSubjectStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../lib/navigation'

type Diff = 'easy' | 'mid' | 'hard'
type TKey = Parameters<ReturnType<typeof useT>>[0]

interface ModeCard {
  id: string
  iconBox: 'zap' | 'cap' | 'num'
  numText?: string
  danger?: boolean
  titleKey: TKey
  meta: string
  diff: Diff
}

export default function TestlarPage() {
  const navigate = useNavigate()
  const { settings, totalCorrect, totalAnswered } = useAppStore()
  const subjectId = useSubjectStore((s) => s.subjectId)
  const tt = useT(settings.language)

  const accuracy = totalAnswered > 0
    ? Math.min(100, Math.round((totalCorrect / totalAnswered) * 100))
    : 0

  const DIFF: Record<Diff, { label: string; color: string }> = {
    easy: { label: tt('diffEasy'), color: '#22c55e' },
    mid:  { label: tt('diffMid'),  color: '#f59e0b' },
    hard: { label: tt('diffHard'), color: '#ef4444' },
  }

  const cards: ModeCard[] = [
    { id: 'random50',  iconBox: 'num', numText: '50',
      titleKey: 't50Test', meta: `50 ${tt('question').toLowerCase()} · 25 ${tt('minWord')}`, diff: 'mid' },
    { id: 'random100', iconBox: 'num', numText: '100',
      titleKey: 't100',    meta: `100 ${tt('question').toLowerCase()} · 120 ${tt('minWord')}`, diff: 'hard' },
    { id: 'random20',  iconBox: 'zap',
      titleKey: 't20',     meta: `20 ${tt('question').toLowerCase()} · 30 ${tt('minWord')}`, diff: 'easy' },
    { id: 'exam',      iconBox: 'cap',
      titleKey: 'realExam', meta: `40 ${tt('question').toLowerCase()} · 30 ${tt('minWord')} — ${tt('examDesc')}`, diff: 'hard' },
    // Mock imtihon FAQAT YHQ uchun (rasmiy bilet formati) — boshqa fanlarda ko'rinmaydi
    ...(subjectId === 'yhq'
      ? [{ id: 'mock',  iconBox: 'cap' as const,        danger: true,
           titleKey: 'mockExam' as const, meta: `20 ${tt('question').toLowerCase()} · 25 ${tt('minWord')} — ${tt('mockFailInfo')}`, diff: 'hard' as const }]
      : []),
  ]

  const start = (m: ModeCard) => {
    track('test_start', { mode: m.id })
    navigate('/test/1', { state: { mode: m.id, title: tt(m.titleKey) } })
  }

  return (
    <div className="px-4 pt-4 pb-8 min-h-screen">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga"
          className="text-subtle hover:text-fg text-xl px-1 transition-colors">←</button>
        <h1 className="text-xl font-black">{tt('testlarTitle')}</h1>
      </div>

      <div className="flex flex-col gap-3">
        {cards.map((m) => {
          const d = DIFF[m.diff]
          // Rang intizomi (v2.1): neytral kulrang default; qizil FAQAT xavf (mock 2 xato = yiqilishing)
          const boxColor = m.danger ? '#ef4444' : '#94a3b8'
          const ringColor = m.danger ? '#ef4444' : 'var(--p-primary)'
          // Ring chart
          const R = 26, C = 2 * Math.PI * R
          const off = C * (1 - accuracy / 100)
          return (
            <button key={m.id} onClick={() => start(m)}
              className="card-neon w-full flex items-center gap-3.5 p-4 active:scale-[0.98] transition-transform">
              {/* Icon box — neytral (yoki danger uchun qizil) */}
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: `${boxColor}14`, border: `1.5px solid ${boxColor}40` }}>
                  {m.iconBox === 'num' && (
                    <span className="text-[17px] font-black" style={{ color: boxColor }}>{m.numText}</span>
                  )}
                  {m.iconBox === 'zap' && <Zap size={26} strokeWidth={2.4} style={{ color: boxColor }} />}
                  {m.iconBox === 'cap' && <ClipboardCheck size={26} strokeWidth={2.2} style={{ color: boxColor }} />}
                </div>
              </div>

              {/* Matn */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[16px] font-black text-fg leading-tight truncate">{tt(m.titleKey)}</p>
                <p className="text-[11.5px] text-subtle mt-0.5 truncate">{m.meta}</p>
                <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold"
                  style={{ color: d.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}` }} />
                  {d.label}
                </span>
              </div>

              {/* Ring — progress = aksent rang (tema bilan almashadi) */}
              <svg width="62" height="62" viewBox="0 0 62 62" className="flex-shrink-0">
                <circle cx="31" cy="31" r={R} fill="none" stroke="var(--p-line)" strokeWidth="5" />
                <circle cx="31" cy="31" r={R} fill="none" stroke={ringColor} strokeWidth="5"
                  strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
                  transform="rotate(-90 31 31)"
                  style={{ filter: 'drop-shadow(0 0 5px var(--p-glow))' }} />
                <text x="31" y="35" textAnchor="middle" fill="var(--p-fg)" fontSize="12" fontWeight="900">
                  {accuracy}%
                </text>
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}
