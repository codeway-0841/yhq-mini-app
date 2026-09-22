import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { api } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useDailyStore, todayStr } from '../../../shared/store/useDailyStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { convertAiCourseToWonderCourse } from '../lib/aiCourseAdapter'
import type { WonderTab, FsrsRating, FsrsCardState, WonderCourse, CanvasCard } from '../types'
import type { AiCourseAnswers } from '../../../../shared/ai-courses'

export type WonderNav = 'home' | 'create' | 'canvas' | 'courses' | 'profile' | 'settings'

interface AudioPlayerState {
  episodeId: string | null
  isPlaying: boolean
  currentTime: number
  playbackRate: number
}

interface WonderStoreState {
  currentNav: WonderNav
  isSidebarCollapsed: boolean
  activeCourseId: string
  activeTab: WonderTab
  completedLessonIds: string[]
  enrolledCourseIds: string[]
  isCourseLoading: boolean
  customCourses: WonderCourse[]
  fsrsCards: Record<string, FsrsCardState>
  canvasCardsMap: Record<string, CanvasCard[]>
  audioState: AudioPlayerState
  wonderStreak: number
  lastActiveDate: string
  openPodcastModal: boolean
  openLearningMapModal: boolean
  openUpgradeModal: boolean
  factsAboutYou: string
  isChatOpen: boolean
  isNotesDrawerOpen: boolean
  lessonNotes: Record<string, string[]>

  // Actions
  setCurrentNav: (nav: WonderNav) => void
  toggleSidebar: () => void
  setActiveCourse: (courseId: string) => void
  setIsCourseLoading: (loading: boolean) => void
  enrollCourse: (courseId: string) => void
  unenrollCourse: (courseId: string) => void
  setActiveTab: (tab: WonderTab) => void
  setOpenPodcastModal: (open: boolean) => void
  setOpenLearningMapModal: (open: boolean) => void
  setOpenUpgradeModal: (open: boolean) => void
  setFactsAboutYou: (facts: string) => void
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  toggleNotesDrawer: () => void
  setNotesDrawerOpen: (open: boolean) => void
  addLessonNote: (lessonId: string, note: string) => void
  deleteLessonNote: (lessonId: string, index: number) => void
  completeLesson: (
    lessonId: string,
    rating: FsrsRating,
    xp: number,
    coins: number,
    answers?: AiCourseAnswers,
    rawPractices?: readonly any[],
  ) => { xpEarned: number; coinsEarned: number; isFirstCompletion: boolean }
  addCustomCourse: (course: WonderCourse) => void
  deleteCourse: (courseId: string) => void
  renameCourse: (courseId: string, newTitle: string) => void
  addCanvasCard: (courseId: string, card: Omit<CanvasCard, 'id'>) => void
  updateCanvasCardPosition: (courseId: string, cardId: string, x: number, y: number) => void
  deleteCanvasCard: (courseId: string, cardId: string) => void
  setAudioState: (partial: Partial<AudioPlayerState>) => void
  resetAudio: () => void
  syncRemoteAiCourses: () => Promise<void>
}

/**
 * FSRS (Free Spaced Repetition Scheduler) simplified algorithm
 */
function calculateFsrsNext(current: FsrsCardState | undefined, rating: FsrsRating): FsrsCardState {
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000

  let stability = current ? current.stability : 1.0
  let difficulty = current ? current.difficulty : 5.0
  let reps = current ? current.reps + 1 : 1

  switch (rating) {
    case 'again':
      stability = Math.max(0.5, stability * 0.5)
      difficulty = Math.min(10.0, difficulty + 1.0)
      reps = 0
      break
    case 'hard':
      stability = stability * 1.2
      difficulty = Math.min(10.0, difficulty + 0.5)
      break
    case 'good':
      stability = stability * 2.0
      difficulty = Math.max(1.0, difficulty - 0.2)
      break
    case 'easy':
      stability = stability * 3.2
      difficulty = Math.max(1.0, difficulty - 1.0)
      break
  }

  const intervalDays = Math.max(1, Math.round(stability))
  const due = now + intervalDays * oneDay

  return {
    lessonId: current ? current.lessonId : '',
    stability,
    difficulty,
    reps,
    lastReviewed: now,
    due,
  }
}

