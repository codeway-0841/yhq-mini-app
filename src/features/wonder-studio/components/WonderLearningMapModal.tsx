import { useState, useEffect, useMemo } from 'react'
import { X, Sparkles, ZoomIn, ZoomOut, Maximize2, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useWonderStore } from '../store/useWonderStore'
import type { WonderCourse } from '../types'

interface WonderLearningMapModalProps {
  course: WonderCourse
  onClose: () => void
  onSelectLesson: (lessonId: string) => void
}

interface MapNode {
  id: string
  lessonId: string
  title: string
  subtitle: string
  x: number
  y: number
  isDone: boolean
  connections: string[]
}

export default function WonderLearningMapModal({
  course,
  onClose,
  onSelectLesson,
}: WonderLearningMapModalProps) {
  const completedLessonIds = useWonderStore((s) => s.completedLessonIds)
  const [isGenerating, setIsGenerating] = useState(true)
  const [zoom, setZoom] = useState(1.0)

  useEffect(() => {
    const t = setTimeout(() => setIsGenerating(false), 500)
    return () => clearTimeout(t)
  }, [])

  // Dynamically generate knowledge graph nodes from course sections & lessons
  const mapNodes = useMemo<MapNode[]>(() => {
    const allLessons = course.sections.flatMap((s, sIdx) =>
      s.lessons.map((l, lIdx) => ({ lesson: l, section: s, sIdx, lIdx }))
    )
    if (allLessons.length === 0) return []

    const selected = allLessons.slice(0, 12)

    return selected.map((item, index) => {
      const col = Math.floor(index / 2)
      const isAlt = index % 2 === 1
      const x = 60 + col * 240
      const y = isAlt ? 230 + ((col % 2) * 15) : 70 + ((col % 2) * 20)

      const connections: string[] = []
      if (index + 1 < selected.length) {
        connections.push(selected[index + 1].lesson.id)
      }
      if (index + 2 < selected.length && !isAlt) {
        connections.push(selected[index + 2].lesson.id)
      }

      const isDone = completedLessonIds.includes(item.lesson.id)

      return {
        id: item.lesson.id,
        lessonId: item.lesson.id,
        title: item.lesson.title,
        subtitle: item.lesson.tldr || item.section.title,
        x,
        y,
        isDone,
        connections,
      }
    })
  }, [course, completedLessonIds])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    if (mapNodes.length > 0 && !selectedNodeId) {
      setSelectedNodeId(mapNodes[0].id)
    }
  }, [mapNodes, selectedNodeId])

  const courseLessons = useMemo(
    () => course.sections.flatMap((s) => s.lessons),
    [course],
  )
  const completedCount = courseLessons.filter((l) =>
    completedLessonIds.includes(l.id),
  ).length
  const earnedXp = completedCount * 40

  const activeNode = mapNodes.find((n) => n.id === selectedNodeId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs font-sans select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl h-[88vh] rounded-3xl bg-[#FFFCF6] dark:bg-[#1C1411] border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header Bar (1:1 with learning_map_view.png) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
              {course.title} learning map
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[11px] font-semibold">
              ★ {earnedXp} XP
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center p-1 rounded-xl bg-[#FAF8F2] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
                className="p-1 text-stone-500 hover:text-stone-900"
              >
                <ZoomOut size={13} />
              </button>
              <span className="px-1.5 font-bold text-[11px]">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
                className="p-1 text-stone-500 hover:text-stone-900"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1.0)}
                className="p-1 ml-1 text-stone-500 hover:text-stone-900 border-l border-stone-200 dark:border-stone-700"
              >
                <Maximize2 size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="size-8 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X size={17} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Map Body Area */}
        <div className="flex-1 relative overflow-hidden bg-[#FFFCF6] dark:bg-[#1C1411]">
          {isGenerating ? (
            /* 1:1 Generating state matching learning_map_view.png */
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="size-14 rounded-2xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center text-2xl shadow-xs">
                <Sparkles size={26} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
                  Generating your learning map
                </h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm">
                  Grouping lessons into concepts and linking them to your learning signals.
                </p>
              </div>
            </div>
          ) : (
            /* Interactive Concept Knowledge Graph */
            <div className="relative w-full h-full p-8 overflow-auto">
              {/* Subtle background dots */}
              <div
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{
                  backgroundImage: 'radial-gradient(#94A3B8 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              {/* SVG Link Curves */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              >
                {mapNodes.flatMap((source) =>
                  source.connections.map((targetId) => {
                    const target = mapNodes.find((n) => n.id === targetId)
                    if (!target) return null
                    const x1 = source.x + 192
                    const y1 = source.y + 36
                    const x2 = target.x
                    const y2 = target.y + 36
                    const midX = (x1 + x2) / 2
                    return (
                      <path
                        key={`${source.id}-${target.id}`}
                        d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke="#CBD5E1"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                    )
                  }),
                )}
              </svg>

              {/* Nodes List */}
              <div
                className="absolute inset-0 p-8 transition-transform duration-150"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              >
                {mapNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id
                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      style={{ position: 'absolute', left: `${node.x}px`, top: `${node.y}px` }}
                      className={`w-48 p-3 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'border-[#0284C7] bg-[#E0F2FE]/70 text-[#0284C7] shadow-md scale-105 z-20'
                          : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 hover:border-stone-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold truncate flex-1">{node.title}</h4>
                        {node.isDone && (
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-stone-500 truncate mt-0.5">{node.subtitle}</p>
                    </div>
                  )
                })}
              </div>

              {/* Selected Node Details Card */}
              {activeNode && (
                <div className="absolute bottom-4 right-4 z-30 w-72 p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                      {activeNode.title}
                    </span>
                    {activeNode.isDone && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold shrink-0">
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed line-clamp-3">
                    {activeNode.subtitle}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectLesson(activeNode.lessonId)
                      onClose()
                    }}
                    className="w-full mt-2 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                  >
                    <span>Open Lesson</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
