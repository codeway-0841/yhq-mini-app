import { Sword } from 'lucide-react'
import { resolveAvatarPath } from '../../../shared/api'

export function MatchedScreen({ opponentName, opponentAvatar }: {
  opponentName: string | null
  opponentAvatar: string | null
}) {
  const src = resolveAvatarPath(opponentAvatar)
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Sword size={36} className="text-pprimary" />
      <p className="text-lg font-black">VS</p>
      {src ? (
        <img src={src} alt={opponentName ?? ''} className="w-16 h-16 rounded-full object-cover ring-2 ring-pprimary/40" />
      ) : null}
      <p className="text-base font-bold text-pprimary">{opponentName}</p>
      <p className="text-xs text-muted animate-pulse">Tayyor bo'ling...</p>
    </div>
  )
}
