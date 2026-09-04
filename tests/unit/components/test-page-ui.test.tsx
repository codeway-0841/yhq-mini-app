import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TestPage from '../../../src/features/test/TestPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useTestSessionStore } from '../../../src/shared/store/useTestSessionStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { api } from '../../../src/shared/api'

vi.mock('../../../src/features/test/components/TestModals', () => ({
  default: ({ showResults, results }: { showResults: boolean; results: unknown }) =>
    showResults ? <output data-testid="results">{JSON.stringify(results)}</output> : null,
}))

const questions = [1, 2, 3].map((id) => ({
  id, text: `Savol ${id}`, image: null, topicId: 999,
  options: [{ id: 'a', text: 'Birinchi variant' }, { id: 'b', text: 'Ikkinchi variant' }],
}))

function page() {
  return render(<MemoryRouter initialEntries={[{ pathname: '/test/1', state: { questionIds: [1, 2, 3] } }]}>
    <Routes><Route path="/test/:id" element={<TestPage />} /></Routes>
  </MemoryRouter>)
}

beforeEach(() => {
  vi.restoreAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
  vi.spyOn(api, 'startKeepAlive').mockReturnValue(() => {})
  vi.spyOn(api, 'getExplanation').mockResolvedValue({ text: 'Sinov uchun tushuntirish.' })
  useSubjectStore.getState().setSubject('yhq')
  useQuestionsStore.setState({ questions, topics: [], loaded: true, loading: false, error: null, subjectId: 'yhq' })
  useTestSessionStore.getState().clear()
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz', autoNextCorrect: false, autoNextWrong: false, shuffleOptions: false },
    savedQuestions: [],
    submitAnswer: vi.fn().mockResolvedValue({ correct: true, correctAnswer: 'a', duplicate: false }),
  })
})

describe('test solving controls', () => {
  it('toggles speech, resets on natural completion and cancels on question change/unmount', () => {
    class Utterance { onend: (() => void) | null = null; onerror: (() => void) | null = null }
    const synth = { getVoices: () => [], speak: vi.fn(), cancel: vi.fn() }
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
    const view = page()
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Savolni o‘qib berish' }))
      expect(screen.getByRole('button', { name: 'Ovozni to‘xtatish' })).toHaveAttribute('aria-pressed', 'true')
      const first = synth.speak.mock.lastCall![0] as Utterance
      fireEvent.click(screen.getByRole('button', { name: 'Ovozni to‘xtatish' }))
      expect(synth.speak).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Savolni o‘qib berish' })).toHaveAttribute('aria-pressed', 'false')
      fireEvent.click(screen.getByRole('button', { name: 'Savolni o‘qib berish' }))
      act(() => first.onend!())
      expect(screen.getByRole('button', { name: 'Ovozni to‘xtatish' })).toBeInTheDocument()
      act(() => (synth.speak.mock.lastCall![0] as Utterance).onend!())
      fireEvent.click(screen.getByRole('button', { name: 'Savolni o‘qib berish' }))
      synth.cancel.mockClear()
      fireEvent.click(screen.getByRole('button', { name: '2', exact: true }))
      expect(synth.cancel).toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Savolni o‘qib berish' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Savolni o‘qib berish' }))
      synth.cancel.mockClear()
      view.unmount()
      expect(synth.cancel).toHaveBeenCalled()
    } finally {
      view.unmount()
      vi.unstubAllGlobals()
    }
  })

  it('requires confirmation and can keep solving without finishing', () => {
    page()
    expect(screen.queryByRole('button', { name: 'Keyingi', exact: true })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ulashish', exact: true })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Test menyusi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yakunlash', exact: true }))
    const dialog = screen.getByRole('dialog', { name: 'Testni yakunlaysizmi?' })
    expect(dialog).toHaveTextContent('3 ta savol javobsiz')
    expect(screen.queryByTestId('results')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yechishni davom ettirish' }))
    expect(useTestSessionStore.getState().session?.finished).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Test menyusi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yakunlash', exact: true }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yakunlash', exact: true }))
    expect(screen.getByTestId('results')).toBeInTheDocument()
    expect(useTestSessionStore.getState().session?.finished).toBe(true)
  })

  it('opens explanation in a dismissible dialog and stays on the same answered question', async () => {
    page()
    expect(screen.queryByRole('button', { name: /Nega|Nima uchun/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'A Birinchi variant' }))
    await waitFor(() => expect(useTestSessionStore.getState().session?.answers[0]).toBe('correct'))
    const trigger = screen.getByRole('button', { name: /Nega|Nima uchun/ })
    expect(screen.queryByRole('button', { name: 'AI tushuntirishi' })).not.toBeInTheDocument()
    trigger.focus()
    fireEvent.click(trigger)
    expect(await screen.findByText('Sinov uchun tushuntirish.')).toBeInTheDocument()
    const explanation = screen.getByRole('dialog', { name: /Nega|Nima uchun/ })
    expect(explanation).toHaveAttribute('aria-modal', 'true')
    expect(within(explanation).getByText('Sinov uchun tushuntirish.')).toBeInTheDocument()
    expect(within(explanation).getByRole('button', { name: 'AI tushuntirishi' })).toBeInTheDocument()
    fireEvent.click(within(explanation).getByRole('button', { name: 'Yopish' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Savol 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'A Birinchi variant' })).toBeDisabled()
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens expired saved results immediately and preserves the actual saved answers', () => {
    useTestSessionStore.getState().save({
      key: 'ids:1,2,3', mode: null, subjectId: 'yhq', title: 'Test',
      questionIds: [3, 1, 2], current: 1,
      answers: ['correct', 'wrong', null], selected: ['a', 'b', null], correctOptions: ['a', 'a', null],
      startedAt: Date.now() - 26 * 60 * 1000, finished: false,
    })
    page()
    expect(JSON.parse(screen.getByTestId('results').textContent!)).toEqual([
      { questionId: 3, status: 'correct' }, { questionId: 1, status: 'incorrect' }, { questionId: 2, status: 'unanswered' },
    ])
    expect(useTestSessionStore.getState().session?.answers).toEqual(['correct', 'wrong', null])
  })
})
