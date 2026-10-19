/**
 * Kontekstli "sharh so'rash" sheet'i — global mount (App.tsx).
 *
 * KO'RINISH: `ModalShell` (yagona modal qobig'i — to'r fon, dumaloq X,
 * markazdagi sarlavha) → matn → bitta CTA.
 *
 * IXCHAM (2026-10-19): sarlavha header ICHIDA, alohida eyebrow/ikonka/ghost
 * tugma YO'Q. Rad etishning bitta aniq yo'li — X (plyus pastga surish va
 * backdrop): takroriy "yo'q" tugmalari sheet'ni og'irlashtiradi.
 *
 * MANTIQ: faqat `useReviewPromptStore.pending` bo'lsa va boshqa modal
 * yopilgandan keyin ko'rinadi (natija/celebration ustiga chiqmaydi).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ModalShell from './ModalShell'
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
    <ModalShell
      title={tt('reviewPromptTitle')}
      onClose={onLater}
      labelId="review-prompt-title"
      closeLabel={tt('close')}
      zIndex={80}
      backdropClassName="bg-black/60"
    >
      <p className="relative z-10 mb-4 px-1 text-center text-[14px] leading-relaxed text-pmuted">
        {tt('reviewPromptBody')}
      </p>

      <button
        type="button"
        onClick={onWrite}
        className="relative z-10 flex w-full items-center justify-center gap-2 rounded-2xl bg-pprimary px-4 py-3.5 font-bold text-ponprimary shadow-xs transition-all duration-150 hover:brightness-[1.06] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-psurface"
      >
        {tt('reviewsWriteTitle')}
      </button>
    </ModalShell>
  )
}
