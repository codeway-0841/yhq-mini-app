import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { Lock, Play, Check, ChevronLeft, MessageCircle, Dumbbell, GraduationCap } from 'lucide-react'
import { modules } from '../../content/modules'
import { MODULE_TOPICS } from '../../content/modules'
import { lessons, TOTAL_LESSONS, type Lesson } from '../../content/lessons'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useDailyStore, todayStr } from '../../shared/store/useDailyStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { openTelegramLink } from '../../platform/telegram'

type Mod = typeof modules[number]

// ── Lesson screen (telefon ilovasidagi dizayn kabi) ─────────────────────────
function LessonScreen({ mod, lessonIdx, onClose, onDone, onPractice }: {
  mod: Mod
  lessonIdx: number
  onClose: () => void
  onDone: (idx: number) => void
  onPractice: () => void
}) {
  const [idx, setIdx] = useState(lessonIdx)
  const settings = useAppStore((s) => s.settings)
  const list = lessons[mod.id] ?? []
  const lesson: Lesson | undefined = list[idx]
  const ru = settings.language === 'ru'

  if (!lesson) return null

  const advance = (i: number) => {
    onDone(i)
    if (i < list.length - 1) setIdx(i + 1)
    else onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-canvas flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <button onClick={onClose} className="text-muted hover:text-fg text-lg px-1">←</button>
        <span className="text-base font-black">{idx + 1}-{ru ? 'урок' : 'dars'}</span>
        <span className="text-xs font-bold text-muted bg-elevated px-2.5 py-1 rounded-lg">
          {idx + 1}/{list.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-6">
        {/* Video karta (video kelguncha — nomli karta) */}
        <div className="rounded-2xl bg-surface border border-line aspect-video flex items-center justify-center relative overflow-hidden mb-4">
          <p className="text-2xl font-black px-6 text-center" style={{ color: mod.color }}>
            {ru ? lesson.titleRu : lesson.titleUz}
          </p>
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
              <Play size={28} className="text-white ml-1" fill="currentColor" />
            </div>
          </div>
        </div>

        <h2 className="text-base font-bold mb-3">
          {idx + 1}-{ru ? 'урок' : 'dars'}. {ru ? lesson.titleRu : lesson.titleUz}
        </h2>

        {/* Tanishuv matni */}
        <div className="flex flex-col gap-3 mb-5">
          {(ru ? lesson.bodyRu : lesson.bodyUz).map((p, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex-none w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5"
                style={{ background: `${mod.color}22`, color: mod.color }}>
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-muted">{p}</p>
            </div>
          ))}
        </div>

        {/* Mavzu bo'yicha mashq kartasi */}
        <button onClick={onPractice}
          className="w-full rounded-2xl border border-line bg-surface p-4 text-left active:scale-[0.98] transition-transform">
          <p className="text-sm font-bold flex items-center gap-2 mb-1">
            <Dumbbell size={16} className="text-duo-purple" />
            {ru ? 'Практика по теме' : "Mavzu bo'yicha mashq"}
          </p>
          <p className="text-xs text-muted">
            {ru ? 'Тест по вопросам этого модуля' : "Shu modul savollaridan test"}
          </p>
        </button>
      </div>

      {/* Pastki tugmalar */}
      <div className="flex gap-3 px-4 py-3 border-t border-line">
        <button onClick={() => openTelegramLink('https://t.me/kiwi_uz_bot')}
          className="flex-1 py-3.5 rounded-xl bg-duo-green text-ponprimary font-bold flex items-center justify-center gap-2">
          <MessageCircle size={16} />
          {ru ? 'Задать вопрос' : 'Savol berish'}
        </button>
        <button onClick={() => advance(idx)}
          className="flex-[1.4] py-3.5 rounded-xl text-ponprimary font-bold flex items-center justify-center gap-2 bg-duo-green">
          <Check size={16} />
          {idx < list.length - 1
            ? (ru ? 'Прочитано — дальше' : "O'qib bo'ldim — keyingi")
            : (ru ? 'Завершить модуль' : 'Modulni yakunlash')}
        </button>
        {idx < list.length - 1 && (
          <button onClick={() => advance(idx)}
            className="w-12 py-3.5 rounded-xl bg-elevated text-fg flex items-center justify-center">
            <ChevronLeft size={18} className="rotate-180" />
          </button>
        )}
      </div>

      {/* progress bar — o'qish progressi (aksent) */}
      <div className="h-1 bg-elevated">
        <div className="h-full transition-all" style={{ width: `${((idx + 1) / list.length) * 100}%`, background: 'var(--p-primary)' }} />
      </div>
    </div>
  )
}

// ── Roadmap yo'lakcha (tobacco Duolingo uslubi) ─────────────────────────────
// ── Winding road helpers ────────────────────────────────────────────────────
const ROAD_W = 340
const ROW_H  = 96
const NODE_DX = 84

/** Aqlli yo'l bezaklari (seed bilan barqaror) */
const DECOS = ['🌲', '🚦', '🌳', '🏠', '⚠️', '🌲', '🏢', '🌳']
function decosFor(modId: number, total: number) {
  const out: { emoji: string; left: number; top: number }[] = []
  for (let i = 0; i < total; i++) {
    const idx = (modId * 7 + i * 3) % DECOS.length
    const side = i % 2 === 0 ? 0.055 : 0.835   // tugunlar qarama-qarshi tomonda
    out.push({ emoji: DECOS[idx], left: side, top: 48 + i * ROW_H - 12 })
  }
  return out
}

/** Egri yo'l SVG path d — tugunlar orasida yumshoq egri 400 chiziqlar */
function roadPath(total: number): { d: string; h: number } {
  const pt = (i: number): [number, number] => [
    ROAD_W / 2 + (i % 2 === 0 ? -NODE_DX : NODE_DX),
    48 + i * ROW_H,
  ]
  let d = ''
  for (let i = 0; i < total; i++) {
    const [x, y] = pt(i)
    if (i === 0) { d = `M ${x} ${y}`; continue }
    const [, py] = pt(i - 1)
    d += ` Q ${ROAD_W / 2} ${(py + y) / 2}, ${x} ${y}`
  }
  return { d, h: 48 + (total - 1) * ROW_H + 70 }
}

// ── Roadmap yo'lakcha (Duolingo uslubi — winding path) ─────────────────────
function ModulePath({ mod, doneList, onOpenLesson }: {
  mod: Mod
  doneList: number[]
  onOpenLesson: (idx: number) => void
}) {
  const settings = useAppStore((s) => s.settings)
  const ru = settings.language === 'ru'
  const modTitle = ru ? mod.titleRu : mod.title
  const total = mod.lessonCount
  const activeIdx = (() => {
    for (let i = 0; i < total; i++) if (!doneList.includes(i)) return i
    return -1   // hammasi tugallangan
  })()
  const road = roadPath(total)

  return (
    <div className="rounded-2xl p-4 border border-white/10 relative overflow-hidden"
      style={{ background: `linear-gradient(140deg, ${mod.color}26 0%, ${mod.color}0d 60%, transparent 100%)`, borderColor: `${mod.color}44` }}>
      {/* Modul banner */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: `${mod.color}2e` }}>
            {mod.icon}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
              {mod.id}-{ru ? 'МОДУЛЬ' : 'MODUL'} · {total} {ru ? 'УРОКОВ' : 'TA DARS'}
            </p>
            <p className="text-base font-black" style={{ color: mod.color }}>{modTitle}</p>
          </div>
        </div>
        <div className="text-xs font-black px-2.5 py-1 rounded-full"
          style={{ background: `${mod.color}2e`, color: mod.color }}>
          {doneList.length}/{total}
        </div>
      </div>

      {/* Winding yo'l */}
      <div className="relative" style={{ height: road.h }}>
        {/* Bezaklar */}
        {decosFor(mod.id, total).map((dc, i) => (
          <span key={i} className="absolute text-xl opacity-60 select-none"
            style={{ left: `${dc.left * 100}%`, top: dc.top }}>
            {dc.emoji}
          </span>
        ))}

        {/* Egri yo'l (SVG) */}
        <svg className="absolute inset-0 mx-auto" width={ROAD_W} height={road.h} fill="none">
          <path d={road.d} stroke="var(--theme-line)" strokeWidth="14" strokeLinecap="round" />
          <path d={road.d} stroke="var(--theme-fg-muted)" strokeWidth="3" strokeDasharray="12 16" strokeLinecap="round" opacity="0.7" />
        </svg>

        {/* Tugunlar */}
        <div className="absolute inset-x-0 top-0 mx-auto" style={{ width: ROAD_W }}>
          {Array.from({ length: total }, (_, i) => {
            const done    = doneList.includes(i)
            const active  = i === activeIdx
            const locked  = i > 0 && !doneList.includes(i - 1)
            const left    = '50%'
            const tx      = i % 2 === 0 ? -NODE_DX : NODE_DX
            return (
              <div key={i} className="absolute flex flex-col items-center"
                style={{ left, top: 48 + i * ROW_H, transform: `translateX(calc(-50% + ${tx}px)) translateY(-50%)`, width: 110 }}>
                <button
                  onClick={() => !locked && onOpenLesson(i)}
                  disabled={locked}
                  className={`rounded-full border-4 flex items-center justify-center transition-all ${active ? 'lesson-glow' : ''} ${
                    locked ? 'bg-elevated border-line w-12 h-12'
                           : done ? 'w-14 h-14' : 'w-14 h-14 active:scale-90'
                  }`}
                  style={{
                    '--glow': `${mod.color}bb`,
                    borderColor: done || active ? mod.color : 'var(--theme-line)',
                    background:  done ? mod.color : locked ? 'var(--theme-elevated)' : `${mod.color}cc`,
                    boxShadow:   active ? `0 0 18px ${mod.color}88` : done ? `0 0 10px ${mod.color}55` : 'none',
                  } as React.CSSProperties}>
                  {locked
                    ? <Lock size={16} className="text-muted" />
                    : done
                      ? <Check size={22} className="text-white" />
                      : <Play size={22} className="text-white ml-0.5" fill="currentColor" />
                  }
                </button>
                <span className={`text-[10px] font-bold mt-1.5 text-center leading-tight ${
                  locked ? 'text-lineStrong' : 'text-muted'
                }`}>
                  {lessons[mod.id]?.[i]
                    ? (ru ? lessons[mod.id][i].titleRu : lessons[mod.id][i].titleUz).split(' ').slice(0, 2).join(' ')
                    : `${i + 1}-${ru ? 'урок' : 'dars'}`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Darslik() {
  const navigate = useNavigate()
  const location = useLocation()
  const settings = useAppStore((s) => s.settings)
  const userId = useAppStore((s) => s.user?.id) ?? '0'
  const doneFor = useLessonsStore((s) => s.byUser[userId] ?? {})
  const questions = useQuestionsStore((s) => s.questions)
  const topics = useQuestionsStore((s) => s.topics)
  // "Davom etish" kartasidan kelish — aniq darsni ochish
  const [reader, setReader] = useState<{ mod: Mod; idx: number } | null>(() => {
    const st = location.state as { moduleId?: number; lessonIdx?: number } | null
    if (st?.moduleId != null && st?.lessonIdx != null) {
      const mod = modules.find((m) => m.id === st.moduleId)
      if (mod) return { mod, idx: Math.min(Math.max(0, st.lessonIdx), mod.lessonCount - 1) }
    }
    return null
  })
  const [toast, setToast] = useState<string | null>(null)

  const ru = settings.language === 'ru'
  const totalDone = Object.values(doneFor).reduce((s, arr) => s + arr.length, 0)
  const markDone = useLessonsStore((s) => s.markDone)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const practiceModule = (mod: Mod) => {
    const slugs = MODULE_TOPICS[mod.id] ?? []
    const topicIds = topics.filter((t) => slugs.includes(t.slug)).map((t) => t.id)
    const ids = questions.filter((q) => q.topicId != null && topicIds.includes(q.topicId)).map((q) => q.id)
    if (ids.length === 0) {
      showToast(ru ? 'Вопросы по этому модулю скоро' : "Bu modul bo'yicha savollar tez kunda")
      return
    }
    navigate('/test/1', { state: { questionIds: ids, title: `${ru ? mod.titleRu : mod.title} — ${ru ? 'практика' : 'mashq'}` } })
  }

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => goBack(navigate)} aria-label={ru ? 'Назад' : 'Orqaga'}
            className="text-muted hover:text-fg text-xl px-1">←</button>
          <GraduationCap size={22} className="text-ppurple" />
          <h1 className="text-xl font-black">{ru ? 'Учебник' : 'Darslik'}</h1>
        </div>
        <span className="text-sm font-bold text-muted bg-elevated px-3 py-1 rounded-full">
          🎓 {totalDone}/{TOTAL_LESSONS}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {modules.map((mod) => (
          <ModulePath
            key={mod.id}
            mod={mod}
            doneList={doneFor[mod.id] ?? []}
            onOpenLesson={(i) => setReader({ mod, idx: i })}
          />
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-4 right-4 bg-orange-500/10 border border-orange-500/40 text-fg text-xs font-semibold px-4 py-3 rounded-xl text-center z-40">
          ⚠️ {toast}
        </div>
      )}

      {reader && (
        <LessonScreen
          mod={reader.mod}
          lessonIdx={reader.idx}
          onClose={() => setReader(null)}
          onDone={(idx) => {
            markDone(userId, reader.mod.id, idx)
            // Dars bilan shug'ullanish ham kunlik faollik — streak yoziladi (kunda 1 marta)
            void useDailyStore.getState().touchActivity(
              userId, todayStr(), useSubjectStore.getState().subjectId,
            )
          }}
          onPractice={() => practiceModule(reader.mod)}
        />
      )}
    </div>
  )
}
