import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import LessonTransitionHost from '../../../src/features/lessons/LessonTransitionHost'
import {
  startLessonTransition,
  isLessonTransitionHostMounted,
  resolveBrilliantRiveColor,
} from '../../../src/features/lessons/lesson-transition'
import { LESSON_LAUNCH_MS, LESSON_LAUNCH_REVEAL_MS } from '../../../src/features/lessons/LessonLaunch'
import { PRACTICE_WARMUP_MS, PRACTICE_WARMUP_REVEAL_MS } from '../../../src/features/lessons/course-engine/PracticeWarmUpLaunch'
import { BrilliantCourseMap } from '../../../src/features/lessons/course-engine/BrilliantCourseMap'
import { courseSectionKey } from '../../../src/features/lessons/course-engine/course-progress'
import { closeTopModal } from '../../../src/shared/lib/navigation'
import Darslik from '../../../src/features/lessons/Darslik'
import TopicsPage from '../../../src/features/topics/TopicsPage'
import CourseMapPage from '../../../src/features/darslik-rustili/CourseMapPage'
import { api } from '../../../src/shared/api'
import { config } from '../../../src/shared/config'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'

function RouteStarter({ kind }: { kind: 'lesson' | 'warmup' }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        startLessonTransition({
          kind,
          lang: 'uz',
          accent: '#3557ff',
          onReveal: () => navigate('/test/1'),
        })
      }}
    >
      Start course
    </button>
  )
}

