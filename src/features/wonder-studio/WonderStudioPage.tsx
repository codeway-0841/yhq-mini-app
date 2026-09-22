import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Menu, BookOpen } from 'lucide-react'
import { useWonderStore, type WonderNav } from './store/useWonderStore'
import { DEFAULT_WONDER_COURSES } from './data/defaultCourses'
import { api } from '../../shared/api'
import { convertAiCourseToWonderCourse } from './lib/aiCourseAdapter'
import WonderSidebar from './components/WonderSidebar'
import WonderTopBar from './components/WonderTopBar'
import WonderPathView from './components/WonderPathView'
import WonderCreateView from './components/WonderCreateView'
import WonderCoursesView from './components/WonderCoursesView'
import WonderSettingsView from './components/WonderSettingsView'
import WonderProfileView from './components/WonderProfileView'
import SpatialCanvasView from './components/SpatialCanvasView'
import ThoughtRefractorView from './components/ThoughtRefractorView'
import WonderPodcastModal from './components/WonderPodcastModal'
import WonderLearningMapModal from './components/WonderLearningMapModal'
import WonderUpgradeModal from './components/WonderUpgradeModal'
import WonderLessonView from './components/WonderLessonView'
import WonderCourseLoadingScreen from './components/WonderCourseLoadingScreen'
import WonderUnlockModal from './components/WonderUnlockModal'
import WonderQuickPracticeModal from './components/WonderQuickPracticeModal'
import WonderStreakCelebrationModal from './components/WonderStreakCelebrationModal'
import WonderLiveChallengeModal from './components/WonderLiveChallengeModal'
import WonderMascot from './components/WonderMascot'
import WonderChatPanel from './components/WonderChatPanel'
import WonderNotesDrawer from './components/WonderNotesDrawer'
import {
  WonderHomeIcon,
  WonderCreateIcon,
  WonderCanvasIcon,
  WonderCoursesIcon,
  WonderProfileIcon,
} from './components/WonderIcons'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../../shared/store/useAppStore'
import type { WonderLessonNode } from './types'

