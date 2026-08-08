/**
 * Capacitor (native APK) adapter — UI kodi platforma farqini bilmasligi shart:
 * Telegram'da TG BackButton delegatsiyasi, APK'da hardware back, brauzerda no-op.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { addListenerMock, splashHideMock, isNativeMock } = vi.hoisted(() => ({
  addListenerMock: vi.fn(),
  splashHideMock: vi.fn(),
  isNativeMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: isNativeMock } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: addListenerMock } }))
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: splashHideMock } }))

import { isNativeApp, bindAppBackButton, hideSplashScreen } from '../../../src/platform/native'

const win: Record<string, unknown> = {}

beforeEach(() => {
  for (const k of Object.keys(win)) delete win[k]
  vi.stubGlobal('window', win)
  addListenerMock.mockReset()
  splashHideMock.mockReset()
  isNativeMock.mockReset().mockReturnValue(false)
  splashHideMock.mockResolvedValue(undefined)
  addListenerMock.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) })
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
