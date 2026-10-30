import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ speak: vi.fn(), stop: vi.fn() }))
vi.mock('../../../src/shared/lib/speech', () => ({ speak: mocks.speak, stopSpeaking: mocks.stop }))
import { LessonMistakeFeedback } from '../../../src/features/test/components/LessonMistakeFeedback'

describe('lesson mistake feedback', () => {
  it('yordam matnini o‘qiydi va AI yoki davom etish amalini ishga tushiradi', () => {
    const onAsk = vi.fn()
    const onContinue = vi.fn()
    render(<LessonMistakeFeedback language="uz" onAsk={onAsk} onContinue={onContinue} />)
    fireEvent.click(screen.getByRole('button', { name: 'Yordamni tinglash' }))
    expect(mocks.speak).toHaveBeenCalledWith('Javob xato. Keling, birga tushunib olamiz.', 'uz')
    fireEvent.click(screen.getByRole('button', { name: 'AI yordam' }))
    expect(onAsk).toHaveBeenCalledOnce()
    expect(mocks.stop).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Davom etish' }))
    expect(onContinue).toHaveBeenCalledOnce()
  })
})
