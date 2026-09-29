import { Check } from 'lucide-react'
import { SUBJECTS } from '../config/subjects'
import { useSubjectStore } from '../store/useSubjectStore'
import { useAppStore } from '../store/useAppStore'
import DialogOverlay from './DialogOverlay'
import ModalMathGrid from './ModalMathGrid'
import ModalHeaderRow from './ModalHeaderRow'

export default function SubjectSheet({ onClose }: { onClose: () => void }) {
  const { subjectId, setSubject } = useSubjectStore()
  const lang = useAppStore((s) => s.settings.language)

  const pick = (id: string, available: boolean) => {
    if (!available) return
    setSubject(id)
    onClose()
  }

  return (
    <DialogOverlay onClose={onClose} labelId="subject-title" swipeToDismiss backdropClassName="bg-black/60">
      <div className="relative w-full bg-psurface rounded-t-sheet px-4 pt-4 pb-[calc(1.75rem+var(--safe-bottom,0px))] max-h-[82vh] overflow-y-auto shadow-2xl overflow-hidden">
        <ModalMathGrid glow={false} height={380} />
        <div data-drag-handle className="w-10 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-2 cursor-grab active:cursor-grabbing touch-none relative z-10" />
        <ModalHeaderRow onClose={onClose} label={lang === 'ru' ? 'Закрыть' : 'Yopish'}>
          <h2 id="subject-title" data-drag-handle className="text-lg font-bold text-pfg select-none">
            {lang === 'ru' ? 'Выбрать предмет' : 'Fan tanlash'}
          </h2>
        </ModalHeaderRow>
        <div className="flex flex-col gap-2.5">
          {SUBJECTS.map((s, i) => {
            const active = s.id === subjectId
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => pick(s.id, s.available)}
                disabled={!s.available}
                style={active ? {
                  boxShadow: `inset 0 0 0 2px ${s.color}, 0 4px 14px ${s.color}20`
                } : { animationDelay: `${Math.min(i, 7) * 28}ms` }}
                className={`relative flex items-center gap-3.5 w-full p-3.5 rounded-2xl text-left transition-[transform,box-shadow] duration-150 ease-out animate-sheetItemIn ${
                  !s.available
                    ? 'opacity-50 cursor-not-allowed bg-pcard'
                    : active
                      ? 'bg-pcard scale-[1.01] subject-picked shadow-md'
                      : 'bg-pcard shadow-2xs hover:shadow-xs active:scale-[0.99]'
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
