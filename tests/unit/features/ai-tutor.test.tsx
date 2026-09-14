import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
import { CAMERA_AUTO_START_KEY } from '../../../src/shared/lib/camera-capture'
import { useAppStore } from '../../../src/shared/store/useAppStore'

const originalPermissions = Object.getOwnPropertyDescriptor(navigator, 'permissions')
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')

describe('AI Tutor Frontend Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, language: 'uz' },
      tariff: 'free',
    })
    localStorage.removeItem(CAMERA_AUTO_START_KEY)
  })

  afterEach(() => {
    if (originalPermissions) Object.defineProperty(navigator, 'permissions', originalPermissions)
    else delete (navigator as Navigator & { permissions?: Permissions }).permissions

    if (originalMediaDevices) Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices)
    else delete (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices
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

  it('requests camera permission only after an explicit user action', async () => {
    mockGetQuota.mockResolvedValue({ ok: false })
    const getUserMedia = vi.fn().mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError'),
    )
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state: 'prompt' }) },
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
    })

    render(
      <MemoryRouter>
        <SnapSolveHub />
      </MemoryRouter>,
    )

    const enableCamera = await screen.findByRole('button', { name: 'Kamerani yoqish' })
    expect(getUserMedia).not.toHaveBeenCalled()

    fireEvent.click(enableCamera)

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
    expect(await screen.findByText(/Kameraga ruxsat berilmagan/)).toBeInTheDocument()
  })

  it('auto-starts on WebViews that report prompt after a previous successful camera start', async () => {
    mockGetQuota.mockResolvedValue({ ok: false })
    localStorage.setItem(CAMERA_AUTO_START_KEY, '1')

    const stream = { getTracks: vi.fn(() => []) } as unknown as MediaStream
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state: 'prompt' }) },
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
    })

    render(
      <MemoryRouter>
        <SnapSolveHub />
      </MemoryRouter>,
    )

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Kamerani yoqish' })).not.toBeInTheDocument())
    expect(localStorage.getItem(CAMERA_AUTO_START_KEY)).toBe('1')

    play.mockRestore()
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
