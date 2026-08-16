import '@testing-library/jest-dom/vitest'
import { vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Telegram WebApp Mock
class MockMainButton {
  text = ''
  isVisible = false
  isActive = true
  private clickHandlers: Array<() => void> = []

  setText(text: string) { this.text = text; return this }
  show() { this.isVisible = true; return this }
  hide() { this.isVisible = false; return this }
  enable() { this.isActive = true; return this }
  disable() { this.isActive = false; return this }
  onClick(fn: () => void) { this.clickHandlers.push(fn); return this }
  offClick(fn: () => void) { this.clickHandlers = this.clickHandlers.filter((h) => h !== fn); return this }
  __simulateClick() { this.clickHandlers.forEach((h) => h()) }
}

export const mockWebApp = {
  ready: vi.fn(),
  expand: vi.fn(),
  close: vi.fn(),
  openTelegramLink: vi.fn(),
  shareURL: vi.fn(),
  requestContact: vi.fn((cb?: (ok: boolean, data?: any) => void) => cb?.(true, { contact: { phone_number: '+998901234567' } })),
  addToHomeScreen: vi.fn(),
  initData: 'query_id=mock&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22username%22%3A%22testuser%22%7D&auth_date=1700000000&hash=mockhash',
  initDataUnsafe: {
    user: { id: 123456789, first_name: 'Test', last_name: 'User', username: 'testuser', language_code: 'uz' },
    auth_date: Math.floor(Date.now() / 1000),
    hash: 'mock_hash',
  },
  colorScheme: 'light',
  themeParams: { bg_color: '#ffffff', text_color: '#000000', button_color: '#2481cc', button_text_color: '#ffffff' },
  MainButton: new MockMainButton(),
  BackButton: { isVisible: false, show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
  HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn(), selectionChanged: vi.fn() },
  showAlert: vi.fn((_msg: string, cb?: () => void) => cb?.()),
  showConfirm: vi.fn((_msg: string, cb?: (ok: boolean) => void) => cb?.(true)),
  sendData: vi.fn(),
  onEvent: vi.fn(),
  offEvent: vi.fn(),
  version: '7.0',
  platform: 'android',
}

// Global window mocks
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'Telegram', {
    writable: true,
    value: { WebApp: mockWebApp },
  })

  // Mock window.scrollTo
  window.scrollTo = vi.fn()

  // Mock window.matchMedia
  window.matchMedia = window.matchMedia || function (query: string) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }
  }

  // Mock Web Audio API
  class MockAudioContext {
    createGain() {
      const node = {
        connect: vi.fn().mockImplementation((dest) => dest ?? node),
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          value: 1,
        },
      }
      return node
    }
    createOscillator() {
      const node = {
        connect: vi.fn().mockImplementation((dest) => dest ?? node),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          value: 440,
        },
        type: 'sine',
      }
      return node
    }
    get destination() {
      return {}
    }
    get currentTime() {
      return 0
    }
    get state() {
      return 'running'
    }
    resume() {
      return Promise.resolve()
    }
    close() {
      return Promise.resolve()
    }
  }

  // @ts-expect-error mock assignment
  window.AudioContext = MockAudioContext
  // @ts-expect-error mock assignment
  window.webkitAudioContext = MockAudioContext
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})
