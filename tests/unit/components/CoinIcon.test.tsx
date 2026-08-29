import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { CoinIcon } from '../../../src/shared/components/CoinIcon'

describe('shared/components/CoinIcon', () => {
  it('renders valid SVG with size and className', () => {
    const { container } = render(<CoinIcon size={20} className="test-coin-icon" data-testid="coin-icon" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('width')).toBe('20')
    expect(svg?.getAttribute('height')).toBe('20')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg?.classList.contains('test-coin-icon')).toBe(true)
  })

  it('renders default size 16', () => {
    const { container } = render(<CoinIcon />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('16')
    expect(svg?.getAttribute('height')).toBe('16')
  })
})
