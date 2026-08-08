import { Sword, UserPlus } from 'lucide-react'

export function IdleScreen({ tt, connFailed, onFind, onDuelWithFriend }: {
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
  connFailed: boolean
  onFind: () => void
  onDuelWithFriend: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <Sword size={56} className="text-subtle opacity-80" />
      <div>
        <h2 className="text-xl font-black mb-1">{tt('octagonTitle')}</h2>
        <p className="text-sm text-muted">Haqiqiy vaqtda raqib bilan bellashuv</p>
      </div>
      <button onClick={onFind} disabled={connFailed}
        className="btn-neon font-bold px-8 py-3.5 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed">
        {tt('findOpponent')}
      </button>
      {/* Do'st bilan duel — invite link orqali (secondary) */}
      <button onClick={onDuelWithFriend} disabled={connFailed}
        className="flex items-center gap-2 border border-line text-fg font-bold px-6 py-3 rounded-xl text-sm active:scale-95 transition-all disabled:opacity-50">
        <UserPlus size={16} />
        {tt('duelWithFriend')}
      </button>
    </div>
  )
}
