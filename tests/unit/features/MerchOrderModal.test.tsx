/**
 * Merch buyurtma modali — forma validatsiyasi va xato kodlarining
 * foydalanuvchiga ko'rinadigan matnga o'girilishi.
 *
 * (Server tomondagi debit/refund/idempotency: tests/integration/api/coins.test.ts.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockBuyMerch } = vi.hoisted(() => ({ mockBuyMerch: vi.fn() }))
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return { ...actual, api: { ...actual.api, buyMerch: mockBuyMerch } }
})

import MerchOrderModal from '../../../src/features/shop/MerchOrderModal'
import { ApiError } from '../../../src/shared/api'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { MERCH_ITEMS } from '../../../shared/merch-items'

const item = MERCH_ITEMS[0]!

function setUser(user: Record<string, unknown> | null) {
  useAppStore.setState({ user: user as never })
}

function renderModal(onOrdered = vi.fn(), onClose = vi.fn()) {
  render(<MerchOrderModal item={item} onClose={onClose} onOrdered={onOrdered} />)
  return { onOrdered, onClose }
}

const nameInput  = () => screen.getAllByRole('textbox')[0] as HTMLInputElement
const phoneInput = () => screen.getAllByRole('textbox')[1] as HTMLInputElement
const noteInput  = () => screen.getAllByRole('textbox')[2] as HTMLInputElement
const submitBtn  = () => screen.getAllByRole('button').at(-1)!

beforeEach(() => {
  mockBuyMerch.mockReset()
  mockBuyMerch.mockResolvedValue({ orderId: 7, balance: 120 })
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
  setUser({ id: '1', firstName: 'Ali', lastName: 'Valiyev', phone: '+998901234567' })
})

describe('MerchOrderModal', () => {
  it('ism va telefonni profil ma\'lumotidan oldindan to\'ldiradi', () => {
    renderModal()

    expect(nameInput().value).toBe('Ali Valiyev')
    expect(phoneInput().value).toBe('+998901234567')
  })

  it('telefon yo\'q bo\'lsa +998 dan boshlanadi', () => {
    setUser({ id: '1', firstName: 'Ali' })
    renderModal()

    expect(nameInput().value).toBe('Ali')
    expect(phoneInput().value).toBe('+998')
  })

  it('juda qisqa ism → xato ko\'rsatiladi, buyurtma YUBORILMAYDI', async () => {
    renderModal()
    fireEvent.change(nameInput(), { target: { value: 'A' } })
    fireEvent.click(submitBtn())

    await screen.findByText(/Ism kamida 2 ta harfdan/i)
    expect(mockBuyMerch).not.toHaveBeenCalled()
  })

  it('noto\'g\'ri telefon → xato ko\'rsatiladi, buyurtma YUBORILMAYDI', async () => {
    renderModal()
    fireEvent.change(phoneInput(), { target: { value: '123' } })
    fireEvent.click(submitBtn())

    await waitFor(() => expect(mockBuyMerch).not.toHaveBeenCalled())
    expect(screen.getByText(/Telefon raqam noto/i)).toBeInTheDocument()
  })

  it('to\'g\'ri forma: qiymatlar trim qilinib yuboriladi, onOrdered chaqiriladi', async () => {
    const { onOrdered } = renderModal()
    fireEvent.change(nameInput(),  { target: { value: '  Ali Valiyev  ' } })
    // Raqam ichidagi bo'shliqlar ruxsat etiladi (formatlangan ko'rinish)
    fireEvent.change(phoneInput(), { target: { value: '+998 90 123 45 67' } })
    fireEvent.change(noteInput(),  { target: { value: '  M o\'lcham  ' } })
    fireEvent.click(submitBtn())

    await waitFor(() => expect(mockBuyMerch).toHaveBeenCalledTimes(1))
    const arg = mockBuyMerch.mock.calls[0]![0]
    expect(arg).toMatchObject({
      itemId: item.id,
      fullName: 'Ali Valiyev',
      phone: '+998 90 123 45 67',
      note: "M o'lcham",
    })
    expect(typeof arg.purchaseId).toBe('string')   // idempotency kaliti
    await waitFor(() => expect(onOrdered).toHaveBeenCalledWith(7, 120))
  })

  it('bo\'sh izoh null bo\'lib ketadi', async () => {
    renderModal()
    fireEvent.change(noteInput(), { target: { value: '   ' } })
    fireEvent.click(submitBtn())

    await waitFor(() => expect(mockBuyMerch).toHaveBeenCalledTimes(1))
    expect(mockBuyMerch.mock.calls[0]![0].note).toBeNull()
  })

  it('COINS_INSUFFICIENT xato kodi tanga yetishmasligi matniga o\'giriladi', async () => {
    mockBuyMerch.mockRejectedValueOnce(new ApiError(409, 'no coins', 'COINS_INSUFFICIENT'))
    const { onOrdered } = renderModal()
    fireEvent.click(submitBtn())

    await screen.findByText(/Tangalar yetarli emas/i)
    expect(onOrdered).not.toHaveBeenCalled()
  })

  it('MERCH_SOLD_OUT va MERCH_ALREADY_OWNED alohida matn beradi', async () => {
    mockBuyMerch.mockRejectedValueOnce(new ApiError(409, 'sold out', 'MERCH_SOLD_OUT'))
    const { unmount } = render(
      <MerchOrderModal item={item} onClose={vi.fn()} onOrdered={vi.fn()} />,
    )
    fireEvent.click(screen.getAllByRole('button').at(-1)!)
    const soldOut = await screen.findByText(/Tugagan/i)
    expect(soldOut).toBeInTheDocument()
    unmount()

    mockBuyMerch.mockRejectedValueOnce(new ApiError(409, 'owned', 'MERCH_ALREADY_OWNED'))
    render(<MerchOrderModal item={item} onClose={vi.fn()} onOrdered={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('button').at(-1)!)
    await screen.findByText(/Buyurtma qilingan/i)
  })

  it('yuborish davomida tugmalar bloklanadi (ikki marta yuborilmaydi)', async () => {
    mockBuyMerch.mockImplementation(() => new Promise(() => {}))   // hech qachon tugamaydi
    renderModal()
    fireEvent.click(submitBtn())

    await waitFor(() => expect(submitBtn()).toBeDisabled())
    fireEvent.click(submitBtn())
    expect(mockBuyMerch).toHaveBeenCalledTimes(1)
  })
})
