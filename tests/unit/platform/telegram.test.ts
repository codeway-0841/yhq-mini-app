/**
 * Platform adapter — window.Telegram murojaatlarining yagona nuqtasi.
 * Telegram tashqarisida (brauzer) hammasi xavfsiz fallback bo'lishi shart.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getInitData, getTelegramUser, getStartParam,
  bindBackButton, requestContact, promptAddToHomeScreen,
  openTelegramLink, shareUrl,
} from '../../../src/platform/telegram'

const win: Record<string, unknown> = {}

beforeEach(() => {
  for (const k of Object.keys(win)) delete win[k]
  win.open = vi.fn()
  vi.stubGlobal('window', win)
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Telegram tashqarisida (brauzer fallback)', () => {
  it('initData / startParam / user — undefined', () => {
    expect(getInitData()).toBeUndefined()
    expect(getStartParam()).toBeUndefined()
    expect(getTelegramUser()).toBeUndefined()
  })

  it('bindBackButton / requestContact / addToHomeScreen — xavfsiz no-op', () => {
    expect(bindBackButton(true, () => {})).toBeUndefined()
    expect(requestContact(() => {})).toBe(false)
    expect(promptAddToHomeScreen()).toBe(false)
  })

  it('openTelegramLink → window.open fallback', () => {
    openTelegramLink('https://t.me/x')
    expect(win.open).toHaveBeenCalledWith('https://t.me/x', '_blank', 'noopener,noreferrer')
  })

  it('shareUrl → clipboard fallback', () => {
    shareUrl('https://example.com')
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com')
  })
})

describe('Telegram ichida', () => {
  beforeEach(() => {
    win.Telegram = {
      WebApp: {
        initData: 'init-data-123',
        initDataUnsafe: {
          start_param: 'duel-abc',
          user: { id: 42, first_name: 'Ali', username: 'ali' },
        },
        openTelegramLink: vi.fn(),
        BackButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
        requestContact: vi.fn((cb: (ok: boolean, d?: unknown) => void) => cb(true, { contact: { phone_number: '901234567' } })),
        addToHomeScreen: vi.fn(),
        ready: vi.fn(),
        expand: vi.fn(),
      },
    }
  })

  const webApp = () => (win.Telegram as { WebApp: Record<string, ReturnType<typeof vi.fn>> }).WebApp

  it('initData / startParam / user olinadi', () => {
    expect(getInitData()).toBe('init-data-123')
    expect(getStartParam()).toBe('duel-abc')
    expect(getTelegramUser()?.id).toBe(42)
  })

  it('bindBackButton: visible → show+onClick, cleanup → offClick', () => {
    const bb = webApp().BackButton as unknown as {
      show: ReturnType<typeof vi.fn>; onClick: ReturnType<typeof vi.fn>; offClick: ReturnType<typeof vi.fn>
    }
    const cleanup = bindBackButton(true, () => {})
    expect(bb.show).toHaveBeenCalledOnce()
    expect(bb.onClick).toHaveBeenCalledOnce()
    cleanup?.()
    expect(bb.offClick).toHaveBeenCalledOnce()
  })

  it('bindBackButton: hidden → faqat hide (object qaytarmasligi shart)', () => {
    const bb = webApp().BackButton as unknown as { hide: ReturnType<typeof vi.fn>; show: ReturnType<typeof vi.fn> }
    const cleanup = bindBackButton(false, () => {})
    expect(bb.hide).toHaveBeenCalledOnce()
    expect(bb.show).not.toHaveBeenCalled()
    expect(cleanup).toBeUndefined()
  })

  it('requestContact → true va callback chaqiriladi', () => {
    const cb = vi.fn()
    expect(requestContact(cb)).toBe(true)
    expect(cb).toHaveBeenCalledWith(true, { contact: { phone_number: '901234567' } })
  })

  it('promptAddToHomeScreen → true', () => {
    expect(promptAddToHomeScreen()).toBe(true)
    expect(webApp().addToHomeScreen).toHaveBeenCalledOnce()
  })

  it('openTelegramLink → Telegram API orqali (window.open EMAS)', () => {
    openTelegramLink('https://t.me/x')
    expect(webApp().openTelegramLink).toHaveBeenCalledWith('https://t.me/x')
    expect(win.open).not.toHaveBeenCalled()
  })

  it('syncTelegramSafeArea: insets mavjud bo\'lganda --safe-top va --safe-bottom o\'rnatadi', async () => {
    const { syncTelegramSafeArea } = await import('../../../src/platform/telegram')
    const rootStyle = document.documentElement.style

    const tg = webApp()
    tg.contentSafeAreaInset = { top: 96, bottom: 34, left: 0, right: 0 }
    syncTelegramSafeArea()
    expect(rootStyle.getPropertyValue('--safe-top')).toBe('96px')
    expect(rootStyle.getPropertyValue('--safe-bottom')).toBe('34px')
  })

  it('syncTelegramTheme: dark/light temalarda headerColor va meta theme-color sinxronlanadi', async () => {
    const { syncTelegramTheme } = await import('../../../src/platform/telegram')
    const tg = webApp()
    tg.setHeaderColor = vi.fn()

    syncTelegramTheme(true)
    expect(tg.setHeaderColor).toHaveBeenCalledWith('#0d1117')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0d1117')

    syncTelegramTheme(false)
    expect(tg.setHeaderColor).toHaveBeenCalledWith('#fafaf9')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#fafaf9')
  })

  it('bindBackButton: Telegram headerColor qayta mustahkamlanadi', async () => {
    const { bindBackButton } = await import('../../../src/platform/telegram')
    const tg = webApp()
    tg.setHeaderColor = vi.fn()
    tg.BackButton = {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    }

    bindBackButton(true, () => {})
    expect(tg.setHeaderColor).toHaveBeenCalledWith('#0d1117')
    expect(tg.BackButton.show).toHaveBeenCalledOnce()

    bindBackButton(false, () => {})
    expect(tg.BackButton.hide).toHaveBeenCalledOnce()
  })

  it('readyAndExpand: disableVerticalSwipes chaqiriladi', async () => {
    const { readyAndExpand } = await import('../../../src/platform/telegram')
    const tg = webApp()
    tg.disableVerticalSwipes = vi.fn()
    readyAndExpand()
    expect(tg.disableVerticalSwipes).toHaveBeenCalledOnce()
  })
})
