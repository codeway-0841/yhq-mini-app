import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Maximize2, Sparkles, CheckCircle2 } from 'lucide-react'
import { registerModal } from '../../shared/lib/navigation'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import Confetti from '../../shared/components/Confetti'
import { CoinIcon } from '../../shared/components/CoinIcon'

interface InteractiveLessonModalProps {
  path: string
  title: string
  subjectId: string
  onClose: () => void
  onChapterComplete?: (chapterNumber: number) => void
}

export function InteractiveLessonModal({
  path,
  title,
  subjectId,
  onClose,
  onChapterComplete
}: InteractiveLessonModalProps) {
  const [rewardClaimed, setRewardClaimed] = useState<{ chapter: number; coins: number; xp: number } | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const onCompleteRef = useRef(onChapterComplete)
  onCompleteRef.current = onChapterComplete

  // Telegram BackButton & Android hardware back integration
  useEffect(() => {
    const modalId = Symbol('interactive-lesson-modal')
    const unregister = registerModal(modalId, () => {
      onCloseRef.current()
    })
    return () => {
      unregister()
    }
  }, [])

  // Listen to postMessage from engine.js
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || data.type !== 'KIVVI_LESSON_EVENT') return

      if (data.action === 'close') {
        onCloseRef.current()
      } else if (data.action === 'chapter_completed') {
        const chapterNum = Number(data.chapter) || 1
        const coinAward = 25
        const xpAward = 50

        // Award in AppStore
        const user = useAppStore.getState().user
        const curCoins = useAppStore.getState().coins
        useAppStore.getState().setCoins(curCoins + coinAward)

        // Save in LessonsStore
        if (user?.id) {
          useLessonsStore.getState().markDone(user.id, 999, chapterNum)
        }

        // Haptic + visual delight
        haptics.notify('success')
        setRewardClaimed({ chapter: chapterNum, coins: coinAward, xp: xpAward })

        if (onCompleteRef.current) {
          onCompleteRef.current(chapterNum)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [subjectId])

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1017] text-white flex flex-col overflow-hidden animate-fadeIn">
      {/* Confetti celebration when reward is claimed */}
      {rewardClaimed && (
        <div className="absolute inset-0 pointer-events-none z-50">
          <Confetti count={35} />
        </div>
      )}

      {/* Top Header bar with Safe Area support */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#131924] border-b border-white/10 safe-top">
        <button
          onClick={onClose}
          aria-label="Orqaga"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 transition-all text-sm font-medium cursor-pointer"
        >
          <ChevronLeft size={18} strokeWidth={2.2} />
          <span>Chiqish</span>
        </button>

        <div className="flex items-center gap-2 min-w-0 px-2 text-center">
          <span className="text-sm font-semibold truncate max-w-[180px] sm:max-w-xs">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {rewardClaimed ? (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold animate-pulse">
              <CheckCircle2 size={14} />
              <span>+{rewardClaimed.coins}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/25 text-xs font-semibold">
              <CoinIcon size={14} />
              <span>+25 tanga</span>
            </div>
          )}

          <a
            href={path}
            target="_blank"
            rel="noopener noreferrer"
            title="Alohida oynada ochish"
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
          >
            <Maximize2 size={16} />
          </a>
        </div>
      </div>

      {/* Reward Toast Banner */}
      {rewardClaimed && (
        <div className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between text-xs font-semibold shadow-lg animate-slideDown">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-200" />
            <span>Bob yakunlandi! +{rewardClaimed.coins} tanga va +{rewardClaimed.xp} XP qo'shildi!</span>
          </div>
          <button
            onClick={() => setRewardClaimed(null)}
            className="px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Embedded Lesson Canvas */}
      <div className="flex-1 w-full h-full relative bg-[#0c1017]">
        <iframe
          src={path}
          title={title}
          className="w-full h-full border-0 absolute inset-0"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  )
}
