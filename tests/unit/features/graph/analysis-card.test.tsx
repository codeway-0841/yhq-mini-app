import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AnalysisCard from '../../../../src/features/graph/components/AnalysisCard'

const baseProps = {
  language: 'uz' as const,
  options: [{ id: 'a', label: 'sin(x)', colorIdx: 0 }],
  selectedId: 'a',
  onSelect: vi.fn(),
  derivativeOn: false,
  onDerivative: vi.fn(),
  tangentOn: true,
  onTangent: vi.fn(),
  x0: 2,
  onX0: vi.fn(),
  fValue: 0.9093,
  slopeValue: -0.4161,
  integralOn: true,
  onIntegral: vi.fn(),
  a: 0,
  b: 1,
  onA: vi.fn(),
  onB: vi.fn(),
  rects: 10,
  onRects: vi.fn(),
  area: 0.4597,
  riemannSum: 0.4593,
  secantOn: false,
  onSecant: vi.fn(),
  h: 1,
  onH: vi.fn(),
  secantSlope: 3,
  secantPlaying: false,
  onToggleSecantPlay: vi.fn(),
  pointPlaying: false,
  onTogglePoint: vi.fn(),
  markersOn: true,
  onMarkers: vi.fn(),
  rootCount: 2,
  extremaCount: 1,
  crossCount: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('graph: AnalysisCard', () => {
  it('sarlavha va tahlil qiymatlarini ko‘rsatadi', () => {
    render(<AnalysisCard {...baseProps} />)
    expect(screen.getByText('Tahlil')).toBeInTheDocument()
    expect(screen.getByText('0.9093')).toBeInTheDocument()
    expect(screen.getByText('-0.4161')).toBeInTheDocument()
    expect(screen.getByText('0.4597')).toBeInTheDocument()
    expect(screen.getByText('0.4593')).toBeInTheDocument()
  })

  it('switch bosilganda callback chaqiriladi', () => {
    render(<AnalysisCard {...baseProps} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Hosila (f′)' }))
    expect(baseProps.onDerivative).toHaveBeenCalledWith(true)
  })

  it('ifoda tanlash chipi ishlaydi', () => {
    render(<AnalysisCard {...baseProps} />)
    fireEvent.click(screen.getByText('sin(x)'))
    expect(baseProps.onSelect).toHaveBeenCalledWith('a')
  })

  it('uzilishda qiymat "—" ko‘rinishida', () => {
    render(<AnalysisCard {...baseProps} fValue={NaN} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('nuqta animatsiyasi tugmasi callback chaqiradi', () => {
    render(<AnalysisCard {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Nuqta harakati' }))
    expect(baseProps.onTogglePoint).toHaveBeenCalledTimes(1)
  })

  it('markerlar hisobini ko‘rsatadi', () => {
    render(<AnalysisCard {...baseProps} />)
    expect(screen.getByText(/Ildizlar/)).toBeInTheDocument()
    expect(screen.getByText(/Ekstremumlar/)).toBeInTheDocument()
    expect(screen.getByText(/Kesishmalar/)).toBeInTheDocument()
  })
})

describe('graph: AnalysisCard sekant', () => {
  it('sekant bloki boshqaruvlarini ko‘rsatadi', () => {
    render(<AnalysisCard {...baseProps} secantOn={true} />)
    expect(screen.getByRole('slider', { name: 'h' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'h ni kichraytirish' })).toBeInTheDocument()
    expect(screen.getByText('sek')).toBeInTheDocument()
  })
})
