/**
 * Premium sahifasi — 3 kunlik trial oqimi (server 1 martagina beradi),
 * tarif rejalari ro'yxati va premium foydalanuvchi uchun holat ko'rinishi.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockStartTrial, mockNavigate } = vi.hoisted(() => ({
  mockStartTrial: vi.fn(),
  mockNavigate: vi.fn(),
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return { ...actual, api: { ...actual.api, startTrial: mockStartTrial } }
})

import PremiumPage from '../../../src/features/premium/PremiumPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { PREMIUM_PLANS } from '../../../shared/premium-plans'

const syncFromServer = vi.fn()

beforeEach(() => {
  mockStartTrial.mockReset().mockResolvedValue({ granted: true })
  syncFromServer.mockReset().mockResolvedValue(undefined)
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    user: { id: '12345', firstName: 'Ali' } as never,
    tariff: 'free',
    syncFromServer: syncFromServer as never,
  })
})

const trialBtn = () => screen.getByText(/3 kun Premium/)

describe('PremiumPage', () => {
  it('barcha tarif rejalarini ko\'rsatadi', () => {
    render(<PremiumPage />)

    for (const plan of PREMIUM_PLANS) {
      expect(screen.getByText(plan.titleUz)).toBeInTheDocument()
    }
    expect(screen.getByText(/Eng mashhur/)).toBeInTheDocument()
  })

  it('trial berilsa: tasdiq bloki chiqadi va server holati qayta o\'qiladi', async () => {
    render(<PremiumPage />)
    fireEvent.click(trialBtn())

    await waitFor(() => expect(mockStartTrial).toHaveBeenCalledWith('12345'))
    await waitFor(() => expect(syncFromServer).toHaveBeenCalledWith('12345'))
    expect(await screen.findByText(/Sinov muddati faollashdi/)).toBeInTheDocument()
    // Trial tugmasi endi ko'rinmaydi
    expect(screen.queryByText(/3 kun Premium/)).toBeNull()
  })

  it('trial avval ishlatilgan bo\'lsa — xato matni, holat sinxronlanmaydi', async () => {
    mockStartTrial.mockResolvedValue({ granted: false })
    render(<PremiumPage />)
    fireEvent.click(trialBtn())

    expect(await screen.findByText(/allaqachon ishlatilgan/)).toBeInTheDocument()
    expect(syncFromServer).not.toHaveBeenCalled()
    expect(screen.queryByText(/Sinov muddati faollashdi/)).toBeNull()
  })

  it('server xatosi — umumiy xato matni ko\'rsatiladi', async () => {
    mockStartTrial.mockRejectedValue(new Error('500'))
    render(<PremiumPage />)
    fireEvent.click(trialBtn())

    expect(await screen.findByText(/Xatolik/)).toBeInTheDocument()
  })

  it('premium foydalanuvchiga trial ham, tariflar ham ko\'rsatilmaydi', () => {
    useAppStore.setState({ tariff: 'premium' })
    render(<PremiumPage />)

    expect(screen.getByText(/Obuna faol/)).toBeInTheDocument()
    expect(screen.queryByText(/3 kun Premium/)).toBeNull()
    expect(screen.queryByText(PREMIUM_PLANS[0]!.titleUz)).toBeNull()
  })

  it('premium muddati bor bo\'lsa qolgan kunlarni ko\'rsatadi', () => {
    useAppStore.setState({
      tariff: 'premium',
      user: {
        id: '12345', firstName: 'Ali',
        premiumUntil: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      } as never,
    })
    render(<PremiumPage />)

    expect(screen.getByText(/3 kun qoldi/)).toBeInTheDocument()
  })

  it('muddatsiz premium — "Obuna faol · umrbod" holat qatori', () => {
    useAppStore.setState({ tariff: 'premium', user: { id: '12345', firstName: 'Ali' } as never })
    render(<PremiumPage />)

    expect(screen.getByText(/Obuna faol/)).toBeInTheDocument()
    expect(screen.getByText(/umrbod/)).toBeInTheDocument()
  })
})
