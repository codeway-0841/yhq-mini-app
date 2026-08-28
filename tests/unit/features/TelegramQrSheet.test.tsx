/**
 * TelegramQrSheet — desktop Telegram login QR varianti:
 * URL'dan QR generate qiladi, 3 qadamli ko'rsatma + bot linki ko'rsatadi,
 * yopish onClose'ni chaqiradi.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import TelegramQrSheet from '../../../src/features/auth/components/TelegramQrSheet'
import { useAppStore } from '../../../src/shared/store/useAppStore'

const URL = 'https://t.me/test_bot?start=login_abc123'

beforeEach(() => {
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
})

describe('TelegramQrSheet', () => {
  it('sarlavha, 3 qadam va bot linkini ko\'rsatadi', () => {
    render(<TelegramQrSheet url={URL} onClose={vi.fn()} />)

    expect(screen.getByText('QR kod bilan kirish')).toBeTruthy()
    expect(screen.getByText('Telefoningizda kamerani oching')).toBeTruthy()
    expect(screen.getByText('QR kodni skanerlang — Telegram ochiladi')).toBeTruthy()
    expect(screen.getByText(/"Boshlash" tugmasini bosing/)).toBeTruthy()

    const link = screen.getByRole('link', { name: /Botni ochish/ }) as HTMLAnchorElement
    expect(link.href).toBe(URL)
    expect(link.target).toBe('_blank')
  })

  it('URL\'dan QR data-url generate qiladi', async () => {
    render(<TelegramQrSheet url={URL} onClose={vi.fn()} />)

    await waitFor(() => {
      const img = screen.getByRole('img', { name: 'QR kod bilan kirish' }) as HTMLImageElement
      expect(img.src.startsWith('data:image/')).toBe(true)
    })
  })

  it('yopish tugmasi onClose\'ni chaqiradi', () => {
    const onClose = vi.fn()
    render(<TelegramQrSheet url={URL} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('RU tilda tarjima qiladi', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'ru' } })
    render(<TelegramQrSheet url={URL} onClose={vi.fn()} />)

    expect(screen.getByText('Вход по QR-коду')).toBeTruthy()
    expect(screen.getByText('Откройте камеру на телефоне')).toBeTruthy()
  })
})
