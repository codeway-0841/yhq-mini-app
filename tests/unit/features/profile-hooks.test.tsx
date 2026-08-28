/**
 * Profil hooklari — telefon ulash (Telegram kontakt → BOT FAST-PATH (SMS'siz)
 * → SMS OTP fallback) va avatar yuklash/o'chirish (SERVER-FIRST: server
 * yozmaguncha lokal o'zgarmaydi).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'

const { mockRequestOTP, mockGetLinkedPhone, mockUploadAvatar, mockRemoveAvatar, mockRequestContact, mockHeic2any } = vi.hoisted(() => ({
  mockRequestOTP: vi.fn(),
  mockGetLinkedPhone: vi.fn(),
  mockUploadAvatar: vi.fn(),
  mockRemoveAvatar: vi.fn(),
  mockRequestContact: vi.fn(),
  mockHeic2any: vi.fn(),
}))
vi.mock('heic2any', () => ({ default: mockHeic2any }))
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      requestOTP: mockRequestOTP,
      getLinkedPhone: mockGetLinkedPhone,
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
  // Default: bot fast-path raqamni (hali) yozmagan → SMS OTP fallback
  mockGetLinkedPhone.mockReset().mockResolvedValue({ phone: null })
  mockUploadAvatar.mockReset().mockResolvedValue({ ok: true })
  mockRemoveAvatar.mockReset().mockResolvedValue({ ok: true })
  mockRequestContact.mockReset()
  mockHeic2any.mockReset()
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    user: { id: '12345', firstName: 'Ali' } as never,
    customAvatar: null,
  })
})

/** Real poll delay testlarni sekinlashtirmasligi uchun delay'siz seam. */
const renderPhone = () => renderHook(() => usePhoneContact({ pollAttempts: 2, pollDelayMs: 0 }))

// globals:false — RTL auto-cleanup YO'Q. Qo'lda: unmount hook'ning fon
// kuzatuvini (watchBotLinkDuringOtp timer'lari) o'chiradi — aks holda OLDINGI
// test'ning watcher'i keyingi test'dagi mock'ni konsumatsiya qiladi.
afterEach(() => { cleanup() })

