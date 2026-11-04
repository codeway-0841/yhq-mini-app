import { ChevronRight } from 'lucide-react'
import { SUBJECTS } from '../config/subjects'
import { useSubjectStore } from '../store/useSubjectStore'
import { useAppStore } from '../store/useAppStore'
import DialogOverlay from './DialogOverlay'
import { SpecCard } from './ui/spec'

export default function SubjectSheet({ onClose }: { onClose: () => void }) {
  const { subjectId, setSubject } = useSubjectStore()
  const lang = useAppStore((s) => s.settings.language)

  const pick = (id: string, available: boolean) => {
    if (!available) return
    setSubject(id)
    onClose()
  }

  const title = lang === 'ru' ? 'Выбрать предмет' : 'Fan tanlash'

  return (
    <DialogOverlay
      onClose={onClose}
      labelId="subject-sheet-title"
      position="bottom"
      swipeToDismiss
      closeOnBackdrop
    >
      <div
        className="relative z-10 mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-t-sheet bg-psurface shadow-2xl max-h-[88dvh] pb-[var(--safe-bottom,0px)]"
      >
        {/* Screen-reader sarlavha (vizual ko'rinmaydi) */}
        <h2 id="subject-sheet-title" className="sr-only">
          {title}
        </h2>

        {/* Yuqori drag tutqich */}
        <div
          data-drag-handle
          aria-hidden="true"
          className="relative z-10 mx-auto mt-3 mb-4 h-1 w-10 flex-none cursor-grab touch-none select-none rounded-full bg-gray-300 active:cursor-grabbing dark:bg-white/20"
        />

        <div className="relative z-10 min-h-0 flex-1 px-4 pb-4 overflow-y-auto overscroll-contain">
          <SpecCard>
            {SUBJECTS.map((s, i) => {
              const active = s.id === subjectId
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  onClick={() => pick(s.id, s.available)}
                  disabled={!s.available}
                  style={{ animationDelay: `${Math.min(i, 7) * 28}ms` }}
                  className={`relative flex w-full items-center gap-3.5 px-4 py-3 text-left transition-all duration-150 ease-out animate-sheetItemIn ${
                    !s.available ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99] hover:bg-psurface cursor-pointer'
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
                    className={`min-w-0 flex-1 truncate text-[15px] ${active ? 'font-bold' : 'font-medium text-pfg'}`}
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
          </SpecCard>
        </div>
      </div>
    </DialogOverlay>
  )
}
