import { memo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useT } from '../../../shared/i18n'
import { cn } from '../../../shared/lib/cn'

// ── Davom etayotgan mavzu kartasi ───────────────────────────────────────────
// Background rasm: faylni `public/continue-mavzu.webp` ga tashlasangiz kifoya —
// karta unga avtomatik ulanadi (fayl bo'lmasa hech narsa buzilmaydi).
const CONTINUE_BG_URL = '/continue-mavzu.webp'

export const ContinueCard = memo(function ContinueCard({ modTitle, lessonLabel, progressPct, allDone, lang, onContinue }: {
  modTitle: string
  lessonLabel: string;         // masalan: "3/7 dars"
  progressPct: number          // shu modul'dagi tayyorlik foizi
  allDone: boolean
  lang: 'uz' | 'ru'; onContinue: () => void
}) {
  const tt = useT(lang)
  const [bgOk, setBgOk] = useState(true)
  return (
    <div className="mb-6 px-5">
      <button
        onClick={onContinue}
        className={cn(
          'relative w-full overflow-hidden rounded-container border border-pline bg-pcard p-5 text-left',
          'transition-[transform,border-color] duration-[120ms] ease-out',
          'hover:border-plineStrong active:scale-[0.98]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
        )}
      >
        {/* Dekorativ rasm — fayl yo'q bo'lsa yashirinadi.
            v3: `mix-blend-mode: screen` olib tashlandi (light temada rasm
            butunlay yo'qolardi); o'rniga past opacity ikkala temada ishlaydi. */}
        {bgOk && (
          <img src={CONTINUE_BG_URL} alt="" aria-hidden
            onError={() => setBgOk(false)}
            className="pointer-events-none absolute right-0 top-1/2 h-full max-w-[45%] -translate-y-1/2 select-none object-contain opacity-[0.14]" />
        )}
        <div className="relative">
          <p className="text-[12px] font-medium text-psubtle">{tt('currentTopic')}</p>
          {/* Mavzu nomi — to'liq qatorda, kesilmaydi */}
          <p className="mt-1 whitespace-normal break-words pr-16 font-display text-[18px] font-semibold leading-snug tracking-[-0.015em] text-pfg">
            {modTitle}
          </p>
          <p className="mt-1.5 text-[12px] font-medium text-pmuted">
            {allDone ? tt('allDoneWord') : lessonLabel}
          </p>
          {/* Progress rail + "Davom etish" — bir qatorda */}
          <div className="mt-4 flex items-center gap-3">
            <div className="h-[3px] flex-1 overflow-hidden rounded-[2px] bg-plineStrong">
              <div
                className="h-full rounded-[2px] bg-pprimary transition-[width] duration-[400ms] ease-out"
                style={{ width: `${Math.max(progressPct, 2)}%` }}
              />
            </div>
            <span className="inline-flex h-[34px] shrink-0 items-center gap-1 rounded-xl bg-pprimary px-3 text-[13.5px] font-semibold text-ponprimary shadow-xs">
              {tt('continueLearn')}
              <ChevronRight size={15} strokeWidth={1.75} />
            </span>
          </div>
        </div>
      </button>
    </div>
  )
})
