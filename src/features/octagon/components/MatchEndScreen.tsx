import { Trophy, Flag, Handshake, ArrowRight } from 'lucide-react'

export function MatchEndScreen({ tt, result, yourScore, oppScore, opponentName, onExit, onRematch, language = 'uz' }: {
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
  result: 'win' | 'lose' | 'draw' | null
  yourScore: number
  oppScore: number
  opponentName: string | null
  language?: 'uz' | 'ru'
  onExit: () => void
  onRematch: () => void
}) {
  return (
    <div className="arena-result flex flex-col items-center gap-5 text-center">
      <div className="arena-result-emblem">{result === 'win' ? <Trophy size={48} /> : result === 'lose' ? <Flag size={48} /> : <Handshake size={48} />}</div>
      <h2 className="text-2xl font-black">
        {result === 'win' ? tt('youWon') : result === 'lose' ? tt('youLost') : tt('draw')}
      </h2>
      <div className="arena-score flex gap-6 font-bold">
        <div className="text-center">
          <p className="text-pprimary text-3xl">{yourScore}</p>
          <p className="text-xs text-muted mt-1">{language === 'ru' ? 'Вы' : 'Siz'}</p>
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
          {language === 'ru' ? 'В арену' : 'Arenaga'}
        </button>
        <button onClick={onRematch} className="arena-primary flex-[2]">
          {language === 'ru' ? 'Новый соперник' : 'Yangi raqib'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
