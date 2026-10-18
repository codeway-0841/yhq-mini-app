import { ChevronLeft } from 'lucide-react'

interface SegmentedProgressPillProps {
  active: number
  total?: number
  onBack?: () => void
  backLabel?: string
}

/**
 * iOS uslubidagi qadam indikatori — IMG_0928.MOV 1:1.
 *
 * Video o'lchovlari (384×832 kadr): kapsula 67×21px, markazda; faol qadam
 * 19×10px kapsula (#AEB8F0), nofaol qadamlar 7×7px doiralar (oq 22%).
 * Orqaga tugmasi — 44×44 aylana, chap chekkada (x=20), kapsula esa HAR DOIM
 * ekran markazida qoladi (shuning uchun absolute joylashuv).
 */
export function SegmentedProgressPill({
  active,
  total = 3,
  onBack,
  backLabel = 'Orqaga',
}: SegmentedProgressPillProps) {
  return (
    <div className="relative flex w-full items-center justify-center">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="absolute left-0 flex size-11 items-center justify-center rounded-full bg-white/[0.14] text-white backdrop-blur-md transition-transform duration-150 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <ChevronLeft size={22} strokeWidth={2.6} />
        </button>
      ) : null}

      <div className="ob-pill" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} data-active={i === active} />
        ))}
      </div>
    </div>
  )
}
