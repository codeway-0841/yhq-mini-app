import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Maximize2, X } from 'lucide-react'
import { registerModal } from '../../shared/lib/navigation'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useT } from '../../shared/i18n'
import { resolveCdnUrl } from '../../shared/config/cdn'
import Confetti from '../../shared/components/Confetti'
import { BrilliantExitDialog, BrilliantSparkle } from '../../shared/components/BrilliantLessonChrome'

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
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const resolvedPath = resolveCdnUrl(path) ?? path
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const rewardClaimedRef = useRef(rewardClaimed)
  rewardClaimedRef.current = rewardClaimed

  const onCompleteRef = useRef(onChapterComplete)
  onCompleteRef.current = onChapterComplete

  // Telegram BackButton & Android hardware back integration
  useEffect(() => {
    const modalId = Symbol('interactive-lesson-modal')
    const unregister = registerModal(modalId, () => {
      if (rewardClaimedRef.current) onCloseRef.current()
      else setShowExitConfirm(true)
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

  const handleCloseAttempt = () => {
    if (rewardClaimed) {
      onClose()
      return
    }
    setShowExitConfirm(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-pcanvas text-pfg animate-fadeIn">
      {/* Confetti celebration when reward is claimed */}
      {rewardClaimed && (
        <div className="pointer-events-none absolute inset-0 z-50">
          <Confetti count={35} />
        </div>
      )}

      {/* Top Header bar — unified Brilliant 1:1 chrome with Safe Area support */}
      <div className="safe-top mx-auto flex min-h-[58px] w-full max-w-[960px] items-center justify-between gap-2.5 bg-pcanvas px-3.5 py-2">
        <button
          type="button"
          onClick={handleCloseAttempt}
          aria-label={tt('darslikClose')}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-pmuted transition-colors hover:bg-psurface hover:text-pfg"
        >
          <X size={21} strokeWidth={2.35} />
        </button>

        <div className="min-w-0 flex-1 px-1 text-center">
          <span className="block truncate font-display text-[15px] font-extrabold text-pfg">{title}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {rewardClaimed ? (
            <div className="flex items-center gap-1 rounded-full bg-[rgb(var(--p-success-rgb)/0.16)] px-3 py-1 text-xs font-extrabold text-psuccess">
              <CheckCircle2 size={14} strokeWidth={2.4} />
              <span>+{rewardClaimed.coins}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-psurface px-3 py-1 text-xs font-extrabold text-pfg">
              <BrilliantSparkle size={14} />
              <span>{tt('interactiveRewardChip').replace('{coins}', '25')}</span>
            </div>
          )}

          <a
            href={resolvedPath}
            target="_blank"
            rel="noopener noreferrer"
            title={tt('interactiveOpenExternal')}
            aria-label={tt('interactiveOpenExternal')}
            className="grid size-9 place-items-center rounded-full bg-psurface text-pmuted transition-colors hover:text-pfg"
          >
            <Maximize2 size={16} />
          </a>
        </div>
      </div>

      {/* Reward Toast Banner */}
      {rewardClaimed && (
        <div className="flex items-center justify-between bg-psuccess px-4 py-2 text-xs font-bold text-white animate-slideDown">
          <div className="flex items-center gap-2">
            <BrilliantSparkle size={15} className="text-white" />
            <span>
              {tt('interactiveChapterDoneToast')
                .replace('{coins}', String(rewardClaimed.coins))
                .replace('{xp}', String(rewardClaimed.xp))}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRewardClaimed(null)}
            aria-label={tt('darslikClose')}
            className="grid size-6 cursor-pointer place-items-center rounded-full bg-[rgb(0_0_0/0.2)] text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Embedded Lesson Canvas */}
      <div className="relative h-full w-full flex-1 bg-[#0c1017]">
        <iframe
          src={resolvedPath}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>

      <BrilliantExitDialog
        open={showExitConfirm}
        onStay={() => setShowExitConfirm(false)}
        onLeave={() => {
          setShowExitConfirm(false)
          onClose()
        }}
      />
    </div>
  )
}
