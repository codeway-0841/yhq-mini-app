import { useCallback, useState } from 'react'
import { isValidPhone, toE164 } from '../validation'

/**
 * +998 prefiksli controlled telefon input'i.
 * `digits` — UI'dagi raqam-only qism (9 tagacha), `value` — to'liq E.164.
 */
export function usePhoneInput() {
  const [digits, setDigitsState] = useState('')

  const setDigits = useCallback((raw: string) => {
    setDigitsState(toE164(raw).slice(4)) // "+998" prefikssiz qism (9 raqamga clamp'langan)
  }, [])

  const reset = useCallback(() => {
    setDigitsState('')
  }, [])

  const value = `+998${digits}`
  return { value, digits, setDigits, reset, isValid: isValidPhone(value) }
}
