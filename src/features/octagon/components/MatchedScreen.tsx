import { Sword } from 'lucide-react'

export function MatchedScreen({ opponentName }: { opponentName: string | null }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Sword size={36} className="text-pprimary" />
      <p className="text-lg font-black">VS</p>
      <p className="text-base font-bold text-pprimary">{opponentName}</p>
      <p className="text-xs text-muted animate-pulse">Tayyor bo'ling...</p>
    </div>
  )
}
