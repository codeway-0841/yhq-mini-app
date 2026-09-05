/**
 * Biletlar sahifasi — savollarni 20 talik biletlarga taqsimlash, "Xatolar"
 * tabidagi filtr/badge va bilet ochilganda test sahifasiga uzatiladigan holat.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import Biletlar from '../../../src/features/tickets/Biletlar'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { questionKey } from '../../../shared/subjects'
import { seededShuffle } from '../../../src/shared/lib/seeded'

/** 40 ta savol = 2 ta bilet (har birida 20 ta) */
const questions = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  topicId: 1,
  questionUz: `Savol ${i + 1}`,
  questionRu: `Вопрос ${i + 1}`,
  optionsUz: { F1: 'a', F2: 'b' },
  optionsRu: { F1: 'а', F2: 'б' },
  correctAnswer: 'F1',
})) as never[]

beforeEach(() => {
  mockNavigate.mockReset()
  useSubjectStore.setState({ subjectId: 'yhq' })
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    wrongByTicket: {},
  })
  useQuestionsStore.setState({ questions, topics: [], loaded: true, loading: false })
})

describe('Biletlar', () => {
  it('savollarni 20 talik biletlarga bo\'ladi', () => {
    render(<Biletlar />)

    expect(screen.getByText('1 - bilet')).toBeInTheDocument()
    expect(screen.getByText('2 - bilet')).toBeInTheDocument()
    expect(screen.queryByText('3 - bilet')).toBeNull()
    expect(screen.getAllByText(/20 ta savol|20 savol|20/).length).toBeGreaterThan(0)
  })

  it('savollar hali yuklanmagan bo\'lsa bilet chiqmaydi', () => {
    useQuestionsStore.setState({ questions: [], loaded: true, loading: false })
    render(<Biletlar />)

    expect(screen.queryByText('1 - bilet')).toBeNull()
  })

  it('"Xatolar" tabida faqat xatosi bor biletlar va ularning soni ko\'rinadi', () => {
    // Biletlar seed bilan aralashtiriladi — 1-biletdagi aynan shu savollarni
    // xato deb belgilaymiz (2 tadan urinish bilan: badge urinishni EMAS,
    // yechilmagan savollar sonini ko'rsatishi kerak)
    const firstTicketIds = seededShuffle(questions, 42)
      .slice(0, 20)
      .map((q) => (q as unknown as { id: number }).id)
      .slice(0, 3)
    useAppStore.setState({
      wrongByTicket: Object.fromEntries(firstTicketIds.map((id) => [questionKey('yhq', id), 2])),
    })

    render(<Biletlar />)
    fireEvent.click(screen.getByText('Xatolar'))

    // Faqat 1-bilet qoladi (2-biletda xato yo'q)
    expect(screen.getAllByText(/ - bilet$/)).toHaveLength(1)
    expect(screen.getByText('1 - bilet')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()   // 3 ta xato savol, 6 urinish emas
  })

  it('xato yo\'q bo\'lsa "Xatolar" tabi bo\'sh holat matnini ko\'rsatadi', () => {
    render(<Biletlar />)
    fireEvent.click(screen.getByText('Xatolar'))

    expect(screen.queryByText(/ - bilet$/)).toBeNull()
  })

  it('bilet bosilganda 1-savoldan boshlab test ochiladi (20 ta savol id bilan)', () => {
    render(<Biletlar />)
    fireEvent.click(screen.getByText('1 - bilet'))

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const [path, opts] = mockNavigate.mock.calls[0]!
    expect(path).toBe('/test/1')
    expect(opts.state.title).toBe('1 - bilet')
    expect(opts.state.questionIds).toHaveLength(20)
  })

  it('biletlar barqaror (seed) tartibda — qayta chizishda o\'zgarmaydi', () => {
    const { unmount } = render(<Biletlar />)
    fireEvent.click(screen.getByText('1 - bilet'))
    const first = mockNavigate.mock.calls[0]![1].state.questionIds
    unmount()

    render(<Biletlar />)
    fireEvent.click(screen.getByText('1 - bilet'))
    const second = mockNavigate.mock.calls[1]![1].state.questionIds

    expect(second).toEqual(first)
  })

  it('YHQ dan boshqa fanlarda (masalan fizika) biletlarni 30 talik qiladi', () => {
    useSubjectStore.setState({ subjectId: 'fizika' })
    const sixtyQuestions = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      topicId: 1,
      questionUz: `Savol ${i + 1}`,
      questionRu: `Вопрос ${i + 1}`,
      optionsUz: { F1: 'a', F2: 'b' },
      optionsRu: { F1: 'а', F2: 'б' },
      correctAnswer: 'F1',
    })) as never[]
    useQuestionsStore.setState({ questions: sixtyQuestions, topics: [], loaded: true, loading: false })

    render(<Biletlar />)
    expect(screen.getByText('1 - bilet')).toBeInTheDocument()
    expect(screen.getByText('2 - bilet')).toBeInTheDocument()
    expect(screen.queryByText('3 - bilet')).toBeNull()
    expect(screen.getAllByText(/30 ta savol|30 savol|30/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText('1 - bilet'))
    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const [path, opts] = mockNavigate.mock.calls[0]!
    expect(path).toBe('/test/1')
    expect(opts.state.questionIds).toHaveLength(30)
  })
})
