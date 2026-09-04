import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncTelegramSafeArea } from '../../../src/platform/telegram'

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('--safe-top')
  document.documentElement.style.removeProperty('--safe-bottom')
})

describe('Telegram mobile safe area', () => {
  it.each(['Android', 'iPhone'])('does not reserve Telegram controls in an ordinary %s browser', (userAgent) => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { userAgent })
    vi.stubGlobal('window', { Telegram: { WebApp: { initData: '', platform: 'unknown' } } })
    syncTelegramSafeArea()
    expect(document.documentElement.style.getPropertyValue('--safe-top')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--safe-bottom')).toBe('0px')
  })
  it.each([['android', '88px'], ['ios', '104px']])('preserves %s Mini App fallback', (platform, expected) => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { userAgent: '' })
    vi.stubGlobal('window', { Telegram: { WebApp: { platform, initData: 'signed-data' } } })
    syncTelegramSafeArea()
    expect(document.documentElement.style.getPropertyValue('--safe-top')).toBe(expected)
  })
  it('preserves explicitly supplied insets', () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { userAgent: 'Android' })
    vi.stubGlobal('window', { Telegram: { WebApp: { platform: 'android', contentSafeAreaInset: { top: 120 } } } })
    syncTelegramSafeArea()
    expect(document.documentElement.style.getPropertyValue('--safe-top')).toBe('120px')
  })
})
