import { memo, useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useQuestionsStore } from '../../../shared/store/useQuestionsStore'
import { useT } from '../../../shared/i18n'
import { Button } from '../../../shared/components/ui/button'

// ── Subject Switcher — fan nomi + testlar soni + almashtirish ──────────────
// Fan rasmlari: `public/fan-{subjectId}.webp` (masalan, fan-matematika.webp) —
// fayl mavjud bo'lsa o'ng tomonda ko'rinadi, bo'lmasa watermark ikon qoladi.
export const SubjectSwitcher = memo(function SubjectSwitcher({ onOpen }: { onOpen: () => void }) {
  const subject = useSubjectStore((s) => s.subject)
  const lang    = useAppStore((s) => s.settings.language)
  const count   = useQuestionsStore((s) => s.questions.length)
  const tt      = useT(lang)
  const Icon    = subject.icon
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => setImgOk(true), [subject.id]) // fan almashganda qayta urinib ko'rish
  const imgUrl = `/fan-${subject.id}.webp`
  return (
    <div className="mb-6 px-5">
      <div className="relative overflow-hidden rounded-2xl bg-pcard p-5 pr-[118px] sm:pr-[132px] shadow-xs">
        {/* O'ng taraf: fan rasmi — karta ichida sig'adi, matnni bosmaydi */}
        {imgOk && (
          <img src={imgUrl} alt="" aria-hidden
            onError={() => setImgOk(false)}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 h-[78%] max-h-[84px] max-w-[34%] object-contain object-right pointer-events-none select-none" />
        )}
        {/* Rasm bo'lmasa: dekorativ watermark ikon */}
        {!imgOk && (
          <Icon size={110} strokeWidth={1} aria-hidden
            className="absolute -right-4 -bottom-6 opacity-[0.07] pointer-events-none text-pfg" />
        )}
        <div className="relative min-w-0">
          <p className="line-clamp-2 break-words font-display text-[19px] font-semibold leading-[1.15] tracking-[-0.02em] text-pfg sm:text-[21px]">
            {lang === 'ru' ? subject.nameRu : subject.name}
          </p>
          <p className="text-[12px] font-medium text-psubtle mt-1">
            {count > 0 ? count.toLocaleString('en-US') : '…'} {tt('testsWord')}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpen}
            className="mt-3.5"
            aria-label={tt('switchSubject')}
          >
            {tt('switchSubject')}
            <ChevronRight strokeWidth={1.75} className="text-psubtle" />
          </Button>
        </div>
      </div>
    </div>
  )
})

// ── Empty State — "tez kunda" fanlar uchun ─────────────────────────────────
export const SubjectEmpty = memo(function SubjectEmpty({ onSwitch }: { onSwitch: () => void }) {
  const subject = useSubjectStore((s) => s.subject)
  const lang    = useAppStore((s) => s.settings.language)
  const Icon    = subject.icon
  return (
    <div className="mx-5 mt-6 flex flex-col items-center rounded-2xl bg-psurface p-8 text-center shadow-xs">
      <Icon size={36} strokeWidth={1.75} className="mb-3 shrink-0 text-pmuted" />
      <h3 className="font-display text-[17px] font-semibold tracking-[-0.015em] text-pfg">
        {lang === 'ru' ? subject.nameRu : subject.name}
      </h3>
      <p className="mt-1.5 max-w-[240px] text-[13px] text-pmuted">
        {lang === 'ru'
          ? 'Этот предмет скоро будет доступен. Следите за обновлениями!'
          : "Bu fan tez kunda qo'shiladi. Yangilanishlarni kuzatib boring!"}
      </p>
      <Button onClick={onSwitch} size="sm" className="mt-5">
        {lang === 'ru' ? 'Выбрать другой предмет' : 'Boshqa fan tanlash'}
      </Button>
    </div>
  )
})
