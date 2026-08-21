import { Sword } from 'lucide-react'
import { resolveAvatarPath } from '../../../shared/api'
import { getAvatarFrame } from '../../../shared/config/avatar-frames'

export function MatchedScreen({ opponentName, opponentAvatar, opponentFrame }: {
  opponentName: string | null
  opponentAvatar: string | null
  opponentFrame: string | null
}) {
  const src = resolveAvatarPath(opponentAvatar)
  const frameClass = getAvatarFrame(opponentFrame)?.cssClass ?? null
  // Avatarsiz/ramkasiz — harf doira (oldin umuman hech narsa ko'rinmardi)
  const circle = src ? (
    <img src={src} alt={opponentName ?? ''} className="w-16 h-16 rounded-full object-cover" />
  ) : (
    <div className="w-16 h-16 rounded-full bg-elevated flex items-center justify-center text-fg text-2xl font-black">
      {opponentName?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Sword size={36} className="text-pprimary" />
      <p className="text-lg font-black">VS</p>
      {frameClass
        ? <span className={`avatar-frame ${frameClass}`}>{circle}</span>
        : <span className={src ? 'rounded-full ring-2 ring-pprimary/40 overflow-hidden inline-flex' : ''}>{circle}</span>}
      <p className="text-base font-bold text-pprimary">{opponentName}</p>
      <p className="text-xs text-muted animate-pulse">Tayyor bo'ling...</p>
    </div>
  )
}
