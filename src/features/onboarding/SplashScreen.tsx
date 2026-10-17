// KIVVI — launch screen: ilova ko'k fonida to'r kataklar (organik 3D to'lqin)
// silliq chayqaladi, markazdagi brend belgisi esa tabiiy chuqurlik bilan nafas oladi.
//
// Kirish animatsiyasi app.html loader'ida boshlanadi (birinchi kadrdayoq
// ko'rinadi). Bu komponent o'sha taymline'dan DAVOM etadi — `__kivviSplashStart`
// bo'lmasa (test, kechki Suspense fallback) 0 dan o'ynaydi.
import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { notifyLaunchDismissed } from './launch-exit'
import { initWaveGrid } from './wave-grid'

/** Katak + belgi animatsiyasi tugaydigan vaqt (index.css bilan bir xil). */
const LAUNCH_SETTLE_MS = 900

type SplashWindow = Window & { __kivviSplashStart?: number }

function elapsedSinceHtmlLoader(): number {
  if (typeof window === 'undefined') return 0
  const startedAt = (window as SplashWindow).__kivviSplashStart
  if (typeof startedAt !== 'number') return 0
  const elapsed = performance.now() - startedAt
  return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0
}

function getHtmlLoaderStartTime(): number {
  if (typeof window === 'undefined') return performance.now()
  const startedAt = (window as SplashWindow).__kivviSplashStart
  return typeof startedAt === 'number' && Number.isFinite(startedAt) ? startedAt : performance.now()
}

export default function SplashScreen({ exiting = false }: { exiting?: boolean }) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  // HTML loader allaqachon boshlagan — animatsiyalar shu siljishdan davom
  // etadi (manfiy delay = taymline o'rtasidan boshlash).
  const elapsed = Math.min(Math.round(elapsedSinceHtmlLoader()), LAUNCH_SETTLE_MS)
  const shift: CSSProperties = { ['--splash-shift' as string]: elapsed > 0 ? `-${elapsed}ms` : '0ms' }

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cleanup = initWaveGrid(canvas, {
      startTimeMs: getHtmlLoaderStartTime(),
    })
    return cleanup
  }, [])

  // Chiqish cross-fade'i (video 3.8–4.6s): unmount paytida signal beramiz,
  // LaunchExitOverlay splash'ning so'nayotgan nusxasini ilova ustida chizadi.
  const mountedAt = useRef(0)
  useLayoutEffect(() => { mountedAt.current = performance.now() }, [])
  useLayoutEffect(() => {
    if (exiting) return
    return () => {
      // StrictMode qayta mount'ida (0ms) yoki bir kadrlik almashishda
      // signal bermaymiz — faqat haqiqiy chiqishda
      if (performance.now() - mountedAt.current > 120) notifyLaunchDismissed()
    }
  }, [exiting])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={tt('splashLoadingLabel')}
      style={shift}
      className={`splash-screen fixed inset-0 z-[70] flex items-center justify-center overflow-hidden select-none ${exiting ? 'splash-screen-exiting' : ''}`}>

      {/* Matematik to'r — fon qatlami */}
      <div className="splash-grid" aria-hidden="true" />

      <div className="splash-cell">
        {/* Organik to'lqinli to'r: Canvas 2D liquid mesh */}
        <div className="splash-cell-grid" aria-hidden="true">
          <canvas ref={canvasRef} className="splash-wave-canvas" aria-hidden="true" />
        </div>
        {/* webp 30 KB / png 52 KB — belgi birinchi ko'rinadigan rasm, shuning
            uchun avval webp, uni qo'llamagan WebView'da png'ga tushadi. */}
        <picture>
          <source srcSet="/images/splash-mark.webp" type="image/webp" />
          <img
            src="/images/splash-mark.png"
            alt="KIVVI"
            width={512}
            height={512}
            decoding="async"
            className="splash-mark select-none"
          />
        </picture>
      </div>
    </div>
  )
}
