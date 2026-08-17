import { useState } from 'react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { api, ApiError } from '../../../shared/api'
import { requestContact } from '../../../platform/telegram'
import type { Keys } from '../../../shared/i18n'

/**
 * Telegram kontakt-ruhsati → SMS OTP isboti → telefon ulash oqimi (H-2 audit).
 * Server phone'ni FAQAT kod tasdiqlangach yozadi — begona raqam ulab bo'lmaydi.
 * Bosqichlar: idle → otp (kod kutilmoqda) → done.
 * `phoneError` har doim i18n KALIT saqlaydi (caller tt() bilan ko'rsatadi).
 */
export function usePhoneContact() {
  const updatePhone = useAppStore((s) => s.updatePhone)
  const [phoneLoading, setPhoneLoading] = useState(false)
  /** null = boshlang'ich holat; string = OTP kutilayotgan raqam */
  const [otpPhone, setOtpPhone] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<Keys | null>(null)

  const flashError = (key: Keys) => {
    setPhoneError(key)
    setTimeout(() => setPhoneError(null), 3000)
  }

  // 1-qadam: Telegram'dan raqam olish + SMS OTP yuborish
  const handleAddPhone = () => {
    setPhoneLoading(true)
    setPhoneError(null)

    const supported = requestContact((ok, data) => {
      if (!ok || !data?.contact?.phone_number) {
        setPhoneLoading(false)
        flashError('phoneContactDenied')
        return
      }

      let phone = data.contact.phone_number.trim()
      if (!phone.startsWith('+')) phone = '+' + phone

      api.requestOTP({ phone })
        .then(() => setOtpPhone(phone))
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

  // 2-qadam: SMS kodni serverga yuborish (egalik isboti bilan yozadi)
  const submitPhoneOtp = async (code: string): Promise<void> => {
    if (!otpPhone) return
    await updatePhone(otpPhone, code)   // optimistik; server xatoda rollback qiladi
    setOtpPhone(null)
  }

  const cancelPhoneOtp = () => setOtpPhone(null)

  return { phoneLoading, otpPhone, phoneError, handleAddPhone, submitPhoneOtp, cancelPhoneOtp }
}
