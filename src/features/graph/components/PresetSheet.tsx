import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Sheet, SheetHeader, SheetTitle, SheetBody, SheetClose } from '../../../shared/components/ui/sheet'
import { GRAPH_PRESETS, type GraphPreset } from '../../../content/graph-presets'
import { useT } from '../../../shared/i18n'

interface Props {
  open: boolean
  onClose: () => void
  language: 'uz' | 'ru'
  onApply: (preset: GraphPreset) => void
}

export default function PresetSheet({ open, onClose, language, onApply }: Props) {
  const tt = useT(language)
  const [subjectId, setSubjectId] = useState<'matematika' | 'fizika'>('matematika')
  if (!open) return null

  const subjects = [
    { id: 'matematika' as const, label: tt('graphPresetMath') },
    { id: 'fizika' as const, label: tt('graphPresetPhysics') },
  ]
  const isRu = language === 'ru'
  const presets = GRAPH_PRESETS.filter((p) => p.subjectId === subjectId)

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <SheetTitle>{tt('graphPresets')}</SheetTitle>
      </SheetHeader>
      <SheetClose onClose={onClose} label={tt('graphClose')} />
      <SheetBody>
        <div className="mb-3 flex gap-2">
          {subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSubjectId(s.id)}
              className={`h-9 rounded-xl px-3.5 text-[13px] font-semibold transition-colors ${
                subjectId === s.id ? 'bg-pprimary text-ponprimary' : 'bg-psurface text-pmuted hover:text-pfg'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApply(p)}
              className="flex items-center gap-3 rounded-2xl bg-psurface p-3 text-left transition-colors hover:bg-pcard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-pfg">{isRu ? p.titleRu : p.title}</p>
                <p className="mt-0.5 truncate font-mono text-[12px] text-pmuted">{p.expr}</p>
                {(isRu ? p.noteRu : p.note) && (
                  <p className="mt-0.5 text-[11px] text-psubtle">{isRu ? p.noteRu : p.note}</p>
                )}
              </div>
              <Plus size={16} className="flex-shrink-0 text-psubtle" />
            </button>
          ))}
        </div>
      </SheetBody>
    </Sheet>
  )
}
