import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  BrilliantHeroIllustration,
  BrilliantLessonRowIcon,
  getBrilliantTheme,
} from '../../../src/features/lessons/BrilliantLevelsCarousel'

describe('BrilliantLevelsCarousel primitives', () => {
  it('returns exact Brilliant module themes (Blue, Gold/Amber, Purple)', () => {
    const level1 = getBrilliantTheme(1)
    expect(level1.accent).toBe('#3557ff')
    expect(level1.buttonBg).toBe('#3557ff')
    expect(level1.recommended).toBe(false)

    const level2 = getBrilliantTheme(2)
    expect(level2.accent).toBe('#f6b31f')
    expect(level2.buttonBg).toBe('#f6b31f')
    expect(level2.recommended).toBe(false)

    const level4 = getBrilliantTheme(4)
    expect(level4.recommended).toBe(true)

    const level5 = getBrilliantTheme(5)
    expect(level5.accent).toBe('#8a4cff')
    expect(level5.buttonBg).toBe('#8a4cff')
    expect(level5.recommended).toBe(true)
  })

  it('renders bespoke 3D hero illustrations for all 5 levels', () => {
    for (const moduleId of [1, 2, 3, 4, 5]) {
      const { container, unmount } = render(<BrilliantHeroIllustration moduleId={moduleId} />)
      expect(container.querySelector('img, svg')).toBeInTheDocument()
      unmount()
    }
  })

  it('renders 3D isometric lesson row icons for done, current, and upcoming states', () => {
    for (const state of ['done', 'current', 'upcoming'] as const) {
      const { container, unmount } = render(<BrilliantLessonRowIcon state={state} />)
      expect(container.querySelector('img, svg')).toBeInTheDocument()
      unmount()
    }
  })
})
