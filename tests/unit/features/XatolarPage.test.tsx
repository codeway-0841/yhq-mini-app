/**
 * Xatolarim sahifasi — yechilmagan xatolarni joriy FAN ichida filtrlash,
 * premium bo'limlarining gating'i va mashq oqimiga uzatiladigan savol id'lari.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import XatolarPage from '../../../src/features/mistakes/XatolarPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { questionKey } from '../../../shared/subjects'

const q = (id: number, topicId: number) => ({
  id, topicId, text: `Savol ${id}`,
  questionUz: `Savol ${id}`, questionRu: `Вопрос ${id}`,
  optionsUz: { F1: 'a' }, optionsRu: { F1: 'а' }, correctAnswer: 'F1',
})

const questions = [q(1, 10), q(2, 10), q(3, 20), q(4, 20)] as never[]
const topics = [
  { id: 10, nameUz: 'Belgilar', nameRu: 'Знаки' },
  { id: 20, nameUz: 'Yo\'l chizig\'i', nameRu: 'Разметка' },
] as never[]

/** '<fan>:<id>' kalitlari bilan xato hisoblagichini o'rnatadi */
function setWrong(map: Record<number, number>, subjectId = 'yhq') {
  useAppStore.setState({
    wrongByTicket: Object.fromEntries(
      Object.entries(map).map(([id, n]) => [questionKey(subjectId, Number(id)), n]),
    ),
  })
}

beforeEach(() => {
  mockNavigate.mockReset()
  useSubjectStore.setState({ subjectId: 'yhq' })
  useQuestionsStore.setState({ questions, topics, loaded: true, loading: false })
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    wrongByTicket: {},
    tariff: 'free',
  })
})

describe('XatolarPage', () => {
  it('xato yo\'q bo\'lsa bo\'sh holat ko\'rsatiladi', () => {
    render(<XatolarPage />)

    expect(screen.getByText("Xatolar yo'q")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mashq/i })).toBeNull()
  })

  it('yechilmagan xatolar sonini ko\'rsatadi', () => {
    setWrong({ 1: 2, 3: 1 })
    render(<XatolarPage />)

    expect(screen.getByText('2')).toBeInTheDocument()   // 2 ta yechilmagan savol
  })

  it('BOSHQA fandagi xatolar hisobga olinmaydi', () => {
    setWrong({ 1: 3 }, 'fizika')   // joriy fan — yhq
    render(<XatolarPage />)

    expect(screen.queryByText(/Barchasini mashq|mashq qilish/i)).toBeNull()
  })

  it('"Barchasini mashq qilish" barcha xato savol id\'lari bilan testni ochadi', () => {
    setWrong({ 1: 1, 2: 1, 3: 5 })
    render(<XatolarPage />)

    fireEvent.click(screen.getByText(/Barchasini mashq|mashq qilish/i))

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const [path, opts] = mockNavigate.mock.calls[0]!
    expect(path).toBe('/test/1')
    expect([...opts.state.questionIds].sort()).toEqual([1, 2, 3])
  })

  it('free foydalanuvchiga mavzular kesimi va Top-10 KO\'RSATILMAYDI (premium banner o\'rniga)', () => {
    setWrong({ 1: 1, 3: 2 })
    render(<XatolarPage />)

    expect(screen.getByText('⭐250')).toBeInTheDocument()
    expect(screen.queryByText('Belgilar')).toBeNull()
  })

  it('premium foydalanuvchida mavzular kesimi ko\'proq xatolisi bilan tepada', () => {
    useAppStore.setState({ tariff: 'premium' })
    setWrong({ 3: 1, 4: 1, 1: 1 })   // 20-mavzuda 2 ta, 10-mavzuda 1 ta
    render(<XatolarPage />)

    const topicNames = screen.getAllByText(/Belgilar|Yo'l chizig/)
    expect(topicNames[0]!.textContent).toContain("Yo'l chizig")   // ko'proq xato — tepada
    expect(screen.queryByText('⭐250')).toBeNull()               // premium banner yo'q
  })

  it('premium: mavzu bosilganda faqat o\'sha mavzu savollari mashqqa ketadi', () => {
    useAppStore.setState({ tariff: 'premium' })
    setWrong({ 1: 1, 2: 1, 3: 1 })
    render(<XatolarPage />)

    fireEvent.click(screen.getByText('Belgilar'))

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const [, opts] = mockNavigate.mock.calls[0]!
    expect([...opts.state.questionIds].sort()).toEqual([1, 2])   // 10-mavzu savollari
  })
})
