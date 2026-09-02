import { useState, useMemo } from 'react'
import { X, Copy, Check, Share2, Users, KeyRound, Swords } from 'lucide-react'
import { shareUrl } from '../../../platform/telegram'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'
import DialogOverlay from '../../../shared/components/DialogOverlay'

interface CustomRoomModalProps {
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
  onClose: () => void
  onStartRoom: (pin: string) => void
  onJoinRoom: (pin: string) => void
}

function generateRandomPin(): string {
  // 6 xonali tasodifiy raqam (100000 - 999999)
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function CustomRoomModal({ tt, onClose, onStartRoom, onJoinRoom }: CustomRoomModalProps) {
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [createdPin] = useState<string>(() => generateRandomPin())
  const [inputPin, setInputPin] = useState('')
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const formattedCreatedPin = useMemo(() => {
    return `${createdPin.slice(0, 3)} ${createdPin.slice(3)}`
  }, [createdPin])

  const inviteLink = `https://t.me/kiwi_uz_bot?start=duel-${createdPin}`

  const handleCopyPin = () => {
    navigator.clipboard?.writeText(createdPin)
    setCopied(true)
    haptics.impact('light')
    playSound('click')
    setTimeout(() => setCopied(false), 2500)
  }

  const handleShare = () => {
    haptics.impact('medium')
    playSound('click')
    const shareText = `Kel, bilimlar jangida bellashamiz! 🤺\n\n📌 Xona PIN-kodi: ${createdPin}\n\nQuyidagi havola orqali kiring:`
    shareUrl(inviteLink, shareText)
    onStartRoom(createdPin)
    onClose()
  }

  const handleStartCreated = () => {
    haptics.impact('medium')
    playSound('click')
    onStartRoom(createdPin)
    onClose()
  }

  const handleJoinEntered = () => {
    const clean = inputPin.replace(/\s+/g, '').trim()
    if (!/^\d{4,8}$/.test(clean) && !/^[a-z0-9-]{4,16}$/i.test(clean)) {
      setErrorMsg(tt('invalidPinError'))
      haptics.notify('error')
      playSound('error')
      return
    }
    setErrorMsg(null)
    haptics.impact('medium')
    playSound('click')
    onJoinRoom(clean.toLowerCase())
    onClose()
  }

  return (
    <DialogOverlay onClose={onClose} position="center" labelId="custom-room-title" className="animate-premiumIn" backdropClassName="bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-psurface border border-pline p-5 shadow-2xl space-y-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[rgb(var(--p-purple-rgb)/0.15)] flex items-center justify-center text-ppurple">
              <Swords size={18} />
            </div>
            <div>
              <h2 id="custom-room-title" className="text-sm font-black text-pfg">{tt('customRoomTitle')}</h2>
              <p className="text-[10px] text-pmuted">{tt('customRoomDesc')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={tt('close')}
            className="w-8 h-8 rounded-full bg-pcard hover:bg-psurface flex items-center justify-center text-pmuted hover:text-pfg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-pcard border border-pline">
          <button
            type="button"
            onClick={() => { setTab('create'); setErrorMsg(null) }}
            className={`py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              tab === 'create'
                ? 'bg-ppurple text-ponprimary shadow-sm'
                : 'text-pmuted hover:text-pfg'
            }`}
          >
            <Users size={14} />
            <span>{tt('tabCreateRoom')}</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('join'); setErrorMsg(null) }}
            className={`py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              tab === 'join'
                ? 'bg-ppurple text-ponprimary shadow-sm'
                : 'text-muted hover:text-fg'
            }`}
          >
            <KeyRound size={14} />
            <span>{tt('tabJoinRoom')}</span>
          </button>
        </div>

        {/* TAB 1: Xona yaratish */}
        {tab === 'create' && (
          <div className="space-y-4 pt-1">
            <div className="rounded-2xl bg-pcard border border-[rgb(var(--p-purple-rgb)/0.30)] p-4 text-center space-y-2">
              <span className="text-[11px] font-bold text-pmuted">{tt('yourRoomPin')}</span>
              <div className="text-3xl font-black font-mono tracking-widest text-pprimary select-all">
                {formattedCreatedPin}
              </div>
              <p className="text-[10.5px] text-pmuted">{tt('roomWaitingHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyPin}
                className="py-2.5 px-3 rounded-xl bg-pcard text-pfg text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
              >
                {copied ? <Check size={14} className="text-pprimary" /> : <Copy size={14} />}
                <span>{copied ? tt('pinCopied') : tt('copyPinBtn')}</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="py-2.5 px-3 rounded-xl bg-[rgb(var(--p-blue-rgb)/0.15)] text-pblue text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
              >
                <Share2 size={14} />
                <span>{tt('shareInviteBtn')}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleStartCreated}
              className="w-full bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Swords size={16} />
              <span>{tt('startWaitingBtn')}</span>
            </button>
          </div>
        )}

        {/* TAB 2: Kodni kiritish */}
        {tab === 'join' && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-pfg">{tt('enterPinPrompt')}</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={inputPin}
                onChange={(e) => {
                  setInputPin(e.target.value.replace(/[^0-9a-zA-Z-]/g, ''))
                  setErrorMsg(null)
                }}
                placeholder={tt('pinInputPlaceholder')}
                className="w-full px-4 py-3 rounded-2xl bg-pcard focus:ring-2 focus:ring-ppurple text-center font-mono text-xl font-black text-pfg placeholder:text-pmuted/40 focus:outline-none transition-colors shadow-xs"
                autoFocus
              />
              {errorMsg && <p className="text-[11px] font-bold text-pdanger text-center">{errorMsg}</p>}
            </div>

            <button
              type="button"
              onClick={handleJoinEntered}
              disabled={!inputPin.trim()}
              className="w-full bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              <KeyRound size={16} />
              <span>{tt('joinRoomBtn')}</span>
            </button>
          </div>
        )}
      </div>
    </DialogOverlay>
  )
}
