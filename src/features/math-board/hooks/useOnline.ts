/**
 * Math Board — online/offline kuzatuv (Faza 7 polish).
 *
 * Recognition va AI hint network talab qiladi — offline'da tugmalar o'chadi,
 * sabab ko'rsatiladi. Lokal check (engine) offline'da ham ishlaydi.
 */

import { useEffect, useState } from 'react'

export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const on = (): void => setOnline(true)
    const off = (): void => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return online
}
