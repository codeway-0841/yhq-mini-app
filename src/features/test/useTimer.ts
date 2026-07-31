import { useEffect, useRef, useState } from 'react'

/** Countdown timer formatted as mm:ss. Restarts when `resetKey` changes. */
export function useTimer(onTimeUp: () => void, resetKey: unknown): string {
  const [seconds, setSeconds] = useState(25 * 60)
  const onTimeUpRef = useRef(onTimeUp)
  const firedRef    = useRef(false)

  useEffect(() => { onTimeUpRef.current = onTimeUp }, [onTimeUp])

  useEffect(() => {
    firedRef.current = false
    setSeconds(25 * 60)
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (!firedRef.current) {
            firedRef.current = true
            setTimeout(() => onTimeUpRef.current(), 0)
          }
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [resetKey])

  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}
