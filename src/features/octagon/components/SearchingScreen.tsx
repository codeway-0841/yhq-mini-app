import { useState } from 'react'
import { Sword, Share2, Copy, Check } from 'lucide-react'
import { shareUrl } from '../../../platform/telegram'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'

export function SearchingScreen({ tt, duelCode, duelLink, onCancel }: {
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
  duelCode: string | null
  duelLink: string | null
  onCancel: () => void
}) {
  const [copied, setCopied] = useState(false)

  const cleanPin = duelCode ? duelCode.replace(/^duel-/, '').replace(/^room-/, '') : null
  const formattedPin = cleanPin && cleanPin.length === 6
    ? `${cleanPin.slice(0, 3)} ${cleanPin.slice(3)}`
    : cleanPin

  const handleCopyPin = () => {
    if (!cleanPin) return
    navigator.clipboard?.writeText(cleanPin)
    setCopied(true)
    haptics.impact('light')
    playSound('click')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center max-w-xs w-full">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[rgb(var(--p-purple-rgb)/0.25)] animate-ping" />
        <div className="relative w-16 h-16 rounded-full bg-[rgb(var(--p-purple-rgb)/0.15)] flex items-center justify-center">
          <Sword size={26} className="text-ppurple" />
        </div>
      </div>
      <div>
        <p className="text-base font-bold">{duelCode ? tt('roomWaitingTitle') : tt('searching')}</p>
        <p className="text-xs text-muted">
          {duelCode ? tt('roomWaitingHint') : 'Raqib qidirilmoqda'}
          <span className="inline-flex w-6 justify-start ml-0.5">
            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
          </span>
        </p>
      </div>

      {/* Duel kutilmoqda — PIN va link ulashish */}
      {duelCode && (
        <div className="w-full rounded-2xl bg-psurface p-4 flex flex-col items-center gap-3 shadow-md">
          {formattedPin && (
            <div className="w-full text-center space-y-1">
              <span className="text-[10px] font-bold text-pmuted uppercase tracking-wider">{tt('yourRoomPin')}</span>
              <div className="text-2xl font-black font-mono tracking-widest text-pprimary">
                {formattedPin}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 w-full">
            {cleanPin && (
              <button
                type="button"
                onClick={handleCopyPin}
                className="flex-1 py-2 px-3 rounded-xl bg-pcard text-pfg text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
              >
                {copied ? <Check size={14} className="text-pprimary" /> : <Copy size={14} />}
                <span>{copied ? tt('pinCopied') : tt('copyPinBtn')}</span>
              </button>
            )}
            {duelLink && (
              <button
                type="button"
                onClick={() => shareUrl(duelLink, `Kel, bilimlar jangida bellashamiz! 🤺 PIN: ${cleanPin || duelCode}`)}
                className="flex-1 py-2 px-3 rounded-xl bg-[rgb(var(--p-blue-rgb)/0.15)] text-pblue text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
              >
                <Share2 size={14} />
                <span>{tt('shareInviteBtn')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <button onClick={onCancel}
        className="text-xs text-pmuted border border-pline px-5 py-2.5 rounded-xl hover:text-pfg transition-colors active:scale-95">
        {tt('cancel')}
      </button>
    </div>
  )
}
