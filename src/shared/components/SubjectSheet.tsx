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
      <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-4 pb-8 max-h-[80vh] overflow-y-auto">
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-5" />
        <p id="subject-title" className="text-center text-base font-black mb-5 text-fg">
          {lang === 'ru' ? 'Выбрать предмет' : 'Fan tanlash'}
        </p>
        <div className="flex flex-col gap-2.5">
          {SUBJECTS.map((s) => {
            const active = s.id === subjectId
            const Icon = s.icon
            return (
              <button key={s.id} onClick={() => pick(s.id, s.available)}
                className={`flex items-center gap-3 w-full rounded-2xl border-2 p-3.5 text-left transition-all active:scale-[0.98] ${
                  !s.available ? 'opacity-55' : ''
                } ${
                  active ? 'border-duo-green bg-duo-green/10' : 'border-line bg-canvas active:border-lineStrong'
                }`}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-none"
                  style={{ background: `${s.color}26`, color: s.color }}>
                  <Icon size={22} />
                </div>
                <span className="flex-1 text-[15px] font-bold text-fg">
                  {lang === 'ru' ? s.nameRu : s.name}
                </span>
                {s.demoData && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-duo-yellow flex-none">
                    demo
                  </span>
                )}
                {!s.available && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-subtle flex-none">
                    {lang === 'ru' ? 'Скоро' : 'Tez kunda'}
                  </span>
                )}
                {active && s.available && <Check size={18} className="text-duo-green flex-none" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
      </div>
    </DialogOverlay>
  )
}
