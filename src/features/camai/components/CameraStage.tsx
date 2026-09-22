/**
 * CamAi kamera sahnasi — jonli video + yuz slotlari overlay'i.
 *
 * Overlay koordinatalari: konteyner aspectRatio'si video kadriga tenglashtiriladi
 * (loadedmetadata'da), shuning uchun object-cover kadrni QIRIB TASHLAMAYDI va
 * normallashtirilgan (0..1) box'lar to'g'ridan-to'g'ri % ga o'tadi.
 */
import { useCallback, useState, type RefObject } from 'react'
import { Camera, CameraOff, Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import type { CamStatus } from '../useFaceDetection'
import type { Slot } from '../camai-logic'

interface CameraStageProps {
  videoRef: RefObject<HTMLVideoElement>
  status: CamStatus
  slots: Slot[]
  /** Ruletka davomida yoritilayotgan slot */
  highlightSlotId: number | null
  /** G'olib bo'lib tanlangan slot */
  winnerSlotId: number | null
  labels: {
    loading: string
    request: string
    denied: string
    error: string
  }
}

export default function CameraStage({ videoRef, status, slots, highlightSlotId, winnerSlotId, labels }: CameraStageProps) {
  const [aspect, setAspect] = useState<number>(16 / 9)

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (v && v.videoWidth > 0 && v.videoHeight > 0) {
      setAspect(v.videoWidth / v.videoHeight)
    }
  }, [videoRef])

  const busy = status === 'loading' || status === 'camera'
  const failed = status === 'denied' || status === 'error'

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-black shadow-xs"
      style={{ aspectRatio: String(aspect) }}
    >
      <video
        ref={videoRef}
        onLoadedMetadata={onLoadedMetadata}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 size-full object-cover"
      />

      {/* Yuz slotlari */}
      {status === 'running' &&
        slots.map((s) => {
          const isHighlight = s.id === highlightSlotId
          const isWinner = s.id === winnerSlotId
          return (
            <div
              key={s.id}
              className={cn(
                'absolute rounded-xl border-2 transition-all duration-150',
                isWinner
                  ? 'border-pgold shadow-[0_0_24px_rgb(var(--p-gold-rgb)/0.8)]'
                  : isHighlight
                    ? 'border-pprimary bg-[rgb(var(--p-primary-rgb)/0.15)]'
                    : 'border-white/70',
              )}
              style={{
                left: `${s.box.x * 100}%`,
                top: `${s.box.y * 100}%`,
                width: `${s.box.width * 100}%`,
                height: `${s.box.height * 100}%`,
              }}
            >
              <span
                className={cn(
                  'absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-xs',
                  isWinner ? 'bg-pgold text-pongold' : isHighlight ? 'bg-pprimary text-ponprimary' : 'bg-black/60 text-white',
                )}
              >
                {s.id}
              </span>
            </div>
          )
        })}

      {/* Yuklanish / xato holatlari */}
      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-black/50">
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="size-7 animate-spin" />
            <p className="text-[13px] font-medium">{status === 'loading' ? labels.loading : labels.request}</p>
          </div>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-2 text-white/80">
            {status === 'denied' ? <CameraOff className="size-8" /> : <Camera className="size-8" />}
            <p className="text-[13px] font-medium">{status === 'denied' ? labels.denied : labels.error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
