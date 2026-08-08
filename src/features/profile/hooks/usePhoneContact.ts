import { useState } from 'react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { requestContact } from '../../../platform/telegram'

/** Telegram kontakt-ruhsati orqali telefon raqamni qo'shish oqimi. */
export function usePhoneContact() {
  const updatePhone = useAppStore((s) => s.updatePhone)
  const [phoneLoading, setPhoneLoading] = useState(false)
  // Eslatma: phoneError qiymati hozircha UI'da ko'rsatilmaydi — faqat
  // timing logikasi (3s timeout) saqlanadi, keyingi iteratsiyada toast'ga ulanadi.
  const [, setPhoneError] = useState<string | null>(null)

  const handleAddPhone = () => {
    setPhoneLoading(true)
    setPhoneError(null)

    const supported = requestContact((ok, data) => {
      if (!ok || !data?.contact?.phone_number) {
        setPhoneLoading(false)
        setPhoneError('Ruxsat berilmadi')
        setTimeout(() => setPhoneError(null), 3000)
        return
      }

      let phone = data.contact.phone_number.trim()
      if (!phone.startsWith('+')) phone = '+' + phone

      updatePhone(phone)
        .catch(() => setPhoneError("Saqlashda xato. Qayta urinib ko'ring."))
        .finally(() => {
          setPhoneLoading(false)
          setTimeout(() => setPhoneError(null), 3000)
        })
    })

    if (!supported) {
      setPhoneLoading(false)
      setPhoneError('Telegram orqali kirish kerak')
      setTimeout(() => setPhoneError(null), 3000)
    }
  }

  return { phoneLoading, handleAddPhone }
}
