import { Sword, UserPlus } from 'lucide-react'

export function IdleScreen({ tt, connFailed, onFind, onDuelWithFriend }: {
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
  connFailed: boolean
  onFind: () => void
  onDuelWithFriend: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-5 text-center max-w-xs w-full">
      <div className="w-20 h-20 rounded-3xl bg-duo-purple/15 border border-duo-purple/30 flex items-center justify-center text-duo-purple shadow-lg">
        <Sword size={40} />
      </div>
      <div>
        <h2 className="text-xl font-black mb-1">{tt('octagonTitle')}</h2>
        <p className="text-xs text-muted">Haqiqiy vaqtda o'quvchilar bilan jonli bellashuv</p>
      </div>

      <div className="w-full space-y-2.5 pt-2">
        <button onClick={onFind} disabled={connFailed}
          className="w-full btn-premium py-3.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          <Sword size={18} />
          <span>{tt('findOpponent')}</span>
        </button>

        {/* Do'st bilan duel — PIN / Xona (secondary) */}
        <button onClick={onDuelWithFriend} disabled={connFailed}
          className="w-full py-3.5 px-4 rounded-2xl bg-card border border-duo-purple/40 text-fg text-xs font-black flex items-center justify-center gap-2 hover:bg-elevated active:scale-95 transition-all disabled:opacity-50">
          <UserPlus size={16} className="text-duo-purple" />
          <span>{tt('customRoomTitle')} (PIN / Link)</span>
        </button>
      </div>
    </div>
  )
}
