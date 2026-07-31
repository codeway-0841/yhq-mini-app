import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Play, Check, ChevronLeft, MessageCircle, Dumbbell, GraduationCap } from 'lucide-react'
import { modules } from '../../shared/data'
import { lessons, TOTAL_LESSONS, type Lesson } from '../../data/lessons'
import { useLessonsStore } from '../../store/useLessonsStore'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { openTelegramLink } from '../../lib/telegram'

type Mod = typeof modules[number]

/** moduleId → tegishli savol mavzulari (topics slugs) — "Mashq qilish" uchun */
const MODULE_TOPICS: Record<number, string[]> = {
  1: ['yol-belgilari', 'yol-chiziqlari'],
  2: ['chorrahalar'],
  3: ['toxtatish-va-turish'],
  4: ['manyovr', 'quvib-otish', 'signallar'],
  5: ['temir-yol', 'yuk-tashish', 'yolovchi-tashish', 'shatakka-olish', 'avtomagistral', 'sirpanchiq-yol'],
  6: ['tezlik'],
  7: ['piyodalar'],
  8: ['birinchi-tibbiy-yordam', 'texnik-holat', 'yoritish', 'haydovchi-majburiyatlari'],
}

// ── Lesson screen (telefon ilovasidagi dizayn kabi) ─────────────────────────
function LessonScreen({ mod, lessonIdx, onClose, onDone, onPractice }: {
  mod: Mod
  lessonIdx: number
  onClose: () => void
  onDone: (idx: number) => void
  onPractice: () => void
}) {
  const [idx, setIdx] = useState(lessonIdx)
  const { settings } = useAppStore()
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
    <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
        <button onClick={onClose} className="text-[#8b949e] hover:text-white text-lg px-1">←</button>
        <span className="text-base font-black">{idx + 1}-{ru ? 'урок' : 'dars'}</span>
        <span className="text-xs font-bold text-[#8b949e] bg-[#21262d] px-2.5 py-1 rounded-lg">
          {idx + 1}/{list.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-6">
        {/* Video karta (video kelguncha — nomli karta) */}
        <div className="rounded-2xl bg-white aspect-video flex items-center justify-center relative overflow-hidden mb-4">
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
              <p className="text-sm leading-relaxed text-[#c9d1d9]">{p}</p>
            </div>
          ))}
        </div>

        {/* Mavzu bo'yicha mashq kartasi */}
        <button onClick={onPractice}
          className="w-full rounded-2xl border border-[#30363d] bg-[#161b22] p-4 text-left active:scale-[0.98] transition-transform">
          <p className="text-sm font-bold flex items-center gap-2 mb-1">
            <Dumbbell size={16} className="text-[#8b5cf6]" />
            {ru ? 'Практика по теме' : "Mavzu bo'yicha mashq"}
          </p>
          <p className="text-xs text-[#8b949e]">
            {ru ? 'Тест по вопросам этого модуля' : "Shu modul savollaridan test"}
          </p>
        </button>
      </div>

      {/* Pastki tugmalar */}
      <div className="flex gap-3 px-4 py-3 border-t border-[#30363d]">
        <button onClick={() => openTelegramLink('https://t.me/osonprava_bot')}
          className="flex-1 py-3.5 rounded-xl bg-[#1f6feb] text-white font-bold flex items-center justify-center gap-2">
          <MessageCircle size={16} />
          {ru ? 'Задать вопрос' : 'Savol berish'}
        </button>
        <button onClick={() => advance(idx)}
          className="flex-[1.4] py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 bg-green-600">
          <Check size={16} />
          {idx < list.length - 1
            ? (ru ? 'Прочитано — дальше' : "O'qib bo'ldim — keyingi")
            : (ru ? 'Завершить модуль' : 'Modulni yakunlash')}
        </button>
        {idx < list.length - 1 && (
          <button onClick={() => advance(idx)}
            className="w-12 py-3.5 rounded-xl bg-[#21262d] text-[#e6edf3] flex items-center justify-center">
            <ChevronLeft size={18} className="rotate-180" />
          </button>
        )}
      </div>

      {/* progress bar */}
      <div className="h-1 bg-[#21262d]">
        <div className="h-full transition-all" style={{ width: `${((idx + 1) / list.length) * 100}%`, background: mod.color }} />
      </div>
    </div>
  )
}

