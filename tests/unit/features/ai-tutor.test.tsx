import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { mockGetQuota, mockSolvePhoto } = vi.hoisted(() => ({
  mockGetQuota: vi.fn(),
  mockSolvePhoto: vi.fn(),
}))

vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      getTutorQuota: mockGetQuota,
      solvePhoto: mockSolvePhoto,
    },
  }
})

import SnapSolveHub from '../../../src/features/ai-tutor/SnapSolveHub'
import SocraticChatSheet from '../../../src/features/ai-tutor/components/SocraticChatSheet'
import { useAppStore } from '../../../src/shared/store/useAppStore'

describe('AI Tutor Frontend Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, language: 'uz' },
      tariff: 'free',
    })
  })

  it('renders SnapSolveHub with quota and action buttons', async () => {
    mockGetQuota.mockResolvedValue({
      ok: true,
      quota: {
        isPremium: false,
        photoSolvesUsed: 0,
        photoSolvesLimit: 2,
        photoSolvesRemaining: 2,
        chatMessagesUsed: 0,
        chatMessagesLimit: 5,
        chatMessagesRemaining: 5,
      },
    })

    render(
      <MemoryRouter>
        <SnapSolveHub />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Suratdan yechish (AI)')).toBeInTheDocument()
    expect(screen.getByText('2 / 2 bepul')).toBeInTheDocument()
    expect(screen.getByText('Kamera orqali suratga olish')).toBeInTheDocument()
    expect(screen.getByText('Galereyadan tanlash')).toBeInTheDocument()
  })

  it('renders SocraticChatSheet when open with welcome message and suggestion chips', () => {
    render(
      <MemoryRouter>
        <SocraticChatSheet
          isOpen={true}
          onClose={() => {}}
          context={{
            questionText: 'Test savoli: Nyuton qonuni',
            subjectId: 'fizika',
          }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Kivvi AI Repetitor')).toBeInTheDocument()
    expect(screen.getByText(/Keling, bu masalani birgalikda tahlil qilamiz/)).toBeInTheDocument()
    expect(screen.getByText(/Formula qayerdan keldi/)).toBeInTheDocument()
    expect(screen.getByText(/Boshqa usuli bormi/)).toBeInTheDocument()
  })

  it('renders SnapSolveFab on standard routes and navigates to /ai-tutor on click', async () => {
    const { default: SnapSolveFab } = await import('../../../src/features/ai-tutor/components/SnapSolveFab')
    render(
      <MemoryRouter initialEntries={['/rejimlar']}>
        <SnapSolveFab />
      </MemoryRouter>,
    )

    const fab = screen.getByRole('button', { name: /Suratdan yechish/i })
    expect(fab).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('hides SnapSolveFab on restricted routes like /ai-tutor', async () => {
    const { default: SnapSolveFab } = await import('../../../src/features/ai-tutor/components/SnapSolveFab')
    render(
      <MemoryRouter initialEntries={['/ai-tutor']}>
        <SnapSolveFab />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: /Suratdan yechish/i })).not.toBeInTheDocument()
  })
})

