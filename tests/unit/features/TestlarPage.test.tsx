import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import TestlarPage from '../../../src/features/testlar/TestlarPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'

beforeEach(() => {
  mockNavigate.mockReset()
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
  })
})

describe('TestlarPage — Mode Card Availability', () => {
  it('YHQ fanida Speed Round va 20 talik test chiqarilmaydi', () => {
    useSubjectStore.setState({ subjectId: 'yhq' })
    render(<TestlarPage />)

    // Speed Round olib tashlangan
    expect(screen.queryByText(/speed round/i)).toBeNull()
    // 20 talik tezkor test olib tashlangan
    expect(screen.queryByText(/20 talik tezkor/i)).toBeNull()

    // Qolgan to'g'ri rejimlar mavjud
    expect(screen.getByText(/mock imtihon/i)).toBeInTheDocument()
    expect(screen.getByText(/marafon/i)).toBeInTheDocument()
  })

  it('Fizika va boshqa fanlarda Speed Round va 20 talik test chiqarilmaydi', () => {
    useSubjectStore.setState({ subjectId: 'fizika' })
    render(<TestlarPage />)

    // Speed Round olib tashlangan
    expect(screen.queryByText(/speed round/i)).toBeNull()
    // 20 talik tezkor test olib tashlangan
    expect(screen.queryByText(/20 talik tezkor/i)).toBeNull()

    // 50 talik, 100 talik va marafon mavjud
    expect(screen.getByText(/50 talik/i)).toBeInTheDocument()
    expect(screen.getByText(/100 talik/i)).toBeInTheDocument()
    expect(screen.getByText(/marafon/i)).toBeInTheDocument()
  })
})
