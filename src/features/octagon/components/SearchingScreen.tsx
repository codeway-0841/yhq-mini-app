import { Sword, Share2 } from 'lucide-react'
import { shareUrl } from '../../../platform/telegram'

export function SearchingScreen({ tt, duelCode, duelLink, onCancel }: {
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
  duelCode: string | null
  duelLink: string | null
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-duo-green/25 animate-ping" />
        <div className="relative w-16 h-16 rounded-full bg-duo-green/10 border border-duo-green/40 flex items-center justify-center">
          <Sword size={26} className="text-pprimary" />
        </div>
      </div>
      <p className="text-base font-bold">{tt('searching')}</p>
      <p className="text-xs text-muted">
        Raqib qidirilmoqda
        <span className="inline-flex w-6 justify-start ml-0.5">
          <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
        </span>
      </p>
      {/* Duel kutilmoqda — do'stga link ulashish */}
      {duelCode && duelLink && (
        <div className="card-neon p-4 flex flex-col items-center gap-2.5 max-w-xs">
          <p className="text-[11px] text-subtle font-semibold text-center">
            {tt('duelInviteHint')}
          </p>
          <button onClick={() => shareUrl(duelLink, tt('duelInviteText'))}
             className="flex items-center gap-2 bg-duo-green text-ponprimary font-bold px-5 py-2.5 rounded-xl text-[13px] active:scale-95 transition-transform">
            <Share2 size={15} />
            {tt('duelShareBtn')}
          </button>
          <p className="text-[10px] text-muted font-mono break-all text-center px-2">{duelLink}</p>
        </div>
      )}
      <button onClick={onCancel}
        className="text-sm text-muted border border-line px-5 py-2.5 rounded-xl hover:text-fg transition-colors">
        {tt('cancel')}
      </button>
    </div>
  )
}
