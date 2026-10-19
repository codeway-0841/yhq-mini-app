import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhoneEditSheet, PhotoEditSheet, NameEditSheet } from '../../../src/features/profile/components/EditSheets'

describe('EditSheets (ModalShell migratsiyasi)', () => {
  it('PhoneEditSheet mavjud raqam bo\'lganda confirm bosqichida ModalShell render qiladi', () => {
    const onClose = vi.fn()
    const onTelegram = vi.fn()
    const onSms = vi.fn()

    render(
      <PhoneEditSheet
        currentPhone="+998901234567"
        busy={false}
        onClose={onClose}
        onTelegram={onTelegram}
        onSms={onSms}
      />
    )

    // ModalShell va uning elementlari
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('+998 90 123 45 67')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yopish' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bekor qilish' })).toBeInTheDocument()

    // Davom etish bosilganda method bosqichiga o'tadi
    fireEvent.click(screen.getByRole('button', { name: "Davom etish" }))
    expect(screen.getByRole('button', { name: /Telegram/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /SMS/i })).toBeInTheDocument()
  })

  it('PhoneEditSheet SMS bosqichida raqam kiritish va yuborish imkonini beradi', () => {
    const onClose = vi.fn()
    const onTelegram = vi.fn()
    const onSms = vi.fn()

    render(
      <PhoneEditSheet
        currentPhone={null}
        busy={false}
        onClose={onClose}
        onTelegram={onTelegram}
        onSms={onSms}
      />
    )

    // Yangi raqam qo'shishda to'g'ridan-to'g'ri method bosqichi chiqadi
    fireEvent.click(screen.getByRole('button', { name: /SMS/i }))

    // SMS kiritish ekrani
    const input = screen.getByPlaceholderText('90 123 45 67')
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '901234567' } })
    const submitBtn = screen.getByRole('button', { name: /Kod yuborish/i })
    expect(submitBtn).not.toBeDisabled()

    fireEvent.click(submitBtn)
    expect(onSms).toHaveBeenCalledWith('+998901234567')
  })

  it('PhotoEditSheet va NameEditSheet ham ModalShell bilan render bo\'ladi', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <PhotoEditSheet
        hasCustom={true}
        busy={false}
        onClose={onClose}
        onPick={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    unmount()

    render(
      <NameEditSheet
        current="Ali"
        onClose={onClose}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ali')).toBeInTheDocument()
  })
})
