import { useState } from 'react'
import { Share2, Copy, Check } from 'lucide-react'
import { shareUrl } from '../../../platform/telegram'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'
import { ArenaArtwork } from './ArenaArtwork'

export function SearchingScreen({ tt, duelCode, duelLink, onCancel, language = 'uz', roomPending = false }: {
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
  duelCode: string | null
  duelLink: string | null
  language?: 'uz' | 'ru'
  roomPending?: boolean
  onCancel: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const cleanPin = duelCode ? duelCode.replace(/^duel-/, '').replace(/^room-/, '') : null
  const formattedPin = cleanPin && cleanPin.length === 6
    ? `${cleanPin.slice(0, 3)} ${cleanPin.slice(3)}`
    : cleanPin

  const handleCopyPin = () => {
    if (!cleanPin) return
    setCopyFailed(false)
    if (!navigator.clipboard) { setCopyFailed(true); return }
    navigator.clipboard.writeText(cleanPin).then(() => {
      setCopied(true)
      haptics.impact('light')
      playSound('click')
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => setCopyFailed(true))
  }

  return (
    <div className="arena-search flex flex-col items-center gap-5 text-center max-w-md w-full">
      <div className="arena-search-art"><ArenaArtwork /></div>
      <div>
        <p className="text-base font-bold">{roomPending ? (language === 'ru' ? 'Создаём комнату…' : 'Xona yaratilmoqda…') : duelCode ? tt('roomWaitingTitle') : tt('searching')}</p>
        <p className="text-sm leading-relaxed text-pmuted">
          {roomPending ? (language === 'ru' ? 'Получаем код комнаты' : 'Xona kodi olinmoqda') : duelCode ? tt('roomWaitingHint') : (language === 'ru' ? 'Ищем соперника. Вы можете отменить поиск.' : 'Munosib raqib qidiryapmiz. Qidiruvni bekor qilishingiz mumkin.')}
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
              <div className="text-2xl font-black font-mono tracking-widest text-pprimary select-all">
                {formattedPin}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 w-full">
            {cleanPin && (
              <button
                type="button"
                onClick={handleCopyPin}
                className="flex-1 min-h-12 py-2 px-3 rounded-xl bg-pcard text-pfg text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
              >
                {copied ? <Check size={14} className="text-pprimary" /> : <Copy size={14} />}
                <span>{copied ? tt('pinCopied') : tt('copyPinBtn')}</span>
              </button>
            )}
            {duelLink && (
              <button
                type="button"
                onClick={() => shareUrl(duelLink, `Kel, bilimlar jangida bellashamiz! 🤺 PIN: ${cleanPin || duelCode}`)}
                className="flex-1 min-h-12 py-2 px-3 rounded-xl bg-[rgb(var(--p-blue-rgb)/0.15)] text-pblue text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
              >
                <Share2 size={14} />
                <span>{tt('shareInviteBtn')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {copyFailed && <p role="alert" className="text-sm text-pdanger">{language === 'ru' ? 'Не удалось скопировать. Выделите код и скопируйте вручную.' : 'Nusxalanmadi. Kodni belgilab, qo‘lda nusxalang.'}</p>}
      <button onClick={onCancel}
        className="text-sm min-h-12 text-pmuted bg-psurface px-5 py-2.5 rounded-xl hover:text-pfg transition-colors active:scale-95 shadow-xs">
        {tt('cancel')}
      </button>
    </div>
  )
}
