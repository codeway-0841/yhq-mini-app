import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ speak: vi.fn(), stop: vi.fn() }))
vi.mock('../../../src/shared/lib/speech', () => ({ speak: mocks.speak, stopSpeaking: mocks.stop }))
import { LessonMistakeFeedback } from '../../../src/features/test/components/LessonMistakeFeedback'

describe('lesson mistake feedback', () => {
  it('yordam matnini o‘qiydi va davom etish amalini ishga tushiradi', () => {
    const onContinue = vi.fn()
    render(<LessonMistakeFeedback language="uz" onContinue={onContinue} />)
    fireEvent.click(screen.getByRole('button', { name: 'Yordamni tinglash' }))
    expect(mocks.speak).toHaveBeenCalledWith('Javob xato. Keling, birga tushunib olamiz.', 'uz')
    expect(screen.queryByRole('button', { name: 'AI yordam' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Davom etish' }))
    expect(onContinue).toHaveBeenCalledOnce()
    expect(mocks.stop).toHaveBeenCalled()
  })
})
