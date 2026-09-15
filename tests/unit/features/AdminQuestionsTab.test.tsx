/**
 * AdminQuestionsTab v2 — kalitsiz paginated ro'yxat + audit'li detail.
 * Ro'yxatda correctAnswer HECH QACHON ko'rinmaydi; tahrirlash detail fetch qiladi.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockGetPage, mockGetDetail, mockMeta, mockTopics } = vi.hoisted(() => ({
  mockGetPage: vi.fn(),
  mockGetDetail: vi.fn(),
  mockMeta: vi.fn(),
  mockTopics: vi.fn(),
}))
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      getAdminQuestions: mockGetPage,
      getAdminQuestion: mockGetDetail,
      getQuestionsMeta: mockMeta,
      getAdminTopics: mockTopics,
    },
  }
})

import AdminQuestionsTab from '../../../src/features/admin/components/AdminQuestionsTab'

const rows = [
  { id: 1, questionUz: 'Birinchi savol matni', questionRu: 'Первый вопрос', image: null, topicId: 9 },
  { id: 2, questionUz: 'Ikkinchi savol matni', questionRu: 'Второй вопрос', image: null, topicId: null },
]

beforeEach(() => {
  vi.restoreAllMocks()
  mockGetPage.mockResolvedValue({ rows, total: 2, limit: 50, offset: 0 })
  mockMeta.mockResolvedValue({ total: 2, withTopic: 1 })
  mockTopics.mockResolvedValue([])
  mockGetDetail.mockResolvedValue({ ...rows[0], optionsUz: { F1: 'a' }, optionsRu: { F1: 'а' }, correctAnswer: 'F1' })
})

describe('AdminQuestionsTab v2', () => {
  it('kalitsiz ro\'yxat chizadi — javob kaliti DOMda yo\'q', async () => {
    render(<AdminQuestionsTab lang="uz" />)

    expect(await screen.findByText('Birinchi savol matni')).toBeTruthy()
    expect(mockGetPage).toHaveBeenCalledWith('yhq', { limit: 50, offset: 0, search: undefined })
    // Ro'yxat satrida kalit ko'rinmaydi
    expect(screen.queryByText(/To'g'ri javob/)).toBeNull()
    expect(screen.getAllByText(/Javob kaliti ro'yxatda yashirin/)).toHaveLength(2)
  })

  it('tahrirlash audit\'li detail fetch qiladi', async () => {
    render(<AdminQuestionsTab lang="uz" />)
    await screen.findByText('Birinchi savol matni')

    fireEvent.click(screen.getAllByTitle('Tahrirlash')[0])

    expect(mockGetDetail).toHaveBeenCalledWith(1, 'yhq')
    expect(await screen.findByText('Tahrirlash #1')).toBeTruthy()
  })

  it('ko\'p sahifada paginatsiya ko\'rinadi va offset bilan tortadi', async () => {
    mockGetPage.mockResolvedValue({ rows, total: 120, limit: 50, offset: 0 })
    render(<AdminQuestionsTab lang="uz" />)
    await screen.findByText('Birinchi savol matni')

    expect(screen.getByText(/1 \/ 3/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keyingi sahifa' }))
    expect(mockGetPage).toHaveBeenLastCalledWith('yhq', { limit: 50, offset: 50, search: undefined })
  })
})
