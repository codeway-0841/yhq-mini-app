import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { SUBJECT_BASES } from '../../../../shared/subjects'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { type Lang, type useT } from '../../../shared/i18n'
import { haptics } from '../../../platform/haptics'
import { cn } from '../../../shared/lib/cn'

interface MyCoursesSectionProps {
  lang: Lang
  tt: ReturnType<typeof useT>
}

export function MyCoursesSection({ lang, tt }: MyCoursesSectionProps) {
  const navigate = useNavigate()
  const activeSubjectId = useSubjectStore((s) => s.subjectId)
  const setSubject = useSubjectStore((s) => s.setSubject)

  // Show available active subjects
  const availableSubjects = SUBJECT_BASES.filter((s) => s.available)

  const handleSelectSubject = (id: string) => {
    haptics.impact('light')
    setSubject(id)
    navigate('/')
  }

  return (
    <div className="mx-4 mb-5 rounded-2xl bg-pcard p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="font-display text-[16px] font-bold text-pfg tracking-tight">
          {tt('myCoursesTitle')}
        </h3>
      </div>

      {/* Horizontal scroll list of subject cards */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1 pt-0.5 -mx-1 px-1">
        {availableSubjects.map((s) => {
          const isSelected = activeSubjectId === s.id
          const subjectName = lang === 'ru' ? s.nameRu : s.name

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectSubject(s.id)}
              className={cn(
                'group flex min-w-[130px] shrink-0 items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-150 active:scale-95 text-left select-none shadow-2xs',
                isSelected
                  ? 'bg-psurface ring-1.5 ring-pprimary'
                  : 'bg-psurface hover:opacity-90',
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[20px] select-none shrink-0 leading-none">
                  {s.icon}
                </span>
                <p className="truncate text-[12.5px] font-semibold text-pfg">
                  {subjectName}
                </p>
              </div>

              <ChevronRight
                size={14}
                strokeWidth={2}
                className="text-psubtle shrink-0 group-hover:text-pfg group-hover:translate-x-0.5 transition-all"
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
