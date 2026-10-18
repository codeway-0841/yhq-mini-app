import type { CSSProperties } from 'react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import { Spinner } from './Spinner'

/**
 * Sync bosqichi — IMG_0928.MOV 13.0–18.5s bilan 1:1.
 *
 * Video o'lchovi: spinner ≈30px (y≈45%), sarlavha 17px, izoh 14px #8E8E93,
 * blok ekran markazidan ≈10px yuqorida. Qadam indikatori bu ekranda YO'Q.
 */
export function SyncScreen({ instant = false }: { instant?: boolean }) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const d = (ms: number) => ({ '--ob-delay': `${instant ? 0 : ms}ms` }) as CSSProperties

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-[28px] text-center">
      <div className="ob-reveal flex" style={d(60)}>
        <Spinner size={30} label={tt('obSyncTitle')} />
      </div>
      <p
        className="ob-reveal mt-[18px] text-[17px] font-medium leading-[20px] tracking-[-0.01em] text-white"
        style={d(150)}
      >
        {tt('obSyncTitle')}
      </p>
      <p
        className="ob-reveal mt-[7px] text-[14px] leading-[19px] text-white/70"
        style={d(230)}
      >
        {tt('obSyncSubtitle')}
      </p>
    </div>
  )
}
