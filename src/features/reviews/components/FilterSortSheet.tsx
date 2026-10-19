import { Check } from 'lucide-react'
import { SUBJECTS } from '@/shared/config/subjects'
import { haptics } from '@/platform/haptics'
import { useAppStore } from '@/shared/store/useAppStore'
import ModalShell from '@/shared/components/ModalShell'

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
  const lang = useAppStore((s) => s.settings.language)

  const handleReset = () => {
    haptics.selection()
    setTimeRange('7D')
    setSelectedSubject(undefined)
    setSortOrder('newest')
  }

  return (
    <ModalShell
      title={lang === 'ru' ? 'Фильтр и сортировка' : 'Filtr va saralash'}
      onClose={onClose}
      labelId="filter-sheet-title"
      closeLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
      backdropClassName="bg-black/60"
      headerRight={
        <button
          type="button"
          onClick={handleReset}
          className="relative left-auto top-auto shrink-0 px-2 py-1 text-xs font-semibold text-pprimary hover:opacity-80 active:scale-95 transition-all cursor-pointer select-none"
        >
          {lang === 'ru' ? 'Сброс' : 'Tozalash'}
        </button>
      }
    >

        {/* 1. Vaqt oralig'i */}
        <div className="mb-4 relative z-10">
          <label className="text-[11px] font-bold text-psubtle uppercase tracking-wider block mb-2 px-1">
            {lang === 'ru' ? 'Период времени' : 'Vaqt oralig‘i'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TIME_RANGES.map((tr) => {
              const active = timeRange === tr.key
              return (
                <button
                  key={tr.key}
                  type="button"
                  onClick={() => {
                    haptics.impact('light')
                    setTimeRange(tr.key)
                  }}
                  className={`py-2 px-3 rounded-2xl text-xs font-semibold flex items-center justify-between border transition-all active:scale-95 cursor-pointer ${
                    active
                      ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 shadow-2xs'
                      : 'bg-pcard text-pfg border-pline hover:bg-psurface'
                  }`}
                >
                  <span>{lang === 'ru' ? tr.labelRu : tr.labelUz}</span>
                  {active && <Check size={13} className="text-blue-600 stroke-[2.5]" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. Saralash */}
        <div className="mb-4 relative z-10">
          <label className="text-[11px] font-bold text-psubtle uppercase tracking-wider block mb-2 px-1">
            {lang === 'ru' ? 'Сортировка' : 'Saralash tartibi'}
          </label>
          <div className="space-y-1.5">
            {SORT_OPTIONS.map((so) => {
              const active = sortOrder === so.key
              return (
                <button
                  key={so.key}
                  type="button"
                  onClick={() => {
                    haptics.impact('light')
                    setSortOrder(so.key)
                  }}
                  className={`w-full py-2 px-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between border transition-all active:scale-95 cursor-pointer ${
                    active
                      ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 shadow-2xs'
                      : 'bg-pcard text-pfg border-pline hover:bg-psurface'
                  }`}
                >
                  <span>{lang === 'ru' ? so.labelRu : so.labelUz}</span>
                  {active && <Check size={13} className="text-blue-600 stroke-[2.5]" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. Fan bo'yicha saralash (Professional KIVVI Grid) */}
        <div className="mb-5 relative z-10">
          <label className="text-[11px] font-bold text-psubtle uppercase tracking-wider block mb-2 px-1">
            {lang === 'ru' ? 'Предметы' : 'Fanlar'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {/* Hammasi */}
            <button
              type="button"
              onClick={() => {
                haptics.selection()
                setSelectedSubject(undefined)
              }}
              className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                !selectedSubject
                  ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 shadow-2xs'
                  : 'bg-pcard text-pfg border-pline hover:bg-psurface'
              }`}
            >
              <span>{lang === 'ru' ? 'Все предметы' : 'Barcha fanlar'}</span>
              {!selectedSubject && <Check size={13} className="text-blue-600 stroke-[2.5]" />}
            </button>

            {/* Har bir fan — toza matn, iconsiz */}
            {activeSubjects.map((s) => {
              const active = selectedSubject === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    haptics.selection()
                    setSelectedSubject(active ? undefined : s.id)
                  }}
                  className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                    active
                      ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 shadow-2xs'
                      : 'bg-pcard text-pfg border-pline hover:bg-psurface'
                  }`}
                >
                  <span className="truncate">{lang === 'ru' ? s.nameRu : s.name}</span>
                  {active && <Check size={13} className="text-blue-600 stroke-[2.5] shrink-0 ml-1" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* 4. Qo'llash tugmasi */}
        <button
          type="button"
          onClick={() => {
            haptics.impact('medium')
            onClose()
          }}
          className="w-full py-3.5 rounded-2xl bg-pprimary text-ponprimary hover:brightness-[1.06] font-bold text-sm active:scale-[0.98] transition-all shadow-xs relative z-10 cursor-pointer"
        >
          {lang === 'ru' ? 'Применить фильтр' : 'Filtrni qo‘llash'}
        </button>
    </ModalShell>
  )
}
