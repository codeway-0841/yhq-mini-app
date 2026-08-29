import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { BOSS_ROSTER } from '../../../shared/boss-battle'
import { getBossIcon, BOSS_ICONS } from '../../../src/features/boss/boss-icons'

describe('features/boss/boss-icons', () => {
  it('all bosses in BOSS_ROSTER have mapped icon components', () => {
    for (const boss of BOSS_ROSTER) {
      const Icon = getBossIcon(boss.id)
      expect(Icon).toBeDefined()
      expect(typeof Icon).toBe('function')
    }
  })

  it('unknown boss fallback to default icon without throwing', () => {
    const FallbackIcon = getBossIcon('unknown-boss-xyz')
    expect(FallbackIcon).toBeDefined()
    expect(typeof FallbackIcon).toBe('function')
  })

  it('all mapped icons render valid svg with correct props', () => {
    for (const [key, Icon] of Object.entries(BOSS_ICONS)) {
      const { container } = render(<Icon size={32} className="test-boss-icon" data-testid={`boss-icon-${key}`} />)
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg?.getAttribute('width')).toBe('32')
      expect(svg?.getAttribute('height')).toBe('32')
      expect(svg?.getAttribute('viewBox')).toBe('0 0 512 512')
      expect(svg?.classList.contains('test-boss-icon')).toBe(true)
    }
  })
})
