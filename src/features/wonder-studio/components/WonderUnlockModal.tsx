import ModalHeaderRow from '../../../shared/components/ModalHeaderRow'
import { WonderRedBear } from './WonderIcons'

interface WonderUnlockModalProps {
  courseTitle?: string
  lessonTitle?: string
  isEnrolled?: boolean
  onClose: () => void
  onUnlock?: () => void
  onUpgradePro?: () => void
}

/**
 * 1:1 Authentic Wondering Lesson Unlock / Jump Ahead Modal
 * Faithfully recreated from live_auth_lesson.png & node_clicked_detail.png
 */
export default function WonderUnlockModal({
  courseTitle: _courseTitle = 'this course',
  lessonTitle = 'Should you really start tests with the hardest problem first?',
  isEnrolled = false,
  onClose,
  onUnlock,
  onUpgradePro,
}: WonderUnlockModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-3xl bg-[#FFFDF8] dark:bg-[#1E1512] border border-stone-200/90 dark:border-stone-800 shadow-2xl p-6 sm:p-8 pt-5 text-center space-y-4">
        <div
          data-drag-handle
          aria-hidden="true"
          className="mx-auto h-1 w-9 rounded-full bg-stone-300 dark:bg-stone-700 cursor-grab active:cursor-grabbing touch-none select-none"
        />
        <ModalHeaderRow
          onClose={onClose}
          label="Close"
          closeClassName="border-transparent bg-transparent shadow-none dark:border-transparent dark:bg-transparent text-stone-400 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
        >
          <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
            {isEnrolled ? 'Jump ahead to this lesson' : 'Import course to unlock'}
          </h3>
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 font-medium max-w-xs mx-auto leading-relaxed mt-1">
            {lessonTitle}
          </p>
        </ModalHeaderRow>

        {/* 1:1 Mascot: Red Bear for Pro Jump Ahead, Star for Course Import */}
        <div className="flex justify-center pt-2">
          {isEnrolled ? (
            <WonderRedBear size={64} className="select-none pointer-events-none" />
          ) : (
            <img
              src="/star.svg"
              alt="Wondering Mascot"
              className="size-12 select-none pointer-events-none"
            />
          )}
        </div>

        {isEnrolled && (
          <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 max-w-xs mx-auto">
            Complete preceding lessons to unlock naturally, or jump ahead right now with Wondering Pro.
          </p>
        )}

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          {isEnrolled ? (
            <>
              <button
                type="button"
                onClick={onUpgradePro || onClose}
                className="w-full py-3 rounded-xl bg-[#67C2F9] hover:bg-[#5BB9F5] text-[#261312] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center"
              >
                JUMP AHEAD WITH PRO
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 font-mono text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800/60 transition-colors cursor-pointer"
              >
                BACK TO PATH
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onUnlock || onClose}
              className="w-full py-3 rounded-xl bg-[#67C2F9] hover:bg-[#5BB9F5] text-[#261312] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center"
            >
              IMPORT COURSE
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
