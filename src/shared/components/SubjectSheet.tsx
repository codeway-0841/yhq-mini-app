import { ChevronRight } from 'lucide-react'
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
        <p className="px-1 mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-psubtle relative z-10 select-none">
          {lang === 'ru' ? 'Предметы' : 'Fanlar'}
        </p>
        <div className="rounded-2xl bg-pcard shadow-2xs relative z-10 overflow-hidden divide-y divide-pline">
          {SUBJECTS.map((s, i) => {
            const active = s.id === subjectId
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => pick(s.id, s.available)}
                disabled={!s.available}
                style={{ animationDelay: `${Math.min(i, 7) * 28}ms` }}
                className={`relative flex items-center gap-3.5 w-full px-4 py-3 text-left transition-all duration-150 ease-out animate-sheetItemIn ${
                  !s.available
                    ? 'opacity-50 cursor-not-allowed'
                    : 'active:scale-[0.99] hover:bg-psurface'
                }`}
              >
                {/* Har fan o'z gradientida (color → colorDark), oq ikonka */}
                <div
                  className="flex size-10 items-center justify-center rounded-full shrink-0 transition-transform shadow-2xs text-white"
                  style={{ backgroundImage: `linear-gradient(135deg, ${s.color}, ${s.colorDark})` }}
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                </div>

                <span
                  className={`flex-1 min-w-0 truncate text-[14.5px] ${active ? 'font-bold' : 'font-medium text-pfg'}`}
                  style={active ? { color: s.color } : undefined}
                >
                  {lang === 'ru' ? s.nameRu : s.name}
                </span>

                {s.demoData && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-pwarning flex-none">
                    demo
                  </span>
                )}
                {!s.available ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-psubtle flex-none">
                    {lang === 'ru' ? 'Скоро' : 'Tez kunda'}
                  </span>
                ) : (
                  <ChevronRight
                    size={18}
                    strokeWidth={2}
                    className="flex-none"
                    style={{ color: active ? s.color : 'var(--p-subtle)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </DialogOverlay>
  )
}
