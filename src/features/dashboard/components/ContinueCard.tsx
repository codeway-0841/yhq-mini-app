import { memo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useT } from '../../../shared/i18n'

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
    <div className="px-5 mb-4">
      <button onClick={onContinue}
        className="card-premium w-full relative overflow-hidden p-5 text-left active:scale-[0.98] transition-transform">
        {/* Background PNG (o'ng tomonda) — fayl yo'q bo'lsa yashirinadi */}
        {bgOk && (
          <img src={CONTINUE_BG_URL} alt="" aria-hidden
            onError={() => setBgOk(false)}
            style={{ mixBlendMode: 'screen' }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-full max-w-full object-contain pointer-events-none select-none" />
        )}
        <div className="relative">
          {/* Sarlavha */}
          <p className="text-[12px] font-medium text-psubtle">{tt('currentTopic')}</p>
          {/* Mavzu nomi — to'liq qatorda, kesilmaydi */}
          <p className="text-[18px] font-bold text-pfg tracking-tight whitespace-normal break-words leading-snug mt-1 pr-16">
            {modTitle}
          </p>
          <p className="text-[12px] font-medium text-pmuted mt-1.5">
            {allDone ? tt('allDoneWord') : lessonLabel}
          </p>
          {/* Progress bar + "Davom etish" — bir qatorda */}
          <div className="flex items-center gap-3 mt-3.5">
            <div className="progress-premium flex-1">
              <div className="fill" style={{ width: `${Math.max(progressPct, 2)}%` }} />
            </div>
            <span className="btn-premium btn-premium-sm flex-shrink-0">
              {tt('continueLearn')}
              <ChevronDown size={15} className="-rotate-90" />
            </span>
          </div>
        </div>
      </button>
    </div>
  )
})