describe('usePhoneContact', () => {
  it('FAST-PATH: bot raqamni yozgan bo\'lsa — SMS YO\'Q, store yangilanadi + notice', async () => {
    mockRequestContact.mockImplementation((cb: (ok: boolean, data?: unknown) => void) => {
      cb(true, { contact: { phone_number: '998901234567' } })
      return true
    })
    mockGetLinkedPhone.mockResolvedValue({ phone: '+998901234567' })

    const { result } = renderPhone()
    act(() => { result.current.handleAddPhone() })

    await waitFor(() => expect(result.current.phoneNotice).toBe('phoneLinkedOk'))
    expect(mockRequestOTP).not.toHaveBeenCalled()       // SMS xarajati nol
    expect(result.current.otpPhone).toBeNull()          // OTP bosqichi ochilmaydi
    expect(useAppStore.getState().user?.phone).toBe('+998901234567')
    expect(result.current.phoneLoading).toBe(false)
  })

  it('bot fast-path topilmasa — raqamga SMS kod yuboriladi va OTP bosqichiga o\'tadi', async () => {
    mockRequestContact.mockImplementation((cb: (ok: boolean, data?: unknown) => void) => {
      cb(true, { contact: { phone_number: '998901234567' } })
      return true
    })

    const { result } = renderPhone()
    act(() => { result.current.handleAddPhone() })

    // Avval fast-path poll, keyin fallback — raqam '+' bilan normallashtiriladi
    await waitFor(() => expect(mockRequestOTP).toHaveBeenCalledWith({ phone: '+998901234567' }))
    await waitFor(() => expect(result.current.otpPhone).toBe('+998901234567'))
    expect(mockGetLinkedPhone).toHaveBeenCalled()
    expect(result.current.phoneError).toBeNull()
  })

  it('COLD START: bot yozuvi kech kelsa — OTP ochilgach fon kuzatuv o\'zi yopadi', async () => {
    mockRequestContact.mockImplementation((cb: (ok: boolean, data?: unknown) => void) => {
      cb(true, { contact: { phone_number: '+998901234567' } })
      return true
    })
    // Dastlabki poll urinishlari → hali yozilmagan; watcher tekshiruvida yozilgan
    mockGetLinkedPhone
      .mockResolvedValueOnce({ phone: null })
      .mockResolvedValueOnce({ phone: null })
      .mockResolvedValue({ phone: '+998901234567' })

    const { result } = renderPhone()
    act(() => { result.current.handleAddPhone() })

    // Fon kuzatuv kech kelgan yozuvni tutib, OTP'ni o'zi yopadi
    // (test'da watcher delay ~1ms — oraliq OTP holati waitFor'ga tushmaydi,
    //  shuning uchun FINAL holat + fallback chaqirig'i tekshiriladi)
    await waitFor(() => expect(result.current.phoneNotice).toBe('phoneLinkedOk'))
    expect(mockRequestOTP).toHaveBeenCalledWith({ phone: '+998901234567' })  // fallback ishga tushgan edi
    expect(result.current.otpPhone).toBeNull()                                // watcher yopdi
    expect(useAppStore.getState().user?.phone).toBe('+998901234567')
    expect(mockGetLinkedPhone.mock.calls.length).toBeGreaterThanOrEqual(3)    // 2 poll + ≥1 watcher
  })

  it('kontakt rad etilsa — xato kaliti, na poll na SMS', async () => {
    mockRequestContact.mockImplementation((cb: (ok: boolean, data?: unknown) => void) => {
      cb(false)
      return true
    })

    const { result } = renderPhone()
    act(() => { result.current.handleAddPhone() })

    await waitFor(() => expect(result.current.phoneError).toBe('phoneContactDenied'))
    expect(mockGetLinkedPhone).not.toHaveBeenCalled()
    expect(mockRequestOTP).not.toHaveBeenCalled()
    expect(result.current.otpPhone).toBeNull()
  })

  it('Telegram muhiti bo\'lmasa — phoneNeedTelegram', async () => {
    mockRequestContact.mockReturnValue(false)

    const { result } = renderPhone()
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

    const { result } = renderPhone()
    act(() => { result.current.handleAddPhone() })

    await waitFor(() => expect(result.current.phoneError).toBe('authRateLimited'))
    expect(result.current.otpPhone).toBeNull()
  })

  it('startManualPhone (SMS orqali qo\'lda raqam) — kod yuborilib OTP bosqichiga o\'tadi', async () => {
    const { result } = renderPhone()
    await act(async () => { await result.current.startManualPhone('+998901234567') })

    expect(mockRequestOTP).toHaveBeenCalledWith({ phone: '+998901234567' })
    expect(result.current.otpPhone).toBe('+998901234567')
    expect(result.current.phoneError).toBeNull()
    expect(result.current.phoneLoading).toBe(false)
  })

  it('startManualPhone 429 — authRateLimited, OTP ochilmaydi', async () => {
    mockRequestOTP.mockRejectedValue(new ApiError(429, 'slow down'))
    const { result } = renderPhone()
    await act(async () => { await result.current.startManualPhone('+998901234567') })

    await waitFor(() => expect(result.current.phoneError).toBe('authRateLimited'))
    expect(result.current.otpPhone).toBeNull()
    expect(result.current.phoneLoading).toBe(false)
  })

  it('cancelPhoneOtp OTP bosqichini bekor qiladi', async () => {
    mockRequestContact.mockImplementation((cb: (ok: boolean, data?: unknown) => void) => {
      cb(true, { contact: { phone_number: '+998901234567' } })
      return true
    })

    const { result } = renderPhone()
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

  /** compressAvatar canvas'ga tayanadi — jsdom'da uni boshqarib turamiz.
   *  failImages — dastlabki N ta Image yuklash onerror bilan tugaydi (HEIC stub). */
  function stubCanvas(dataUrl: string | ((mime?: string) => string), failImages = 0) {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      (typeof dataUrl === 'string' ? () => dataUrl : dataUrl) as () => string,
    )
    // Image.onload'ni darhol ishga tushiramiz
    let imgCount = 0
    vi.spyOn(window, 'Image').mockImplementation(function (this: HTMLImageElement) {
      const n = ++imgCount
      const img = { width: 512, height: 512 } as unknown as HTMLImageElement
      Object.defineProperty(img, 'src', {
        set() {
          queueMicrotask(() => {
            const rec = img as unknown as Record<string, (() => void) | undefined>
            if (n <= failImages) rec['onerror']?.()
            else rec['onload']?.()
          })
        },
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

  it('HEIC rasm WebView ocholmasa — client o\'zi JPEG\'ga o\'girib yuklaydi', async () => {
    stubCanvas('data:image/webp;base64,HEIC_OK', 1)   // 1-decode fail (HEIC), 2-o'girilgan JPEG OK
    mockHeic2any.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }))
    const { result } = renderUpload()

    const heicEvent = {
      target: { files: [new File(['x'], 'IMG_1234.HEIC', { type: 'image/heic' })], value: 'x' },
    } as unknown as React.ChangeEvent<HTMLInputElement>
    await act(async () => { await result.current.handleAvatarFile(heicEvent) })

    expect(mockHeic2any).toHaveBeenCalledTimes(1)
    expect(mockUploadAvatar).toHaveBeenCalledWith('12345', 'data:image/webp;base64,HEIC_OK')
    expect(useAppStore.getState().customAvatar).toBe('data:image/webp;base64,HEIC_OK')
  })

  it('HEIC ham bo\'lmagan buzuk fayl — yuklanmaydi (haqiqiy format xatosi)', async () => {
    stubCanvas('data:image/webp;base64,NOPE', 99)   // har decode fail
    mockHeic2any.mockRejectedValue(new Error('not heic'))
    const { result } = renderUpload()

    await act(async () => { await result.current.handleAvatarFile(fileEvent()) })

    expect(mockUploadAvatar).not.toHaveBeenCalled()
    expect(useAppStore.getState().customAvatar).toBeNull()
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
