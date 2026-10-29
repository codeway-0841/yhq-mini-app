import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MascotStudioPage from '../../../src/features/mascot-studio/MascotStudioPage'
import { MASCOT_ANIMATIONS } from '../../../src/features/mascot-studio/animations'
import { PathMascot } from '../../../src/features/lessons/LessonToken'
import { useAppStore } from '../../../src/shared/store/useAppStore'

vi.mock('../../../src/features/mascot-studio/RiveCanvas', () => ({
  RiveCanvas: ({ animation, label }: { animation: string; label: string }) => (
    <div data-testid={`canvas-${label}`}>{animation}</div>
  ),
}))

describe('maskot animatsiyalari', () => {
  beforeEach(() => {
    useAppStore.setState((state) => ({ settings: { ...state.settings, language: 'uz' } }))
  })

  it('registers all seven local Rive assets and offers their exact timeline names', () => {
    expect(MASCOT_ANIMATIONS).toHaveLength(7)
    expect(new Set(MASCOT_ANIMATIONS.map((item) => item.file)).size).toBe(7)
    for (const item of MASCOT_ANIMATIONS) {
      expect(item.file).toMatch(/\.riv$/)
      expect(item.animations.length).toBeGreaterThan(1)
      const header = readFileSync(resolve('public', 'brilliant', item.file)).subarray(0, 4)
      expect(header.toString('ascii')).toBe('RIVE')
    }
  })

  it('changes the live animation when a card action is pressed', () => {
    render(<MemoryRouter><MascotStudioPage /></MemoryRouter>)
    const group = screen.getByRole('group', { name: /Gapirayotgan Koji: Harakatlar/ })
    expect(screen.getByTestId('canvas-Gapirayotgan Koji')).toHaveTextContent('idle')
    fireEvent.click(group.querySelectorAll('button')[1])
    expect(screen.getByTestId('canvas-Gapirayotgan Koji')).toHaveTextContent('powerUp_one')
    expect(group.querySelectorAll('button')[1]).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders PathMascot as pure Rive canvas playing idle animation without static images', () => {
    const { container } = render(<PathMascot />)
    const canvas = screen.getByTestId('canvas-Koji')
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveTextContent('idle')
    expect(container.querySelector('img')).toBeNull()
  })
})
