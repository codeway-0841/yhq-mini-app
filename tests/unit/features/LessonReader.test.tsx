import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { modules } from '../../../src/content/modules'
import { lessons } from '../../../src/content/lessons'
import { useAppStore } from '../../../src/shared/store/useAppStore'

const mocks = vi.hoisted(() => ({ speak: vi.fn(), stop: vi.fn() }))
vi.mock('../../../src/shared/lib/speech', () => ({
  speak: mocks.speak, stopSpeaking: mocks.stop, subscribeSpeaking: () => () => {}, isSpeaking: () => false,
}))
vi.mock('../../../src/features/lessons/LessonToken', () => ({ PathMascot: () => <span>mascot</span> }))

import LessonReader from '../../../src/features/lessons/LessonReader'

beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({ tariff: 'premium', settings: { ...useAppStore.getState().settings, language: 'uz' } })
})

describe('YHQ lesson reader', () => {
  it('darsni bosqichma-bosqich ochadi, orqaga qaytadi va faqat oxirida belgilaydi', () => {
    const onDone = vi.fn()
    render(<LessonReader mod={modules[0]} lessonIdx={0} onClose={vi.fn()} onDone={onDone} onPractice={vi.fn()} onPremium={vi.fn()} />)
    const progress = screen.getByRole('progressbar', { name: 'Dars bosqichi' })
    expect(progress).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByText(lessons[1][0].bodyUz[0])).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Davom etish' }))
    expect(progress).toHaveAttribute('aria-valuenow', '2')
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Orqaga' }))
    expect(progress).toHaveAttribute('aria-valuenow', '1')
    for (let i = 0; i < lessons[1][0].bodyUz.length; i++) fireEvent.click(screen.getByRole('button', { name: 'Davom etish' }))
    expect(screen.getByRole('button', { name: /Mavzu bo'yicha mashq/ })).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: "O'qib bo'ldim — keyingi" }))
    expect(onDone).toHaveBeenCalledOnce()
    expect(onDone).toHaveBeenCalledWith(0)
    expect(screen.getByRole('heading', { name: `2-dars. ${lessons[1][1].titleUz}` })).toBeInTheDocument()
  })

  it('matnni ovozli o‘qiydi', () => {
    render(<LessonReader mod={modules[0]} lessonIdx={0} onClose={vi.fn()} onDone={vi.fn()} onPractice={vi.fn()} onPremium={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Matnni tinglash' }))
    expect(mocks.speak).toHaveBeenCalledWith(expect.stringContaining(lessons[1][0].bodyUz[0]), 'uz')
    expect(screen.queryByRole('button', { name: 'AI yordamchidan so‘rash' })).not.toBeInTheDocument()
  })

  it('dars o‘rtasida chiqish bosilganda Brilliant tasdiqlash oynasini ko‘rsatadi', () => {
    const onClose = vi.fn()
    render(<LessonReader mod={modules[0]} lessonIdx={0} onClose={onClose} onDone={vi.fn()} onPractice={vi.fn()} onPremium={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Davom etish' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Ishonchingiz komilmi?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Chiqish' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
