import { useEffect, useRef } from 'react'
import type { LocalVideoTrack, RemoteTrack } from 'livekit-client'
import { cn } from '@/shared/lib/cn'

/**
 * LiveKit video tile — track attach/detach lifecycle.
 * Rounded + muted local (echo yo'q), remote ovoz alohida audio el'da.
 */
export function VideoView({ track, label, speaking, muted = false, large = false }: {
  track: RemoteTrack | LocalVideoTrack
  label: string
  speaking?: boolean
  muted?: boolean
  large?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    track.attach(el)
    return () => { track.detach(el) }
  }, [track])
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl bg-black/80',
      large ? 'aspect-video w-full' : 'aspect-[4/3] w-full',
      speaking && 'ring-2 ring-psuccess',
    )}>
      <video ref={ref} muted={muted} playsInline autoPlay className="h-full w-full object-cover" />
      <span className="absolute bottom-1.5 left-1.5 max-w-[80%] truncate rounded-xl bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
        {label}
      </span>
    </div>
  )
}
