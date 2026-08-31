/**
 * Capacitor (native APK) adapter — UI kodi platforma farqini bilmasligi shart:
 * Telegram'da TG BackButton delegatsiyasi, APK'da hardware back, brauzerda no-op.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { addListenerMock, splashHideMock, isNativeMock, setOverlaysMock, setStyleMock } = vi.hoisted(() => ({
  addListenerMock: vi.fn(),
  splashHideMock: vi.fn(),
  isNativeMock: vi.fn(),
  setOverlaysMock: vi.fn(),
  setStyleMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: isNativeMock } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: addListenerMock } }))
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: splashHideMock } }))
vi.mock('@capacitor/status-bar', () => ({
  StatusBar: { setOverlaysWebView: setOverlaysMock, setStyle: setStyleMock },
  Style: { Dark: 'DARK', Light: 'LIGHT' },
}))

import { isNativeApp, bindAppBackButton, hideSplashScreen, applyNativeChrome, syncStatusBarStyle } from '../../../src/platform/native'

const win: Record<string, unknown> = {}

beforeEach(() => {
  for (const k of Object.keys(win)) delete win[k]
  vi.stubGlobal('window', win)
  addListenerMock.mockReset()
  splashHideMock.mockReset()
  setOverlaysMock.mockReset().mockResolvedValue(undefined)
  setStyleMock.mockReset().mockResolvedValue(undefined)
  isNativeMock.mockReset().mockReturnValue(false)
  splashHideMock.mockResolvedValue(undefined)
  addListenerMock.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) })
  delete document.body.dataset.platform
  delete document.body.dataset.theme
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isNativeApp', () => {
  it('Capacitor.isNativePlatform natijasini qaytaradi', () => {
    expect(isNativeApp()).toBe(false)
    isNativeMock.mockReturnValue(true)
    expect(isNativeApp()).toBe(true)
  })

  it('Capacitor throw qilsa — xavfsiz false', () => {
    isNativeMock.mockImplementation(() => { throw new Error('no bridge') })
    expect(isNativeApp()).toBe(false)
  })
})

describe('bindAppBackButton — Telegram ichida (delegatsiya, xatti-harakat o\'zgarmas)', () => {
  beforeEach(() => {
    win.Telegram = {
      WebApp: {
        BackButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
      },
    }
  })

  const bb = () => (win.Telegram as { WebApp: { BackButton: Record<string, ReturnType<typeof vi.fn>> } }).WebApp.BackButton

  it('visible=true → TG BackButton; native listener QO\'SHILMAYDI (hatto APK uchun ham)', () => {
    isNativeMock.mockReturnValue(true)
    const onBack = vi.fn()
    const cleanup = bindAppBackButton(true, onBack)
    expect(bb().show).toHaveBeenCalledOnce()
    expect(bb().onClick).toHaveBeenCalledWith(onBack)
    expect(addListenerMock).not.toHaveBeenCalled()
    cleanup?.()
    expect(bb().offClick).toHaveBeenCalledWith(onBack)
  })

  it('visible=false → faqat TG hide, cleanup yo\'q', () => {
    expect(bindAppBackButton(false, () => {})).toBeUndefined()
    expect(bb().hide).toHaveBeenCalledOnce()
    expect(addListenerMock).not.toHaveBeenCalled()
  })
})

describe('bindAppBackButton — native APK (Telegram yo\'q)', () => {
  it('visible=true → hardware back listener bog\'lanadi, cleanup remove() qiladi', async () => {
    isNativeMock.mockReturnValue(true)
    const onBack = vi.fn()
    const cleanup = bindAppBackButton(true, onBack)
    expect(addListenerMock).toHaveBeenCalledWith('backButton', onBack)
    expect(cleanup).toBeTypeOf('function')
    const { remove } = await addListenerMock.mock.results[0]!.value as { remove: ReturnType<typeof vi.fn> }
    cleanup!()
    await Promise.resolve() // promise.then zanjiri ishlashi uchun
    expect(remove).toHaveBeenCalledOnce()
    cleanup!() // ikki marta chaqirish xavfsiz bo'lishi kerak
  })

  it('visible=false → listener yo\'q (bosh sahifada tizim default\'i qoladi)', () => {
    isNativeMock.mockReturnValue(true)
    expect(bindAppBackButton(false, () => {})).toBeUndefined()
    expect(addListenerMock).not.toHaveBeenCalled()
  })
})

describe('bindAppBackButton — oddiy brauzer', () => {
  it('no-op: cleanup ham, listener ham yo\'q', () => {
    expect(bindAppBackButton(true, () => {})).toBeUndefined()
    expect(addListenerMock).not.toHaveBeenCalled()
  })
})

describe('hideSplashScreen', () => {
  it('native APK\'da SplashScreen.hide() chaqiriladi', () => {
    isNativeMock.mockReturnValue(true)
    hideSplashScreen()
    expect(splashHideMock).toHaveBeenCalledOnce()
  })

  it('brauzer/Telegram\'da no-op', () => {
    hideSplashScreen()
    expect(splashHideMock).not.toHaveBeenCalled()
  })
})

describe('applyNativeChrome — edge-to-edge safe-area (APK status bar)', () => {
  it('native APK: body[data-platform=native] yoziladi + overlay yoqiladi + dark default style', () => {
    isNativeMock.mockReturnValue(true)
    applyNativeChrome()
    expect(document.body.dataset.platform).toBe('native')
    expect(setOverlaysMock).toHaveBeenCalledWith({ overlay: true })
    // body[data-theme] yo'q (boot script yozmagan) → dark default
    expect(setStyleMock).toHaveBeenCalledWith({ style: 'DARK' })
  })

  it('native APK + body[data-theme=light] (boot script) → LIGHT icon style', () => {
    isNativeMock.mockReturnValue(true)
    document.body.dataset.theme = 'light'
    applyNativeChrome()
    expect(setStyleMock).toHaveBeenCalledWith({ style: 'LIGHT' })
  })

  it('brauzer/Telegram: body TEGILMAYDI, StatusBar chaqirilmaydi (TG xatti-harakati o\'zgarmas)', () => {
    applyNativeChrome()
    expect(document.body.dataset.platform).toBeUndefined()
    expect(setOverlaysMock).not.toHaveBeenCalled()
    expect(setStyleMock).not.toHaveBeenCalled()
  })
})

describe('syncStatusBarStyle — app temasi bilan sinxron', () => {
  it('native: dark → DARK (oq iconlar), light → LIGHT (qora iconlar)', () => {
    isNativeMock.mockReturnValue(true)
    syncStatusBarStyle(true)
    expect(setStyleMock).toHaveBeenLastCalledWith({ style: 'DARK' })
    syncStatusBarStyle(false)
    expect(setStyleMock).toHaveBeenLastCalledWith({ style: 'LIGHT' })
  })

  it('brauzer/Telegram: no-op', () => {
    syncStatusBarStyle(true)
    expect(setStyleMock).not.toHaveBeenCalled()
  })
})
