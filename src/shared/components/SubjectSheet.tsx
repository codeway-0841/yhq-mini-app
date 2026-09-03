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
        <div className="flex flex-col gap-2">
          {SUBJECTS.map((s) => {
            const active = s.id === subjectId
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => pick(s.id, s.available)}
                disabled={!s.available}
                className={`relative flex items-center gap-3.5 w-full p-3 rounded-2xl text-left transition-all duration-150 ease-out shadow-xs ${
                  !s.available
                    ? 'opacity-50 cursor-not-allowed bg-psurface/60'
                    : active
                      ? 'scale-[1.01]'
                      : 'bg-psurface hover:bg-pcard active:scale-[0.99]'
                }`}
                style={active ? {
                  backgroundColor: `${s.color}16`,
                  boxShadow: `inset 0 0 0 1.5px ${s.color}60, 0 4px 14px ${s.color}20`
                } : undefined}
              >
                {/* Rangli ikonka konteyneri */}
                <div
                  className="flex size-10 items-center justify-center rounded-xl shrink-0 transition-transform shadow-2xs"
                  style={{
                    backgroundColor: active ? s.color : `${s.color}18`,
                    color: active ? '#ffffff' : s.color
                  }}
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
