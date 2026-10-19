import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import ModalShell from './ModalShell'
import { SpecCard, SpecRow } from './ui/spec'

export interface PickerOption {
  value:   string
  label:   string
  desc?:   string
  icon?:   ReactNode
}

export default function PickerSheet({ title, titleIcon: _titleIcon, options, value, onSelect, onClose }: {
  title:    string
  titleIcon?: ReactNode
  options:  PickerOption[]
  value:    string
  onSelect: (value: string) => void
  onClose:  () => void
}) {
  return (
    <ModalShell
      title={title}
      onClose={onClose}
      labelId="picker-title"
      closeLabel="Yopish"
    >
        <SpecCard>
          {options.map((opt) => {
            const selected = opt.value === value
            return (
              <SpecRow
                key={opt.value}
                icon={opt.icon}
                tone={selected ? 'primary' : 'neutral'}
                label={opt.label}
                hint={opt.desc}
                selected={selected}
                value={selected ? <Check className="size-4 text-pprimary" strokeWidth={2.6} /> : undefined}
                onClick={() => { onSelect(opt.value); onClose() }}
              />
            )
          })}
        </SpecCard>
    </ModalShell>
  )
}
