import { useEffect, useRef, useState } from 'react'

/**
 * Countdown timer formatted as mm:ss. Restarts when `resetKey` changes.
 *
 * WALL-CLOCK asosida (deadline): Telegram WebView background'da setInterval
 * suspenssiya bo'ladi — tick-ga asoslangan timer "soatini to'xtatardi" va
 * foydalanuvchi ilovani minimizatsiya qilib vaqt "to'xtatib" qo'yishi mumkin edi.
 * Endi: har tick'da Date.now() dan qolgan vaqt hisoblanadi; app qaytganda
 * real vaqt ko'rsatiladi, muddati o'tgan bo'lsa darhol time-up chaqiriladi.
 */
export function useTimer(onTimeUp: () => void, resetKey: unknown, totalSeconds = 25 * 60): string {
  const [seconds, setSeconds] = useState(totalSeconds)
  const onTimeUpRef = useRef(onTimeUp)
  const firedRef    = useRef(false)
  const deadlineRef = useRef(0)

  useEffect(() => { onTimeUpRef.current = onTimeUp }, [onTimeUp])

  useEffect(() => {
    firedRef.current  = false
    deadlineRef.current = Date.now() + totalSeconds * 1000
    setSeconds(totalSeconds)

    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
      setSeconds(left)
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        onTimeUpRef.current()
      }
    }

    const id = setInterval(tick, 1000)
    // App foreground'ga qaytganda darhol real vaqtni ko'rsat
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [resetKey, totalSeconds])

  return formatTimerLeft(seconds)
}

/**
 * Soniyalar → "mm:ss" (60+ daqiqada "h:mm:ss", masalan marafon 5:00:00).
 */
export function formatTimerLeft(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * "mm:ss" / "h:mm:ss" → qolgan soniyalar (urgency rangi uchun; hook API'si o'zgarmaydi).
 * Noto'g'ri format xavfsiz 0 qaytaradi.
 */
export function parseTimerLeft(timer: string): number {
  const parts = timer.split(':').map(Number)
  if (parts.some((n) => !Number.isFinite(n))) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}
