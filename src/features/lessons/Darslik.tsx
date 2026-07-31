import { useState } from 'react'
import React from 'react'
import { Lock, Play, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { modules, finalStages } from '../../shared/data'
import { lessons, TOTAL_LESSONS, type Lesson } from '../../data/lessons'
import { useLessonsStore } from '../../store/useLessonsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { useNavigate } from 'react-router-dom'

type Mod = typeof modules[number]
type FinalStageItem = typeof finalStages[number]

// ── Lesson reader (full-screen overlay) ─────────────────────────────────────
function LessonReader({ mod, lessonIdx, onClose, onDone }: {
  mod: Mod
  lessonIdx: number
  onClose: () => void
  onDone: (idx: number) => void
}) {
  const [idx, setIdx] = useState(lessonIdx)
  const { settings } = useAppStore()
  const list = lessons[mod.id] ?? []
  const lesson: Lesson | undefined = list[idx]
  const ru = settings.language === 'ru'

  if (!lesson) return null

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
        <button onClick={onClose} className="text-[#8b949e] hover:text-white text-lg px-1">←</button>
        <span className="text-xs font-bold text-[#8b949e]">
          {mod.icon} {ru ? 'ДАРС' : 'DARS'} {idx + 1}/{list.length}
        </span>
        <span className="w-6" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-8">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: mod.color }}>
          {ru ? `МОДУЛЬ ${mod.id}` : `${mod.id}-MODUL`}
        </p>
        <h2 className="text-lg font-black mb-4 leading-snug">
          {ru ? lesson.titleRu : lesson.titleUz}
        </h2>
        <div className="flex flex-col gap-3">
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
      </div>

      <div className="flex gap-3 px-4 py-3 border-t border-[#30363d]">
        <button
          onClick={() => idx > 0 && setIdx(idx - 1)}
          disabled={idx === 0}
          className="w-12 py-3.5 rounded-xl bg-[#21262d] text-[#e6edf3] font-bold flex items-center justify-center disabled:opacity-40">
          <ChevronLeft size={18} />
        </button>
        {idx < list.length - 1 ? (
          <button
            onClick={() => { onDone(idx); setIdx(idx + 1) }}
            className="flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 text-white"
            style={{ background: mod.color }}>
            <Check size={16} />
            {ru ? 'Прочитано — дальше' : "O'qib bo'ldim — keyingi"}
          </button>
        ) : (
          <button
            onClick={() => { onDone(idx); onClose() }}
            className="flex-1 py-3.5 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center gap-2">
            <Check size={16} />
            {ru ? 'Завершить модуль' : 'Modulni yakunlash'}
          </button>
        )}
        <button
          onClick={() => idx < list.length - 1 && setIdx(idx + 1)}
          disabled={idx >= list.length - 1}
          className="w-12 py-3.5 rounded-xl bg-[#21262d] text-[#e6edf3] font-bold flex items-center justify-center disabled:opacity-40">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* progress bar */}
      <div className="h-1 bg-[#21262d]">
        <div className="h-full transition-all" style={{ width: `${((idx + 1) / list.length) * 100}%`, background: mod.color }} />
      </div>
    </div>
  )
}

// ── Module banner ───────────────────────────────────────────────────────────
function ModuleBanner({ mod, progress, onOpenLesson }: {
  mod: Mod
  progress: number
  onOpenLesson: (idx: number) => void
}) {
  return (
    <div className="rounded-2xl p-4 border border-white/10"
      style={{ background: `${mod.color}22`, borderColor: `${mod.color}44` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{mod.icon}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">
              {mod.id}-MODUL · {mod.lessonCount} TA DARS
            </p>
            <p className="text-sm font-bold mt-0.5">{mod.title}</p>
          </div>
        </div>
        <div className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-xs font-bold"
          style={{ borderColor: mod.color, color: mod.color }}>
          {progress}/{mod.lessonCount}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {Array.from({ length: mod.lessonCount }, (_, i) => (
          <div key={i} className="relative flex flex-col items-center">
            <button
              onClick={() => onOpenLesson(i)}
              className="w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all active:scale-95"
              style={{
                borderColor: i < progress ? mod.color : '#30363d',
                background:  i < progress ? `${mod.color}33` : '#161b22',
              }}>
              {i < progress
                ? <span className="text-xs" style={{ color: mod.color }}>✓</span>
                : <Play size={12} className="text-[#8b949e]" />
              }
            </button>
            <span className="text-[9px] text-[#8b949e] mt-0.5">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinalStage({ stage, index, onClick }: { stage: FinalStageItem; index: number; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={stage.locked}
      className={`flex items-center gap-3 rounded-2xl border p-4 w-full text-left ${
        stage.locked ? 'border-[#30363d] opacity-50' : 'border-[#1f6feb]/40 bg-[#1f6feb]/10 active:scale-[0.98] transition-transform'
      }`}>
      <div className="w-10 h-10 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center flex-none">
        {stage.locked
          ? <Lock size={16} className="text-[#8b949e]" />
          : <Play size={16} className="text-[#1f6feb]" />
        }
      </div>
      <div className="flex-1">
        <p className="text-xs text-[#8b949e] font-medium">{index + 1}-BOSQICH</p>
        <p className="text-sm font-bold">{stage.title}</p>
      </div>
      {stage.locked && (
        <span className="text-[10px] font-bold text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded-full uppercase tracking-wider">
          YOPIQ
        </span>
      )}
    </button>
  )
}

export default function Darslik() {
  const navigate = useNavigate()
  const done = useLessonsStore((s) => s.done)
  const markDone = useLessonsStore((s) => s.markDone)
  const [reader, setReader] = useState<{ mod: Mod; idx: number } | null>(null)

  const totalDone = Object.values(done).reduce((s, arr) => s + arr.length, 0)
  const progressFor = (modId: number) => (done[modId] ?? []).length

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-black">Darslik</h1>
        <span className="text-sm font-bold text-[#8b949e] bg-[#21262d] px-3 py-1 rounded-full">
          🎓 {totalDone}/{TOTAL_LESSONS}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {modules.map((mod, idx) => (
          <React.Fragment key={mod.id}>
            <ModuleBanner
              mod={mod}
              progress={progressFor(mod.id)}
              onOpenLesson={(i) => setReader({ mod, idx: i })}
            />
            {idx < modules.length - 1 && (
              <div className="flex justify-center">
                <div className="w-0.5 h-6 border-l-2 border-dashed border-[#30363d]" />
              </div>
            )}
          </React.Fragment>
        ))}

        <div className="mt-2">
          <p className="text-xs font-bold text-[#8b949e] uppercase tracking-widest mb-3 text-center">
            Yakuniy bosqichlar
          </p>
          <div className="flex flex-col gap-3">
            {finalStages.map((stage, i) => (
              <FinalStage
                key={stage.id}
                stage={stage}
                index={i}
                onClick={
                  stage.id === 'inner'
                    ? () => navigate('/test/1', { state: { mode: 'exam', title: 'Ichki imtihon' } })
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </div>

      {reader && (
        <LessonReader
          mod={reader.mod}
          lessonIdx={reader.idx}
          onClose={() => setReader(null)}
          onDone={(idx) => markDone(reader.mod.id, idx)}
        />
      )}
    </div>
  )
}
