import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import RussianDarslikPage from '../../../src/features/darslik-rustili/RussianDarslikPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { api, ApiError } from '../../../src/shared/api'
import type { DarslikCheckResult, DarslikPublicCheck } from '../../../shared/darslik-mastery'
import {
  DARSLIK_BLOCKS,
  DARSLIK_PROGRESS_MODULE_OFFSET,
  getBlockOutline,
} from '../../../src/content/darslik-rustili'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', async (original) => ({
  ...await original<typeof import('react-router-dom')>(),
  useNavigate: () => navigate,
}))

const uid = 'rus-darslik-test'
const moduleIdOf = (blockId: number) => DARSLIK_PROGRESS_MODULE_OFFSET + blockId
const pathNode = (blockId: number, idx: number) =>
  document.querySelector<HTMLButtonElement>(`[data-path-node][data-module="${blockId}"][data-lesson="${idx}"]`)!

const CHECK: DarslikPublicCheck = {
  questions: [
    {
      id: 'q1',
      kind: 'mcq',
      prompt: 'Что мы произносим и слышим?',
      options: ['Буквы', 'Звуки', 'Знаки препинания', 'Написание слов'],
    },
    {
      id: 'q2',
      kind: 'mcq',
      prompt: 'Сколько букв в слове «конь»?',
      options: ['2', '3', '4', '5'],
    },
    {
      id: 'q3',
      kind: 'input',
      prompt: 'Сколько звуков в слове «дом»?',
    },
  ],
}

const PASSED: DarslikCheckResult = {
  passed: true,
  correct: 3,
  total: 3,
  feedback: [
    { id: 'q1', correct: true, explanation: 'Звуки мы произносим и слышим.' },
    { id: 'q2', correct: true, explanation: 'В слове «конь» четыре буквы.' },
    { id: 'q3', correct: true, explanation: 'В слове «дом» три звука.' },
  ],
}

const FAILED: DarslikCheckResult = {
  passed: false,
  correct: 1,
  total: 3,
  feedback: [
    { id: 'q1', correct: true, explanation: 'Звуки мы произносим и слышим.' },
    { id: 'q2', correct: false, explanation: 'В слове «конь» четыре буквы.' },
    { id: 'q3', correct: false, explanation: 'В слове «дом» три звука.' },
  ],
}

function checkElement(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-testid="topic-check"]')!
}

async function answerCheck(quiz: HTMLElement) {
  await within(quiz).findByText(CHECK.questions[0].prompt)
  const submit = within(quiz).getByRole('button', { name: 'Tekshirish' })
  expect(submit).toBeDisabled()

  fireEvent.click(within(quiz).getByRole('button', { name: 'Звуки' }))
  fireEvent.click(within(quiz).getByRole('button', { name: '4' }))
  expect(submit).toBeDisabled()

  fireEvent.change(within(quiz).getByPlaceholderText('Javobingizni yozing'), { target: { value: '3' } })
  expect(submit).toBeEnabled()
  fireEvent.click(submit)
}

async function waitReaderReady(reader: HTMLElement) {
  await waitFor(() => expect(within(reader).getByTestId('micro-lesson-card')).toBeInTheDocument())
}

async function advanceToPractice(reader: HTMLElement) {
  await waitReaderReady(reader)
  for (let step = 0; step < 20; step++) {
    const next = within(reader).queryByRole('button', { name: 'Davom etish' })
    if (!next) break
    fireEvent.click(next)
  }
  return within(reader).getByRole('button', { name: 'Mashqni boshlash' })
}

