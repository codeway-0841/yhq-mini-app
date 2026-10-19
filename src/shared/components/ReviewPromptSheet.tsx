/**
 * Kontekstli "sharh so'rash" sheet'i — global mount (App.tsx).
 *
 * KO'RINISH: ilovadagi YAGONA global sheet skeleti (UpdateSheet/WriteReviewSheet):
 * DialogOverlay → bg-psurface + rounded-t-sheet → ModalMathGrid → drag handle →
 * ModalHeaderRow (chapda X, o'rtada sarlavha) → matn → bitta CTA.
 *
 * IXCHAM (2026-10-19): sarlavha header ICHIDA (WriteReviewSheet uslubi), alohida
 * eyebrow/ikonka/ghost tugma YO'Q. Rad etishning bitta aniq yo'li — X (plyus
 * pastga surish va backdrop): takroriy "yo'q" tugmalari sheet'ni og'irlashtiradi.
 *
 * MANTIQ: faqat `useReviewPromptStore.pending` bo'lsa va boshqa modal
 * yopilgandan keyin ko'rinadi (natija/celebration ustiga chiqmaydi).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DialogOverlay from './DialogOverlay'
import ModalMathGrid from './ModalMathGrid'
import ModalHeaderRow from './ModalHeaderRow'
import { useAppStore } from '../store/useAppStore'
import { useReviewPromptStore } from '../store/useReviewPromptStore'
import { useModalCount } from '../lib/navigation'
import { useT } from '../i18n'
import { haptics } from '../../platform/haptics'
import { playSound } from '../lib/sounds'

export default function ReviewPromptSheet() {
  const pending = useReviewPromptStore((s) => s.pending)
  const dismiss = useReviewPromptStore((s) => s.dismiss)
  const markAsked = useReviewPromptStore((s) => s.markAsked)
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const navigate = useNavigate()
  const modalCount = useModalCount()

  // MUHIM: ochilgan sheet O'ZI ham modalCount'ni oshiradi. Agar ko'rinish sharti
  // har renderda `modalCount === 0` bo'lsa — mount bo'lishi bilan count 1 bo'ladi,
  // shart yana false bo'ladi va cheksiz mount/unmount loop boshlanadi.
  // Shuning uchun overlay FAQAT effect'dan keyin mount qilinadi va `ready` bilan
  // qulflanadi — o'z hissasi endi tekshirilmaydi.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!pending) {
      setReady(false)
      return
    }
    if (ready) return
    if (modalCount === 0) setReady(true)
  }, [pending, modalCount, ready])

  if (!pending || !ready) return null

  const onLater = () => {
    haptics.selection()
    dismiss()
  }

  const onWrite = () => {
    haptics.impact('light')
    playSound('click')
    markAsked()
    navigate('/sharhlar?write=1')
  }

  return (
    <DialogOverlay
      onClose={onLater}
      labelId="review-prompt-title"
      swipeToDismiss
      backdropClassName="bg-black/60"
      zIndex={80}
    >
      <div className="relative w-full max-w-lg mx-auto bg-psurface rounded-t-sheet px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar text-pfg">
        {/* Global standart balandlik (360) — mask 60%dan so'nadi, sheet ~207px
            bo'lgani uchun to'r butun sheet bo'ylab to'liq kuchda ko'rinadi.
            Kichik qiymat (240) bersa, mask sheet'ning yarmidan so'nib ketardi. */}
        <ModalMathGrid glow={false} height={360} />

        {/* iOS drag handle */}
        <div
          data-drag-handle
          className="w-10 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-2 cursor-grab active:cursor-grabbing touch-none relative z-10"
        />

        {/* Global modal header: chapda X, o'rtada sarlavha */}
        <ModalHeaderRow onClose={onLater} label={tt('close')}>
          <div data-drag-handle className="select-none">
            <h2
              id="review-prompt-title"
              className="text-[18px] font-bold leading-[23px] tracking-tight text-pfg"
            >
              {tt('reviewPromptTitle')}
            </h2>
          </div>
        </ModalHeaderRow>

        <p className="relative z-10 mb-4 mt-1 px-1 text-center text-[14px] leading-relaxed text-pmuted">
          {tt('reviewPromptBody')}
        </p>

        <button
          type="button"
          onClick={onWrite}
          className="relative z-10 w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-semibold text-ponprimary bg-pprimary active:scale-[0.98] transition-all shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-psurface"
        >
          {tt('reviewsWriteTitle')}
        </button>
      </div>
    </DialogOverlay>
  )
}