// ── Roadmap yo'lakcha (tobacco Duolingo uslubi) ─────────────────────────────
function ModulePath({ mod, doneList, onOpenLesson }: {
  mod: Mod
  doneList: number[]
  onOpenLesson: (idx: number) => void
}) {
  const total = mod.lessonCount
  return (
    <div className="rounded-2xl p-4 border border-white/10 relative overflow-hidden"
      style={{ background: `${mod.color}14`, borderColor: `${mod.color}33` }}>
      {/* Modul banner */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{mod.icon}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">
              {mod.id}-MODUL · {total} TA DARS
            </p>
            <p className="text-base font-black" style={{ color: mod.color }}>{mod.title}</p>
          </div>
        </div>
        <div className="text-xs font-black px-2.5 py-1 rounded-full"
          style={{ background: `${mod.color}22`, color: mod.color }}>
          {doneList.length}/{total}
        </div>
      </div>

      {/* Zigzag yo'l — dars tugmalari */}
      <div className="relative flex flex-col items-center gap-1 py-2">
        {/* Uzun yo'l chizig'i */}
        <div className="absolute left-1/2 top-2 bottom-6 w-1 -translate-x-1/2 rounded-full opacity-30"
          style={{ background: `repeating-linear-gradient(to bottom, ${mod.color} 0 10px, transparent 10px 20px)` }} />

        {Array.from({ length: total }, (_, i) => {
          const done   = doneList.includes(i)
          const locked = i > 0 && !doneList.includes(i - 1)   // oldingi dars o'qilmagan
          const offset = i % 2 === 0 ? '-translate-x-10' : 'translate-x-10'
          return (
            <div key={i} className={`relative z-10 flex flex-col items-center ${offset}`}>
              <button
                onClick={() => !locked && onOpenLesson(i)}
                disabled={locked}
                className={`w-14 h-14 rounded-full border-4 flex items-center justify-center transition-all ${
                  locked ? 'bg-[#21262d] border-[#30363d]' : 'active:scale-90'
                }`}
                style={{
                  borderColor: done ? mod.color : locked ? '#30363d' : '#ffffff33',
                  background:  done ? mod.color : locked ? '#21262d' : `${mod.color}55`,
                  boxShadow:   done ? `0 0 12px ${mod.color}66` : 'none',
                }}>
                {locked
                  ? <Lock size={18} className="text-[#8b949e]" />
                  : done
                    ? <Check size={22} className="text-white" />
                    : <Play size={22} className="text-white ml-0.5" fill="currentColor" />
                }
              </button>
              <span className={`text-[10px] font-semibold mt-1 text-center max-w-[90px] ${
                locked ? 'text-[#484f58]' : 'text-[#c9d1d9]'
              }`}>
                {lessons[mod.id]?.[i] ? lessons[mod.id][i].titleUz.split(' ').slice(0, 2).join(' ') : `${i + 1}-dars`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Darslik() {
  const navigate = useNavigate()
  const { settings } = useAppStore()
  const done = useLessonsStore((s) => s.done)
  const markDone = useLessonsStore((s) => s.markDone)
  const questions = useQuestionsStore((s) => s.questions)
  const topics = useQuestionsStore((s) => s.topics)
  const [reader, setReader] = useState<{ mod: Mod; idx: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const ru = settings.language === 'ru'
  const totalDone = Object.values(done).reduce((s, arr) => s + arr.length, 0)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const practiceModule = (mod: Mod) => {
    const slugs = MODULE_TOPICS[mod.id] ?? []
    const topicIds = topics.filter((t) => slugs.includes(t.slug)).map((t) => t.id)
    const ids = questions.filter((q) => q.topicId != null && topicIds.includes(q.topicId)).map((q) => q.id)
    if (ids.length === 0) {
      showToast(ru ? 'Вопросы по этому модулю скоро' : "Bu modul bo'yicha savollar tez kunda")
      return
    }
    navigate('/test/1', { state: { questionIds: ids, title: `${mod.title} — mashq` } })
  }

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} aria-label="Orqaga"
            className="text-[#8b949e] hover:text-white text-xl px-1">←</button>
          <GraduationCap size={22} className="text-[#1f6feb]" />
          <h1 className="text-xl font-black">{ru ? 'Учебник' : 'Darslik'}</h1>
        </div>
        <span className="text-sm font-bold text-[#8b949e] bg-[#21262d] px-3 py-1 rounded-full">
          🎓 {totalDone}/{TOTAL_LESSONS}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {modules.map((mod) => (
          <ModulePath
            key={mod.id}
            mod={mod}
            doneList={done[mod.id] ?? []}
            onOpenLesson={(i) => setReader({ mod, idx: i })}
          />
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-4 right-4 bg-orange-900/90 border border-orange-500/50 text-orange-100 text-xs font-semibold px-4 py-3 rounded-xl text-center z-40">
          ⚠️ {toast}
        </div>
      )}

      {reader && (
        <LessonScreen
          mod={reader.mod}
          lessonIdx={reader.idx}
          onClose={() => setReader(null)}
          onDone={(idx) => markDone(reader.mod.id, idx)}
          onPractice={() => practiceModule(reader.mod)}
        />
      )}
    </div>
  )
}
