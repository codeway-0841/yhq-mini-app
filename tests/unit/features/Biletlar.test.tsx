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
    tariff: 'free',
    user: { id: 'user-1', firstName: 'Ali', tariff: 'free', lastName: undefined, username: undefined, photoUrl: undefined, phone: undefined },
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
    expect(opts.state).toMatchObject({
      mode: 'ticket',
      serverSelector: { type: 'ticket', ticketNumber: 1 },
    })
  })

  it('free userga faqat birinchi 3 ta bilet ochiq, 4-bilet Premiumga yuboradi', () => {
    const eightyQuestions = Array.from({ length: 80 }, (_, i) => ({
      id: i + 1,
      topicId: 1,
      questionUz: `Savol ${i + 1}`,
      questionRu: `Вопрос ${i + 1}`,
      optionsUz: { F1: 'a', F2: 'b' },
      optionsRu: { F1: 'а', F2: 'б' },
      correctAnswer: 'F1',
    })) as never[]
    useQuestionsStore.setState({ questions: eightyQuestions, topics: [], loaded: true, loading: false })

    render(<Biletlar />)
    fireEvent.click(screen.getByText('4 - bilet'))

    expect(mockNavigate).toHaveBeenCalledWith('/premium')
  })

  it('premium user 4-biletni ham ochadi', () => {
    const eightyQuestions = Array.from({ length: 80 }, (_, i) => ({
      id: i + 1,
      topicId: 1,
      questionUz: `Savol ${i + 1}`,
      questionRu: `Вопрос ${i + 1}`,
      optionsUz: { F1: 'a', F2: 'b' },
      optionsRu: { F1: 'а', F2: 'б' },
      correctAnswer: 'F1',
    })) as never[]
    useQuestionsStore.setState({ questions: eightyQuestions, topics: [], loaded: true, loading: false })
    useAppStore.setState({
      tariff: 'premium',
      user: { id: 'user-1', firstName: 'Ali', tariff: 'premium', lastName: undefined, username: undefined, photoUrl: undefined, phone: undefined },
    })

    render(<Biletlar />)
    fireEvent.click(screen.getByText('4 - bilet'))

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate.mock.calls[0]?.[0]).toBe('/test/1')
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

  it('fizikada mavzular (topics) mavjud bo\'lsa, har bir mavzu bo\'yicha 30 talik bilet tuzadi va bo\'limlar filtrini ko\'rsatadi', () => {
    useSubjectStore.setState({ subjectId: 'fizika' })

    const mockTopics = [
      { id: 101, nameUz: 'Kinematika-1', nameRu: 'Кинематика-1', slug: 'physics_db-ftp-01-001' },
      { id: 102, nameUz: 'Dinamika va Statika-1', nameRu: 'Динамика и статика-1', slug: 'physics_db-ftp-02-001' },
    ]

    const topicQuestions = [
      ...Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        topicId: 101,
        questionUz: `Kinematika savoli ${i + 1}`,
        questionRu: `Кинематика вопрос ${i + 1}`,
        optionsUz: { F1: 'a', F2: 'b' },
        optionsRu: { F1: 'а', F2: 'б' },
        correctAnswer: 'F1',
      })),
      ...Array.from({ length: 30 }, (_, i) => ({
        id: 31 + i,
        topicId: 102,
        questionUz: `Dinamika savoli ${i + 1}`,
        questionRu: `Динамика вопрос ${i + 1}`,
        optionsUz: { F1: 'a', F2: 'b' },
        optionsRu: { F1: 'а', F2: 'б' },
        correctAnswer: 'F1',
      })),
    ] as never[]

    useQuestionsStore.setState({
      questions: topicQuestions,
      topics: mockTopics,
      loaded: true,
      loading: false,
    })

    render(<Biletlar />)

    // Biletlar sarlavhalari va mavzu nomlari chiqadi
    expect(screen.getByText('1 - bilet')).toBeInTheDocument()
    expect(screen.getByText('Kinematika-1')).toBeInTheDocument()
    expect(screen.getByText('2 - bilet')).toBeInTheDocument()
    expect(screen.getByText('Dinamika va Statika-1')).toBeInTheDocument()

    // Bo'lim filtrlari mavjud
    const kinFilter = screen.getByRole('button', { name: /^Kinematika\s+\(/i })
    const dinFilter = screen.getByRole('button', { name: /^Dinamika va Statika\s+\(/i })
    expect(kinFilter).toBeInTheDocument()
    expect(dinFilter).toBeInTheDocument()

    // Kinematika bo'limini tanlaganda faqat 1-bilet qolishi kerak
    fireEvent.click(kinFilter)
    expect(screen.getByText('1 - bilet')).toBeInTheDocument()
    expect(screen.getByText('Kinematika-1')).toBeInTheDocument()
    expect(screen.queryByText('Dinamika va Statika-1')).toBeNull()

    // Bilet bosilganda to'g'ri savol id'lari va title bilan navigatsiya bo'ladi
    fireEvent.click(screen.getByText('1 - bilet'))
    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const [path, opts] = mockNavigate.mock.calls[0]!
    expect(path).toBe('/test/1')
    expect(opts.state.title).toBe('1 - bilet (Kinematika-1)')
    expect(opts.state.questionIds).toHaveLength(30)
    expect(opts.state.questionIds[0]).toBe(1)
    expect(opts.state.questionIds[29]).toBe(30)
    expect(opts.state).toMatchObject({
      mode: 'ticket', serverSelector: { type: 'ticket', ticketNumber: 1 },
    })
  })

  it("ingliz tili: darajalar bo'yicha biletlar va filtrlash to'g'ri ishlaydi", () => {
    useSubjectStore.setState({ subjectId: 'ingliz' })

    const mockTopics = [
      { id: 201, nameUz: '[Pre-A1] Greetings', nameRu: '[Pre-A1] Greetings', slug: 'english_db-ing_kids_m1' },
      { id: 202, nameUz: '[A1] To be', nameRu: '[A1] To be', slug: 'english_db-ing_a1_m1' },
      { id: 203, nameUz: '[B1] Present Perfect', nameRu: '[B1] Present Perfect', slug: 'english_db-ing_b1_m1' },
    ] as never[]

    const topicQuestions = [
      { id: 1, topicId: 201, questionUz: 'Hi', questionRu: 'Hi', optionsUz: { A1: 'Hello' }, optionsRu: { A1: 'Hello' }, correctAnswer: 'A1' },
      { id: 2, topicId: 202, questionUz: 'I ___', questionRu: 'I ___', optionsUz: { A1: 'am' }, optionsRu: { A1: 'am' }, correctAnswer: 'A1' },
      { id: 3, topicId: 203, questionUz: 'She has ___', questionRu: 'She has ___', optionsUz: { A1: 'gone' }, optionsRu: { A1: 'gone' }, correctAnswer: 'A1' },
    ] as never[]

    useQuestionsStore.setState({
      questions: topicQuestions,
      topics: mockTopics,
      loaded: true,
      loading: false,
    })

    render(<Biletlar />)

    expect(screen.getByText('[Pre-A1] Greetings')).toBeInTheDocument()
    expect(screen.getByText('[A1] To be')).toBeInTheDocument()
    expect(screen.getByText('[B1] Present Perfect')).toBeInTheDocument()

    // Level filterlar
    const preA1Filter = screen.getByRole('button', { name: /^Pre-A1/i })
    const b1Filter = screen.getByRole('button', { name: /^B1/i })
    expect(preA1Filter).toBeInTheDocument()
    expect(b1Filter).toBeInTheDocument()

    // B1 ni tanlaganda faqat B1 bileti ko'rinadi
    fireEvent.click(b1Filter)
    expect(screen.getByText('[B1] Present Perfect')).toBeInTheDocument()
    expect(screen.queryByText('[Pre-A1] Greetings')).toBeNull()
  })

  it('biologiya: sinflar bo\'yicha biletlar va filtrlash to\'g\'ri ishlaydi', () => {
    useSubjectStore.setState({ subjectId: 'biologiya' })

    const mockTopics = [
      { id: 301, nameUz: '5-sinf Botanika kirish', nameRu: '5-класс', slug: 'biology_db-bio5_m1' },
      { id: 302, nameUz: '10-sinf Hujayra nazariyasi', nameRu: '10-класс', slug: 'biology_db-bio10_m1' },
    ] as never[]

    const topicQuestions = [
      { id: 10, topicId: 301, questionUz: 'Botanika nima?', questionRu: 'Что такое ботаника?', optionsUz: { A1: 'Osimlik' }, optionsRu: { A1: 'Растение' }, correctAnswer: 'A1' },
      { id: 11, topicId: 302, questionUz: 'Hujayra nima?', questionRu: 'Что такое клетка?', optionsUz: { A1: 'Birlik' }, optionsRu: { A1: 'Единица' }, correctAnswer: 'A1' },
    ] as never[]

    useQuestionsStore.setState({
      questions: topicQuestions,
      topics: mockTopics,
      loaded: true,
      loading: false,
    })

    render(<Biletlar />)

    expect(screen.getByText('5-sinf Botanika kirish')).toBeInTheDocument()
    expect(screen.getByText('10-sinf Hujayra nazariyasi')).toBeInTheDocument()

    // Sinf tab filtrlari
    const sinf5Filter = screen.getByRole('button', { name: /^5-sinf/i })
    const sinf10Filter = screen.getByRole('button', { name: /^10-sinf/i })
    expect(sinf5Filter).toBeInTheDocument()
    expect(sinf10Filter).toBeInTheDocument()

    // 10-sinf tanlanganda faqat 10-sinf bileti qoladi
    fireEvent.click(sinf10Filter)
    expect(screen.getByText('10-sinf Hujayra nazariyasi')).toBeInTheDocument()
    expect(screen.queryByText('5-sinf Botanika kirish')).toBeNull()
  })

  it('ona tili: tilshunoslik bo\'limlari bo\'yicha biletlar va filtrlash to\'g\'ri ishlaydi', () => {
    useSubjectStore.setState({ subjectId: 'onatili' })

    const mockTopics = [
      { id: 401, nameUz: 'Fonetika asoslari', nameRu: 'Фонетика', slug: 'onatili_db-onatili_fon_m01' },
      { id: 402, nameUz: 'Ot so\'z turkumi', nameRu: 'Существительное', slug: 'onatili_db-onatili_mor_m01' },
    ] as never[]

    const topicQuestions = [
      { id: 20, topicId: 401, questionUz: 'Tovush nima?', questionRu: 'Что такое звук?', optionsUz: { A1: 'A' }, optionsRu: { A1: 'А' }, correctAnswer: 'A1' },
      { id: 21, topicId: 402, questionUz: 'Ot nima?', questionRu: 'Что такое имя?', optionsUz: { A1: 'B' }, optionsRu: { A1: 'Б' }, correctAnswer: 'A1' },
    ] as never[]

    useQuestionsStore.setState({
      questions: topicQuestions,
      topics: mockTopics,
      loaded: true,
      loading: false,
    })

    render(<Biletlar />)

    expect(screen.getByText('Fonetika asoslari')).toBeInTheDocument()
    expect(screen.getByText('Ot so\'z turkumi')).toBeInTheDocument()

    const fonFilter = screen.getByRole('button', { name: /^Fonetika/i })
    const morFilter = screen.getByRole('button', { name: /^Morfologiya/i })
    expect(fonFilter).toBeInTheDocument()
    expect(morFilter).toBeInTheDocument()

    fireEvent.click(morFilter)
    expect(screen.getByText('Ot so\'z turkumi')).toBeInTheDocument()
    expect(screen.queryByText('Fonetika asoslari')).toBeNull()
  })
})
