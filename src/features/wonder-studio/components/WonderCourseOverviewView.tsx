import { useState } from 'react'
import {
  Layers,
  BookOpen,
  Clock,
  Map,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import { WonderCourseHeroBanner } from './WonderIcons'
import WonderUnlockModal from './WonderUnlockModal'
import { useWonderStore } from '../store/useWonderStore'
import type { WonderCourse, WonderLessonNode } from '../types'

interface WonderCourseOverviewViewProps {
  course: WonderCourse
  onStartLearning: () => void
  onPreviewLesson?: (lesson: WonderLessonNode) => void
  onBackToCatalog?: () => void
}

export default function WonderCourseOverviewView({
  course,
  onStartLearning,
  onPreviewLesson,
  onBackToCatalog,
}: WonderCourseOverviewViewProps) {
  const setCurrentNav = useWonderStore((s) => s.setCurrentNav)
  const setActiveTab = useWonderStore((s) => s.setActiveTab)
  const setActiveCourse = useWonderStore((s) => s.setActiveCourse)
  const enrollCourse = useWonderStore((s) => s.enrollCourse)
  const setOpenLearningMapModal = useWonderStore((s) => s.setOpenLearningMapModal)
  const enrolledCourseIds = useWonderStore((s) => s.enrolledCourseIds)
  const isEnrolled = enrolledCourseIds.includes(course.id)

  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(
    course.sections[0]?.id || null,
  )
  const [showUnlockModal, setShowUnlockModal] = useState(false)

  const totalLessons = course.sections.reduce(
    (acc, sec) => acc + sec.lessons.length,
    0,
  )

  const handleViewPath = () => {
    if (!isEnrolled) {
      enrollCourse(course.id)
    }
    setActiveCourse(course.id)
    setActiveTab('path')
    onStartLearning()
  }

  const handlePreviewLesson = () => {
    if (!isEnrolled) {
      enrollCourse(course.id)
    }
    const firstLesson = course.sections[0]?.lessons[0]
    if (firstLesson && onPreviewLesson) {
      setActiveCourse(course.id)
      onPreviewLesson(firstLesson)
    } else {
      handleViewPath()
    }
  }

  const handleImportOrContinue = () => {
    if (!isEnrolled) {
      enrollCourse(course.id)
    }
    setActiveCourse(course.id)
    setActiveTab('path')
    onStartLearning()
  }

  const handleLearningMap = () => {
    setActiveCourse(course.id)
    setOpenLearningMapModal(true)
  }

  const handlePersonalize = () => {
    setCurrentNav('create')
  }

  const handleConfirmUnlock = () => {
    enrollCourse(course.id)
    setActiveCourse(course.id)
    setShowUnlockModal(false)
    onStartLearning()
  }

  return (
    <div className="max-w-4xl mx-auto py-2 font-sans select-none space-y-8 animate-in fade-in duration-200">
      {/* Back to Explore Navigation Link */}
      {onBackToCatalog && (
        <button
          type="button"
          onClick={onBackToCatalog}
          className="flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Explore</span>
        </button>
      )}

      {/* 1:1 3D Geometric Banner from course_overview_desktop.png */}
      {course.localCoverImage || course.coverImage ? (
        <div className="w-full h-56 sm:h-80 rounded-3xl overflow-hidden shadow-sm relative bg-[#FAF8F2] dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800">
          <img
            src={course.localCoverImage || course.coverImage}
            alt={course.title}
            className="w-full h-full object-cover object-center"
          />
        </div>
      ) : (
        <WonderCourseHeroBanner className="shadow-sm" />
      )}

      {/* Course Header & Description */}
      <div className="space-y-3">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight">
          {course.title}
        </h1>

        <p className="text-xs sm:text-sm font-medium text-stone-500 dark:text-stone-400">
          {course.author ? `by ${course.author}` : 'by Barbara Oakley, Terrence Sejnowski, and Alistair McConville'}
        </p>

        <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed pt-1">
          {course.description}
        </p>

        {/* Stats Row (1:1 with course_overview_desktop.png) */}
        <div className="flex items-center gap-5 pt-2 text-xs font-semibold text-stone-600 dark:text-stone-400">
          <div className="flex items-center gap-1.5">
            <Layers size={14} className="text-stone-400" />
            <span>{course.sections.length} sections</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BookOpen size={14} className="text-stone-400" />
            <span>{totalLessons} lessons</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-stone-400" />
            <span>~{course.estimatedMinutes || totalLessons * 3} min</span>
          </div>
        </div>

        {/* 4 Action Pills (1:1 with course_overview_desktop.png) */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3">
          <button
            type="button"
            onClick={handleViewPath}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF8F2] dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-mono font-bold uppercase tracking-wider shadow-[0_3px_0_0_#D6D3D1] dark:shadow-[0_3px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <Map size={13} />
            <span>VIEW PATH</span>
          </button>

          <button
            type="button"
            onClick={handleLearningMap}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF8F2] dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-mono font-bold uppercase tracking-wider shadow-[0_3px_0_0_#D6D3D1] dark:shadow-[0_3px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <BookOpen size={13} />
            <span>LEARNING MAP</span>
          </button>

          <button
            type="button"
            onClick={handlePersonalize}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF8F2] dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-mono font-bold uppercase tracking-wider shadow-[0_3px_0_0_#D6D3D1] dark:shadow-[0_3px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <Sparkles size={13} />
            <span>PERSONALIZE</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCourse(course.id)
              setActiveTab('refractor')
              setCurrentNav('home')
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF8F2] dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-mono font-bold uppercase tracking-wider shadow-[0_3px_0_0_#D6D3D1] dark:shadow-[0_3px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <Layers size={13} />
            <span>5 SOURCES</span>
          </button>
        </div>
      </div>

      {/* "What you will achieve" Checklist (1:1 with screenshot) */}
      <div className="space-y-2 pt-4 border-t border-stone-200/80 dark:border-stone-800">
        <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
          What you will achieve
        </h3>
        <ul className="space-y-1.5 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
          <li className="flex items-start gap-2">
            <span className="text-stone-400">•</span>
            <span>Switch deliberately between focused and diffuse thinking</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-stone-400">•</span>
            <span>Use practical systems to interrupt procrastination</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-stone-400">•</span>
            <span>Choose retrieval, spacing, interleaving, and memory tools appropriately</span>
          </li>
        </ul>
      </div>

      {/* Course Syllabus Accordion */}
      <div className="space-y-3 pt-4 border-t border-stone-200/80 dark:border-stone-800 pb-20">
        <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 mb-3">
          Course Syllabus
        </h3>

        <div className="space-y-2">
          {course.sections.map((section, idx) => {
            const isExpanded = expandedSectionId === section.id
            return (
              <div
                key={section.id}
                className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-[#FAF8F2] dark:bg-stone-900/60 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSectionId(isExpanded ? null : section.id)
                  }
                  className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer hover:bg-stone-100/60 dark:hover:bg-stone-800/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="size-6 rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                        {section.title}
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        {section.lessons.length} lessons
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-stone-400" />
                  ) : (
                    <ChevronRight size={16} className="text-stone-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="p-3 pt-0 space-y-1.5 border-t border-stone-200/60 dark:border-stone-800/60 divide-y divide-stone-200/40 dark:divide-stone-800/40">
                    {section.lessons.map((lesson, lIdx) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between py-2 text-xs text-stone-700 dark:text-stone-300"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-stone-400 text-[11px]">
                            {idx + 1}.{lIdx + 1}
                          </span>
                          <span className="font-medium">{lesson.title}</span>
                        </div>
                        <span className="text-[11px] text-stone-400">
                          ~{lesson.durationMinutes || 3} min
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Sticky Bottom Actions Bar (1:1 with course_overview_desktop.png & live_auth_lesson.png) */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 pb-[calc(0.75rem+var(--safe-bottom,0px))] bg-[#FFFCF6]/95 dark:bg-[#1C1411]/95 backdrop-blur-sm border-t border-stone-200/80 dark:border-stone-800 flex items-center gap-3 z-20">
        <button
          type="button"
          onClick={handlePreviewLesson}
          className="flex-1 py-3 px-4 rounded-xl bg-[#FAF8F2] dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs sm:text-sm font-mono font-bold uppercase tracking-wider shadow-[0_3px_0_0_#D6D3D1] dark:shadow-[0_3px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-center"
        >
          PREVIEW LESSON
        </button>

        <button
          type="button"
          onClick={handleImportOrContinue}
          className="flex-2 py-3 px-4 rounded-xl bg-[#67C2F9] text-[#261312] text-xs sm:text-sm font-mono font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] hover:bg-[#5BB9F5] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-center"
        >
          {isEnrolled ? 'CONTINUE LEARNING' : 'IMPORT COURSE'}
        </button>
      </div>

      {/* 1:1 Authentic Unlock / Import Modal matching live_auth_lesson.png */}
      {showUnlockModal && (
        <WonderUnlockModal
          courseTitle={course.title}
          lessonTitle={
            course.sections[0]?.lessons[0]?.title
              ? `Should you really start with "${course.sections[0].lessons[0].title}"?`
              : 'Should you really start tests with the hardest problem first?'
          }
          onClose={() => setShowUnlockModal(false)}
          onUnlock={handleConfirmUnlock}
        />
      )}
    </div>
  )
}
