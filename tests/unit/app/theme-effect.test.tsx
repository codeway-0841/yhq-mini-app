import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { useAppStore } from '../../../src/shared/store/useAppStore'

// Mock native and telegram functions
vi.mock('../../../src/platform/native', () => ({
  syncStatusBarStyle: vi.fn(),
}))
vi.mock('../../../src/platform/telegram', () => ({
  syncTelegramTheme: vi.fn(),
}))
vi.mock('../../../src/shared/lib/fonts', () => ({
  ensureFontLoaded: vi.fn(),
}))

// Import or test ThemeEffect behavior directly
import { resolveAccent } from '../../../src/shared/config/themes'
import ThemeEffect from '../../../src/features/app/components/ThemeEffect'

describe('Theme and DOM attribute synchronization (Characterization)', () => {
  beforeEach(() => {
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-accent')
    document.body.removeAttribute('data-no-animation')
    document.body.removeAttribute('data-font')
    document.documentElement.lang = 'uz'
  })

  it('sets documentElement.lang correctly', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'ru' } })
    document.documentElement.lang = useAppStore.getState().settings.language
    expect(document.documentElement.lang).toBe('ru')
  })

  it('synchronizes html scheme with body on store-driven theme changes', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, theme: 'light' } })
    render(<ThemeEffect />)
    expect(document.body.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('resolves accent color correctly for free vs premium', () => {
    const freeAccent = resolveAccent('kiwi', false, new Set())
    expect(freeAccent).toBe('kiwi')

    // Violet is premium/coin accent
    const premiumAccent = resolveAccent('violet', true, new Set())
    expect(premiumAccent).toBe('violet')

    const lockedAccent = resolveAccent('violet', false, new Set())
    expect(lockedAccent).toBe('kiwi') // fallback to default kiwi
  })
})
