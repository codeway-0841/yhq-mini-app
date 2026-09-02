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
    <DialogOverlay onClose={onClose} labelId="subject-title">
      <div className="relative w-full bg-pcard rounded-t-sheet px-4 pt-4 pb-[calc(1.75rem+var(--safe-bottom,0px))] max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-5" />
        <p id="subject-title" className="text-center text-base font-semibold mb-5 text-pfg">
          {lang === 'ru' ? 'Выбрать предмет' : 'Fan tanlash'}
        </p>
        <div className="overflow-hidden rounded-2xl bg-psurface divide-y divide-pline shadow-xs">
          {SUBJECTS.map((s) => {
            const active = s.id === subjectId
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => pick(s.id, s.available)}
                disabled={!s.available}
                className={`flex items-center gap-3.5 w-full p-3.5 text-left transition-colors duration-[120ms] ease-out ${
                  !s.available ? 'opacity-50 cursor-not-allowed' : 'hover:bg-pcard active:bg-pcard'
                } ${
                  active ? 'bg-pcard font-semibold' : ''
                }`}
              >
                <Icon size={20} strokeWidth={1.75} className="shrink-0 text-pmuted" />
                <span className="flex-1 text-[14.5px] font-medium text-pfg">
                  {lang === 'ru' ? s.nameRu : s.name}
                </span>
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
                  <Check size={18} className="text-pprimary flex-none" strokeWidth={2.25} />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </DialogOverlay>
  )
}