beforeEach(() => {
  navigate.mockReset()
  useLessonsStore.setState({ byUser: {}, readByUser: {} })
  useAppStore.setState({
    tariff: 'premium',
    user: { id: uid, firstName: 'Test' } as never,
    settings: { ...useAppStore.getState().settings, language: 'uz' },
  })
  vi.spyOn(api, 'getDarslikProgress').mockResolvedValue({ passed: [] })
  vi.spyOn(api, 'getDarslikCheck').mockResolvedValue(CHECK)
  vi.spyOn(api, 'submitDarslikCheck').mockResolvedValue(PASSED)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RussianDarslikPage — learning path', () => {
  it('har bir blok uchun learning path va umumiy progressni ko‘rsatadi', async () => {
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    // Mobil header va desktop karta — ikkalasi ham sarlavhani beradi
    expect(screen.getAllByRole('heading', { name: 'Rus tili darsligi' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText(`0/${getBlockOutline(1).length}`).length).toBeGreaterThan(0)

    for (const block of DARSLIK_BLOCKS) {
      const section = document.getElementById(`rus-block-${block.id}`)
      expect(section).toBeTruthy()
    }
    expect(document.getElementById('rus-block-1')!.querySelectorAll('[data-path-node]')).toHaveLength(8)
    expect(document.getElementById('rus-block-2')!.querySelectorAll('[data-path-node]')).toHaveLength(0)

    // Ketma-ket ochilish: faqat birinchi mavzu ochiq, qolganlari qulflangan.
    expect(pathNode(1, 0)).not.toHaveAttribute('aria-disabled')
    expect(pathNode(1, 1)).toHaveAttribute('aria-disabled', 'true')
    expect(pathNode(1, 2)).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(within(document.getElementById('rus-block-2')!).getByRole('button', { name: 'Blokni ochish' }))
    expect(pathNode(2, 0)).toHaveAttribute('aria-disabled', 'true')
  })

  it('server progressi o‘tilgan mavzularni va keyingi ochilishni ko‘rsatadi', async () => {
    vi.mocked(api.getDarslikProgress).mockResolvedValue({ passed: ['1:0', '1:1'] })
    render(<RussianDarslikPage />)

    await waitFor(() => expect(screen.getAllByText(`2/${getBlockOutline(1).length}`).length).toBeGreaterThan(0))
    expect(pathNode(1, 1)).not.toHaveAttribute('aria-disabled')
    expect(pathNode(1, 2)).not.toHaveAttribute('aria-disabled')
    expect(pathNode(1, 3)).toHaveAttribute('aria-disabled', 'true')
    const banner = document.getElementById('rus-block-1')!
    expect(banner.textContent).toContain(`2/${getBlockOutline(1).length}`)
  })

  it('katta blokni 8 mavzuli oynalarda ko‘rsatadi va asl indekslarni saqlaydi', async () => {
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    const firstBlock = document.getElementById('rus-block-1')!
    expect(pathNode(1, 0)).toBeInTheDocument()
    fireEvent.click(within(firstBlock).getByRole('button', { name: 'Keyingi mavzular' }))

    expect(pathNode(1, 0)).not.toBeInTheDocument()
    expect(pathNode(1, 8)).toBeInTheDocument()
    expect(firstBlock).toHaveTextContent(`9–12 / ${getBlockOutline(1).length} mavzu`)
  })

  it('mavzuni o‘qib, server testini topshirgach keyingi mavzu ochiladi', async () => {
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    fireEvent.click(pathNode(1, 0))
    expect(await screen.findByText('Qisqa nazariya, misollar va interaktiv mashq.')).toBeInTheDocument()
    expect(screen.getByText('3–5 daqiqa')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Boshlash' }))

    const reader = document.querySelector('.lesson-reader') as HTMLElement
    await waitFor(() => {
      expect(reader.textContent).toContain(`1-blok · 1/${getBlockOutline(1).length}`)
    })
    await waitReaderReady(reader)
    expect(within(reader).getAllByText(/ЗВУКИ И БУКВЫ/).length).toBeGreaterThan(0)
    expect(within(reader).queryByRole('heading', { name: /ГЛАСНЫЕ И СОГЛАСНЫЕ/ })).not.toBeInTheDocument()

    // O'qishning o'zi yetarli emas: server testi ochiladi, mavzu hali "passed" emas.
    fireEvent.click(await advanceToPractice(reader))
    expect(useLessonsStore.getState().readByUser[uid][moduleIdOf(1)]).toEqual([0])
    expect(checkElement()).toBeTruthy()
    await waitFor(() => expect(api.getDarslikCheck).toHaveBeenCalledWith('1:0'))

    await answerCheck(checkElement())

    await waitFor(() => expect(api.submitDarslikCheck).toHaveBeenCalled())
    expect(api.submitDarslikCheck).toHaveBeenCalledWith('1:0', expect.objectContaining({ q1: '1', q2: '2', q3: '3' }))
    expect(await screen.findByText('Test o‘tdi!')).toBeInTheDocument()

    // Server natijasi lokal cache'ga ham tushadi va keyingi mavzu ochiladi.
    await waitFor(() => expect(pathNode(1, 1)).not.toHaveAttribute('aria-disabled'))
    expect(useLessonsStore.getState().byUser[uid][moduleIdOf(1)]).toContain(0)

    // Natijadan keyin keyingi mavzuga o'tish mumkin.
    fireEvent.click(within(checkElement()).getByRole('button', { name: 'Keyingi mavzu' }))
    await waitFor(() => {
      expect(document.querySelector('.lesson-reader')!.textContent).toContain(`1-blok · 2/${getBlockOutline(1).length}`)
    })
  })

  it('test yopilsa ham o‘qilgan mavzu keyingisini ochmaydi', async () => {
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    fireEvent.click(pathNode(1, 0))
    fireEvent.click(await screen.findByRole('button', { name: 'Boshlash' }))
    const reader = document.querySelector('.lesson-reader') as HTMLElement
    await waitFor(() => {
      expect(reader.textContent).toContain(`1-blok · 1/${getBlockOutline(1).length}`)
    })

    fireEvent.click(await advanceToPractice(reader))
    await within(checkElement()).findByText(CHECK.questions[0].prompt)
    fireEvent.click(within(checkElement()).getByRole('button', { name: 'Testni yopish' }))
    expect(document.querySelector('[data-testid="topic-check"]')).not.toBeInTheDocument()
    expect(document.querySelector('.lesson-reader')).toBeInTheDocument()

    fireEvent.click(within(reader).getByRole('button', { name: 'O‘qishni yopish' }))

    expect(screen.getAllByText(`0/${getBlockOutline(1).length}`).length).toBeGreaterThan(0)
    expect(pathNode(1, 0)).toHaveTextContent('Test kutilmoqda')
    expect(pathNode(1, 1)).toHaveAttribute('aria-disabled', 'true')
    expect(useLessonsStore.getState().byUser[uid]?.[moduleIdOf(1)]).toBeUndefined()
  })

  it('server test yechilmaganda keyingi mavzu qulflangan qoladi', async () => {
    vi.mocked(api.submitDarslikCheck).mockResolvedValue(FAILED)
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    fireEvent.click(pathNode(1, 0))
    fireEvent.click(await screen.findByRole('button', { name: 'Boshlash' }))
    const reader = document.querySelector('.lesson-reader') as HTMLElement
    await waitFor(() => {
      expect(reader.textContent).toContain(`1-blok · 1/${getBlockOutline(1).length}`)
    })

    fireEvent.click(await advanceToPractice(reader))
    await answerCheck(checkElement())

    expect(await screen.findByText('Test o‘tilmadi')).toBeInTheDocument()
    expect(pathNode(1, 1)).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(within(checkElement()).getByRole('button', { name: 'Mavzuga qaytish' }))
    expect(within(reader).getByRole('button', { name: 'Testni boshlash' })).toBeInTheDocument()
    expect(within(reader).queryByRole('button', { name: 'Keyingi mavzu' })).not.toBeInTheDocument()
  })

  it('server testi mavjud bo‘lmasa qayta urinishni taklif qiladi', async () => {
    vi.mocked(api.getDarslikCheck).mockRejectedValue(new ApiError(503, 'PRACTICE_UNAVAILABLE', 'PRACTICE_UNAVAILABLE'))
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    fireEvent.click(pathNode(1, 0))
    fireEvent.click(await screen.findByRole('button', { name: 'Boshlash' }))
    const reader = document.querySelector('.lesson-reader') as HTMLElement
    await waitFor(() => {
      expect(reader.textContent).toContain(`1-blok · 1/${getBlockOutline(1).length}`)
    })

    fireEvent.click(await advanceToPractice(reader))
    expect(await screen.findByText('Test vaqtincha mavjud emas. Keyinroq qayta urinib ko‘ring.')).toBeInTheDocument()
    fireEvent.click(within(checkElement()).getByRole('button', { name: 'Qayta urinish' }))
    await waitFor(() => expect(vi.mocked(api.getDarslikCheck).mock.calls.length).toBeGreaterThan(1))
  })

  it('server 403 qaytarsa progressni qayta yuklaydi va qulf sababini ko‘rsatadi', async () => {
    vi.mocked(api.getDarslikCheck).mockRejectedValue(new ApiError(403, 'TOPIC_LOCKED', 'TOPIC_LOCKED'))
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    fireEvent.click(pathNode(1, 0))
    fireEvent.click(await screen.findByRole('button', { name: 'Boshlash' }))
    const reader = document.querySelector('.lesson-reader') as HTMLElement
    await waitFor(() => {
      expect(reader.textContent).toContain(`1-blok · 1/${getBlockOutline(1).length}`)
    })

    fireEvent.click(await advanceToPractice(reader))
    expect(await screen.findByText('Mavzu qulflangan')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(api.getDarslikProgress).mock.calls.length).toBeGreaterThan(1))
  })

  it('mundarijada keyingi mavzu testdan o‘tilmaguncha qulflangan', async () => {
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    fireEvent.click(pathNode(1, 0))
    fireEvent.click(await screen.findByRole('button', { name: 'Boshlash' }))
    const reader = document.querySelector('.lesson-reader') as HTMLElement
    await waitFor(() => {
      expect(reader.textContent).toContain(`1-blok · 1/${getBlockOutline(1).length}`)
    })

    await waitReaderReady(reader)
    fireEvent.click(within(reader).getByRole('button', { name: 'Mundarija' }))
    expect(within(reader).getByRole('button', { name: /1\. ЗВУКИ И БУКВЫ/ })).not.toBeDisabled()
    expect(within(reader).getByRole('button', { name: /2\. ГЛАСНЫЕ И СОГЛАСНЫЕ/ })).toBeDisabled()
  })

  it('qulflangan mavzu preview’da sabab bilan ko‘rsatiladi', async () => {
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    fireEvent.click(pathNode(1, 1))

    expect(await screen.findByText(/Avval «ЗВУКИ И БУКВЫ» mavzusi testini o‘ting/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hali ochilmagan' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Boshlash' })).not.toBeInTheDocument()
  })

  it('server progressi yuklanmasa ogohlantiradi va qayta urinish beradi', async () => {
    vi.mocked(api.getDarslikProgress).mockRejectedValue(new Error('offline'))
    render(<RussianDarslikPage />)

    expect(await screen.findByText('Progressni yuklab bo‘lmadi. Internetni tekshiring.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }))
    await waitFor(() => expect(vi.mocked(api.getDarslikProgress).mock.calls.length).toBeGreaterThan(1))
  })

  it('o‘qilgan (serverda o‘tilgan) mavzu uchun "Qayta o‘qish" taklif qiladi', async () => {
    vi.mocked(api.getDarslikProgress).mockResolvedValue({ passed: ['1:0'] })
    render(<RussianDarslikPage />)
    await waitFor(() => expect(pathNode(1, 1)).not.toHaveAttribute('aria-disabled'))

    fireEvent.click(pathNode(1, 0))
    expect(await screen.findByRole('button', { name: 'Qayta o‘qish' })).toBeInTheDocument()
  })

  it('rus tilida modul va mavzu sarlavhalarini ruscha ko‘rsatadi', async () => {
    useAppStore.setState({
      ...useAppStore.getState(),
      settings: { ...useAppStore.getState().settings, language: 'ru' },
    })
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    expect(screen.getAllByRole('heading', { name: 'Учебник русского языка' }).length).toBeGreaterThan(0)
    const banner = document.getElementById('rus-block-1')!
    expect(banner.textContent).toContain(DARSLIK_BLOCKS[0].titleRu)
  })

  it('bo‘lim nishoni, bosqich indikatori va nazariya kartasida talaffuz tugmasini ko‘rsatadi', async () => {
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    const firstBlock = document.getElementById('rus-block-1')!
    expect(firstBlock).toHaveTextContent('1-bo‘lim')
    expect(firstBlock).toHaveTextContent('1-bosqich')

    fireEvent.click(pathNode(1, 0))
    fireEvent.click(await screen.findByRole('button', { name: 'Boshlash' }))
    const reader = document.querySelector('.lesson-reader') as HTMLElement
    await waitReaderReady(reader)
    expect(within(reader).getByRole('button', { name: 'Talaffuzni eshitish' })).toBeInTheDocument()
  })
})