export default function WonderStudioPage() {
  const currentNav = useWonderStore((s) => s.currentNav)
  const setCurrentNav = useWonderStore((s) => s.setCurrentNav)
  const syncRemoteAiCourses = useWonderStore((s) => s.syncRemoteAiCourses)
  const activeCourseId = useWonderStore((s) => s.activeCourseId)
  const setActiveCourse = useWonderStore((s) => s.setActiveCourse)
  const activeTab = useWonderStore((s) => s.activeTab)
  const setActiveTab = useWonderStore((s) => s.setActiveTab)
  const customCourses = useWonderStore((s) => s.customCourses)
  const enrolledCourseIds = useWonderStore((s) => s.enrolledCourseIds)
  const enrollCourse = useWonderStore((s) => s.enrollCourse)
  const isCourseLoading = useWonderStore((s) => s.isCourseLoading)
  const openPodcastModal = useWonderStore((s) => s.openPodcastModal)
  const setOpenPodcastModal = useWonderStore((s) => s.setOpenPodcastModal)
  const openLearningMapModal = useWonderStore((s) => s.openLearningMapModal)
  const setOpenLearningMapModal = useWonderStore((s) => s.setOpenLearningMapModal)
  const openUpgradeModal = useWonderStore((s) => s.openUpgradeModal)
  const setOpenUpgradeModal = useWonderStore((s) => s.setOpenUpgradeModal)
  const addCustomCourse = useWonderStore((s) => s.addCustomCourse)

  const [searchParams] = useSearchParams()
  const courseParam = searchParams.get('course')
  const navParam = searchParams.get('nav')
  const lessonParam = searchParams.get('lesson')

  // Sync user's remote AI courses on mount
  useEffect(() => {
    syncRemoteAiCourses()
  }, [syncRemoteAiCourses])

  // Deep-linking through URL parameters (?course=..., ?nav=..., ?lesson=...)
  useEffect(() => {
    if (navParam && ['home', 'create', 'canvas', 'courses', 'profile', 'settings'].includes(navParam)) {
      setCurrentNav(navParam as WonderNav)
    }

    if (courseParam) {
      const normalizedCourseId = courseParam.startsWith('ai-') || !Number.isInteger(Number(courseParam))
        ? courseParam
        : `ai-${courseParam}`

      enrollCourse(normalizedCourseId)
      setActiveCourse(normalizedCourseId)
      setCurrentNav('home')
      setActiveTab('path')

      // Fetch and cache remote AI course if not yet present in customCourses
      if (normalizedCourseId.startsWith('ai-')) {
        const rawNum = Number(normalizedCourseId.replace('ai-', ''))
        if (rawNum > 0) {
          api.getAiCourse(rawNum).then((res) => {
            if (res?.ok && res.course) {
              const converted = convertAiCourseToWonderCourse(res.course)
              addCustomCourse(converted)
              setActiveCourse(converted.id)
              enrollCourse(converted.id)
            }
          }).catch(() => {})
        }
      }
    }
  }, [courseParam, navParam, enrollCourse, setActiveCourse, setCurrentNav, setActiveTab, addCustomCourse])

  // Combined courses
  const allCourses = useMemo(() => {
    return [...customCourses, ...DEFAULT_WONDER_COURSES]
  }, [customCourses])

  const enrolledCourses = useMemo(() => {
    return allCourses.filter((c) => enrolledCourseIds.includes(c.id))
  }, [allCourses, enrolledCourseIds])

  const activeCourse = useMemo(() => {
    return (
      enrolledCourses.find((c) => c.id === activeCourseId) ||
      allCourses.find((c) => c.id === activeCourseId) ||
      allCourses[0]
    )
  }, [enrolledCourses, allCourses, activeCourseId])

  // Modals state
  const [activeReadingLesson, setActiveReadingLesson] = useState<WonderLessonNode | null>(null)
  const [unlockModalLesson, setUnlockModalLesson] = useState<WonderLessonNode | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [quickPracticeState, setQuickPracticeState] = useState<{
    isOpen: boolean
    sectionTitle?: string
  }>({ isOpen: false })
  const [streakCelebrationState, setStreakCelebrationState] = useState<{
    isOpen: boolean
    streakCount: number
  } | null>(null)
  const [liveChallengeSectionTitle, setLiveChallengeSectionTitle] = useState<string | null>(null)

  const hasOpenedLessonParamRef = useRef<string | null>(null)

  // Handler to jump to lesson from learning map or syllabus
  const handleJumpToLesson = (lessonId: string) => {
    for (const sec of activeCourse.sections) {
      const match = sec.lessons.find((l) => l.id === lessonId)
      if (match) {
        setActiveReadingLesson(match)
        break
      }
    }
  }

  // Auto-open lesson if ?lesson=<id> is in URL (one-time on mount / route update)
  useEffect(() => {
    if (
      lessonParam &&
      hasOpenedLessonParamRef.current !== lessonParam &&
      activeCourse?.sections
    ) {
      for (const sec of activeCourse.sections) {
        const match = sec.lessons.find((l) => l.id === lessonParam)
        if (match) {
          hasOpenedLessonParamRef.current = lessonParam
          setActiveReadingLesson(match)
          break
        }
      }
    }
  }, [lessonParam, activeCourse])

  return (
    <div className="h-screen bg-[#F6F4EE] dark:bg-[#150F0D] text-stone-900 dark:text-stone-100 flex font-public-sans overflow-hidden selection:bg-amber-300 selection:text-stone-900">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block shrink-0">
        <WonderSidebar
          courses={allCourses}
          activeCourse={activeCourse}
          onOpenCreate={() => setCurrentNav('create')}
          onOpenUpgrade={() => setOpenUpgradeModal(true)}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 h-full">
            <WonderSidebar
              courses={allCourses}
              activeCourse={activeCourse}
              onOpenCreate={() => {
                setMobileSidebarOpen(false)
                setCurrentNav('create')
              }}
              onOpenUpgrade={() => {
                setMobileSidebarOpen(false)
                setOpenUpgradeModal(true)
              }}
            />
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header Bar */}
        <div className="md:hidden flex items-center justify-between p-3 bg-[#F6F4EE] dark:bg-[#150F0D] border-b border-stone-200 dark:border-stone-800 sticky top-[var(--safe-top,0px)] z-20">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-200/60"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <span className="font-sans font-semibold text-base text-stone-900 dark:text-stone-100">
            Wondering
          </span>
          <div className="size-8 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center text-xs font-bold">
            I
          </div>
        </div>

        {/* 1:1 Authentic Wondering Right Inset Floating Card Workspace */}
        {isCourseLoading ? (
          <WonderCourseLoadingScreen />
        ) : (
          <main className="flex-1 rounded-2xl sm:rounded-3xl border border-[#E7E2D6] dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411] shadow-2xs flex flex-col p-4 sm:p-6 my-2 sm:my-3 mr-2 sm:mr-3 overflow-y-auto relative animate-in fade-in duration-150 pb-[calc(5rem+var(--safe-bottom,0px))] md:pb-6">
            {/* Empty State when no courses are enrolled (1:1 with live_auth_dashboard.png) */}
            {currentNav === 'home' && enrolledCourses.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 min-h-[460px] my-auto animate-in fade-in duration-200">
                <div className="size-20 rounded-full bg-[#EFECE3] dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300 mb-6">
                  <BookOpen size={36} strokeWidth={1.5} />
                </div>

                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-3 tracking-tight">
                  Create your first course
                </h2>

                <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mb-8 leading-relaxed">
                  Start learning by creating a course on any topic you&apos;re interested in
                </p>

                <button
                  type="button"
                  onClick={() => {
                    const setCurrentNav = useWonderStore.getState().setCurrentNav
                    setCurrentNav('create')
                  }}
                  className="px-8 py-3.5 rounded-2xl bg-[#59B2E6] hover:bg-[#4EA5D9] text-[#261312] font-mono font-bold text-xs uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center"
                >
                  CREATE COURSE
                </button>
              </div>
            )}

            {/* Top Course Bar & Path View (When courses are enrolled) */}
            {currentNav === 'home' && enrolledCourses.length > 0 && (
              <>
                <WonderTopBar
                  courses={enrolledCourses}
                  activeCourse={activeCourse}
                  onOpenPodcast={() => setOpenPodcastModal(true)}
                  onOpenLearningMap={() => setOpenLearningMapModal(true)}
                  onOpenQuickExercise={() => {
                    setQuickPracticeState({ isOpen: true })
                  }}
                  onOpenSettings={() => {
                    const setCurrentNav = useWonderStore.getState().setCurrentNav
                    setCurrentNav('settings')
                  }}
                />

                {/* Conditional Tab Rendering */}
                {activeTab === 'path' && (
                  <WonderPathView
                    course={activeCourse}
                    onStartLesson={(lesson) => setActiveReadingLesson(lesson)}
                    onLockedLessonClick={(lesson) => setUnlockModalLesson(lesson)}
                    onOpenSectionReview={(sectionTitle) => {
                      setQuickPracticeState({ isOpen: true, sectionTitle })
                    }}
                    onOpenLiveChallenge={(sectionTitle) => {
                      setLiveChallengeSectionTitle(sectionTitle)
                    }}
                  />
                )}

                {activeTab === 'refractor' && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setActiveTab('path')}
                        className="text-xs font-bold text-stone-500 hover:text-stone-900 underline"
                      >
                        ← Back to Path
                      </button>
                    </div>
                    <ThoughtRefractorView course={activeCourse} />
                  </div>
                )}

                {activeTab === 'canvas' && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setActiveTab('path')}
                        className="text-xs font-bold text-stone-500 hover:text-stone-900 underline"
                      >
                        ← Back to Path
                      </button>
                    </div>
                    <SpatialCanvasView course={activeCourse} />
                  </div>
                )}
              </>
            )}

            {currentNav === 'create' && <WonderCreateView />}

            {currentNav === 'canvas' && <SpatialCanvasView course={activeCourse} />}

            {currentNav === 'courses' && (
              <WonderCoursesView
                courses={allCourses}
                activeCourse={activeCourse}
                onStartLearning={() => {
                  const setCurrentNav = useWonderStore.getState().setCurrentNav
                  setCurrentNav('home')
                  setActiveTab('path')
                }}
                onPreviewLesson={(lesson) => {
                  setActiveReadingLesson(lesson)
                }}
              />
            )}

            {currentNav === 'profile' && <WonderProfileView />}

            {currentNav === 'settings' && (
              <WonderSettingsView
                onOpenUpgrade={() => setOpenUpgradeModal(true)}
              />
            )}
          </main>
        )}
      </div>

      {/* Global Modals */}
      {openPodcastModal && (
        <WonderPodcastModal
          course={activeCourse}
          onClose={() => setOpenPodcastModal(false)}
          onOpenUpgrade={() => {
            setOpenPodcastModal(false)
            setOpenUpgradeModal(true)
          }}
        />
      )}

      {openLearningMapModal && (
        <WonderLearningMapModal
          course={activeCourse}
          onClose={() => setOpenLearningMapModal(false)}
          onSelectLesson={(lessonId) => handleJumpToLesson(lessonId)}
        />
      )}

      {openUpgradeModal && (
        <WonderUpgradeModal onClose={() => setOpenUpgradeModal(false)} />
      )}

      {unlockModalLesson && (
        <WonderUnlockModal
          courseTitle={activeCourse.title}
          lessonTitle={unlockModalLesson.title}
          isEnrolled={enrolledCourseIds.includes(activeCourse.id)}
          onClose={() => setUnlockModalLesson(null)}
          onUnlock={() => {
            enrollCourse(activeCourse.id)
            setUnlockModalLesson(null)
          }}
          onUpgradePro={() => {
            setUnlockModalLesson(null)
            setOpenUpgradeModal(true)
          }}
        />
      )}

      {/* 1:1 Authentic Quick Exercise & Section Review Modal */}
      {quickPracticeState.isOpen && (
        <WonderQuickPracticeModal
          course={activeCourse}
          sectionTitle={quickPracticeState.sectionTitle}
          onClose={() => setQuickPracticeState({ isOpen: false })}
          onCompleteSession={(res) => {
            setQuickPracticeState({ isOpen: false })
            setStreakCelebrationState({ isOpen: true, streakCount: res.streakCount })
          }}
        />
      )}

      {/* 1:1 Authentic StreakCelebrationSheet */}
      {streakCelebrationState?.isOpen && (
        <WonderStreakCelebrationModal
          streakCount={streakCelebrationState.streakCount}
          onClose={() => setStreakCelebrationState(null)}
        />
      )}

      {/* 1:1 Authentic Wondering Live Challenge Modal */}
      {liveChallengeSectionTitle && (
        <WonderLiveChallengeModal
          course={activeCourse}
          sectionTitle={liveChallengeSectionTitle}
          onClose={() => setLiveChallengeSectionTitle(null)}
          onComplete={(res) => {
            setLiveChallengeSectionTitle(null)
            useAppStore.setState((s) => ({
              xp: s.xp + res.xpEarned,
              coins: s.coins + res.coinsEarned,
            }))
            setStreakCelebrationState({ isOpen: true, streakCount: 5 })
          }}
        />
      )}

      {/* 1:1 Wondering AI Companion ChatPanel */}
      {!activeReadingLesson && (
        <WonderChatPanel
          course={activeCourse}
          activeLesson={activeReadingLesson}
        />
      )}

      {/* 1:1 Study Notes & Saved Concepts Drawer */}
      <WonderNotesDrawer
        course={activeCourse}
        activeLesson={activeReadingLesson}
      />

      {/* Floating Dark Star Mascot */}
      {!activeReadingLesson && <WonderMascot />}

      {/* 1:1 Fullscreen Immersive Lesson Reading View */}
      {activeReadingLesson && (
        <div className="fixed inset-0 z-50 bg-[#FFFDF8] dark:bg-[#150F0D] flex flex-col overflow-hidden animate-in fade-in duration-150">
          <WonderLessonView
            lesson={activeReadingLesson}
            course={activeCourse}
            onClose={() => setActiveReadingLesson(null)}
          />
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (1:1 with authentic Wondering mobile) */}
      {!activeReadingLesson && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#FAF8F2] dark:bg-[#1A1412] border-t border-[#E7E2D6] dark:border-stone-800 z-30 pb-[var(--safe-bottom,0px)] shadow-lg select-none">
        <div className="flex items-center justify-around px-2 py-1.5">
          {[
            { id: 'home' as const, label: 'Home', icon: WonderHomeIcon },
            { id: 'create' as const, label: 'Create', icon: WonderCreateIcon },
            { id: 'canvas' as const, label: 'Canvas', icon: WonderCanvasIcon },
            { id: 'courses' as const, label: 'Explore', icon: WonderCoursesIcon },
            { id: 'profile' as const, label: 'Profile', icon: WonderProfileIcon },
          ].map(({ id, label, icon: Icon }) => {
            const isActive = currentNav === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  haptics.selection()
                  setCurrentNav(id)
                }}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'text-stone-900 dark:text-stone-100 font-bold'
                    : 'text-stone-400 dark:text-stone-500 hover:text-stone-800'
                }`}
              >
                <Icon size={20} className={isActive ? 'scale-110 transition-transform' : ''} />
                <span className="text-[10px] mt-0.5">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
      )}
    </div>
  )
}
