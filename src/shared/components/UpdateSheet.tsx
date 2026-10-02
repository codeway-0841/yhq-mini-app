import { memo } from 'react'
import { ArrowRight, Download } from 'lucide-react'
import DialogOverlay from './DialogOverlay'
import ModalMathGrid from './ModalMathGrid'
import ModalHeaderRow from './ModalHeaderRow'
import type { AppVersionInfo } from '../../platform/version-check'
import type { Lang } from '../i18n'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'

export interface UpdateSheetProps {
  isOpen: boolean
  info: AppVersionInfo
  lang: Lang
  onClose: () => void
  onDismiss: () => void
}

export const UpdateSheet = memo(function UpdateSheet({
  isOpen,
  info,
  lang,
  onClose,
  onDismiss,
}: UpdateSheetProps) {
  if (!isOpen) return null

  const handleUpdate = () => {
    playSound('click')
    haptics.impact('medium')
    if (info.updateUrl) {
      window.open(info.updateUrl, '_system')
    }
    onClose()
  }

  const handleLater = () => {
    playSound('click')
    haptics.impact('light')
    onDismiss()
  }

  const isRu = lang === 'ru'

  return (
    <DialogOverlay onClose={onClose} labelId="update-sheet-title" swipeToDismiss backdropClassName="bg-black/60">
      <div className="relative w-full bg-psurface rounded-t-sheet px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))] shadow-2xl overflow-hidden text-pfg">
        <ModalMathGrid glow={false} height={320} />
        
        {/* iOS Drag Handle */}
        <div
          data-drag-handle
          className="w-10 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-2 cursor-grab active:cursor-grabbing touch-none relative z-10"
        />

        {/* Header Row */}
        <ModalHeaderRow onClose={onClose} label={isRu ? 'Закрыть' : 'Yopish'}>
          <span className="text-xs font-semibold text-pmuted uppercase tracking-wider">
            KIVVI Update
          </span>
        </ModalHeaderRow>

        {/* Content */}
        <div className="flex flex-col items-center text-center mt-2 mb-6 relative z-10">
          <div className="relative mb-3 flex items-center justify-center text-pfg">
            <Download size={36} strokeWidth={2} />
            <span className="absolute -top-1 -right-2.5 flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-blue-500" />
            </span>
          </div>

          <h2 id="update-sheet-title" className="text-xl font-bold tracking-tight text-pfg">
            {isRu ? 'Доступна новая версия!' : 'Yangi versiya tayyor!'}
          </h2>

          {info.latestVersion && info.latestVersion !== '0.0.0' && (
            <span className="mt-1 text-[13px] font-medium text-pmuted">
              v{info.latestVersion}
            </span>
          )}

          <p className="mt-2.5 text-[14px] text-pmuted leading-relaxed max-w-xs">
            {isRu
              ? 'Мы обновили KIVVI: улучшена скорость работы, добавлены новые тесты и исправлены ошибки.'
              : 'KIVVI ilovasi yangilandi: ishlash tezligi oshirildi, yangi testlar qo‘shildi va xatoliklar tuzatildi.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 relative z-10">
          <button
            type="button"
            onClick={handleUpdate}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md cursor-pointer"
          >
            <span>{isRu ? 'Обновить в Google Play' : 'Google Play orqali yangilash'}</span>
            <ArrowRight size={18} />
          </button>

          <button
            type="button"
            onClick={handleLater}
            className="w-full py-3 px-4 rounded-2xl text-[14px] font-medium text-pmuted hover:text-pfg hover:bg-psurface active:scale-[0.98] transition-colors cursor-pointer"
          >
            {isRu ? 'Напомнить позже' : 'Keyinroq eslatish'}
          </button>
        </div>
      </div>
    </DialogOverlay>
  )
})

export default UpdateSheet