describe('Universal LessonTransitionHost & YHQ course map integration', () => {
  beforeEach(() => {
    useSubjectStore.setState({ subjectId: 'yhq' })
    useLessonsStore.setState({ byUser: {}, readByUser: {} })
    useAppStore.setState({
      tariff: 'premium',
      user: { id: 'host-test', firstName: 'Test' } as never,
      settings: { ...useAppStore.getState().settings, language: 'uz', noAnimation: false },
    })
  })

  afterEach(() => {
    ;(config as { testSessionsV2Enabled: boolean }).testSessionsV2Enabled = false
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('keeps LessonLaunch alive across route navigation until crossfade completes', () => {
    vi.useFakeTimers()
    expect(isLessonTransitionHostMounted()).toBe(false)

    render(
      <MemoryRouter initialEntries={['/darslik']}>
        <LessonTransitionHost />
        <Routes>
          <Route path="/darslik" element={<RouteStarter kind="lesson" />} />
          <Route path="/test/:id" element={<div data-testid="dest-test">Test screen</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(isLessonTransitionHostMounted()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Start course' }))
    expect(screen.getByRole('dialog', { name: 'Dars ochilmoqda' })).toBeInTheDocument()
    expect(screen.queryByTestId('dest-test')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(LESSON_LAUNCH_REVEAL_MS)
    })
    expect(screen.getByTestId('dest-test')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Dars ochilmoqda' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(LESSON_LAUNCH_MS - LESSON_LAUNCH_REVEAL_MS)
    })
    expect(screen.queryByRole('dialog', { name: 'Dars ochilmoqda' })).toBeNull()
  })

  it('supports warmup transitions and Android back cancellation via closeTopModal', () => {
    vi.useFakeTimers()
    render(
      <MemoryRouter initialEntries={['/darslik']}>
        <LessonTransitionHost />
        <Routes>
          <Route path="/darslik" element={<RouteStarter kind="warmup" />} />
          <Route path="/test/:id" element={<div data-testid="dest-test">Test screen</div>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start course' }))
    expect(screen.getByText('Mashq yuklanmoqda…')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(PRACTICE_WARMUP_REVEAL_MS - 100)
      expect(closeTopModal()).toBe(true)
      vi.advanceTimersByTime(PRACTICE_WARMUP_MS)
    })

    expect(screen.queryByText('Mashq yuklanmoqda…')).toBeNull()
    expect(screen.queryByTestId('dest-test')).toBeNull()
  })

  it('opens universal BrilliantCourseMap when /darslik?block=1 is requested for YHQ', () => {
    render(
      <MemoryRouter initialEntries={['/darslik?block=1']}>
        <Routes>
          <Route path="/darslik" element={<Darslik />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(document.querySelector('[data-course="yhq-map"]')).toBeInTheDocument()
    expect(screen.getAllByText('MODUL 1').length).toBeGreaterThan(0)
  })

  it('resolves Brilliant Rive color indices uniformly across accents', () => {
    expect(resolveBrilliantRiveColor('#22c55e')).toBe(0)
    expect(resolveBrilliantRiveColor('#3557ff')).toBe(1)
    expect(resolveBrilliantRiveColor('#ef4444')).toBe(2)
    expect(resolveBrilliantRiveColor('#f97316')).toBe(3)
    expect(resolveBrilliantRiveColor('#f6b31f')).toBe(4)
    expect(resolveBrilliantRiveColor('#8a4cff')).toBe(5)
    expect(resolveBrilliantRiveColor('#3557ff', 4)).toBe(4)
  })

  it('launches animated transition when tapping a subject topic card in TopicsPage', async () => {
    vi.useFakeTimers()
    ;(config as { testSessionsV2Enabled: boolean }).testSessionsV2Enabled = true
    useSubjectStore.setState({ subjectId: 'fizika' })
    const loadTopicsSpy = vi.fn().mockResolvedValue(undefined)
    useQuestionsStore.setState({
      subjectId: 'fizika',
      loaded: true,
      loading: false,
      topics: [
        { id: 101, subjectId: 'fizika', slug: '01-kinematika', nameUz: 'Kinematika', nameRu: 'Кинематика', questionCount: 10 },
      ],
      loadTopics: loadTopicsSpy,
    })
    vi.spyOn(api, 'getTopicProgress').mockResolvedValue({ subjectId: 'fizika', topics: [] })

    render(
      <MemoryRouter initialEntries={['/mavzular']}>
        <LessonTransitionHost />
        <Routes>
          <Route path="/mavzular" element={<TopicsPage />} />
          <Route path="/darslik" element={<div data-testid="subject-map-dest">Physics Map</div>} />
        </Routes>
      </MemoryRouter>,
    )

    const card = document.querySelector('.br-topic-card') as HTMLButtonElement
    expect(card).not.toBeNull()
    fireEvent.click(card)

    expect(screen.getByRole('dialog', { name: 'Dars ochilmoqda' })).toBeInTheDocument()
    expect(screen.queryByTestId('subject-map-dest')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(LESSON_LAUNCH_REVEAL_MS)
    })
    expect(screen.getByTestId('subject-map-dest')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(LESSON_LAUNCH_MS - LESSON_LAUNCH_REVEAL_MS)
    })
    expect(screen.queryByRole('dialog', { name: 'Dars ochilmoqda' })).toBeNull()
    ;(config as { testSessionsV2Enabled: boolean }).testSessionsV2Enabled = false
  })

  it('triggers Koji entry dive and LessonLaunch on CourseMapPage even without initialBlockId', async () => {
    vi.spyOn(api, 'getDarslikProgress').mockResolvedValue({ passed: [] })
    render(
      <MemoryRouter initialEntries={['/darslik/rus-tili']}>
        <CourseMapPage />
      </MemoryRouter>,
    )
    await act(async () => {
      await Promise.resolve()
    })

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const startBtn = screen.getByRole('button', { name: 'Boshlash' })
    fireEvent.click(startBtn)
    expect(startBtn).toBeDisabled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(530)
    })
    expect(screen.getByRole('dialog', { name: 'Dars ochilmoqda' })).toBeInTheDocument()
  })

  it('launches warm-up Dumbbell overlay for completed topics on route-based subjects (no renderOverlay)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const onOpenSection = vi.fn()
    render(
      <MemoryRouter initialEntries={['/darslik?block=1']}>
        <LessonTransitionHost />
        <BrilliantCourseMap
          subjectId="fizika"
          blocks={[
            {
              id: 1,
              titleUz: 'Mexanika',
              titleRu: 'Механика',
              sections: [{ key: 101, title: 'Kinematika' }],
            },
          ]}
          progress={{
            passed: new Set([courseSectionKey(1, 0)]),
            lockSequential: false,
            loading: false,
            error: false,
            refresh: () => {},
          }}
          courseTitle="Fizika"
          courseSubtitle="Kursning barcha mavzulari"
          sectionCountLabel="mavzu"
          unitLabelUz="BOB"
          unitLabelRu="БЛОК"
          initialBlockId={1}
          initialSectionIdx={0}
          includeUnitCheck={false}
          onOpenSection={onOpenSection}
        />
      </MemoryRouter>,
    )

    const practiceBtn = screen.getByRole('button', { name: 'Mashqni boshlash' })
    fireEvent.click(practiceBtn)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(530)
    })
    const caption = screen.getByText('Mashq yuklanmoqda…')
    expect(caption).toBeInTheDocument()
    expect(caption).not.toHaveClass('sr-only')
    expect(onOpenSection).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRACTICE_WARMUP_REVEAL_MS)
    })
    expect(onOpenSection).toHaveBeenCalledWith(expect.objectContaining({ practiceMode: true }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(330)
    })
    expect(screen.queryByText('Mashq yuklanmoqda…')).toBeNull()
  })
})
