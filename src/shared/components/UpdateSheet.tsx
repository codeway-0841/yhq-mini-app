import { memo } from 'react'
import { ArrowRight, Download } from 'lucide-react'
import ModalShell from './ModalShell'
import { SpecHero } from './ui/spec'
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
    <ModalShell
      title={isRu ? 'Обновление' : 'Yangilanish'}
      onClose={onClose}
      labelId="update-sheet-title"
      closeLabel={isRu ? 'Закрыть' : 'Yopish'}
      backdropClassName="bg-black/60"
    >
      <SpecHero
        icon={<Download className="size-9 text-white" strokeWidth={2} />}
        iconClassName="bg-[linear-gradient(160deg,#2f6fe0,#14418f)]"
        badge={
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pblue opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-pblue" />
          </span>
        }
        title={isRu ? 'Доступна новая версия!' : 'Yangi versiya tayyor!'}
        subtitle={
          info.latestVersion && info.latestVersion !== '0.0.0' ? `v${info.latestVersion}` : undefined
        }
      />

      <p className="relative z-10 mx-auto mt-4 max-w-xs text-center text-[13.5px] leading-relaxed text-pmuted">
        {isRu
          ? 'Мы обновили KIVVI: улучшена скорость работы, добавлены новые тесты и исправлены ошибки.'
          : 'KIVVI ilovasi yangilandi: ishlash tezligi oshirildi, yangi testlar qo‘shildi va xatoliklar tuzatildi.'}
      </p>

      <div className="relative z-10 mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleUpdate}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pprimary px-4 py-3.5 font-bold text-ponprimary shadow-xs transition-[transform,filter] duration-150 hover:brightness-[1.06] active:scale-[0.98] cursor-pointer"
        >
          <span>{isRu ? 'Обновить в Google Play' : 'Google Play orqali yangilash'}</span>
          <ArrowRight size={18} />
        </button>

        <button
          type="button"
          onClick={handleLater}
          className="w-full rounded-2xl px-4 py-3 text-[14px] font-medium text-pmuted transition-colors hover:bg-[rgb(var(--p-surface-rgb)/0.6)] hover:text-pfg active:scale-[0.98] cursor-pointer"
        >
          {isRu ? 'Напомнить позже' : 'Keyinroq eslatish'}
        </button>
      </div>
    </ModalShell>
  )
})

export default UpdateSheet
