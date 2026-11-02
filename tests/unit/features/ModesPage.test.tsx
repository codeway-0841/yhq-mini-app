import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../../src/shared/components/ToastContainer'
import ModesPage from '../../../src/features/dashboard/ModesPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

beforeEach(() => {
  mockNavigate.mockClear()
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
  useSubjectStore.setState({
    subject: {
      id: 'yhq',
      name: "Yo'l harakati qoidalari",
      icon: vi.fn() as any,
      color: '#10b981',
      available: true,
      examPresets: [],
    },
  })
})

describe('ModesPage', () => {
  it('sarlavha va barcha rejim kartalarini render qiladi', () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <ModesPage />
        </MemoryRouter>
      </ToastProvider>
    )

    expect(screen.getByText('Rejimlar')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Orqaga' })).toBeTruthy()
    expect(screen.getByText('Mavzular')).toBeTruthy()
    expect(screen.getByText('Biletlar')).toBeTruthy()
    expect(screen.getByText('Duel')).toBeTruthy()
    expect(screen.getByText('Xatolar')).toBeTruthy()
    expect(screen.getByText('Darslik')).toBeTruthy()
  })

  it('chap chevron (orqaga) bosilganda orqaga navigatsiya ishlaydi', () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <ModesPage />
        </MemoryRouter>
      </ToastProvider>
    )

    const backBtn = screen.getByRole('button', { name: 'Orqaga' })
    fireEvent.click(backBtn)
    expect(mockNavigate).toHaveBeenCalled()
  })

  it('karta bosilganda to\'g\'ridan-to\'g\'ri mos marshrutga navigate qiladi (dashboard miltillamaydi)', () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <ModesPage />
        </MemoryRouter>
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Biletlar' }))
    expect(mockNavigate).toHaveBeenCalledWith('/biletlar')

    fireEvent.click(screen.getByRole('button', { name: 'Mavzular' }))
    expect(mockNavigate).toHaveBeenCalledWith('/mavzular')

    fireEvent.click(screen.getByRole('button', { name: 'Xatolar' }))
    expect(mockNavigate).toHaveBeenCalledWith('/xatolar')
  })

  it('saqlangan mashqni v2 uchun server selector bilan belgilaydi', () => {
    useAppStore.setState({ savedQuestions: ['yhq:1'] })
    render(
      <ToastProvider>
        <MemoryRouter>
          <ModesPage />
        </MemoryRouter>
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Saqlanganlar' }))
    expect(mockNavigate).toHaveBeenCalledWith('/test/1', {
      state: {
        questionIds: [1], mode: 'saved', serverSelector: 'saved', title: 'Saqlanganlar',
      },
    })
  })

  it('Aqlli takrorlash kartasi chiqadi va mos marshrutga olib boradi, Tezkor test esa olib tashlangan', () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <ModesPage />
        </MemoryRouter>
      </ToastProvider>
    )

    expect(screen.queryByRole('button', { name: 'Tezkor test' })).toBeNull()

    const adaptiveBtn = screen.getByRole('button', { name: 'Aqlli takrorlash' })
    expect(adaptiveBtn).toBeTruthy()
    fireEvent.click(adaptiveBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/adaptive')
  })

  it('KIVVI Drive faqat YHQ fanida ko‘rinadi va alohida simulyatorga olib boradi', () => {
    const view = render(
      <ToastProvider>
        <MemoryRouter>
          <ModesPage />
        </MemoryRouter>
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Haydash simulyatori' }))
    expect(mockNavigate).toHaveBeenCalledWith('/drive')

    useSubjectStore.getState().setSubject('fizika')
    view.rerender(
      <ToastProvider>
        <MemoryRouter>
          <ModesPage />
        </MemoryRouter>
      </ToastProvider>
    )
    expect(screen.queryByRole('button', { name: 'Haydash simulyatori' })).toBeNull()
  })

  it('Ball kalkulyatori va Tezkor test ModesPage ichida ko\'rinmaydi', () => {
    useSubjectStore.setState({
      subject: {
        id: 'fizika',
        name: 'Fizika',
        icon: vi.fn() as any,
        color: '#3b82f6',
        available: true,
        examPresets: ['milliy-sertifikat'],
      },
    })

    render(
      <ToastProvider>
        <MemoryRouter>
          <ModesPage />
        </MemoryRouter>
      </ToastProvider>
    )

    expect(screen.queryByRole('button', { name: 'Ball kalkulyatori' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tezkor test' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'AI Wonder Studio' })).toBeNull()
  })
})
