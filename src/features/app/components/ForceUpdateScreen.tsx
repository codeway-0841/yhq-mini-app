/**
 * Majburiy yangilash ekrani — APK versiyasi server'dagi minVersion'dan past
 * bo'lganda ko'rsatiladi. Dismiss qilib BO'LMAYDI (ilovani ishlatish mumkin emas).
 *
 * Yumshoq (soft) variant: dismiss qilinadigan banner — foydalanuvchi
 * "Keyinroq" bosib davom etishi mumkin.
 */
import { useCallback } from 'react'
import { t } from '../../../shared/i18n'
import type { Lang } from '../../../shared/i18n'
import type { AppVersionInfo } from '../../../platform/version-check'

interface ForceUpdateScreenProps {
  lang: Lang
  info: AppVersionInfo
  currentVersion: string
}

/** Blokirovka ekrani — oddiy, toza va ortiqcha bezaklarsiz (original holat) */
export default function ForceUpdateScreen({ lang, info, currentVersion }: ForceUpdateScreenProps) {
  const handleUpdate = useCallback(() => {
    window.open(info.updateUrl, '_system')
  }, [info.updateUrl])

  return (
    <div className="first-launch-screen bg-pcanvas text-pfg flex items-center justify-center overflow-y-auto overscroll-contain px-6 py-6">
      <div className="card-premium max-w-sm w-full text-center flex flex-col items-center gap-4 p-6">
        <div className="text-5xl">🚀</div>

        <div className="text-lg font-bold leading-snug">
          {t(lang, 'forceUpdateTitle')}
        </div>

        <p className="text-sm text-pmuted leading-relaxed">
          {t(lang, 'forceUpdateBody')}
        </p>

        <div className="w-full flex flex-col gap-2 mt-1">
          <button
            type="button"
            className="btn-premium w-full flex items-center justify-center gap-2"
            onClick={handleUpdate}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 20.5v-17c0-.83.52-1.28 1.09-1.45.57-.17 1.24-.04 1.73.25L19.3 10.8c.47.27.7.67.7 1.2s-.23.93-.7 1.2L5.82 21.7c-.49.29-1.16.42-1.73.25C3.52 21.78 3 21.33 3 20.5z" />
            </svg>
            {t(lang, 'forceUpdateButton')}
          </button>
        </div>

        <p className="text-xs text-psubtle">
          v{currentVersion} → v{info.latestVersion}
        </p>
      </div>
    </div>
  )
}

interface SoftUpdateBannerProps {
  lang: Lang
  info: AppVersionInfo
  currentVersion?: string
  onDismiss?: () => void
}

/**
 * Tepadagi suzuvchi kapsula (pill).
 * Dashboard'dagi Dynamic Island uslubida:
 * - Tabiiy shisha fon (--p-card-rgb / text-pfg)
 * - Dashboard kabi nozik "pulse" indikatori
 */
export function SoftUpdateBanner({ lang, info }: SoftUpdateBannerProps) {
  const handleUpdate = useCallback(() => {
    window.open(info.updateUrl, '_system')
  }, [info.updateUrl])

  return (
    <div className="fixed top-[calc(var(--safe-top,0px)+0.75rem)] left-0 right-0 z-[9999] flex justify-center pointer-events-none px-4">
      <button
        type="button"
        onClick={handleUpdate}
        className="pointer-events-auto inline-flex items-center justify-center gap-3 px-5 py-2 rounded-full 
                   bg-[rgb(var(--p-card-rgb)/0.92)] 
                   text-pfg 
                   backdrop-blur-2xl saturate-150 
                   border border-plineStrong 
                   hover:bg-[rgb(var(--p-card-rgb)/0.98)]
                   active:scale-[0.97] transition-all duration-150 cursor-pointer select-none"
      >
        {/* Dashboard Dynamic Island'dagi kabi nafis pulse */}
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-blue-500" />
        </span>

        {/* Matn */}
        <span className="text-[13.5px] font-medium text-pfg tracking-tight">
          {lang === 'ru' ? 'Доступно обновление' : 'Yangi versiya mavjud'}
        </span>

        {/* Versiya */}
        {info.latestVersion && info.latestVersion !== '0.0.0' && (
          <span className="text-[12px] font-medium text-pmuted">
            v{info.latestVersion}
          </span>
        )}
      </button>
    </div>
  )
}
