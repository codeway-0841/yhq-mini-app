import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import {
  Share2,
  Settings,
  ChevronsUpDown,
  Check,
} from 'lucide-react'
import {
  WonderIsometricArtwork,
  WonderLearningMapIcon,
  WonderSourcesIcon,
  WonderPodcastIcon,
  WonderQuickExerciseIcon,
  WonderViewSavedIcon,
} from './WonderIcons'
import { playSound } from '../../../shared/lib/sounds'
import { useWonderStore } from '../store/useWonderStore'
import type { WonderCourse } from '../types'

interface WonderTopBarProps {
  courses: WonderCourse[]
  activeCourse: WonderCourse
  onOpenPodcast: () => void
  onOpenLearningMap: () => void
  onOpenQuickExercise: () => void
  onOpenSettings: () => void
}

/**
 * 1:1 HeaderActionButton extracted from Wondering bundle (line 5641674)
 */
function HeaderActionButton({
  icon,
  label,
  onClick,
  active = false,
  title,
  badge,
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
  active?: boolean
  title?: string
  badge?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => {
        playSound('click')
        onClick?.()
      }}
      title={title || label}
      aria-label={label}
      className={`group relative inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        active
          ? 'text-stone-950 dark:text-stone-100 font-bold'
          : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/40 dark:hover:bg-stone-800/40'
      }`}
    >
      <span className="flex shrink-0 items-center justify-center text-stone-500 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-100">
        {icon}
      </span>
      <span className="whitespace-nowrap">{label}</span>
      {badge}
    </button>
  )
}

export default function WonderTopBar({
  courses,
  activeCourse,
  onOpenPodcast,
  onOpenLearningMap,
  onOpenQuickExercise,
  onOpenSettings,
}: WonderTopBarProps) {
  const activeTab = useWonderStore((s) => s.activeTab)
  const setActiveTab = useWonderStore((s) => s.setActiveTab)
  const setActiveCourse = useWonderStore((s) => s.setActiveCourse)
  const isNotesDrawerOpen = useWonderStore((s) => s.isNotesDrawerOpen)
  const toggleNotesDrawer = useWonderStore((s) => s.toggleNotesDrawer)
  const fsrsCards = useWonderStore((s) => s.fsrsCards)
  const [courseSelectOpen, setCourseSelectOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const dueCardsCount = useMemo(() => {
    const now = Date.now()
    return Object.values(fsrsCards).filter((c) => c.due <= now).length
  }, [fsrsCards])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setCourseSelectOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  return (
    <div className="rounded-2xl border border-[#E7E2D6] dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1E1512] px-4 py-3 shadow-2xs mb-6 select-none">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Course Info with CourseCoverThumbnail (1:1 with lesson_reading_view.png) */}
        <div className="flex items-center gap-3.5 min-w-0">
          {/* CourseCoverThumbnail: size-12 rounded-2xl border */}
          <div className="shrink-0 size-12 rounded-2xl overflow-hidden border border-stone-200/80 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 shadow-2xs">
            {activeCourse.localCoverImage || activeCourse.coverImage ? (
              <img
                src={activeCourse.localCoverImage || activeCourse.coverImage}
                alt={activeCourse.title}
                className="size-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="size-full flex items-center justify-center bg-stone-100 dark:bg-stone-800">
                <WonderIsometricArtwork size={40} />
              </div>
            )}
          </div>

          <div className="relative min-w-0" ref={dropdownRef}>
            {/* Title with dropdown switcher */}
            <button
              type="button"
              onClick={() => setCourseSelectOpen(!courseSelectOpen)}
              className="inline-flex min-w-0 max-w-full items-baseline gap-1.5 rounded-xl text-left transition-colors hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer group"
              title={activeCourse.title}
            >
              <span className="line-clamp-2 block text-base font-semibold leading-[19px] text-stone-900 dark:text-stone-100">
                {activeCourse.title}
              </span>
              <ChevronsUpDown
                className="relative top-px size-3.5 shrink-0 text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200 transition-colors"
                strokeWidth={2}
              />
            </button>

            {/* Course switcher dropdown */}
            {courseSelectOpen && (
              <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-[#FFFDF8] dark:bg-[#1E1512] border border-stone-200 dark:border-stone-700 shadow-xl z-50 p-2 space-y-1 animate-in fade-in duration-150">
                <div className="px-2 py-1 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                  Select course
                </div>
                <div className="max-h-60 overflow-y-auto space-y-0.5">
                  {courses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setActiveCourse(c.id)
                        setCourseSelectOpen(false)
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
                        c.id === activeCourse.id
                          ? 'bg-amber-100/80 dark:bg-stone-800 text-stone-950 dark:text-stone-100 font-bold'
                          : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <span className="truncate">{c.title}</span>
                      {c.id === activeCourse.id && (
                        <Check size={14} className="text-amber-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-toolbar: Learning Map, Sources, Podcast, Quick Exercise, View Saved (1:1 with lesson_reading_view.png) */}
            <div className="flex items-center gap-1 sm:gap-2 pt-1 overflow-x-auto no-scrollbar">
              <HeaderActionButton
                icon={<WonderLearningMapIcon size={16} />}
                label="Learning Map"
                onClick={onOpenLearningMap}
              />
              <HeaderActionButton
                icon={<WonderSourcesIcon size={16} />}
                label="Sources"
                active={activeTab === 'refractor'}
                onClick={() => setActiveTab('refractor')}
              />
              <HeaderActionButton
                icon={<WonderPodcastIcon size={16} />}
                label="Podcast"
                onClick={onOpenPodcast}
              />
              <HeaderActionButton
                icon={<WonderQuickExerciseIcon size={16} />}
                label="Quick Exercise"
                onClick={onOpenQuickExercise}
                badge={
                  dueCardsCount > 0 ? (
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[10px] font-black font-mono shadow-xs animate-pulse leading-none">
                      {dueCardsCount}
                    </span>
                  ) : undefined
                }
              />
              <HeaderActionButton
                icon={<WonderViewSavedIcon size={16} />}
                label="View Saved"
                active={isNotesDrawerOpen}
                onClick={toggleNotesDrawer}
              />
            </div>
          </div>
        </div>

        {/* Right Action Icons: Share & Settings */}
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <HeaderActionButton
            icon={<Share2 className="size-4" strokeWidth={1.8} />}
            label={shareCopied ? 'Copied!' : 'Share'}
            onClick={handleShare}
          />
          <HeaderActionButton
            icon={<Settings className="size-4" strokeWidth={1.8} />}
            label="Settings"
            onClick={onOpenSettings}
          />
        </div>
      </div>
    </div>
  )
}

