import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { modules } from '../../../src/content/modules'
import { lessons } from '../../../src/content/lessons'
import { useAppStore } from '../../../src/shared/store/useAppStore'

const mocks = vi.hoisted(() => ({ speak: vi.fn(), stop: vi.fn(), tutorContext: vi.fn() }))
vi.mock('../../../src/shared/lib/speech', () => ({
  speak: mocks.speak, stopSpeaking: mocks.stop, subscribeSpeaking: () => () => {}, isSpeaking: () => false,
}))
vi.mock('../../../src/features/lessons/LessonToken', () => ({ PathMascot: () => <span>mascot</span> }))
vi.mock('../../../src/features/ai-tutor', () => ({
  SocraticChatSheet: ({ context, onClose }: { context: unknown; onClose: () => void }) => {
    mocks.tutorContext(context)
    return <div role="dialog"><button onClick={onClose}>Close tutor</button></div>
  },
}))

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

  it('matnni ovozli o‘qiydi va AI yordamchisiga dars kontekstini beradi', async () => {
    render(<LessonReader mod={modules[0]} lessonIdx={0} onClose={vi.fn()} onDone={vi.fn()} onPractice={vi.fn()} onPremium={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Matnni tinglash' }))
    expect(mocks.speak).toHaveBeenCalledWith(expect.stringContaining(lessons[1][0].bodyUz[0]), 'uz')
    fireEvent.click(screen.getByRole('button', { name: 'AI yordamchidan so‘rash' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(mocks.tutorContext).toHaveBeenCalledWith(expect.objectContaining({ subjectId: 'yhq', topicName: lessons[1][0].titleUz, questionText: expect.stringContaining(lessons[1][0].bodyUz[0]) }))
    fireEvent.click(screen.getByRole('button', { name: 'Close tutor' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
