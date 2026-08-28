/**
 * Profil hooklari — telefon ulash (Telegram kontakt → SMS OTP) va avatar
 * yuklash/o'chirish (SERVER-FIRST: server yozmaguncha lokal o'zgarmaydi).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockRequestOTP, mockUploadAvatar, mockRemoveAvatar, mockRequestContact } = vi.hoisted(() => ({
  mockRequestOTP: vi.fn(),
  mockUploadAvatar: vi.fn(),
  mockRemoveAvatar: vi.fn(),
  mockRequestContact: vi.fn(),
}))
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      requestOTP: mockRequestOTP,
      uploadAvatar: mockUploadAvatar,
      removeAvatar: mockRemoveAvatar,
    },
  }
})
vi.mock('../../../src/platform/telegram', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/platform/telegram')>()
  return { ...actual, requestContact: mockRequestContact }
})

import { usePhoneContact } from '../../../src/features/profile/hooks/usePhoneContact'
import { useAvatarUpload, AVATAR_MAX_DATA_URL_LEN } from '../../../src/features/profile/hooks/useAvatarUpload'
import { ApiError } from '../../../src/shared/api'
import { useAppStore } from '../../../src/shared/store/useAppStore'

beforeEach(() => {
  mockRequestOTP.mockReset().mockResolvedValue({ ok: true })
  mockUploadAvatar.mockReset().mockResolvedValue({ ok: true })
  mockRemoveAvatar.mockReset().mockResolvedValue({ ok: true })
  mockRequestContact.mockReset()
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    user: { id: '12345', firstName: 'Ali' } as never,
    customAvatar: null,
  })
})

describe('usePhoneContact', () => {
  it('kontakt berilsa raqamga SMS kod yuboriladi va OTP bosqichiga o\'tadi', async () => {
    mockRequestContact.mockImplementation((cb: (ok: boolean, data?: unknown) => void) => {
      cb(true, { contact: { phone_number: '998901234567' } })
      return true
    })

    const { result } = renderHook(() => usePhoneContact())
    act(() => { result.current.handleAddPhone() })

    // Raqam '+' bilan normallashtiriladi
    await waitFor(() => expect(mockRequestOTP).toHaveBeenCalledWith({ phone: '+998901234567' }))
    await waitFor(() => expect(result.current.otpPhone).toBe('+998901234567'))
    expect(result.current.phoneError).toBeNull()
  })

  it('kontakt rad etilsa — xato kaliti, SMS yuborilmaydi', async () => {
    mockRequestContact.mockImplementation((cb: (ok: boolean, data?: unknown) => void) => {
      cb(false)
      return true
    })

    const { result } = renderHook(() => usePhoneContact())
    act(() => { result.current.handleAddPhone() })

    await waitFor(() => expect(result.current.phoneError).toBe('phoneContactDenied'))
    expect(mockRequestOTP).not.toHaveBeenCalled()
    expect(result.current.otpPhone).toBeNull()
  })

  it('Telegram muhiti bo\'lmasa — phoneNeedTelegram', async () => {
    mockRequestContact.mockReturnValue(false)

    const { result } = renderHook(() => usePhoneContact())
    act(() => { result.current.handleAddPhone() })

    await waitFor(() => expect(result.current.phoneError).toBe('phoneNeedTelegram'))
    expect(result.current.phoneLoading).toBe(false)
  })

  it('OTP so\'rovi 429 bo\'lsa — authRateLimited kaliti', async () => {
    mockRequestContact.mockImplementation((cb: (ok: boolean, data?: unknown) => void) => {
      cb(true, { contact: { phone_number: '+998901234567' } })
      return true
    })
    mockRequestOTP.mockRejectedValue(new ApiError(429, 'slow down'))

    const { result } = renderHook(() => usePhoneContact())
    act(() => { result.current.handleAddPhone() })

    await waitFor(() => expect(result.current.phoneError).toBe('authRateLimited'))
    expect(result.current.otpPhone).toBeNull()
  })

  it('cancelPhoneOtp OTP bosqichini bekor qiladi', async () => {
    mockRequestContact.mockImplementation((cb: (ok: boolean, data?: unknown) => void) => {
      cb(true, { contact: { phone_number: '+998901234567' } })
      return true
    })

    const { result } = renderHook(() => usePhoneContact())
    act(() => { result.current.handleAddPhone() })
    await waitFor(() => expect(result.current.otpPhone).not.toBeNull())

    act(() => { result.current.cancelPhoneOtp() })
    expect(result.current.otpPhone).toBeNull()
  })
})

describe('useAvatarUpload', () => {
  const showToast = vi.fn()
  const closeSheet = vi.fn()
  const renderUpload = () => renderHook(() => useAvatarUpload({ showToast, closeSheet }))

  /** compressAvatar canvas'ga tayanadi — jsdom'da uni boshqarib turamiz */
  function stubCanvas(dataUrl: string | ((mime?: string) => string)) {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      (typeof dataUrl === 'string' ? () => dataUrl : dataUrl) as () => string,
    )
    // Image.onload'ni darhol ishga tushiramiz
    vi.spyOn(window, 'Image').mockImplementation(function (this: HTMLImageElement) {
      const img = { width: 512, height: 512 } as unknown as HTMLImageElement
      Object.defineProperty(img, 'src', {
        set() { queueMicrotask(() => (img as unknown as { onload: () => void }).onload?.()) },
      })
      return img
    } as unknown as typeof Image)
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
  }

  const fileEvent = () => ({
    target: { files: [new File(['x'], 'a.png', { type: 'image/png' })], value: 'a.png' },
  } as unknown as React.ChangeEvent<HTMLInputElement>)

  beforeEach(() => {
    showToast.mockReset()
    closeSheet.mockReset()
    vi.restoreAllMocks()
  })

  it('rasm siqiladi, SERVERGA yuboriladi va shundan keyin lokal store yangilanadi', async () => {
    stubCanvas('data:image/webp;base64,SHORT')
    const { result } = renderUpload()

    await act(async () => { await result.current.handleAvatarFile(fileEvent()) })

    expect(mockUploadAvatar).toHaveBeenCalledWith('12345', 'data:image/webp;base64,SHORT')
    expect(useAppStore.getState().customAvatar).toBe('data:image/webp;base64,SHORT')
    expect(closeSheet).toHaveBeenCalled()
    expect(showToast).toHaveBeenCalled()
  })

  it('server xatosi — lokal avatar YOZILMAYDI (server-first)', async () => {
    stubCanvas('data:image/webp;base64,SHORT')
    mockUploadAvatar.mockRejectedValue(new Error('500'))
    const { result } = renderUpload()

    await act(async () => { await result.current.handleAvatarFile(fileEvent()) })

    expect(useAppStore.getState().customAvatar).toBeNull()
    expect(closeSheet).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalled()
  })

  it('limitdan katta rasm yuborilmaydi (barcha adaptiv bosqichlar sig\'magan holda)', async () => {
    stubCanvas('data:image/webp;base64,' + 'A'.repeat(AVATAR_MAX_DATA_URL_LEN))
    const { result } = renderUpload()

    await act(async () => { await result.current.handleAvatarFile(fileEvent()) })

    expect(mockUploadAvatar).not.toHaveBeenCalled()
    expect(useAppStore.getState().customAvatar).toBeNull()
  })

  it('birinchi siqish limitdan oshsa — sifat tushirilib QAYTA siqilib yuboriladi', async () => {
    let calls = 0
    stubCanvas(() =>
      ++calls === 1
        ? 'data:image/webp;base64,' + 'A'.repeat(AVATAR_MAX_DATA_URL_LEN)
        : 'data:image/webp;base64,SMALL')
    const { result } = renderUpload()

    await act(async () => { await result.current.handleAvatarFile(fileEvent()) })

    expect(calls).toBeGreaterThan(1)   // qayta siqildi
    expect(mockUploadAvatar).toHaveBeenCalledWith('12345', 'data:image/webp;base64,SMALL')
    expect(useAppStore.getState().customAvatar).toBe('data:image/webp;base64,SMALL')
  })

  it('WebP codec yo\'q WebView (jimgina PNG qaytaradi) — JPEG fallback yuboriladi', async () => {
    stubCanvas((mime) =>
      mime === 'image/webp' ? 'data:image/png;base64,PNG_FALLBACK' : 'data:image/jpeg;base64,JPEG_OK')
    const { result } = renderUpload()

    await act(async () => { await result.current.handleAvatarFile(fileEvent()) })

    expect(mockUploadAvatar).toHaveBeenCalledWith('12345', 'data:image/jpeg;base64,JPEG_OK')
    expect(useAppStore.getState().customAvatar).toBe('data:image/jpeg;base64,JPEG_OK')
  })

  it('o\'chirish ham server-first: DELETE o\'tsa lokal tozalanadi', async () => {
    useAppStore.setState({ customAvatar: 'data:image/webp;base64,OLD' })
    const { result } = renderUpload()

    await act(async () => { await result.current.removeAvatar() })

    expect(mockRemoveAvatar).toHaveBeenCalledWith('12345')
    expect(useAppStore.getState().customAvatar).toBeNull()
  })

  it('DELETE yiqilsa lokal avatar SAQLANADI', async () => {
    useAppStore.setState({ customAvatar: 'data:image/webp;base64,OLD' })
    mockRemoveAvatar.mockRejectedValue(new Error('500'))
    const { result } = renderUpload()

    await act(async () => { await result.current.removeAvatar() })

    expect(useAppStore.getState().customAvatar).toBe('data:image/webp;base64,OLD')
  })
})
