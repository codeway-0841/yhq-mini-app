import { useState } from 'react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { api, ApiError } from '../../../shared/api'
import { requestContact } from '../../../platform/telegram'
import type { Keys } from '../../../shared/i18n'

/**
 * Telegram kontakt-ruhsati → BOT FAST-PATH (SMS'siz) → SMS OTP fallback (H-2).
 *
 * Oqim (2026-08-28):
 * 1. requestContact'da rozi bo'lgan user uchun Telegram O'ZI bot chat'iga
 *    imzolangan contact xabarini yuboradi (rasmiy docs: "the bot will receive
 *    the phone details") — bot handler `contact.user_id === from.id` ni
 *    tekshirib users.phone'ni DARHOL yozadi (SMS kerak emas).
 * 2. Webhook asinxron — client GET /users/:id/phone ni bir necha soniya
 *    poll qiladi; raqam ko'rinsa — tayyor (spinner → yashil raqam + notice).
 * 3. Bot yetib kelmasa (eski client, webhook kechikishi) — eski SMS OTP
 *    oqimi ochiladi (server phone'ni FAQAT egalik isbotidan keyin yozadi).
 *
 * Bosqichlar: idle → otp (kod kutilmoqda, faqat fallback) → done.
 * `phoneError`/`phoneNotice` har doim i18n KALIT saqlaydi (caller tt() bilan ko'rsatadi).
 */

/** Bot webhook'i odatda <1s; 4×1.5s ≈ 6s oyna — undan oshsa OTP fallback. */
const BOT_LINK_ATTEMPTS = 4
const BOT_LINK_DELAY_MS = 1500

interface PhoneContactOptions {
  /** Test seam (prod'da berilmaydi — default'lar ishlatiladi). */
  pollAttempts?: number
  pollDelayMs?: number
}

export function usePhoneContact(options?: PhoneContactOptions) {
  const pollAttempts = options?.pollAttempts ?? BOT_LINK_ATTEMPTS
  const pollDelayMs = options?.pollDelayMs ?? BOT_LINK_DELAY_MS
  const updatePhone = useAppStore((s) => s.updatePhone)
  const setUser = useAppStore((s) => s.setUser)
  const [phoneLoading, setPhoneLoading] = useState(false)
  /** null = boshlang'ich holat; string = OTP kutilayotgan raqam */
  const [otpPhone, setOtpPhone] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<Keys | null>(null)
  const [phoneNotice, setPhoneNotice] = useState<Keys | null>(null)

  const flashError = (key: Keys) => {
    setPhoneError(key)
    setTimeout(() => setPhoneError(null), 3000)
  }
  const flashNotice = (key: Keys) => {
    setPhoneNotice(key)
    setTimeout(() => setPhoneNotice(null), 4000)
  }

  /** Bot contact-xabari users.phone'ni yozguncha poll; yozilganini ko'rsa true. */
  const pollBotLinkedPhone = async (userId: string, phone: string): Promise<boolean> => {
    for (let i = 0; i < pollAttempts; i++) {
      try {
        const { phone: linked } = await api.getLinkedPhone(userId)
        if (linked === phone) return true
      } catch { /* vaqtinchalik tarmoq xatosi — keyingi urinish */ }
      if (i < pollAttempts - 1) await new Promise((r) => setTimeout(r, pollDelayMs))
    }
    return false
  }

  // 1-qadam: Telegram'dan raqam olish → bot fast-path, bo'lmasa SMS OTP
  const handleAddPhone = () => {
    setPhoneLoading(true)
    setPhoneError(null)
    setPhoneNotice(null)

    const supported = requestContact((ok, data) => {
      if (!ok || !data?.contact?.phone_number) {
        setPhoneLoading(false)
        flashError('phoneContactDenied')
        return
      }

      // Server normalizatsiyasi bilan BIR XIL (contact-phone.ts) — aks holda
      // fast-path poll taqqoslashi mos kelmay, bekordan OTP'ga tushardi
      const phone = `+${data.contact.phone_number.replace(/[^\d]/g, '')}`
      const userId = useAppStore.getState().user?.id

      const run = async () => {
        // Fast-path: Telegram-imzolangan bot contact xabari raqamni yozdimi?
        if (userId && await pollBotLinkedPhone(userId, phone)) {
          const u = useAppStore.getState().user
          if (u) setUser({ ...u, phone })
          flashNotice('phoneLinkedOk')
          return
        }
        // Fallback: SMS OTP egalik isboti (H-2)
        await api.requestOTP({ phone })
        setOtpPhone(phone)
      }

      run()
        .catch((err) => {
          flashError(err instanceof ApiError && err.status === 429 ? 'authRateLimited' : 'authGenericError')
        })
        .finally(() => setPhoneLoading(false))
    })

    if (!supported) {
      setPhoneLoading(false)
      flashError('phoneNeedTelegram')
    }
  }

  // 2-qadam (fallback): SMS kodni serverga yuborish (egalik isboti bilan yozadi)
  const submitPhoneOtp = async (code: string): Promise<void> => {
    if (!otpPhone) return
    await updatePhone(otpPhone, code)   // optimistik; server xatoda rollback qiladi
    setOtpPhone(null)
  }

  const cancelPhoneOtp = () => setOtpPhone(null)

  return { phoneLoading, otpPhone, phoneError, phoneNotice, handleAddPhone, submitPhoneOtp, cancelPhoneOtp }
}
