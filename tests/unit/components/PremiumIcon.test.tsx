import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { PremiumIcon } from '../../../src/shared/components/PremiumIcon'

describe('shared/components/PremiumIcon', () => {
  it('renders valid SVG diamond icon with size and className', () => {
    const { container } = render(<PremiumIcon size={24} className="test-premium-icon" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('width')).toBe('24')
    expect(svg?.getAttribute('height')).toBe('24')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg?.classList.contains('test-premium-icon')).toBe(true)
  })

  it('renders default size 16', () => {
    const { container } = render(<PremiumIcon />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('16')
    expect(svg?.getAttribute('height')).toBe('16')
  })
})
