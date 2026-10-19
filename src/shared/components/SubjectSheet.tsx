import { ChevronRight } from 'lucide-react'
import { SUBJECTS } from '../config/subjects'
import { useSubjectStore } from '../store/useSubjectStore'
import { useAppStore } from '../store/useAppStore'
import ModalShell from './ModalShell'
import { SpecCard } from './ui/spec'

export default function SubjectSheet({ onClose }: { onClose: () => void }) {
  const { subjectId, setSubject } = useSubjectStore()
  const lang = useAppStore((s) => s.settings.language)

  const pick = (id: string, available: boolean) => {
    if (!available) return
    setSubject(id)
    onClose()
  }

  return (
    <ModalShell
      title={lang === 'ru' ? 'Выбрать предмет' : 'Fan tanlash'}
      onClose={onClose}
      labelId="subject-title"
      closeLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
    >
      <p className="relative z-10 mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-psubtle select-none">
        {lang === 'ru' ? 'Предметы' : 'Fanlar'}
      </p>
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
                !s.available ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99] hover:bg-psurface'
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
    </ModalShell>
  )
}
