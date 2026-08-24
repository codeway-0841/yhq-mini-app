/**
 * Testlar sahifasi (v1.1) — test rejimini tanlash.
 * Mock'dagi vertikal neon kartalar: glow icon + sarlavha + meta + difficulty tag + progress ring.
 * Barcha ko'rsatilgan raqamlar HAQIQIY (vaqt/savollar soni/foydalanuvchi accuracy).
 * Soxta "N marta yechilgan" ijtimoiy-dalillarni QO'SHMADIK (ma'lumot yo'q — yolg'on bo'lardi).
 */

import { useNavigate } from 'react-router-dom'
import { Zap, ClipboardCheck, ChevronLeft, Search } from 'lucide-react'
import { track } from '../../shared/lib/analytics'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { SUBJECT_BASES } from '../../../shared/subjects'
import { getExamPreset } from '../../../shared/exam-presets'

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
  // Selector'li obuna — whole-store EMAS
  const settings      = useAppStore((s) => s.settings)
  const totalCorrect  = useAppStore((s) => s.totalCorrect)
  const totalAnswered = useAppStore((s) => s.totalAnswered)
  const subjectId = useSubjectStore((s) => s.subjectId)
  const tt = useT(settings.language)

  const accuracy = totalAnswered > 0
    ? Math.min(100, Math.round((totalCorrect / totalAnswered) * 100))
    : 0

  const DIFF: Record<Diff, { label: string; color: string }> = {
    easy: { label: tt('diffEasy'), color: 'var(--p-success)' },
    mid:  { label: tt('diffMid'),  color: 'var(--p-warning)' },
    hard: { label: tt('diffHard'), color: 'var(--p-danger)' },
  }

  // Rasmiy imtihon simulyatori — fan konfigidan (shared/subjects.ts examPresets).
  // YHQ: o'z 'mock' + 'exam' formatlari bor (quyida); qolgan fanlar: preset kartalari.
  const subjectBase = SUBJECT_BASES.find((s) => s.id === subjectId)
  const examPresetCards: ModeCard[] = (subjectBase?.examPresets ?? []).flatMap((pid) => {
    const p = getExamPreset(pid)
    if (!p) return []
    const titleKey = pid === 'milliy-sertifikat' ? 'examPresetMilliy' : 'examPresetAttestatsiya'
    // 120 daqiqa → "2 soat", 180 → "3 soat" (soatga karrali muddatlar)
    const timeMeta = p.durationMinutes % 60 === 0
      ? `${p.durationMinutes / 60} ${tt('hourWord')}`
      : `${p.durationMinutes} ${tt('minWord')}`
    return [{ id: `exam:${p.id}`, iconBox: 'cap' as const, numText: String(p.questionCount),
      titleKey: titleKey as TKey,
      meta: `${p.questionCount} ${tt('question').toLowerCase()} · ${timeMeta}`, diff: 'hard' as const }]
  })

  const cards: ModeCard[] = [
    { id: 'speed',     iconBox: 'zap',
      titleKey: 'speedTitle', meta: `20 ${tt('question').toLowerCase()} × 10 ${tt('speedSec')}`, diff: 'mid' },
    { id: 'random50',  iconBox: 'num', numText: '50',
      titleKey: 't50Test', meta: `50 ${tt('question').toLowerCase()} · 25 ${tt('minWord')}`, diff: 'mid' },
    { id: 'random100', iconBox: 'num', numText: '100',
      titleKey: 't100',    meta: `100 ${tt('question').toLowerCase()} · 120 ${tt('minWord')}`, diff: 'hard' },
    { id: 'random20',  iconBox: 'zap',
      titleKey: 't20',     meta: `20 ${tt('question').toLowerCase()} · 30 ${tt('minWord')}`, diff: 'easy' },
    { id: 'marathon',  iconBox: 'zap',
      titleKey: 'marathonTitle', meta: tt('marathonDesc'), diff: 'hard' },
    // YHQ: mavjud generic realExam; qolgan fanlar: rasmiy preset kartalari (config'dan)
    ...(subjectId === 'yhq'
      ? [{ id: 'exam',  iconBox: 'cap' as const,
           titleKey: 'realExam' as const, meta: `40 ${tt('question').toLowerCase()} · 30 ${tt('minWord')} — ${tt('examDesc')}`, diff: 'hard' as const }]
      : examPresetCards),
    // Mock imtihon FAQAT YHQ uchun (rasmiy bilet formati) — boshqa fanlarda ko'rinmaydi
    ...(subjectId === 'yhq'
      ? [{ id: 'mock',  iconBox: 'cap' as const,        danger: true,
           titleKey: 'mockExam' as const, meta: `20 ${tt('question').toLowerCase()} · 25 ${tt('minWord')} — ${tt('mockFailInfo')}`, diff: 'hard' as const }]
      : []),
  ]

  const start = (m: ModeCard) => {
    track('test_start', { mode: m.id })
    if (m.id === 'speed') { navigate('/speed'); return }
    navigate('/test/1', { state: { mode: m.id, title: tt(m.titleKey) } })
  }

  return (
    <div className="px-4 pt-4 pb-8 min-h-screen">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="grid size-11 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
        <h1 className="text-xl font-semibold">{tt('testlarTitle')}</h1>
      </div>

      {/* Qidiruvga kirish (#45) — fake input, haqiqiy sahifa /qidiruv */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigate('/qidiruv')}
          className="flex w-full items-center gap-2.5 rounded-control border border-plineStrong bg-psurface px-4 py-3 text-left transition-[transform,border-color] duration-[120ms] ease-out hover:border-pline active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas"
        >
          <Search size={16} strokeWidth={1.75} className="flex-shrink-0 text-pprimary" />
          <span className="text-sm text-psubtle">{tt('searchPlaceholder')}</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {cards.map((m) => {
          const d = DIFF[m.diff]
          // Rang intizomi: tema aksent rangi default; qizil FAQAT xavf (mock 2 xato = yiqilishing)
          const boxColor = m.danger ? 'var(--p-danger)' : 'var(--p-primary)'
          const ringColor = m.danger ? 'var(--p-danger)' : 'var(--p-primary)'
          // Ring chart
          const R = 26, C = 2 * Math.PI * R
          const off = C * (1 - accuracy / 100)
          return (
            <button key={m.id} onClick={() => start(m)}
              className="rounded-container border border-pline bg-pcard w-full flex items-center gap-3.5 p-4 active:scale-[0.98] transition-transform">
              {/* Icon box — neytral (yoki danger uchun qizil) */}
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-container flex items-center justify-center"
                  style={{
                    background: `color-mix(in srgb, ${boxColor} 8%, transparent)`,
                    border: `1.5px solid color-mix(in srgb, ${boxColor} 25%, transparent)`,
                  }}>
                  {m.iconBox === 'num' && (
                    <span className="text-[17px] font-semibold" style={{ color: boxColor }}>{m.numText}</span>
                  )}
                  {m.iconBox === 'zap' && <Zap size={26} strokeWidth={2.4} style={{ color: boxColor }} />}
                  {m.iconBox === 'cap' && <ClipboardCheck size={26} strokeWidth={2.2} style={{ color: boxColor }} />}
                </div>
              </div>

              {/* Matn */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[16px] font-semibold text-pfg leading-tight truncate">{tt(m.titleKey)}</p>
                <p className="text-[11.5px] text-psubtle mt-0.5 truncate">{m.meta}</p>
                <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold"
                  style={{ color: d.color }}>
                  <span className="size-2 rounded-full" style={{ background: d.color }} />
                  {d.label}
                </span>
              </div>

              {/* Ring — progress = aksent rang (tema bilan almashadi) */}
              <svg width="62" height="62" viewBox="0 0 62 62" className="flex-shrink-0">
                <circle cx="31" cy="31" r={R} fill="none" stroke="var(--p-line)" strokeWidth="5" />
                <circle cx="31" cy="31" r={R} fill="none" stroke={ringColor} strokeWidth="5"
                  strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
                  transform="rotate(-90 31 31)" />
                <text x="31" y="35" textAnchor="middle" fill="var(--p-fg)" fontSize="12" fontWeight="600">
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
