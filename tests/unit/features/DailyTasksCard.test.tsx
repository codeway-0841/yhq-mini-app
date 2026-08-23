/**
 * Kunlik vazifalar kartasi — holatlar (jarayonda / bajarilgan / olingan),
 * claim oqimi va balansning SERVER javobidan yangilanishi.
 *
 * (Claim atomikligi va kunlik cheklov: tests/integration/api/coins.test.ts.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockGetTasks, mockClaim } = vi.hoisted(() => ({
  mockGetTasks: vi.fn(),
  mockClaim: vi.fn(),
}))
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return {
    ...actual,
    api: { ...actual.api, getCoinTasks: mockGetTasks, claimCoinTask: mockClaim },
  }
})

import DailyTasksCard from '../../../src/features/shop/DailyTasksCard'
import { ApiError } from '../../../src/shared/api'
import { useAppStore } from '../../../src/shared/store/useAppStore'

const task = (over: Partial<{
  id: string; progress: number; target: number; reward: number; completed: boolean; claimed: boolean
}> = {}) => ({
  id: 'answers-20', progress: 5, target: 20, reward: 10, completed: false, claimed: false, ...over,
})

beforeEach(() => {
  mockGetTasks.mockReset()
  mockClaim.mockReset()
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
})

describe('DailyTasksCard', () => {
  it('vazifa nomi, progressi va mukofotini ko\'rsatadi', async () => {
    mockGetTasks.mockResolvedValue({ tasks: [task()] })
    render(<DailyTasksCard />)

    expect(await screen.findByText('20 ta savolga javob ber')).toBeInTheDocument()
    expect(screen.getByText('5/20')).toBeInTheDocument()
    expect(screen.getByText('+10')).toBeInTheDocument()
  })

  it('bajarilmagan vazifada "Olish" tugmasi YO\'Q', async () => {
    mockGetTasks.mockResolvedValue({ tasks: [task()] })
    render(<DailyTasksCard />)

    await screen.findByText('20 ta savolga javob ber')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('bajarilgan vazifa claim qilinadi: balans server javobidan yangilanadi', async () => {
    mockGetTasks
      .mockResolvedValueOnce({ tasks: [task({ progress: 20, completed: true })] })
      .mockResolvedValue({ tasks: [task({ progress: 20, completed: true, claimed: true })] })
    mockClaim.mockResolvedValue({ balance: 260 })
    useAppStore.setState({ coins: 100 })

    const { container } = render(<DailyTasksCard />)
    const claimBtn = await screen.findByRole('button')
    fireEvent.click(claimBtn)

    await waitFor(() => expect(mockClaim).toHaveBeenCalledWith('answers-20'))
    await waitFor(() => expect(useAppStore.getState().coins).toBe(260))

    // Qator darhol "✓ Olindi" holatiga o'tadi (tugma o'rniga)
    expect(await screen.findByText('Olindi')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()

    // ~1.4s dan keyin holat serverdan qayta o'qiladi; olingan vazifa ro'yxatdan
    // chiqib ketadi (boshqa vazifa qolmagani uchun butun karta yo'qoladi)
    await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(2), { timeout: 4000 })
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('TASK_ALREADY_CLAIMED xatosi holatni qayta yuklaydi (balans o\'zgarmaydi)', async () => {
    mockGetTasks.mockResolvedValue({ tasks: [task({ progress: 20, completed: true })] })
    mockClaim.mockRejectedValue(new ApiError(409, 'claimed', 'TASK_ALREADY_CLAIMED'))
    useAppStore.setState({ coins: 100 })

    render(<DailyTasksCard />)
    fireEvent.click(await screen.findByRole('button'))

    await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(2))
    expect(useAppStore.getState().coins).toBe(100)
  })

  it('tangasi olingan vazifa ro\'yxatdan yashiriladi; hammasi olingan bo\'lsa karta chiqmaydi', async () => {
    mockGetTasks.mockResolvedValue({
      tasks: [
        task({ id: 'answers-20', progress: 20, completed: true, claimed: true }),
        task({ id: 'correct-15', progress: 15, target: 15, reward: 15, completed: true, claimed: true }),
        task({ id: 'fix-5', progress: 5, target: 5, reward: 10, completed: true, claimed: true }),
      ],
    })
    const { container } = render(<DailyTasksCard />)

    await waitFor(() => expect(mockGetTasks).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('server xatosi — karta jimgina yo\'qoladi (sahifa buzilmaydi)', async () => {
    mockGetTasks.mockRejectedValue(new Error('network'))
    const { container } = render(<DailyTasksCard />)

    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('noma\'lum id\'li vazifa (eski client) chizilmaydi', async () => {
    mockGetTasks.mockResolvedValue({ tasks: [task({ id: 'yoq-bunday-vazifa' })] })
    const { container } = render(<DailyTasksCard />)

    await waitFor(() => expect(mockGetTasks).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent).toBe(''))
  })
})
