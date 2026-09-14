import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import GraphPage from '../../../../src/features/graph/GraphPage'
import { ToastProvider } from '../../../../src/shared/components/ToastContainer'
import { useGraphStore } from '../../../../src/features/graph/useGraphStore'

vi.mock('../../../../src/shared/lib/tutor', () => ({
  streamSocraticChat: async function* () {
    yield 'Javob'
  },
  TutorError: class TutorError extends Error {
    kind = 'network'
  },
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <GraphPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useGraphStore.getState().reset()
})

describe('graph: GraphPage smoke', () => {
  it('default ifoda va asosiy elementlar chiziladi', () => {
    renderPage()
    expect(screen.getByText('Grafik quruvchi')).toBeInTheDocument()
    expect(screen.getByDisplayValue('sin(x)')).toBeInTheDocument()
    expect(screen.getByTestId('graph-canvas')).toBeInTheDocument()
    expect(screen.getByText('Tahlil')).toBeInTheDocument()
  })

  it('AI repetitor tugmasi chat sheetini ochadi', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'AI repetitor bilan muhokama' }))
    expect(await screen.findByText('Kivvi AI Repetitor')).toBeInTheDocument()
  })
})
