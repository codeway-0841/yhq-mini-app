export interface ActiveReaction {
  id: string
  senderId: string
  isYou: boolean
  kind: 'emoji' | 'phrase' | 'prop'
  content: string
  xPos: number // percentage across screen 20-80%
}

interface FloatingReactionsOverlayProps {
  reactions: ActiveReaction[]
  opponentPhrase: string | null
  yourPhrase: string | null
}

export function FloatingReactionsOverlay({
  reactions,
  opponentPhrase,
  yourPhrase,
}: FloatingReactionsOverlayProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {/* Speech bubbles for phrases */}
      {opponentPhrase && (
        <div className="absolute top-20 left-6 max-w-[200px] animate-premiumIn z-50">
          <div className="relative rounded-2xl bg-duo-purple text-ponprimary px-3.5 py-2 text-xs font-black shadow-xl border border-white/20">
            {opponentPhrase}
            <div className="absolute -top-1.5 left-4 w-3 h-3 bg-duo-purple rotate-45" />
          </div>
        </div>
      )}

      {yourPhrase && (
        <div className="absolute top-20 right-6 max-w-[200px] animate-premiumIn z-50">
          <div className="relative rounded-2xl bg-pprimary text-ponprimary px-3.5 py-2 text-xs font-black shadow-xl border border-white/20">
            {yourPhrase}
            <div className="absolute -top-1.5 right-4 w-3 h-3 bg-pprimary rotate-45" />
          </div>
        </div>
      )}

      {/* Floating flying emojis */}
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-24 flex flex-col items-center animate-flyUp"
          style={{
            left: `${r.xPos}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="relative flex items-center justify-center">
            <span className="text-4xl filter drop-shadow-lg select-none animate-wiggle">
              {r.content}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
