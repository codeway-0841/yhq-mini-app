import { useState, useRef, useEffect } from 'react'
import {
  BookOpen,
  CheckCheck,
  Dumbbell,
  AudioLines,
  Lock,
  Award,
  Sparkles,
} from 'lucide-react'
import { WonderActivePeekingNode, WonderLockedDisk, WonderSectionNotebookIcon } from './WonderIcons'
import WonderCertificateModal from './WonderCertificateModal'
import { playSound } from '../../../shared/lib/sounds'
import { useWonderStore } from '../store/useWonderStore'
import type { WonderCourse, WonderLessonNode } from '../types'

interface WonderPathViewProps {
  course: WonderCourse
  onStartLesson: (lesson: WonderLessonNode) => void
  onLockedLessonClick?: (lesson: WonderLessonNode) => void
  onOpenSectionReview?: (sectionTitle: string) => void
  onOpenLiveChallenge?: (sectionTitle: string) => void
}

/* Authentic Wondering Constants from index-DdgSrxYa.js (lines 5340000 & 5363824) */
const BLOCK_X_OFFSET = 30
const ZIGZAG_CENTER_OFFSET = -50
const BLOCK_Y_MARGIN = 20
const ZIGZAG_CYCLE = 4

const getBlockZigzagOffset = (index: number) => {
  const mod = index % ZIGZAG_CYCLE
  return mod === 0 ? -BLOCK_X_OFFSET : mod === 1 ? 0 : mod === 2 ? BLOCK_X_OFFSET : 0
}

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

/**
 * 1:1 Authentic SVG Zigzag Path Connector
 * Smoothly connects center of each node (x_i, y_i) to (x_{i+1}, y_{i+1}) with cubic bezier curves.
 */
