/**
 * Mavzular (Darslik) sahifasi — dars qulflash qoidasi (oldingisi tugamaguncha
 * keyingisi ochilmaydi), curated mapping'siz darslarning yashirilishi va
 * dars ochilganda testga uzatiladigan savol id'lari.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import TopicsPage from '../../../src/features/topics/TopicsPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { modules } from '../../../src/content/modules'
import lessonMap from '../../../src/content/lessonMap.yhq.json'
import { questionKey } from '../../../shared/subjects'

const MAP = lessonMap as Record<string, number[]>
/** Kamida 3 savoli bor (ya'ni ko'rinadigan) birinchi dars */
const firstVisible = Object.entries(MAP).find(([, ids]) => ids.length >= 3)!
const [firstModId, firstLessonIdx] = firstVisible[0].split(':').map(Number) as [number, number]

const UID = '12345'

beforeEach(() => {
  mockNavigate.mockReset()
  useSubjectStore.setState({ subjectId: 'yhq' })
  useLessonsStore.setState({ byUser: {} })
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    user: { id: UID, firstName: 'Ali' } as never,
    wrongByTicket: {},
  })
})

describe('TopicsPage', () => {
  it('modullar ro\'yxati chiziladi', () => {
    render(<TopicsPage />)

    const visibleMods = modules.filter((m) =>
      Object.keys(MAP).some((k) => k.startsWith(`${m.id}:`) && MAP[k]!.length >= 3))
    expect(visibleMods.length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(visibleMods.length)
  })

  it('birinchi dars ochiq, keyingisi QULFLANGAN (oldingisi tugamagan)', () => {
    render(<TopicsPage />)

    const lessons = screen.getAllByRole('button').filter((b) => /-dars\./.test(b.textContent ?? ''))
    expect(lessons.length).toBeGreaterThan(1)
    expect(lessons[0]).not.toBeDisabled()
    expect(lessons[1]).toBeDisabled()
  })

  it('oldingi dars tugagach keyingisi ochiladi', () => {
    useLessonsStore.setState({ byUser: { [UID]: { [firstModId]: [firstLessonIdx] } } })
    render(<TopicsPage />)

    const lessons = screen.getAllByRole('button').filter((b) => /-dars\./.test(b.textContent ?? ''))
    expect(lessons[1]).not.toBeDisabled()
  })

  it('dars bosilganda curated savol id\'lari bilan test ochiladi', () => {
    render(<TopicsPage />)

    const firstLesson = screen.getAllByRole('button').find((b) => /-dars\./.test(b.textContent ?? ''))!
    fireEvent.click(firstLesson)

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const [path, opts] = mockNavigate.mock.calls[0]!
    expect(path).toBe('/test/1')
    expect(opts.state.questionIds.length).toBeGreaterThanOrEqual(3)
    expect(opts.state.title).toMatch(/-dars:/)
  })

  it('qulflangan dars bosilsa hech qayerga o\'tmaydi', () => {
    render(<TopicsPage />)

    const locked = screen.getAllByRole('button')
      .filter((b) => /-dars\./.test(b.textContent ?? ''))
      .find((b) => (b as HTMLButtonElement).disabled)!
    fireEvent.click(locked)

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('joriy fanda xato bo\'lsa "Xatolarni tuzatish" banneri chiqadi va /xatolar ochadi', () => {
    useAppStore.setState({
      wrongByTicket: { [questionKey('yhq', 1)]: 2, [questionKey('fizika', 9)]: 5 },
    })
    render(<TopicsPage />)

    // Faqat joriy fan (yhq) xatolari sanaladi — 1 ta
    expect(screen.getByText('1')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Xatolar/i))
    expect(mockNavigate).toHaveBeenCalledWith('/xatolar')
  })

  it('xato yo\'q bo\'lsa banner ko\'rsatilmaydi', () => {
    render(<TopicsPage />)
    expect(screen.queryByText(/Xatolarni tuzatish/i)).toBeNull()
  })
})
