import { useEffect, useRef, useState } from 'react'
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
 * 2. Webhook asinxron — client GET /users/:id/phone ni poll qiladi; raqam
 *    ko'rinsa — tayyor (spinner → yashil raqam + notice).
 * 3. Bot yetib kelmasa (bot bloklangan, eski TG client) — SMS OTP fallback.
 * 4. OTP ekrani ochilgach HAM fon kuzatuv davom etadi — bot yozuvi KECH
 *    kelgan bo'lsa (cold start race) OTP oynasi o'zi yopilib notice chiqadi
 *    (2026-08-28 prod incident: deploy'dan keyingi cold start 6s oynadan
 *    oshib, bot ✅ yozgan-app OTP ochgan mismatch).
 *
 * Bosqichlar: idle → otp (kod kutilmoqda, faqat fallback) → done.
 * `phoneError`/`phoneNotice` har doim i18n KALIT saqlaydi (caller tt() bilan ko'rsatadi).
 */

/** Bot webhook warm'da <1s; lekin Vercel fn + Neon COLD START 5-8s —
 *  oyna ~12s (7×2s) bo'lishi shart, aks holda bot yozuvi oynadan kech qoladi. */
const BOT_LINK_ATTEMPTS = 7
const BOT_LINK_DELAY_MS = 2000
/** OTP ekrani ochilgach ham NECHA marta fon tekshiruv (kech cold-start yozuvi). */
const BOT_LINK_WATCH_ATTEMPTS = 3

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
  /** Fon kuzatuv generatsiyasi — cancel/submit/unmount'da eski watcher o'chadi. */
  const watchGenRef = useRef(0)
  useEffect(() => () => { watchGenRef.current++ }, [])   // unmount — watcher to'xtaydi

  const flashError = (key: Keys) => {
    setPhoneError(key)
    setTimeout(() => setPhoneError(null), 3000)
  }
  const flashNotice = (key: Keys) => {
    setPhoneNotice(key)
    setTimeout(() => setPhoneNotice(null), 4000)
  }

  /** Fast-path muvaffaqiyati — store + notice (poll va watcher UMUMIY nuqtasi). */
  const applyBotLinkedPhone = (phone: string) => {
    const u = useAppStore.getState().user
    if (u) setUser({ ...u, phone })
    setOtpPhone(null)           // OTP ekrani ochiq bo'lsa — yopiladi
    flashNotice('phoneLinkedOk')
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

  /** OTP ekrani ochilgach ham FON kuzatuv — cold start'da bot yozuvi poll
   *  oynasidan KECH qolsa, SMS kiritish shart bo'lmasdan o'zi yopiladi. */
  const watchBotLinkDuringOtp = (userId: string, phone: string) => {
    const gen = ++watchGenRef.current
    void (async () => {
      for (let i = 0; i < BOT_LINK_WATCH_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, Math.max(pollDelayMs, 1)))
        if (watchGenRef.current !== gen) return   // bekor qilingan / tasdiqlangan
        try {
          const { phone: linked } = await api.getLinkedPhone(userId)
          if (linked === phone) { applyBotLinkedPhone(phone); return }
        } catch { /* ignore */ }
      }
    })()
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
          applyBotLinkedPhone(phone)
          return
        }
        // Fallback: SMS OTP egalik isboti (H-2)
        await api.requestOTP({ phone })
        setOtpPhone(phone)
        if (userId) watchBotLinkDuringOtp(userId, phone)   // kech cold-start yozuvi
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

  // SMS orqali qo'lda raqam kiritish (PhoneEditSheet "SMS orqali" yo'li) —
  // boshqa raqam (TG'niki emas) yoki Telegram'siz muhit (APK/brauzer) uchun.
  const startManualPhone = async (phone: string): Promise<void> => {
    setPhoneLoading(true)
    setPhoneError(null)
    setPhoneNotice(null)
    try {
      await api.requestOTP({ phone })
      setOtpPhone(phone)
    } catch (err) {
      flashError(err instanceof ApiError && err.status === 429 ? 'authRateLimited' : 'authGenericError')
    } finally {
      setPhoneLoading(false)
    }
  }

  // 2-qadam (fallback): SMS kodni serverga yuborish (egalik isboti bilan yozadi)
  const submitPhoneOtp = async (code: string): Promise<void> => {
    if (!otpPhone) return
    watchGenRef.current++              // fon kuzatuvni to'xtatish
    await updatePhone(otpPhone, code)   // optimistik; server xatoda rollback qiladi
    setOtpPhone(null)
  }

  const cancelPhoneOtp = () => {
    watchGenRef.current++              // fon kuzatuvni to'xtatish
    setOtpPhone(null)
  }

  return { phoneLoading, otpPhone, phoneError, phoneNotice, handleAddPhone, startManualPhone, submitPhoneOtp, cancelPhoneOtp }
}