function SectionPathCurve({
  totalNodes,
  getOffset,
}: {
  totalNodes: number
  getOffset: (idx: number) => number
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(600)

  useEffect(() => {
    if (!ref.current) return
    const update = () => {
      if (ref.current && ref.current.clientWidth > 0) {
        setWidth(ref.current.clientWidth)
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const centerX = width / 2
  const points = Array.from({ length: totalNodes }).map((_, i) => ({
    x: centerX + getOffset(i),
    y: 44 + i * (56 + BLOCK_Y_MARGIN),
  }))

  let d = ''
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    const midY = (p1.y + p2.y) / 2
    if (i === 0) {
      d += `M ${p1.x} ${p1.y} `
    }
    d += `C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y} `
  }

  return (
    <svg
      ref={ref}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="#DCD6CA"
        strokeWidth="3.5"
        strokeDasharray="6 6"
        strokeLinecap="round"
        className="dark:stroke-stone-700/80"
      />
    </svg>
  )
}

export default function WonderPathView({
  course,
  onStartLesson,
  onLockedLessonClick,
  onOpenSectionReview,
  onOpenLiveChallenge,
}: WonderPathViewProps) {
  const completedLessonIds = useWonderStore((s) => s.completedLessonIds)
  const setCurrentNav = useWonderStore((s) => s.setCurrentNav)
  const [glossarySectionId, setGlossarySectionId] = useState<string | null>(null)
  const [showCertificateModal, setShowCertificateModal] = useState(false)

  const allCourseLessons = course?.sections ? course.sections.flatMap((s) => s.lessons) : []
  const totalLessonsCount = allCourseLessons.length
  const totalCompletedCount = allCourseLessons.filter((l) => completedLessonIds.includes(l.id)).length
  const isCourseFullyCompleted = totalLessonsCount > 0 && totalCompletedCount >= totalLessonsCount

  // Empty state (1:1 with live_auth_dashboard.png)
  if (!course || !course.sections || course.sections.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 min-h-[460px] animate-in fade-in duration-200">
        <div className="size-20 rounded-full bg-stone-200/60 dark:bg-stone-800 flex items-center justify-center text-stone-500 dark:text-stone-400 mb-6">
          <BookOpen size={36} strokeWidth={1.5} />
        </div>

        <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
          Create your first course
        </h2>

        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-sm mb-6">
          Start learning by creating a course on any topic you&apos;re interested in
        </p>

        <button
          type="button"
          onClick={() => setCurrentNav('create')}
          className="wonder-btn-primary px-8 py-3 rounded-xl text-xs sm:text-sm font-mono font-bold uppercase tracking-wider cursor-pointer"
        >
          CREATE COURSE
        </button>
      </div>
    )
  }

  // Flatten all lessons across sections to find the first planned (active) lesson index
  const allLessons = course.sections.flatMap((s) => s.lessons)
  const firstPlannedIndex = allLessons.findIndex(
    (l) => !completedLessonIds.includes(l.id),
  )

  return (
    <div className="max-w-2xl mx-auto w-full py-2 px-1 sm:px-4 font-sans relative select-none animate-in fade-in duration-150">
      <div className="space-y-10">
        {course.sections.map((section, sectionIdx) => {
          const completedCount = section.lessons.filter((l) =>
            completedLessonIds.includes(l.id),
          ).length
          const isSectionGlossaryOpen = glossarySectionId === section.id
          const isSectionCompleted = completedCount === section.lessons.length

          return (
            <div key={section.id} className="section-container mb-8">
              {/* Section Header Card (1:1 with lesson_reading_view.png) */}
              <div className="sticky top-[var(--safe-top,0px)] z-20 flex items-stretch justify-between overflow-hidden rounded-2xl border border-[#E7E2D6] dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1E1512] shadow-2xs mb-8">
                <div className="flex-1 px-6 py-3.5">
                  <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                    {sectionIdx + 1}. {section.title.replace(/^\d+\.\s*/, '')}
                  </h2>
                  <p className="mt-0.5 text-sm font-normal text-stone-500 dark:text-stone-400">
                    {completedCount}/{section.lessons.length} lessons
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setGlossarySectionId(
                      isSectionGlossaryOpen ? null : section.id,
                    )
                  }
                  className="flex items-center justify-center border-l border-[#E7E2D6] dark:border-stone-800 px-5 text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
                  title="View saved items"
                  aria-label="View saved items"
                >
                  <WonderSectionNotebookIcon size={20} />
                </button>
              </div>

              {/* Glossary Popover Drawer (if opened) */}
              {isSectionGlossaryOpen && (
                <div className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/80 dark:bg-sky-950/30 p-4 text-xs space-y-2 mb-8 animate-in fade-in duration-150">
                  <h4 className="font-bold text-sky-900 dark:text-sky-200">
                    Glossary & Key Concepts
                  </h4>
                  <ul className="space-y-1 text-stone-600 dark:text-stone-400 pl-4 list-disc">
                    <li>
                      <strong>Core Mechanics:</strong> The fundamental operational primitive governing this system.
                    </li>
                    <li>
                      <strong>Trade-off Optimization:</strong> Balancing conflicting system constraints for durable equilibrium.
                    </li>
                    <li>
                      <strong>Mental Models:</strong> Structural frameworks for rapid decision making under uncertainty.
                    </li>
                  </ul>
                </div>
              )}

              {/* 1:1 Authentic Zigzag Path Layout (1:1 with lesson_reading_view.png & bundle lines 5340000-5363824) */}
              <div className="relative py-4 flex flex-col items-center">
                {/* Connecting SVG Zigzag Curve */}
                <SectionPathCurve
                  totalNodes={section.lessons.length + 2}
                  getOffset={(idx) => ZIGZAG_CENTER_OFFSET + getBlockZigzagOffset(idx)}
                />

                {section.lessons.map((lesson, lessonIdx) => {
                  const isDone = completedLessonIds.includes(lesson.id)
                  const isPlanned =
                    firstPlannedIndex === -1
                      ? lessonIdx === 0 && sectionIdx === 0
                      : allLessons.findIndex((l) => l.id === lesson.id) === firstPlannedIndex
                  const isUserCourse = course.id.startsWith('ai-') || course.id.startsWith('custom-')
                  const isLocked = !isDone && !isPlanned && !isUserCourse
                  const isAvailable = isDone || isPlanned || isUserCourse

                  const xOffset =
                    ZIGZAG_CENTER_OFFSET + getBlockZigzagOffset(lessonIdx)

                  return (
                    <div
                      key={lesson.id}
                      style={{
                        marginBottom: `${BLOCK_Y_MARGIN}px`,
                      }}
                      className="relative flex justify-center w-full"
                    >
                      <div
                        style={{
                          transform: `translateX(${xOffset}px)`,
                        }}
                        className="relative z-10"
                      >
                        <button
                          type="button"
                          data-wonder-node={lesson.id}
                          onClick={() => {
                            playSound('click')
                            if (isAvailable) {
                              onStartLesson(lesson)
                            } else {
                              onLockedLessonClick?.(lesson)
                            }
                          }}
                          title={isLocked ? 'Locked lesson - tap to unlock' : lesson.title}
                          className={`group relative flex cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95 ${
                            isLocked ? 'opacity-95' : ''
                          }`}
                        >
                          {/* 3D Circular Disk (1:1 with lesson_reading_view.png) */}
                          <div className="relative flex items-center justify-center">
                            {isDone ? (
                              <div className="relative size-14 rounded-full flex items-center justify-center border-2 border-[#67C2F9] shadow-[0_4px_0_0_#3898DA,0_5px_0_0_#2563EB] hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_#3898DA,0_7px_0_0_#2563EB] active:translate-y-1 active:shadow-none bg-[#E0F2FE] dark:bg-[#0C4A6E]/30 text-[#0284C7] dark:text-[#38BDF8] transition-all cursor-pointer z-10 overflow-hidden">
                                <CheckCheck className="size-5 md:size-6" strokeWidth={2} />
                              </div>
                            ) : isPlanned ? (
                              <WonderActivePeekingNode size={56} className="hover:-translate-y-0.5 active:translate-y-0.5 transition-transform" />
                            ) : isUserCourse ? (
                              <div className="relative size-13 rounded-full flex items-center justify-center border-2 border-[#D2CCBF] dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 shadow-[0_3px_0_0_#DCD6CA] hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#DCD6CA] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer z-10">
                                <BookOpen className="size-5 text-stone-600 dark:text-stone-300" strokeWidth={2} />
                              </div>
                            ) : (
                              <WonderLockedDisk size={52} className="cursor-not-allowed" />
                            )}
                          </div>

                          {/* Lesson Title to the Right (1:1 with lesson_reading_view.png: clean title ONLY, no duration badge) */}
                          <div className="absolute left-full ml-4 w-44 sm:w-56 text-left pointer-events-none sm:pointer-events-auto">
                            <p
                              className={`line-clamp-2 text-base transition-colors leading-snug ${
                                isDone
                                  ? 'text-stone-600 dark:text-stone-400 font-medium'
                                  : isPlanned
                                    ? 'text-stone-900 dark:text-stone-100 font-bold'
                                    : 'text-stone-700 dark:text-stone-300 font-medium'
                              }`}
                            >
                              {lesson.title}
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Section Review Node (1:1 with bundle lines 5265000-5267700) */}
                <div
                  style={{
                    marginBottom: `${BLOCK_Y_MARGIN}px`,
                  }}
                  className="relative flex justify-center w-full"
                >
                  <div
                    style={{
                      transform: `translateX(${
                        ZIGZAG_CENTER_OFFSET +
                        getBlockZigzagOffset(section.lessons.length)
                      }px)`,
                    }}
                    className="relative z-10"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        playSound('click')
                        onOpenSectionReview?.(section.title)
                      }}
                      className="group relative flex cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95"
                    >
                      <div className="relative flex items-center justify-center">
                        {isSectionCompleted ? (
                          <div className="relative size-14 rounded-full flex items-center justify-center border-2 border-[#67C2F9] shadow-[0_4px_0_0_#3898DA,0_5px_0_0_#2563EB] bg-[#E0F2FE] dark:bg-[#0C4A6E]/30 text-[#0284C7] dark:text-[#38BDF8] overflow-hidden">
                            <CheckCheck className="size-5 md:size-6" strokeWidth={2} />
                          </div>
                        ) : (
                          <div className="relative size-14 rounded-full flex items-center justify-center border-2 border-[#D2CCBF] dark:border-stone-700 bg-[#F6F4EE] dark:bg-stone-800 text-stone-700 dark:text-stone-300 shadow-[0_4px_0_0_#DCD6CA] overflow-hidden">
                            {/* Segmented Progress SVG Ring */}
                            <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0" aria-hidden="true" shapeRendering="geometricPrecision">
                              {Array.from({ length: section.lessons.length }).map((_, ka) => {
                                const total = section.lessons.length
                                const Sa = 360 / total
                                const Aa = ka * Sa
                                const La = (ka + 1) * Sa
                                const Ta = polarToCartesian(50, 50, 46, La)
                                const Ga = polarToCartesian(50, 50, 46, Aa)
                                const Ma = La - Aa <= 180 ? '0' : '1'
                                const Ba = ['M', 50, 50, 'L', Ta.x, Ta.y, 'A', 46, 46, 0, Ma, 0, Ga.x, Ga.y, 'Z'].join(' ')
                                const isFilled = ka < completedCount
                                return (
                                  <path
                                    key={ka}
                                    d={Ba}
                                    fill={isFilled ? '#67C2F9' : '#EAE6DC'}
                                    stroke="transparent"
                                    strokeWidth={0}
                                    className="dark:fill-stone-700"
                                  />
                                )
                              })}
                            </svg>
                            {completedCount > 0 ? (
                              <Dumbbell className="relative z-10 size-5 md:size-6 text-stone-700 dark:text-stone-200" strokeWidth={2} />
                            ) : (
                              <Lock className="relative z-10 size-4.5 md:size-5 text-stone-400" strokeWidth={2} />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="absolute left-full ml-4 w-40 sm:w-48 text-left">
                        <p className="line-clamp-2 text-base text-stone-900 dark:text-stone-100 font-medium">
                          Section Review
                        </p>
                        <p className="text-xs text-stone-500">
                          {completedCount}/{section.lessons.length} sessions
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Live Challenge Node (1:1 with bundle line 5268000) */}
                <div className="relative flex justify-center w-full">
                  <div
                    style={{
                      transform: `translateX(${
                        ZIGZAG_CENTER_OFFSET +
                        getBlockZigzagOffset(section.lessons.length + 1)
                      }px)`,
                    }}
                    className="relative z-10"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        playSound('click')
                        onOpenLiveChallenge?.(section.title)
                      }}
                      className="group relative flex cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95"
                    >
                      <div className="relative flex items-center justify-center">
                        {isSectionCompleted ? (
                          <div className="relative size-14 rounded-full flex items-center justify-center border-2 border-[#67C2F9] shadow-[0_4px_0_0_#3898DA,0_5px_0_0_#2563EB] bg-[#E0F2FE] dark:bg-[#0C4A6E]/30 text-[#0284C7] dark:text-[#38BDF8] overflow-hidden">
                            <AudioLines className="size-5 md:size-6" strokeWidth={2} />
                          </div>
                        ) : (
                          <WonderLockedDisk size={52} className="cursor-not-allowed" />
                        )}
                      </div>
                      <div className="absolute left-full ml-4 w-40 sm:w-48 text-left">
                        <p className="line-clamp-2 text-base text-stone-900 dark:text-stone-100 font-medium">
                          Live Challenge
                        </p>
                        <p className="text-xs text-stone-500">
                          {isSectionCompleted
                            ? 'All ' + section.lessons.length + ' lessons'
                            : `Finish the section first (${completedCount}/${section.lessons.length})`}
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 1:1 Course Mastered Celebration Banner & Certificate Trigger */}
      {isCourseFullyCompleted && (
        <div className="relative mt-12 mb-8 mx-auto max-w-lg p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-amber-100/80 via-[#FFFDF8] to-[#F5EFE0] dark:from-amber-950/40 dark:via-[#1C1411] dark:to-[#17100D] border-2 border-amber-400/60 dark:border-amber-500/40 text-center shadow-xl select-none animate-in fade-in zoom-in-95 duration-300">
          <div className="relative inline-flex items-center justify-center mb-4">
            <div className="size-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-stone-950 shadow-lg animate-bounce duration-1000">
              <Award size={42} strokeWidth={2.2} />
            </div>
            <div className="absolute -top-1 -right-1 size-7 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center font-black text-xs shadow-md">
              ★
            </div>
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-amber-400/20 text-amber-900 dark:text-amber-300 font-mono text-xs font-black uppercase tracking-wider mb-2">
            100% Tamomlandi!
          </span>

          <h3 className="text-2xl sm:text-3xl font-serif font-black text-stone-900 dark:text-stone-100">
            Kurs To&apos;liq O&apos;zlashtirildi!
          </h3>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-2 max-w-sm mx-auto leading-relaxed">
            Siz <span className="font-bold text-stone-900 dark:text-stone-200">&ldquo;{course.title}&rdquo;</span> kursidagi barcha {totalLessonsCount} ta darsni muvaffaqiyatli yakunladingiz!
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                playSound('win')
                setShowCertificateModal(true)
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-stone-950 font-bold text-xs uppercase tracking-wider shadow-[0_4px_0_0_#D97706] active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Award size={16} />
              <span>Sertifikatni Ko&apos;rish</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentNav('create')}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 border border-stone-300 dark:border-stone-700 font-bold text-xs uppercase tracking-wider shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles size={16} className="text-amber-500" />
              <span>Yangi Mavzu Yaratish</span>
            </button>
          </div>
        </div>
      )}

      {/* Certificate Modal */}
      {showCertificateModal && (
        <WonderCertificateModal
          course={course}
          totalLessons={totalLessonsCount}
          onClose={() => setShowCertificateModal(false)}
        />
      )}
    </div>
  )
}

