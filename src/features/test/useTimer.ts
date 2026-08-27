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

  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}
