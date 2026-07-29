import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useAppStore, type ApiSettings } from '../store/useAppStore'
import Toggle from './Toggle'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#30363d] last:border-0">
      <span className="text-sm text-[#e6edf3]">{label}</span>
      {children}
    </div>
  )
}

function ChipGroup({ options, value, onChange }: {
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
            value === opt.value
              ? 'bg-[#1f6feb] text-white'
              : 'bg-[#21262d] text-[#8b949e] hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useAppStore()
  const [local, setLocal] = useState<ApiSettings>({ ...settings })

  const set = <K extends keyof ApiSettings>(key: K, val: ApiSettings[K]) =>
    setLocal((s) => ({ ...s, [key]: val }))

  const save = () => {
    updateSettings(local)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-[#161b22] rounded-t-2xl border-t border-[#30363d] p-5 pb-8 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">Sozlamalar</h2>
          <button onClick={onClose} className="text-[#8b949e] hover:text-white">
            <X size={20} />
          </button>
        </div>

        <Row label="To'g'ri javobda avtomatik o'tish">
          <Toggle checked={local.autoNextCorrect} onChange={(v) => set('autoNextCorrect', v)} />
        </Row>
        <Row label="Xato javobda avtomatik o'tish">
          <Toggle checked={local.autoNextWrong} onChange={(v) => set('autoNextWrong', v)} />
        </Row>
        <Row label="Animatsiyasiz o'tish">
          <Toggle checked={local.noAnimation} onChange={(v) => set('noAnimation', v)} />
        </Row>
        <Row label="Variantlarni aralashtirish">
          <Toggle checked={local.shuffleOptions} onChange={(v) => set('shuffleOptions', v)} />
        </Row>
        <Row label="Shrift o'lchami">
          <ChipGroup
            value={local.fontSize}
            onChange={(v) => set('fontSize', v as ApiSettings['fontSize'])}
            options={[
              { label: 'Kichik',   value: 'small'  },
              { label: "O'rtacha", value: 'medium' },
              { label: 'Katta',    value: 'large'  },
            ]}
          />
        </Row>
        <Row label="Shrift uslubi">
          <ChipGroup
            value={local.fontStyle}
            onChange={(v) => set('fontStyle', v as ApiSettings['fontStyle'])}
            options={[
              { label: 'Standart', value: 'default' },
              { label: 'Serif',    value: 'serif'   },
              { label: 'Mono',     value: 'mono'    },
            ]}
          />
        </Row>
        <Row label="Ilova tili">
          <ChipGroup
            value={local.language}
            onChange={(v) => set('language', v as ApiSettings['language'])}
            options={[
              { label: "O'zbekcha", value: 'uz' },
              { label: 'Русский',   value: 'ru' },
            ]}
          />
        </Row>

        <button className="mt-1 text-sm text-[#8b949e] hover:text-white underline underline-offset-2">
          Xatolik haqida xabar berish
        </button>

        <button
          onClick={save}
          className="mt-5 w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-base transition-colors"
        >
          Saqlash
        </button>
      </div>
    </div>
  )
}
