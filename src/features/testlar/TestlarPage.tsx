/**
 * Testlar sahifasi (v1.1) — test rejimini tanlash.
 * Mock'dagi vertikal neon kartalar: glow icon + sarlavha + meta + difficulty tag + progress ring.
 * Barcha ko'rsatilgan raqamlar HAQIQIY (vaqt/savollar soni/foydalanuvchi accuracy).
 * Soxta "N marta yechilgan" ijtimoiy-dalillarni QO'SHMADIK (ma'lumot yo'q — yolg'on bo'lardi).
 */

import { useNavigate } from 'react-router-dom'
import { Zap, ClipboardCheck, ChevronLeft, ChevronRight, Search, Sparkles } from 'lucide-react'
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
  iconBox: 'zap' | 'cap' | 'num' | 'ai'
  numText?: string
  danger?: boolean
  /** AI kunlik test — "YANGI" badge + binafsha (AI) aksent */
  aiCard?: boolean
  customTitle?: string
  titleKey: TKey
  meta: string
  diff: Diff
}

export default function TestlarPage() {
  const navigate = useNavigate()
  // Selector'li obuna — whole-store EMAS
  const settings  = useAppStore((s) => s.settings)
  const subjectId = useSubjectStore((s) => s.subjectId)
  const tt = useT(settings.language)

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
    // AI Kunlik Test (rustili) — har kuni 2 ta yangi variant (SSOT: shared/ai-daily-test.ts)
    ...(subjectId === 'rustili'
      ? [{ id: 'ai-daily', iconBox: 'ai' as const, aiCard: true,
           titleKey: 'aiTestTitle' as const, meta: tt('aiTestMeta'), diff: 'mid' as const }]
      : []),
    ...(subjectId === 'yhq'
      ? [
          { id: 'yim',      iconBox: 'cap' as const, danger: true, customTitle: '🏛️ YIM Davlat Imtihoni (1:1)',
            titleKey: 'mockExam' as const, meta: `20 savol · 25 daqiqa · 2 xatoda yiqilish`, diff: 'hard' as const },
          { id: 'mock',     iconBox: 'cap' as const, danger: true,
            titleKey: 'mockExam' as const, meta: `20 ${tt('question').toLowerCase()} · 25 ${tt('minWord')} — ${tt('mockFailInfo')}`, diff: 'hard' as const },
          { id: 'speed',    iconBox: 'zap' as const,
            titleKey: 'speedTitle' as const, meta: `20 ${tt('question').toLowerCase()} × 10 ${tt('speedSec')}`, diff: 'mid' as const },
          { id: 'marathon', iconBox: 'zap' as const,
            titleKey: 'marathonTitle' as const, meta: tt('marathonDesc'), diff: 'hard' as const },
        ]
      : [
          { id: 'speed',     iconBox: 'zap' as const,
            titleKey: 'speedTitle' as const, meta: `20 ${tt('question').toLowerCase()} × 10 ${tt('speedSec')}`, diff: 'mid' as const },
          { id: 'random50',  iconBox: 'num' as const, numText: '50',
            titleKey: 't50Test' as const, meta: `50 ${tt('question').toLowerCase()} · 25 ${tt('minWord')}`, diff: 'mid' as const },
          { id: 'random100', iconBox: 'num' as const, numText: '100',
            titleKey: 't100' as const,    meta: `100 ${tt('question').toLowerCase()} · 120 ${tt('minWord')}`, diff: 'hard' as const },
          { id: 'random20',  iconBox: 'zap' as const,
            titleKey: 't20' as const,     meta: `20 ${tt('question').toLowerCase()} · 30 ${tt('minWord')}`, diff: 'easy' as const },
          { id: 'marathon',  iconBox: 'zap' as const,
            titleKey: 'marathonTitle' as const, meta: tt('marathonDesc'), diff: 'hard' as const },
          ...examPresetCards,
        ]),
  ]

  const start = (m: ModeCard) => {
    track('test_start', { mode: m.id })
    if (m.id === 'yim') { navigate('/test/yim'); return }
    if (m.id === 'speed') { navigate('/speed'); return }
    if (m.id === 'ai-daily') { navigate('/ai-test'); return }
    navigate('/test/1', { state: { mode: m.id, title: tt(m.titleKey) } })
  }

  return (
    <div className="px-4 pb-4">
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 bg-pcanvas border-b border-pline flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
        <h1 className="text-xl font-semibold">{tt('testlarTitle')}</h1>
      </header>

      {/* Qidiruvga kirish (#45) — fake input, haqiqiy sahifa /qidiruv */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigate('/qidiruv')}
          className="flex w-full items-center gap-2.5 rounded-2xl bg-psurface px-4 py-3 text-left transition-all active:scale-[0.99] shadow-xs hover:bg-psurface/80"
        >
          <Search size={16} strokeWidth={1.75} className="flex-shrink-0 text-pprimary" />
          <span className="text-sm text-psubtle">{tt('searchPlaceholder')}</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {cards.map((m) => {
          const d = DIFF[m.diff]
          return (
            <button key={m.id} onClick={() => start(m)}
              className="group relative rounded-2xl bg-pcard w-full flex items-center gap-3.5 p-4 active:scale-[0.98] transition-all text-left shadow-xs hover:bg-psurface">
              {/* AI kunlik test — YANGI badge (yangi testlar ekanligi ko'rinib tursin) */}
              {m.aiCard && (
                <span className="absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-ponprimary bg-ppurple animate-pulse">
                  {tt('aiTestNew')}
                </span>
              )}
              {/* Flat Icon — toza, fonsiz, grid uslubidagi neytral ikonka */}
              <div className="flex size-11 shrink-0 items-center justify-center text-pmuted">
                {m.iconBox === 'num' && (
                  <span className="text-[17px] font-bold text-pmuted tracking-tight tabular-nums">{m.numText}</span>
                )}
                {m.iconBox === 'zap' && <Zap size={24} strokeWidth={1.75} />}
                {m.iconBox === 'cap' && <ClipboardCheck size={24} strokeWidth={1.75} />}
                {m.iconBox === 'ai' && <Sparkles size={24} strokeWidth={1.75} className="text-ppurple" />}
              </div>

              {/* Matn */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[16px] font-semibold text-pfg leading-tight truncate">{m.customTitle ?? tt(m.titleKey)}</p>
                <p className="text-[11.5px] text-psubtle mt-0.5 truncate">{m.meta}</p>
                <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold"
                  style={{ color: d.color }}>
                  <span className="size-2 rounded-full" style={{ background: d.color }} />
                  {d.label}
                </span>
              </div>

              {/* O'tish ko'rsatkichi */}
              <ChevronRight size={18} strokeWidth={2} className="flex-shrink-0 text-psubtle group-hover:text-pfg transition-colors" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
