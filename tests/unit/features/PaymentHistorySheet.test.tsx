/**
 * PaymentHistorySheet — Profil'dagi "To'lovlar tarixi" bottom sheet'i.
 * Holatlar: yuklanmoqda → ro'yxat / bo'sh holat / xato (+qayta urinish).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockGetHistory } = vi.hoisted(() => ({ mockGetHistory: vi.fn() }))
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return { ...actual, api: { ...actual.api, getPaymentHistory: mockGetHistory } }
})

import { PaymentHistorySheet } from '../../../src/features/profile/components/PaymentHistorySheet'
import { useAppStore } from '../../../src/shared/store/useAppStore'

const row = (over: Record<string, unknown> = {}) => ({
  orderId: 'ord_1',
  plan: 'month',
  amountUzs: 29_000,
  provider: 'click' as const,
  status: 'completed' as const,
  createdAt: '2026-08-20T12:00:00.000Z',
  ...over,
})

beforeEach(() => {
  mockGetHistory.mockReset()
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
})

describe('PaymentHistorySheet', () => {
  it('sarlavha va taglavha ko\'rsatiladi', async () => {
    mockGetHistory.mockResolvedValue({ ok: true, rows: [] })
    render(<PaymentHistorySheet onClose={() => {}} />)

    expect(screen.getByText("To'lovlar tarixi")).toBeInTheDocument()
    expect(screen.getByText("Barcha to'lovlaringiz ro'yxati")).toBeInTheDocument()
  })

  it("bo'sh holat — faqat sarlavha (desc o'chirilgan)", async () => {
    mockGetHistory.mockResolvedValue({ ok: true, rows: [] })
    render(<PaymentHistorySheet onClose={() => {}} />)

    expect(await screen.findByText("Hozircha to'lovlar mavjud emas")).toBeInTheDocument()
    expect(screen.queryByText("Siz hali birorta to'lov qilmagansiz")).toBeNull()
  })

  it('ro\'yxat: tarif nomi, provider, summa va holat chip\'i', async () => {
    mockGetHistory.mockResolvedValue({
      ok: true,
      rows: [
        row({ orderId: 'ord_2', plan: 'year', amountUzs: 79_000, provider: 'payme', status: 'pending' }),
        row(),
      ],
    })
    render(<PaymentHistorySheet onClose={() => {}} />)

    // 'month' tarifi — "Oylik · Click", 29 000 so'm, "To'langan"
    expect(await screen.findByText('29 000 so\'m')).toBeInTheDocument()
    expect(screen.getByText('79 000 so\'m')).toBeInTheDocument()
    // Oylik model (2026-08-29): month va year ikkalasi ham "Oylik" nomli
    expect(screen.getAllByText('Oylik')).toHaveLength(2)
    expect(screen.getByText('· Click')).toBeInTheDocument()
    expect(screen.getByText('· Payme')).toBeInTheDocument()
    expect(screen.getByText("To'langan")).toBeInTheDocument()
    expect(screen.getByText('Kutilmoqda')).toBeInTheDocument()
  })

  it('bekor qilingan/xatolik holatlari chip\'lari', async () => {
    mockGetHistory.mockResolvedValue({
      ok: true,
      rows: [
        row({ orderId: 'ord_c', status: 'cancelled' }),
        row({ orderId: 'ord_f', status: 'failed' }),
      ],
    })
    render(<PaymentHistorySheet onClose={() => {}} />)

    expect(await screen.findByText('Bekor qilingan')).toBeInTheDocument()
    expect(screen.getByText('Xatolik')).toBeInTheDocument()
  })

  it('xato holati — "Qayta urinish" API\'ni qayta chaqiradi', async () => {
    mockGetHistory
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, rows: [row()] })

    render(<PaymentHistorySheet onClose={() => {}} />)

    expect(await screen.findByText("To'lovlar yuklanmadi. Qaytadan urinib ko'ring.")).toBeInTheDocument()
    fireEvent.click(screen.getByText('Qayta urinish'))

    await waitFor(() => expect(mockGetHistory).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('29 000 so\'m')).toBeInTheDocument()
  })

  it('ru tilda tarif nomi ruschada', async () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'ru' } })
    mockGetHistory.mockResolvedValue({ ok: true, rows: [row()] })
    render(<PaymentHistorySheet onClose={() => {}} />)

    expect(await screen.findByText('Месяц')).toBeInTheDocument()
    expect(screen.getByText('29 000 сум')).toBeInTheDocument()
    expect(screen.getByText('Оплачено')).toBeInTheDocument()
  })
})
