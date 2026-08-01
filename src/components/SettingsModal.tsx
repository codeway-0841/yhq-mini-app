import { useState, type ReactNode } from 'react'
import {
  X, Play, Zap, Shuffle, Type, Moon, Sun, Globe, Flag,
} from 'lucide-react'
import { useAppStore, type ApiSettings } from '../store/useAppStore'
import { useQuestionsStore } from '../store/useQuestionsStore'
import { openTelegramLink } from '../lib/telegram'
import { useT } from '../lib/i18n'
import Toggle from './Toggle'

type LucideIcon = typeof Play

/** Videodagi dizayn kabi: chapda rangli ikonka-da'ira + label + o'ngda boshqaruv */
function Row({ icon: Icon, iconColor, label, children }: {
  icon: LucideIcon
  iconColor: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#30363d] last:border-0">
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-none"
        style={{ background: `${iconColor}26` }}>
        <Icon size={17} style={{ color: iconColor }} />
      </div>
      <span className="flex-1 text-sm text-[#e6edf3]">{label}</span>
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
  const tt = useT(local.language)

  const set = <K extends keyof ApiSettings>(key: K, val: ApiSettings[K]) =>
    setLocal((s) => ({ ...s, [key]: val }))

  const save = () => {
    updateSettings(local)
    if (local.language !== settings.language) {
      useQuestionsStore.getState().setLang(local.language)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-[#161b22] rounded-t-2xl border-t border-[#30363d] p-5 pb-8 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-[#30363d] rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">{tt('settingsTitle')}</h2>
          <button onClick={onClose} aria-label={tt('settingsTitle')} className="text-[#8b949e] hover:text-white">
            <X size={20} />
          </button>
        </div>

        <Row icon={Play} iconColor="#22c55e" label={tt('autoNextCorrect')}>
          <Toggle label={tt('autoNextCorrect')} checked={local.autoNextCorrect} onChange={(v) => set('autoNextCorrect', v)} />
        </Row>
        <Row icon={Play} iconColor="#ef4444" label={tt('autoNextWrong')}>
          <Toggle label={tt('autoNextWrong')} checked={local.autoNextWrong} onChange={(v) => set('autoNextWrong', v)} />
        </Row>
        <Row icon={Zap} iconColor="#8b5cf6" label={tt('noAnimation')}>
          <Toggle label={tt('noAnimation')} checked={local.noAnimation} onChange={(v) => set('noAnimation', v)} />
        </Row>
        <Row icon={Shuffle} iconColor="#f59e0b" label={tt('shuffleOptions')}>
          <Toggle label={tt('shuffleOptions')} checked={local.shuffleOptions} onChange={(v) => set('shuffleOptions', v)} />
        </Row>
        <Row icon={Type} iconColor="#a78bfa" label={tt('fontSize')}>
          <ChipGroup
            value={local.fontSize}
            onChange={(v) => set('fontSize', v as ApiSettings['fontSize'])}
            options={[
              { label: tt('fontSmall'),  value: 'small'  },
              { label: tt('fontMedium'), value: 'medium' },
              { label: tt('fontLarge'),  value: 'large'  },
            ]}
          />
        </Row>
        <Row icon={Type} iconColor="#60a5fa" label={tt('fontStyle')}>
          <ChipGroup
            value={local.fontStyle}
            onChange={(v) => set('fontStyle', v as ApiSettings['fontStyle'])}
            options={[
              { label: tt('fontDefault'), value: 'default' },
              { label: tt('fontSerif'),   value: 'serif'   },
              { label: tt('fontMono'),    value: 'mono'    },
            ]}
          />
        </Row>
        <Row icon={Globe} iconColor="#3b82f6" label={tt('langLabel')}>
          <ChipGroup
            value={local.language}
            onChange={(v) => set('language', v as ApiSettings['language'])}
            options={[
              { label: tt('uzLang'), value: 'uz' },
              { label: tt('ruLang'), value: 'ru' },
            ]}
          />
        </Row>
        <Row
          icon={local.theme === 'dark' ? Moon : Sun}
          iconColor="#f59e0b"
          label={tt('themeLabel')}
        >
          <ChipGroup
            value={local.theme}
            onChange={(v) => set('theme', v as ApiSettings['theme'])}
            options={[
              { label: tt('darkTheme'),  value: 'dark'  },
              { label: tt('lightTheme'), value: 'light' },
            ]}
          />
        </Row>

        <button
          onClick={() => openTelegramLink('https://t.me/prava_oson_bot')}
          className="w-full flex items-center gap-3 py-3 active:opacity-70 transition-opacity">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-none bg-[#ef4444]/15">
            <Flag size={17} className="text-[#ef4444]" />
          </div>
          <span className="flex-1 text-sm text-left text-[#e6edf3]">{tt('reportIssue')}</span>
        </button>

        <button
          onClick={save}
          className="mt-3 w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-base transition-colors"
        >
          {tt('saveBtn')}
        </button>
      </div>
    </div>
  )
}
