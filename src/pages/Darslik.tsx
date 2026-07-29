import React from 'react'
import { Lock, Play } from 'lucide-react'
import { modules, finalStages } from '../data/modules'

type Mod = typeof modules[number]
type FinalStageItem = typeof finalStages[number]

function ModuleBanner({ mod, progress }: { mod: Mod; progress: number }) {
  return (
    <div
      className="rounded-2xl p-4 border border-white/10"
      style={{ background: `${mod.color}22`, borderColor: `${mod.color}44` }}
    >
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
        <div
          className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-xs font-bold"
          style={{ borderColor: mod.color, color: mod.color }}
        >
          {progress}/{mod.lessonCount}
        </div>
      </div>

      {/* Lesson nodes */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {Array.from({ length: mod.lessonCount }, (_, i) => (
          <div key={i} className="relative flex flex-col items-center">
            <button
              className="w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all active:scale-95"
              style={{
                borderColor: i < progress ? mod.color : '#30363d',
                background: i < progress ? `${mod.color}33` : '#161b22',
              }}
            >
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

function FinalStage({ stage, index }: { stage: FinalStageItem; index: number }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 ${
      stage.locked ? 'border-[#30363d] opacity-50' : 'border-[#1f6feb]/40 bg-[#1f6feb]/10'
    }`}>
      <div className="w-10 h-10 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center">
        {stage.locked ? <Lock size={16} className="text-[#8b949e]" /> : <Play size={16} className="text-[#1f6feb]" />}
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
    </div>
  )
}

export default function Darslik() {
  // All lessons at 0 progress for mock
  const progress: Record<number, number> = {}

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-black">Darslik</h1>
        <span className="text-sm font-bold text-[#8b949e] bg-[#21262d] px-3 py-1 rounded-full">
          🎓 0/42
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {modules.map((mod) => (
          <React.Fragment key={mod.id}>
            <ModuleBanner mod={mod} progress={progress[mod.id] || 0} />
            {/* Dashed connector between modules */}
            {mod.id < modules.length && (
              <div className="flex justify-center">
                <div className="w-0.5 h-6 border-l-2 border-dashed border-[#30363d]" />
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Final stages */}
        <div className="mt-2">
          <p className="text-xs font-bold text-[#8b949e] uppercase tracking-widest mb-3 text-center">
            Yakuniy bosqichlar
          </p>
          <div className="flex flex-col gap-3">
            {finalStages.map((stage, i) => (
              <FinalStage key={stage.id} stage={stage} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
