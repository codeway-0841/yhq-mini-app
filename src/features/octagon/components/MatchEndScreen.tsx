export function MatchEndScreen({ tt, result, yourScore, oppScore, opponentName, onExit, onRematch }: {
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
  result: 'win' | 'lose' | 'draw' | null
  yourScore: number
  oppScore: number
  opponentName: string | null
  onExit: () => void
  onRematch: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span className="text-6xl">
        {result === 'win' ? '🏆' : result === 'lose' ? '😔' : '🤝'}
      </span>
      <h2 className="text-2xl font-black">
        {result === 'win' ? tt('youWon') : result === 'lose' ? tt('youLost') : tt('draw')}
      </h2>
      <div className="flex gap-6 font-bold">
        <div className="text-center">
          <p className="text-pprimary text-3xl">{yourScore}</p>
          <p className="text-xs text-muted mt-1">Siz</p>
        </div>
        <div className="text-line text-3xl self-center">:</div>
        <div className="text-center">
          <p className="text-pdanger text-3xl">{oppScore}</p>
          <p className="text-xs text-muted mt-1">{opponentName}</p>
        </div>
      </div>
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={onExit}
          className="flex-1 py-3 rounded-xl bg-elevated text-sm font-semibold">
          Chiqish
        </button>
        <button onClick={onRematch} className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,background-color,filter] duration-[120ms] flex-[2] py-3 rounded-xl font-bold">
          Qayta o'ynash
        </button>
      </div>
    </div>
  )
}
