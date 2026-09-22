import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  Flame,
  Sparkles,
  Map,
  Layers,
  Headphones,
  Compass,
  Check,
} from 'lucide-react'
import { goBack } from '../../../shared/lib/navigation'
import { useWonderStore } from '../store/useWonderStore'
import type { WonderCourse, WonderTab } from '../types'

interface WonderHeaderProps {
  courses: WonderCourse[]
  activeCourse: WonderCourse
  onOpenCreate: () => void
}

export default function WonderHeader({
  courses,
  activeCourse,
  onOpenCreate,
}: WonderHeaderProps) {
  const navigate = useNavigate()
  const activeTab = useWonderStore((s) => s.activeTab)
  const setActiveTab = useWonderStore((s) => s.setActiveTab)
  const setActiveCourse = useWonderStore((s) => s.setActiveCourse)
  const wonderStreak = useWonderStore((s) => s.wonderStreak)

  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false)

  const tabs: { id: WonderTab; label: string; icon: typeof Map }[] = [
    { id: 'path', label: "O'quv Yo'li", icon: Map },
    { id: 'refractor', label: 'Fikr Refraktori', icon: Layers },
    { id: 'podcast', label: 'AI Podcast', icon: Headphones },
    { id: 'canvas', label: 'Fikrlar Maydoni', icon: Compass },
  ]

  return (
    <header className="sticky top-[var(--safe-top,0px)] z-40 bg-[#FFFCF0]/95 dark:bg-[#1C1310]/95 backdrop-blur-md border-b-2 border-stone-800/15 dark:border-stone-700/40 transition-colors">
      <div className="max-w-4xl mx-auto px-3.5 pt-3 pb-2.5">
        {/* Yuqori qator: Back, Kurs tanlash, Streak va Yangi Kurs CTA */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => goBack(navigate)}
              aria-label="Orqaga"
              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800/70 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 active:scale-95 transition-all shrink-0"
            >
              <ArrowLeft size={18} />
            </button>

            {/* Kurs Dropdown tanlash tugmasi */}
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setCourseDropdownOpen(!courseDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500/40 hover:border-amber-500 text-stone-900 dark:text-amber-100 font-medium text-xs sm:text-sm max-w-[200px] sm:max-w-[280px] truncate shadow-2xs transition-all"
              >
                <span className="text-base shrink-0">{activeCourse.badge}</span>
                <span className="truncate font-semibold">{activeCourse.title}</span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 transition-transform ${courseDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Kurslar ro'yxati menyusi */}
              {courseDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setCourseDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-72 sm:w-80 rounded-2xl bg-[#FFFDF7] dark:bg-[#231A17] border-2 border-stone-800/20 dark:border-stone-700 shadow-xl z-50 p-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                      Kursni Tanlang
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {courses.map((c) => {
                        const isSelected = c.id === activeCourse.id
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setActiveCourse(c.id)
                              setCourseDropdownOpen(false)
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs sm:text-sm transition-all ${
                              isSelected
                                ? 'bg-amber-400/20 text-amber-900 dark:text-amber-200 font-bold border border-amber-400/40'
                                : 'hover:bg-stone-100 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base">{c.badge}</span>
                              <span className="truncate">{c.title}</span>
                            </div>
                            {isSelected && <Check size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                    <div className="border-t border-stone-200 dark:border-stone-800 mt-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCourseDropdownOpen(false)
                          onOpenCreate()
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs shadow-[0_2px_0_0_#28231D] active:translate-y-0.5 active:shadow-none transition-all"
                      >
                        <Plus size={14} />
                        Yangi Wonder Kurs Yaratish
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* O'ng tomon: Wonder Streak va Yangi Kurs */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 font-bold text-xs">
              <Flame size={14} className="fill-orange-500 text-orange-500" />
              <span>{wonderStreak} kun</span>
            </div>

            <button
              type="button"
              onClick={onOpenCreate}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#F7C948] hover:bg-[#ffb800] text-stone-900 font-bold text-xs border-2 border-stone-800 shadow-[0_3px_0_0_#28231D] active:translate-y-0.5 active:shadow-none transition-all"
            >
              <Sparkles size={13} />
              <span className="hidden xs:inline">Yangi Kurs</span>
              <span className="xs:hidden">+ Kurs</span>
            </button>
          </div>
        </div>

        {/* Wondering 4 Ta Asosiy Tab Switcheri */}
        <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-stone-900 dark:bg-amber-400 text-white dark:text-stone-950 shadow-[0_2px_0_0_rgba(0,0,0,0.3)]'
                    : 'bg-stone-100 dark:bg-stone-800/60 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 border border-stone-200 dark:border-stone-800'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
