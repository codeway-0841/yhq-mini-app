import { memo, useEffect, useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useQuestionsStore } from '../../../shared/store/useQuestionsStore'
import { useT } from '../../../shared/i18n'

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
    <div className="px-5 mb-3">
      <div className="card-premium relative overflow-hidden p-5 pr-[118px] sm:pr-[132px]">
        {/* O'ng taraf: fan rasmi — karta ichida sig'adi, matnni bosmaydi */}
        {imgOk && (
          <img src={imgUrl} alt="" aria-hidden
            onError={() => setImgOk(false)}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 h-[78%] max-h-[84px] max-w-[34%] object-contain object-right pointer-events-none select-none" />
        )}
        {/* Rasm bo'lmasa: dekorativ watermark ikon */}
        {!imgOk && (
          <Icon size={110} strokeWidth={1} aria-hidden
            className="absolute -right-4 -bottom-6 opacity-[0.07] pointer-events-none"
            style={{ color: subject.color }} />
        )}
        <div className="relative min-w-0">
          <p className="text-[18px] sm:text-[20px] font-bold text-pfg tracking-tight leading-[1.15] line-clamp-2 break-words">
            {lang === 'ru' ? subject.nameRu : subject.name}
          </p>
          <p className="text-[12px] font-medium text-psubtle mt-1">
            {count > 0 ? count.toLocaleString('en-US') : '…'} {tt('testsWord')}
          </p>
          <button onClick={onOpen}
            className="btn-premium-secondary mt-3.5 rounded-full px-4 py-2 text-[12px]"
            aria-label={tt('switchSubject')}>
            {tt('switchSubject')}
            <ChevronDown size={14} className="-rotate-90 text-psubtle" />
          </button>
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
    <div className="mx-5 mt-6 rounded-[28px] border border-dashed border-pline p-8 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: `${subject.color}1A`, border: `1px solid ${subject.color}2E`, color: subject.color }}>
        <Icon size={32} />
      </div>
      <h3 className="text-[17px] font-bold text-pfg tracking-tight">
        {lang === 'ru' ? subject.nameRu : subject.name}
      </h3>
      <p className="text-[13px] font-medium text-psubtle mt-1.5 max-w-[240px]">
        {lang === 'ru'
          ? 'Этот предмет скоро будет доступен. Следите за обновлениями!'
          : "Bu fan tez kunda qo'shiladi. Yangilanishlarni kuzatib boring!"}
      </p>
      <button onClick={onSwitch}
        className="btn-premium btn-premium-sm mt-5">
        <Sparkles size={16} />
        {lang === 'ru' ? 'Выбрать другой предмет' : 'Boshqa fan tanlash'}
      </button>
    </div>
  )
})
