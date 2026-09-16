import { Check } from 'lucide-react'
import { SUBJECTS } from '../config/subjects'
import { useSubjectStore } from '../store/useSubjectStore'
import { useAppStore } from '../store/useAppStore'
import DialogOverlay from './DialogOverlay'

export default function SubjectSheet({ onClose }: { onClose: () => void }) {
  const { subjectId, setSubject } = useSubjectStore()
  const lang = useAppStore((s) => s.settings.language)

  const pick = (id: string, available: boolean) => {
    if (!available) return
    setSubject(id)
    onClose()
  }

  return (
    <DialogOverlay onClose={onClose} labelId="subject-title" swipeToDismiss>
      <div className="relative w-full bg-pcard rounded-t-sheet px-4 pt-4 pb-[calc(1.75rem+var(--safe-bottom,0px))] max-h-[80vh] overflow-y-auto shadow-2xl">
        <div data-drag-handle className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-5 cursor-grab active:cursor-grabbing touch-none" />
        <p id="subject-title" data-drag-handle className="text-center text-base font-semibold mb-5 text-pfg select-none">
          {lang === 'ru' ? 'Выбрать предмет' : 'Fan tanlash'}
        </p>
        <div className="flex flex-col gap-2">
          {SUBJECTS.map((s, i) => {
            const active = s.id === subjectId
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => pick(s.id, s.available)}
                disabled={!s.available}
                style={active ? {
                  backgroundColor: `${s.color}2E`,
                  boxShadow: `inset 0 0 0 2px ${s.color}, 0 4px 14px ${s.color}20`
                } : { animationDelay: `${Math.min(i, 7) * 28}ms` }}
                className={`relative flex items-center gap-3.5 w-full p-3 rounded-2xl text-left transition-[transform,background-color] duration-150 ease-out shadow-xs animate-sheetItemIn ${
                  !s.available
                    ? 'opacity-50 cursor-not-allowed bg-[rgb(var(--p-surface-rgb)/0.6)]'
                    : active
                      ? 'scale-[1.01] subject-picked'
                      : 'bg-psurface [@media(hover:hover)]:hover:bg-pcard [@media(hover:hover)]:hover:ring-2 [@media(hover:hover)]:hover:ring-[rgb(var(--p-muted-rgb)/0.4)] active:scale-[0.99]'
                }`}
              >
                {/* Har fan o'z gradientida (color → colorDark), oq ikonka */}
                <div
                  className="flex size-10 items-center justify-center rounded-full shrink-0 transition-transform shadow-2xs text-white"
                  style={{ backgroundImage: `linear-gradient(135deg, ${s.color}, ${s.colorDark})` }}
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[14.5px] truncate ${active ? 'font-bold' : 'font-medium text-pfg'}`}
                      style={active ? { color: s.color } : undefined}
                    >
                      {lang === 'ru' ? s.nameRu : s.name}
                    </span>
                    {active && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white shadow-2xs shrink-0"
                        style={{ backgroundColor: s.color }}
                      >
                        {lang === 'ru' ? 'Активен' : 'Tanlangan'}
                      </span>
                    )}
                  </div>
                </div>

                {s.demoData && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-pwarning flex-none">
                    demo
                  </span>
                )}
                {!s.available && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-psubtle flex-none">
                    {lang === 'ru' ? 'Скоро' : 'Tez kunda'}
                  </span>
                )}
                {active && s.available && (
                  <div
                    className="size-6 rounded-full flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: s.color }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </DialogOverlay>
  )
}
