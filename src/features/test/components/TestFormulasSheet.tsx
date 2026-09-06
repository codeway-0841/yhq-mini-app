import { useState, useMemo } from 'react'
import { Search, BookOpen, X } from 'lucide-react'
import { Sheet, SheetBody, SheetClose, SheetHeader, SheetTitle } from '../../../shared/components/ui/sheet'
import { useT, type Lang } from '../../../shared/i18n'
import { FORMULA_SUBJECTS, type FormulaSubject, type FormulaTopic } from '../../../content/formulas'

interface TestFormulasSheetProps {
  open: boolean
  onClose: () => void
  language: Lang
  subjectId: string
}

export default function TestFormulasSheet({
  open,
  onClose,
  language,
  subjectId,
}: TestFormulasSheetProps) {
  const tt = useT(language)
  const [search, setSearch] = useState('')

  // Fan mosligi: agar subjectId 'matematika', 'fizika' kabi bo'lsa o'shani tanlaymiz,
  // aks holda birinchi mavjud fan.
  const defaultSubject = useMemo(() => {
    const found = FORMULA_SUBJECTS.find((s) => s.subjectId === subjectId)
    return found ? found.subjectId : FORMULA_SUBJECTS[0]?.subjectId || 'matematika'
  }, [subjectId])

  const [activeSubjectId, setActiveSubjectId] = useState<string>(defaultSubject)
  const [activeTopicId, setActiveTopicId] = useState<string>('all')

  const currentSubject: FormulaSubject | undefined = useMemo(() => {
    return FORMULA_SUBJECTS.find((s) => s.subjectId === activeSubjectId) || FORMULA_SUBJECTS[0]
  }, [activeSubjectId])

  // Mavzular
  const topics: FormulaTopic[] = currentSubject?.topics || []

  // Qidiruv va filtr
  const filteredFormulas = useMemo(() => {
    if (!currentSubject) return []
    const query = search.trim().toLowerCase()

    let all = currentSubject.topics.flatMap((t) =>
      t.formulas.map((f) => ({
        ...f,
        topicName: language === 'ru' ? t.nameRu : t.name,
        topicId: t.id,
      }))
    )

    if (activeTopicId !== 'all') {
      all = all.filter((f) => f.topicId === activeTopicId)
    }

    if (query) {
      all = all.filter((f) => {
        const title = (language === 'ru' ? f.titleRu : f.title).toLowerCase()
        const formula = f.formula.toLowerCase()
        const note = (language === 'ru' ? (f.noteRu || '') : (f.note || '')).toLowerCase()
        const topic = f.topicName.toLowerCase()
        return title.includes(query) || formula.includes(query) || note.includes(query) || topic.includes(query)
      })
    }

    return all
  }, [currentSubject, activeTopicId, search, language])

  return (
    <Sheet open={open} onClose={onClose} zIndex={70} className="max-w-xl">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <BookOpen className="size-5 text-pprimary" />
          {tt('formulasTitle')}
        </SheetTitle>
      </SheetHeader>
      <SheetClose onClose={onClose} label={tt('formulasClose')} />

      <SheetBody className="space-y-3 px-4 pb-6">
        {/* Fan tanlash tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FORMULA_SUBJECTS.map((subj) => {
            const isSelected = subj.subjectId === activeSubjectId
            const label = subj.subjectId === 'matematika' ? (language === 'ru' ? 'Математика' : 'Matematika')
              : subj.subjectId === 'fizika' ? (language === 'ru' ? 'Физика' : 'Fizika')
              : subj.subjectId === 'kimyo' ? (language === 'ru' ? 'Химия' : 'Kimyo')
              : subj.subjectId === 'biologiya' ? (language === 'ru' ? 'Биология' : 'Biologiya')
              : (language === 'ru' ? 'Английский' : 'Ingliz tili')

            return (
              <button
                key={subj.subjectId}
                type="button"
                onClick={() => {
                  setActiveSubjectId(subj.subjectId)
                  setActiveTopicId('all')
                }}
                className={`flex-none rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-pprimary text-white shadow-xs'
                    : 'bg-psurface text-pmuted hover:text-pfg'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Qidiruv qatori */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-pmuted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tt('formulasSearch')}
            className="w-full rounded-2xl bg-psurface py-2 pl-9 pr-8 text-xs font-medium text-pfg placeholder:text-pmuted focus:outline-none focus:ring-2 focus:ring-pprimary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pmuted hover:text-pfg p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Mavzu filtrlari */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setActiveTopicId('all')}
            className={`flex-none rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
              activeTopicId === 'all'
                ? 'bg-pprimary/15 text-pprimary font-semibold'
                : 'bg-psurface text-pmuted hover:text-pfg'
            }`}
          >
            {tt('formulasAllTopics')}
          </button>
          {topics.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTopicId(t.id)}
              className={`flex-none rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                activeTopicId === t.id
                  ? 'bg-pprimary/15 text-pprimary font-semibold'
                  : 'bg-psurface text-pmuted hover:text-pfg'
              }`}
            >
              {language === 'ru' ? t.nameRu : t.name}
            </button>
          ))}
        </div>

        {/* Formulalar ro'yxati */}
        <div className="max-h-[50dvh] overflow-y-auto space-y-2 pr-1 [scrollbar-width:thin]">
          {filteredFormulas.length === 0 ? (
            <div className="py-8 text-center text-xs text-pmuted font-medium">
              {tt('formulasEmpty')}
            </div>
          ) : (
            filteredFormulas.map((f) => (
              <div
                key={f.id}
                className="flex flex-col gap-1 rounded-2xl bg-psurface p-3 transition-colors hover:bg-psurfaceHover"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-pfg">
                    {language === 'ru' ? f.titleRu : f.title}
                  </span>
                  <span className="text-[10px] text-pmuted font-medium bg-pcard px-2 py-0.5 rounded-full">
                    {f.topicName}
                  </span>
                </div>
                <div className="rounded-xl bg-pcard px-3 py-2 text-center font-mono text-sm font-bold text-pprimary shadow-2xs tracking-wide select-all">
                  {f.formula}
                </div>
                {(f.note || f.noteRu) && (
                  <span className="text-[11px] text-pmuted italic pl-1">
                    {language === 'ru' ? (f.noteRu || f.note) : (f.note || f.noteRu)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </SheetBody>
    </Sheet>
  )
}
