import { useState } from 'react'
import { Smile, MessageSquare, Volume2, VolumeX, X, Zap } from 'lucide-react'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'

const EMOJIS = [
  { emoji: '🔥', label: 'fire' },
  { emoji: '😂', label: 'laugh' },
  { emoji: '😱', label: 'shock' },
  { emoji: '😎', label: 'cool' },
  { emoji: '👏', label: 'clap' },
  { emoji: '⚡', label: 'lightning' },
  { emoji: '🥶', label: 'freeze' },
  { emoji: '🍿', label: 'popcorn' },
  { emoji: '🥊', label: 'punch' },
  { emoji: '🍅', label: 'tomato' },
]

const TAUNTS_UZ = [
  { text: '🏎️ Qani, yetib ol!', kind: 'taunt' },
  { text: '🎯 100% to\'g\'ri bildim!', kind: 'taunt' },
  { text: '⏳ Tezroq o\'yla!', kind: 'taunt' },
  { text: '🤝 Zo\'r jang bo\'lyapti!', kind: 'taunt' },
  { text: '🤫 Chalg\'itma meni!', kind: 'taunt' },
  { text: '🧠 Menga bu oson!', kind: 'taunt' },
]

const TAUNTS_RU = [
  { text: '🏎️ Догоняй!', kind: 'taunt' },
  { text: '🎯 В яблочко!', kind: 'taunt' },
  { text: '⏳ Время идёт!', kind: 'taunt' },
  { text: '🤝 Отличная игра!', kind: 'taunt' },
  { text: '🤫 Не отвлекай!', kind: 'taunt' },
  { text: '🧠 Для меня это легко!', kind: 'taunt' },
]

interface DuelReactionPickerProps {
  language: string
  isMuted: boolean
  onToggleMute: () => void
  onSendReaction: (kind: 'emoji' | 'phrase' | 'prop', content: string) => void
}

export function DuelReactionPicker({
  language,
  isMuted,
  onToggleMute,
  onSendReaction,
}: DuelReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<'emojis' | 'taunts'>('emojis')
  const [cooldown, setCooldown] = useState(false)

  const taunts = language === 'ru' ? TAUNTS_RU : TAUNTS_UZ

  const handleSendEmoji = (emoji: string) => {
    if (cooldown) return
    haptics.impact('light')
    playSound('emote_pop')
    onSendReaction('emoji', emoji)
    startCooldown()
    setIsOpen(false)
  }

  const handleSendTaunt = (phrase: string) => {
    if (cooldown) return
    haptics.impact('medium')
    playSound('emote_whoosh')
    onSendReaction('phrase', phrase)
    startCooldown()
    setIsOpen(false)
  }

  const startCooldown = () => {
    setCooldown(true)
    setTimeout(() => {
      setCooldown(false)
    }, 1400)
  }

  return (
    <div className="relative">
      {/* Trigger floating button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            haptics.impact('light')
            setIsOpen(!isOpen)
          }}
          disabled={cooldown}
          className={`w-11 h-11 rounded-2xl bg-pcard border border-pline flex items-center justify-center text-pfg shadow-lg active:scale-95 transition-all ${
            isOpen ? 'border-ppurple bg-psurface text-ppurple' : 'hover:bg-psurface'
          } ${cooldown ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Reaksiyalar"
        >
          <Smile size={20} className={cooldown ? 'animate-spin' : ''} />
        </button>

        <button
          type="button"
          onClick={() => {
            haptics.impact('light')
            playSound('toggle')
            onToggleMute()
          }}
          className="w-11 h-11 rounded-2xl bg-pcard border border-pline flex items-center justify-center text-pmuted hover:text-pfg shadow-lg active:scale-95 transition-all"
          title={isMuted ? 'Ovozni yoqish' : 'Ovozni o\'chirish'}
        >
          {isMuted ? <VolumeX size={18} className="text-pdanger" /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Expanded Reactions Drawer */}
      {isOpen && (
        <div className="absolute bottom-14 left-0 w-72 rounded-3xl bg-psurface border border-pline p-3.5 shadow-2xl space-y-3 z-50 animate-premiumIn">
          {/* Header & Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-pcard p-1 rounded-2xl shadow-xs">
              <button
                type="button"
                onClick={() => setTab('emojis')}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 transition-all ${
                  tab === 'emojis'
                    ? 'bg-ppurple text-ponprimary shadow-xs'
                    : 'text-pmuted hover:text-pfg'
                }`}
              >
                <Smile size={12} />
                <span>Smayliklar</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('taunts')}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 transition-all ${
                  tab === 'taunts'
                    ? 'bg-ppurple text-ponprimary shadow-xs'
                    : 'text-pmuted hover:text-pfg'
                }`}
              >
                <MessageSquare size={12} />
                <span>Frazalar</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 rounded-full bg-pcard hover:bg-psurface flex items-center justify-center text-pmuted hover:text-pfg transition-colors"
            >
              <X size={13} />
            </button>
          </div>

          {/* Tab 1: Emojis Grid */}
          {tab === 'emojis' && (
            <div className="grid grid-cols-5 gap-2">
              {EMOJIS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleSendEmoji(item.emoji)}
                  className="w-11 h-11 rounded-2xl bg-pcard hover:bg-psurface border border-pline flex items-center justify-center text-2xl active:scale-90 transition-transform shadow-xs"
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          )}

          {/* Tab 2: Quick Taunts List */}
          {tab === 'taunts' && (
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {taunts.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendTaunt(item.text)}
                  className="w-full text-left px-3 py-2 rounded-xl bg-pcard hover:bg-psurface border border-pline text-xs font-bold text-pfg flex items-center gap-2 active:scale-98 transition-all"
                >
                  <Zap size={13} className="text-ppurple shrink-0" />
                  <span className="truncate">{item.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
