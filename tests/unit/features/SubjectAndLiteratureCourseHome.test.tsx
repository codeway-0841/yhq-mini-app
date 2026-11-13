import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Darslik from '../../../src/features/lessons/Darslik'
import LiteratureCourseHome from '../../../src/features/darslik-rusadabiyot/LiteratureCourseHome'
import { api } from '../../../src/shared/api'
import { config } from '../../../src/shared/config'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useDailyStore } from '../../../src/shared/store/useDailyStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'

describe('Universal Brilliant Course Home across subjects', () => {
  beforeEach(() => {
    useAppStore.setState({
      user: { id: 'u-global', firstName: 'Ali' } as never,
      tariff: 'free',
      settings: { ...useAppStore.getState().settings, language: 'uz', noAnimation: true },
    })
    useDailyStore.setState({
      streaks: {},
      charges: {},
      extendedDates: {},
      globalStreak: 4,
      globalCharges: 2,
      globalExtendedDate: null,
      activityKey: null,
    })
    useLessonsStore.setState({ byUser: {}, readByUser: {} })
    useQuestionsStore.setState({ topics: [], subjectId: '', loaded: false, loading: false })
  })

  it('renders Brilliant Course Home for non-YHQ subjects such as fizika and launches first incomplete topic test', async () => {
    useSubjectStore.setState({ subjectId: 'fizika' })
    const loadTopicsSpy = vi.fn().mockImplementation(async () => {
      useQuestionsStore.setState({
        subjectId: 'fizika',
        topics: [
          { id: 101, nameUz: 'Mexanika asoslari', nameRu: 'Основы механики', slug: 'mexanika', questionCount: 10 },
          { id: 102, nameUz: 'Termodinamika qonunlari', nameRu: 'Законы термодинамики', slug: 'termodinamika', questionCount: 8 },
        ],
      })
    })
    useQuestionsStore.setState({ loadTopics: loadTopicsSpy })
    const progressSpy = vi.spyOn(api, 'getTopicProgress').mockResolvedValue({
      subjectId: 'fizika',
      topics: [{ topicId: 101, solved: 10 }],
    })
    const dailySpy = vi.spyOn(api, 'getDaily').mockResolvedValue({
      record: { date: '2026-11-13', subjectId: 'fizika', answered: 2, correct: 2 },
      dailyStreak: 4,
      streakCharges: 2,
    })
    const histSpy = vi.spyOn(api, 'getDailyHistory').mockResolvedValue({
      rows: [],
      dailyStreak: 4,
      bestStreak: 4,
      streakCharges: 2,
    })

    const prevV2 = config.testSessionsV2Enabled
    ;(config as { testSessionsV2Enabled: boolean }).testSessionsV2Enabled = true

    try {
      render(
        <MemoryRouter initialEntries={['/darslik']}>
          <Routes>
            <Route path="/darslik" element={<Darslik />} />
            <Route path="/test/:id" element={<div data-testid="test-route-page">Test</div>} />
          </Routes>
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('subject-brilliant-home-fizika')).toBeInTheDocument()
      })
      expect(screen.getByTestId('brilliant-streak-pill')).toHaveTextContent('4')
      expect(screen.getByTestId('brilliant-keys-pill')).toHaveTextContent('1')
      expect(screen.getByText('Mexanika asoslari')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Boshlash' }))
      await waitFor(() => {
        expect(screen.getByTestId('test-route-page')).toBeInTheDocument()
      })
    } finally {
      ;(config as { testSessionsV2Enabled: boolean }).testSessionsV2Enabled = prevV2
      progressSpy.mockRestore()
      dailySpy.mockRestore()
      histSpy.mockRestore()
    }
  })

  it('redirects rustili and rusadabiyot from /darslik to their specialized Brilliant course homes', () => {
    useSubjectStore.setState({ subjectId: 'rustili' })
    const first = render(
      <MemoryRouter initialEntries={['/darslik']}>
        <Routes>
          <Route path="/darslik" element={<Darslik />} />
          <Route path="/darslik/rus-tili" element={<div data-testid="rus-tili-home" />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('rus-tili-home')).toBeInTheDocument()
    first.unmount()

    useSubjectStore.setState({ subjectId: 'rusadabiyot' })
    render(
      <MemoryRouter initialEntries={['/darslik']}>
        <Routes>
          <Route path="/darslik" element={<Darslik />} />
          <Route path="/darslik/rus-adabiyot" element={<div data-testid="rus-adabiyot-home" />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('rus-adabiyot-home')).toBeInTheDocument()
  })

  it('renders /darslik/rus-adabiyot with the Brilliant Course Home, global pills, and ?block reader flow', async () => {
    const dailySpy = vi.spyOn(api, 'getDaily').mockResolvedValue({
      record: { date: '2026-11-13', subjectId: 'rusadabiyot', answered: 0, correct: 0 },
      dailyStreak: 4,
      streakCharges: 2,
    })
    const histSpy = vi.spyOn(api, 'getDailyHistory').mockResolvedValue({
      rows: [],
      dailyStreak: 4,
      bestStreak: 4,
      streakCharges: 2,
    })

    try {
      render(
        <MemoryRouter initialEntries={['/darslik/rus-adabiyot']}>
          <Routes>
            <Route path="/darslik/rus-adabiyot" element={<LiteratureCourseHome />} />
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByTestId('literature-course-home')).toBeInTheDocument()
      await waitFor(() => {
        expect(screen.getByTestId('brilliant-streak-pill')).toHaveTextContent('4')
      })
      expect(screen.getByText('DAVR 1')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Boshlash' }))
      await waitFor(() => {
        expect(screen.getByText('Davr 1')).toBeInTheDocument()
      })
    } finally {
      dailySpy.mockRestore()
      histSpy.mockRestore()
    }
  })
})
