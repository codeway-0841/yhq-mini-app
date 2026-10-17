import { useEffect, useRef, useState } from 'react'
import SplashScreen from './SplashScreen'
import { onLaunchDismissed } from './launch-exit'

/** index.css `.splash-exit` davomiyligi bilan bir xil. */
const FADE_MS = 300

/**
 * Launch ekranining "chiqish" nusxasi — video'dagi kabi ko'k ekran ilova
 * ustida so'nadi (keskin almashish o'rniga). Boot splash unmount bo'lganda
 * 300ms ko'rinadi va o'zini yo'q qiladi.
 *
 * main.tsx'da <App/ > yonida turadi: App qaysi ekranni chizishidan qat'i
 * nazar, overlay doim ilova ustida bo'ladi.
 */
export default function LaunchExitOverlay() {
  const [fading, setFading] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const off = onLaunchDismissed(() => {
      // Harakat o'chirilgan bo'lsa — so'nish ham kerak emas
      if (typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      window.clearTimeout(timer.current)
      setFading(true)
      timer.current = window.setTimeout(() => setFading(false), FADE_MS)
    })
    return () => {
      off()
      window.clearTimeout(timer.current)
    }
  }, [])

  if (!fading) return null

  return (
    <div className="splash-exit" aria-hidden="true">
      {/* exiting: o'zi yana signal bermaydi (cheksiz sikl bo'lmasin) */}
      <SplashScreen exiting />
    </div>
  )
}
