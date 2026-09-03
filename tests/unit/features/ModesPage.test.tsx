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
    expect(screen.getByText('Mavzular')).toBeTruthy()
    expect(screen.getByText('Biletlar')).toBeTruthy()
    expect(screen.getByText('Duel')).toBeTruthy()
    expect(screen.getByText('Xatolar')).toBeTruthy()
    expect(screen.getByText('Darslik')).toBeTruthy()
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
  })
})
