/**
 * TestPage — oflayn-mashq javob yo'lining xavfsizlik xossasi.
 *
 * Butun "offline subject download" feature'i shu bitta qoidaga tayanadi:
 * isOfflinePractice===true bo'lganda javob HECH QACHON serverga
 * (submitAnswer, demak enqueueOutbox ham) yuborilmaydi — faqat lokal
 * (useQuestionsStore.offlineAnswers) skorlanadi. Shu tufayli GET
 * /api/offline-package javob kalitini client'ga yuborishi xavfsiz: oflayn
 * javob hech qachon qaytarilmagani uchun kalitni bilish hech narsa bermaydi.
 * Bu test o'sha chegarani himoya qiladi.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '1' }),
    useLocation: () => ({ pathname: '/test/1', search: '', hash: '', state: null, key: 'test-key' }),
  }
})

import TestPage from '../../../src/features/test/TestPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useTestSessionStore } from '../../../src/shared/store/useTestSessionStore'

// jsdom scrollIntoView'ni implement qilmaydi — QuestionStrip uni current savol
// o'zgarganda chaqiradi (autoscroll). Bu global emas, faqat shu test faylida.
window.HTMLElement.prototype.scrollIntoView = vi.fn()

/** Bitta savol, ikkita variant — 'a' to'g'ri (offlineAnswers orqali). */
const QUESTION = {
  id: 1,
  text: 'Test savoli',
  image: null,
  options: [
    { id: 'a', text: 'Variant A' },
    { id: 'b', text: 'Variant B' },
  ],
  topicId: null,
}

const mockSubmitAnswer = vi.fn()

beforeEach(() => {
  mockNavigate.mockReset()
  mockSubmitAnswer.mockReset()
  mockSubmitAnswer.mockResolvedValue({ correct: true, correctAnswer: 'a', coinsEarned: 0 })

  // Resume/eski sessiya bo'lmasin — har test toza activeQuestions bilan boshlansin.
  useTestSessionStore.setState({ session: null })
  useSubjectStore.setState({ subjectId: 'yhq' })
  useAppStore.setState({
    settings: {
      ...useAppStore.getState().settings,
      language: 'uz',
      // Auto-next timer'lar testni murakkablashtirmasin.
      autoNextCorrect: false,
      autoNextWrong: false,
    },
    submitAnswer: mockSubmitAnswer,
    toggleSaved: vi.fn(),
    savedQuestions: [],
  })
})

describe('TestPage — offline practice', () => {
  it('javobni lokal offlineAnswers bilan skorlaydi va submitAnswer chaqirmaydi', () => {
    useQuestionsStore.setState({
      questions: [QUESTION],
      topics: [],
      loading: false,
      loaded: true,
      lang: 'uz',
      subjectId: 'yhq',
      isOfflinePractice: true,
      offlineAnswers: { 1: 'a' },
    })

    render(<TestPage />)

    // Banner ko'rinadi — foydalanuvchi bu hisobga yozilmasligini biladi.
    expect(screen.getByText(/Oflayn mashq — natija hisobga yozilmaydi/)).toBeInTheDocument()

    const optionA = screen.getByText('Variant A').closest('button')!
    const optionB = screen.getByText('Variant B').closest('button')!

    // Noto'g'ri variantni tanlaymiz.
    fireEvent.click(optionB)

    // XAVFSIZLIK XOSSASI: serverga (demak outbox'ga ham) HECH NARSA yuborilmadi.
    expect(mockSubmitAnswer).not.toHaveBeenCalled()

    // Vizual feedback onlayn yo'l bilan bir xil: tanlangan (noto'g'ri) qizil,
    // haqiqiy to'g'ri variant reveal qilinadi (yashil) — bu faqat mahalliy
    // skoring to'g'ri ishlaganda mumkin (submitAnswer chaqirilmagan bo'lsa-da).
    expect(optionB).toHaveClass('border-pdanger')
    expect(optionA).toHaveClass('border-pprimary')
    expect(optionA).toBeDisabled()
    expect(optionB).toBeDisabled()
  })

  it('nazorat: onlayn rejimda (isOfflinePractice=false) submitAnswer chaqiriladi', async () => {
    useQuestionsStore.setState({
      questions: [QUESTION],
      topics: [],
      loading: false,
      loaded: true,
      lang: 'uz',
      subjectId: 'yhq',
      isOfflinePractice: false,
      offlineAnswers: {},
    })

    render(<TestPage />)

    expect(screen.queryByText(/Oflayn mashq/)).not.toBeInTheDocument()

    const optionA = screen.getByText('Variant A').closest('button')!
    fireEvent.click(optionA)

    // Bu test harness'ning o'zi klik/javob yo'lini to'g'ri ro'yxatga
    // olishini tasdiqlaydi — aks holda yuqoridagi xavfsizlik testi
    // "hech narsa chaqirilmadi" degan bo'sh (vacuous) natija berishi mumkin edi.
    expect(mockSubmitAnswer).toHaveBeenCalledWith(1, 'a', expect.any(Number))

    // Pending promise/async holat-yangilanishlarini tozalab, act ogohlantirishisiz tugatamiz.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  })
})
