import { useState } from 'react'
import { Share2, Copy, Check } from 'lucide-react'
import { shareUrl } from '../../../platform/telegram'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'
import { ArenaArtwork } from './ArenaArtwork'
import { Button } from '../../../shared/components/ui/button'

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
        <div className="w-full rounded-2xl bg-pcard p-4 flex flex-col items-center gap-3 shadow-md">
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopyPin}
                className="flex-1 min-h-12 text-xs font-bold"
              >
                {copied ? <Check size={14} className="text-pprimary" /> : <Copy size={14} />}
                <span>{copied ? tt('pinCopied') : tt('copyPinBtn')}</span>
              </Button>
            )}
            {duelLink && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => shareUrl(duelLink, tt('duelShareShort').replace('{pin}', cleanPin || duelCode))}
                className="flex-1 min-h-12 text-xs font-bold"
              >
                <Share2 size={14} />
                <span>{tt('shareInviteBtn')}</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {copyFailed && <p role="alert" className="text-sm text-pdanger">{language === 'ru' ? 'Не удалось скопировать. Выделите код и скопируйте вручную.' : 'Nusxalanmadi. Kodni belgilab, qo‘lda nusxalang.'}</p>}
      <Button variant="secondary" onClick={onCancel}>
        {tt('cancel')}
      </Button>
    </div>
  )
}