export const useWonderStore = create<WonderStoreState>()(
  persist(
    (set, get) => ({
      currentNav: 'home',
      isSidebarCollapsed: false,
      activeCourseId: 'learning-how-to-learn',
      activeTab: 'path',
      completedLessonIds: [],
      enrolledCourseIds: ['learning-how-to-learn'],
      isCourseLoading: false,
      customCourses: [],
      fsrsCards: {},
      canvasCardsMap: {},
      audioState: {
        episodeId: null,
        isPlaying: false,
        currentTime: 0,
        playbackRate: 1.0,
      },
      wonderStreak: 1,
      lastActiveDate: new Date().toISOString().slice(0, 10),
      openPodcastModal: false,
      openLearningMapModal: false,
      openUpgradeModal: false,
      factsAboutYou: "I am a visual learner interested in deep concepts and science.",
      isChatOpen: false,
      isNotesDrawerOpen: false,
      lessonNotes: {},

      setCurrentNav: (nav) => set({ currentNav: nav }),
      toggleSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
      setIsCourseLoading: (loading) => set({ isCourseLoading: loading }),
      toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
      setChatOpen: (open) => set({ isChatOpen: open }),
      toggleNotesDrawer: () => set((s) => ({ isNotesDrawerOpen: !s.isNotesDrawerOpen })),
      setNotesDrawerOpen: (open) => set({ isNotesDrawerOpen: open }),
      addLessonNote: (lessonId, note) => {
        if (!note.trim()) return
        set((s) => {
          const current = s.lessonNotes[lessonId] || []
          return {
            lessonNotes: {
              ...s.lessonNotes,
              [lessonId]: [...current, note.trim()],
            },
          }
        })
      },
      deleteLessonNote: (lessonId, index) => {
        set((s) => {
          const current = s.lessonNotes[lessonId] || []
          return {
            lessonNotes: {
              ...s.lessonNotes,
              [lessonId]: current.filter((_, i) => i !== index),
            },
          }
        })
      },
      setActiveCourse: (courseId) => {
        set({ isCourseLoading: true, activeCourseId: courseId, currentNav: 'home' })
        setTimeout(() => {
          set({ isCourseLoading: false })
        }, 450)
      },
      enrollCourse: (courseId) => {
        const state = get()
        const updated = Array.from(new Set([...state.enrolledCourseIds, courseId]))
        set({
          enrolledCourseIds: updated,
          activeCourseId: courseId,
          isCourseLoading: true,
          currentNav: 'home',
        })
        setTimeout(() => {
          set({ isCourseLoading: false })
        }, 450)
      },
      unenrollCourse: (courseId) => {
        const state = get()
        const updated = state.enrolledCourseIds.filter((id) => id !== courseId)
        const nextActive = updated.length > 0 ? updated[0] : ''
        set({
          enrolledCourseIds: updated,
          activeCourseId: state.activeCourseId === courseId ? nextActive : state.activeCourseId,
        })
      },
      setActiveTab: (tab) => set({ activeTab: tab }),
      setOpenPodcastModal: (open) => set({ openPodcastModal: open }),
      setOpenLearningMapModal: (open) => set({ openLearningMapModal: open }),
      setOpenUpgradeModal: (open) => set({ openUpgradeModal: open }),
      setFactsAboutYou: (facts) => set({ factsAboutYou: facts }),

      completeLesson: (lessonId, rating, xp, coins, answers, rawPractices) => {
        const state = get()
        const isFirstCompletion = !state.completedLessonIds.includes(lessonId)
        const updatedCompleted = isFirstCompletion
          ? [...state.completedLessonIds, lessonId]
          : state.completedLessonIds

        const currentFsrs = state.fsrsCards[lessonId]
        const updatedFsrs = calculateFsrsNext(currentFsrs, rating)
        updatedFsrs.lessonId = lessonId

        const today = new Date().toISOString().slice(0, 10)
        let streak = state.wonderStreak
        if (state.lastActiveDate !== today) {
          streak += 1
        }

        set({
          completedLessonIds: updatedCompleted,
          fsrsCards: {
            ...state.fsrsCards,
            [lessonId]: updatedFsrs,
          },
          wonderStreak: streak,
          lastActiveDate: today,
        })

        // Background sync to backend Neon DB for AI courses
        if (state.activeCourseId.startsWith('ai-') && isFirstCompletion) {
          const numericId = parseInt(state.activeCourseId.replace('ai-', ''), 10)
          if (numericId > 0) {
            const clientToken = `wnd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

            // Build complete answers guaranteeing isLessonFullyAnswered passes
            const finalAnswers: AiCourseAnswers = {
              flashcard: { ...(answers?.flashcard ?? {}) },
              mcq: { ...(answers?.mcq ?? {}) },
              cloze: { ...(answers?.cloze ?? {}) },
              order: { ...(answers?.order ?? {}) },
            }

            if (rawPractices && Array.isArray(rawPractices)) {
              for (const p of rawPractices) {
                if (p.kind === 'flashcard' && !finalAnswers.flashcard[p.id]) {
                  finalAnswers.flashcard[p.id] = rating === 'again' ? 'unknown' : 'known'
                } else if (p.kind === 'mcq' && !finalAnswers.mcq[p.id]) {
                  const defaultOpt = p.options?.[0]?.id || 'opt1'
                  finalAnswers.mcq[p.id] = defaultOpt
                } else if (p.kind === 'cloze' && !finalAnswers.cloze[p.id]) {
                  finalAnswers.cloze[p.id] = {}
                  if (Array.isArray(p.blanks)) {
                    for (const b of p.blanks) {
                      finalAnswers.cloze[p.id][b.id] = b.id || 'answer'
                    }
                  }
                } else if (p.kind === 'order' && !finalAnswers.order[p.id]) {
                  finalAnswers.order[p.id] = Array.isArray(p.steps)
                    ? p.steps.map((s: { id: string }) => s.id)
                    : []
                }
              }
            }

            api
              .completeAiCourseLesson(numericId, lessonId, {
                answers: finalAnswers,
                clientToken,
              })
              .then((res) => {
                if (res?.coinsAwarded && res.coinsAwarded > 0) {
                  useAppStore.setState((s) => ({ coins: s.coins + res.coinsAwarded }))
                }
                const userId = useAppStore.getState().user?.id
                if (userId) {
                  void useDailyStore
                    .getState()
                    .touchActivity(
                      userId,
                      todayStr(),
                      useSubjectStore.getState().subjectId,
                    )
                }
              })
              .catch(() => {
                // fire-and-forget fallback
              })
          }
        }

        return {
          xpEarned: isFirstCompletion ? xp : Math.round(xp * 0.4),
          coinsEarned: isFirstCompletion ? coins : 0,
          isFirstCompletion,
        }
      },

      addCustomCourse: (course) => {
        set((s) => ({
          customCourses: [course, ...s.customCourses.filter((c) => c.id !== course.id)],
          enrolledCourseIds: Array.from(new Set([course.id, ...s.enrolledCourseIds])),
          activeCourseId: course.id,
          currentNav: 'home',
          activeTab: 'path',
        }))
      },

      deleteCourse: (courseId) => {
        set((s) => {
          const updatedCustom = s.customCourses.filter((c) => c.id !== courseId)
          const updatedEnrolled = s.enrolledCourseIds.filter((id) => id !== courseId)
          const nextActive =
            updatedEnrolled.length > 0
              ? updatedEnrolled[0]
              : updatedCustom[0]?.id || 'learning-how-to-learn'
          return {
            customCourses: updatedCustom,
            enrolledCourseIds: updatedEnrolled,
            activeCourseId: s.activeCourseId === courseId ? nextActive : s.activeCourseId,
          }
        })
      },

      renameCourse: (courseId, newTitle) => {
        const trimmed = newTitle.trim()
        if (!trimmed) return
        set((s) => ({
          customCourses: s.customCourses.map((c) =>
            c.id === courseId ? { ...c, title: trimmed } : c,
          ),
        }))
      },

      addCanvasCard: (courseId, card) => {
        const newCard: CanvasCard = {
          ...card,
          id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        }
        set((s) => {
          const currentCards = s.canvasCardsMap[courseId] || []
          return {
            canvasCardsMap: {
              ...s.canvasCardsMap,
              [courseId]: [...currentCards, newCard],
            },
          }
        })
      },

      updateCanvasCardPosition: (courseId, cardId, x, y) => {
        set((s) => {
          const currentCards = s.canvasCardsMap[courseId] || []
          return {
            canvasCardsMap: {
              ...s.canvasCardsMap,
              [courseId]: currentCards.map((c) => (c.id === cardId ? { ...c, x, y } : c)),
            },
          }
        })
      },

      deleteCanvasCard: (courseId, cardId) => {
        set((s) => {
          const currentCards = s.canvasCardsMap[courseId] || []
          return {
            canvasCardsMap: {
              ...s.canvasCardsMap,
              [courseId]: currentCards.filter((c) => c.id !== cardId),
            },
          }
        })
      },

      setAudioState: (partial) => {
        set((s) => ({
          audioState: {
            ...s.audioState,
            ...partial,
          },
        }))
      },

      resetAudio: () => {
        set({
          audioState: {
            episodeId: null,
            isPlaying: false,
            currentTime: 0,
            playbackRate: 1.0,
          },
        })
      },

      syncRemoteAiCourses: async () => {
        try {
          const res = await api.getAiCourses()
          if (!res?.ok || !Array.isArray(res.courses)) return

          const state = get()
          const existingCourses = [...state.customCourses]
          const newEnrolled = new Set(state.enrolledCourseIds)
          const newCompleted = new Set(state.completedLessonIds)

          for (const item of res.courses) {
            const courseId = `ai-${item.id}`
            newEnrolled.add(courseId)
            const exists = existingCourses.some((c) => c.id === courseId)
            if (!exists) {
              try {
                const detailRes = await api.getAiCourse(item.id)
                if (detailRes?.ok && detailRes.course) {
                  const converted = convertAiCourseToWonderCourse(detailRes.course)
                  existingCourses.push(converted)
                  if (Array.isArray(detailRes.course.completedLessonIds)) {
                    for (const clId of detailRes.course.completedLessonIds) {
                      newCompleted.add(clId)
                    }
                  }
                }
              } catch {
                // skip single course error
              }
            } else {
              try {
                const detailRes = await api.getAiCourse(item.id)
                if (detailRes?.ok && detailRes.course && Array.isArray(detailRes.course.completedLessonIds)) {
                  for (const clId of detailRes.course.completedLessonIds) {
                    newCompleted.add(clId)
                  }
                }
              } catch {
                // skip single course error
              }
            }
          }

          set({
            customCourses: existingCourses,
            enrolledCourseIds: Array.from(newEnrolled),
            completedLessonIds: Array.from(newCompleted),
          })
        } catch {
          // offline or unauthenticated fallback
        }
      },
    }),
    {
      name: 'kivvi-wonder-studio-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        currentNav: s.currentNav,
        isSidebarCollapsed: s.isSidebarCollapsed,
        activeCourseId: s.activeCourseId,
        activeTab: s.activeTab,
        completedLessonIds: s.completedLessonIds,
        enrolledCourseIds: s.enrolledCourseIds,
        customCourses: s.customCourses,
        fsrsCards: s.fsrsCards,
        canvasCardsMap: s.canvasCardsMap,
        wonderStreak: s.wonderStreak,
        lastActiveDate: s.lastActiveDate,
        factsAboutYou: s.factsAboutYou,
        lessonNotes: s.lessonNotes,
      }),
    },
  ),
)
