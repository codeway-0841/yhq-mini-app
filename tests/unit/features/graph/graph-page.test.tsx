import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import GraphPage from '../../../../src/features/graph/GraphPage'
import { ToastProvider } from '../../../../src/shared/components/ToastContainer'
import { useGraphStore } from '../../../../src/features/graph/useGraphStore'

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
    expect(screen.queryByRole('button', { name: 'AI repetitor bilan muhokama' })).not.toBeInTheDocument()
  })
})
