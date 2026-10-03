import { X, Check } from 'lucide-react'
import { SUBJECTS } from '@/shared/config/subjects'
import { haptics } from '@/platform/haptics'

export type TimeRange = '7D' | '30D' | '90D' | '1Y'
export type SortOrder = 'newest' | 'highest' | 'helpful'

interface Props {
  timeRange: TimeRange
  setTimeRange: (t: TimeRange) => void
  selectedSubject: string | undefined
  setSelectedSubject: (s: string | undefined) => void
  sortOrder: SortOrder
  setSortOrder: (s: SortOrder) => void
  onClose: () => void
}

const TIME_RANGES: { key: TimeRange; labelUz: string; labelRu: string }[] = [
  { key: '7D', labelUz: "So'nggi 7 kun", labelRu: 'Последние 7 дней' },
  { key: '30D', labelUz: "So'nggi 30 kun", labelRu: 'Последние 30 дней' },
  { key: '90D', labelUz: "So'nggi 90 kun", labelRu: 'Последние 90 дней' },
  { key: '1Y', labelUz: 'Barcha vaqt', labelRu: 'Всё время' },
]

const SORT_OPTIONS: { key: SortOrder; labelUz: string; labelRu: string }[] = [
  { key: 'newest', labelUz: 'Eng yangilari', labelRu: 'Сначала новые' },
  { key: 'highest', labelUz: 'Yuqori baholilar', labelRu: 'С высокой оценкой' },
  { key: 'helpful', labelUz: 'Eng foydalilari', labelRu: 'Самые полезные' },
]

export default function FilterSortSheet({
  timeRange,
  setTimeRange,
  selectedSubject,
  setSelectedSubject,
  sortOrder,
  setSortOrder,
  onClose,
}: Props) {
  const activeSubjects = SUBJECTS.filter((s) => s.available)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in" />

      <div
        className="relative w-full max-w-lg bg-white dark:bg-card rounded-t-[32px] px-6 pb-10 pt-4 animate-in slide-in-from-bottom duration-300 max-h-[88vh] overflow-y-auto no-scrollbar shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1.5 bg-slate-200 dark:bg-white/20 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-foreground tracking-tight">
            Filtr va saralash
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. Vaqt oralig'i */}
        <div className="mb-5">
          <label className="text-[11px] font-bold text-slate-400 dark:text-muted-foreground uppercase tracking-wider block mb-2.5">
            Vaqt oralig‘i
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TIME_RANGES.map((tr) => {
              const active = timeRange === tr.key
              return (
                <button
                  key={tr.key}
                  onClick={() => {
                    haptics.impact('light')
                    setTimeRange(tr.key)
                  }}
                  className={`py-2.5 px-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between border transition-all active:scale-95 ${
                    active
                      ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 shadow-2xs'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span>{tr.labelUz}</span>
                  {active && <Check size={14} className="text-blue-600 stroke-[2.5]" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. Saralash */}
        <div className="mb-5">
          <label className="text-[11px] font-bold text-slate-400 dark:text-muted-foreground uppercase tracking-wider block mb-2.5">
            Saralash tartibi
          </label>
          <div className="space-y-1.5">
            {SORT_OPTIONS.map((so) => {
              const active = sortOrder === so.key
              return (
                <button
                  key={so.key}
                  onClick={() => {
                    haptics.impact('light')
                    setSortOrder(so.key)
                  }}
                  className={`w-full py-2.5 px-4 rounded-2xl text-xs font-semibold flex items-center justify-between border transition-all active:scale-95 ${
                    active
                      ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 shadow-2xs'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span>{so.labelUz}</span>
                  {active && <Check size={14} className="text-blue-600 stroke-[2.5]" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. Fan bo'yicha saralash (Professional KIVVI Grid) */}
        <div className="mb-6">
          <label className="text-[11px] font-bold text-slate-400 dark:text-muted-foreground uppercase tracking-wider block mb-2.5">
            Fanlar
          </label>
          <div className="grid grid-cols-2 gap-2">
            {/* Hammasi */}
            <button
              onClick={() => {
                haptics.selection()
                setSelectedSubject(undefined)
              }}
              className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all active:scale-95 ${
                !selectedSubject
                  ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 shadow-2xs'
                  : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:bg-slate-50'
              }`}
            >
              <span>Barcha fanlar</span>
              {!selectedSubject && <Check size={14} className="text-blue-600 stroke-[2.5]" />}
            </button>

            {/* Har bir fan — toza matn, iconsiz */}
            {activeSubjects.map((s) => {
              const active = selectedSubject === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    haptics.selection()
                    setSelectedSubject(active ? undefined : s.id)
                  }}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all active:scale-95 ${
                    active
                      ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 shadow-2xs'
                      : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{s.name}</span>
                  {active && <Check size={14} className="text-blue-600 stroke-[2.5] shrink-0 ml-1" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* 4. Qo'llash tugmasi */}
        <button
          onClick={() => {
            haptics.impact('medium')
            onClose()
          }}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm active:scale-[0.98] transition-all shadow-md shadow-blue-500/20"
        >
          Filtrni qo‘llash
        </button>
      </div>
    </div>
  )
}
