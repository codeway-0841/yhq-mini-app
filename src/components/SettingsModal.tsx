import { useState, type ReactNode } from 'react'
import {
  X, Play, Zap, Shuffle, Type, Globe, Flag, ChevronRight,
} from 'lucide-react'
import { useAppStore, type ApiSettings } from '../store/useAppStore'
import { useQuestionsStore } from '../store/useQuestionsStore'
import { openTelegramLink } from '../lib/telegram'
import { useT } from '../lib/i18n'
import Toggle from './Toggle'
import PickerSheet from './PickerSheet'

type LucideIcon = typeof Play
type PickerKey = 'fontSize' | 'fontStyle' | 'language' | null

/** Qator: chapda rangli ikonka-chip + label + o'ngda boshqaruv */
function Row({ icon: Icon, iconColor, label, children }: {
  icon: LucideIcon
  iconColor: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-line last:border-0">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-none"
        style={{ background: `${iconColor}26` }}>
        <Icon size={17} style={{ color: iconColor }} />
      </div>
      <span className="flex-1 text-sm font-semibold text-fg">{label}</span>
      {children}
    </div>
  )
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useAppStore()
  const [local, setLocal] = useState<ApiSettings>({ ...settings })
  const [picker, setPicker] = useState<PickerKey>(null)
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

  const fontSizeLabel  = { small: tt('fontSmall'),   medium: tt('fontMedium'),  large: tt('fontLarge') }[local.fontSize]
  const fontStyleLabel = { default: tt('fontDefault'), serif: tt('fontSerif'),  mono: tt('fontMono')   }[local.fontStyle]
  const languageLabel  = { uz: tt('uzLang'), ru: tt('ruLang') }[local.language]

  const valueBtn = 'flex items-center gap-1 text-[13px] font-bold text-muted active:text-fg transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full card-neon rounded-t-3xl border-t border-lineStrong max-h-[85vh] flex flex-col">
        <div className="p-5 pb-0">
          <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-black text-fg">{tt('settingsTitle')}</h2>
            <button onClick={onClose} aria-label={tt('settingsTitle')} className="text-muted hover:text-fg">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Kontent — scrollable */}
        <div className="flex-1 overflow-y-auto px-5">
          <Row icon={Play} iconColor="#58cc02" label={tt('autoNextCorrect')}>
            <Toggle label={tt('autoNextCorrect')} checked={local.autoNextCorrect} onChange={(v) => set('autoNextCorrect', v)} />
          </Row>
          <Row icon={Play} iconColor="#ff4b4b" label={tt('autoNextWrong')}>
            <Toggle label={tt('autoNextWrong')} checked={local.autoNextWrong} onChange={(v) => set('autoNextWrong', v)} />
          </Row>
          <Row icon={Zap} iconColor="#ce82ff" label={tt('noAnimation')}>
            <Toggle label={tt('noAnimation')} checked={local.noAnimation} onChange={(v) => set('noAnimation', v)} />
          </Row>
          <Row icon={Shuffle} iconColor="#ff9600" label={tt('shuffleOptions')}>
            <Toggle label={tt('shuffleOptions')} checked={local.shuffleOptions} onChange={(v) => set('shuffleOptions', v)} />
          </Row>

          {/* Shrift o'lchami — picker */}
          <button className="w-full text-left" onClick={() => setPicker('fontSize')}>
            <Row icon={Type} iconColor="#ce82ff" label={tt('fontSize')}>
              <span className={valueBtn}>{fontSizeLabel} <ChevronRight size={14} /></span>
            </Row>
          </button>

          {/* Shrift uslubi — picker */}
          <button className="w-full text-left" onClick={() => setPicker('fontStyle')}>
            <Row icon={Type} iconColor="#1cb0f6" label={tt('fontStyle')}>
              <span className={valueBtn}>{fontStyleLabel} <ChevronRight size={14} /></span>
            </Row>
          </button>

          {/* Ilova tili — picker */}
          <button className="w-full text-left" onClick={() => setPicker('language')}>
            <Row icon={Globe} iconColor="#1cb0f6" label={tt('langLabel')}>
              <span className={valueBtn}>{languageLabel} <ChevronRight size={14} /></span>
            </Row>
          </button>

          <button
            onClick={() => openTelegramLink('https://t.me/kiwi_uz_bot')}
            className="w-full flex items-center gap-3 py-3 active:opacity-70 transition-opacity">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-none" style={{ background: '#ff4b4b26' }}>
              <Flag size={17} className="text-duo-red" />
            </div>
            <span className="flex-1 text-sm font-semibold text-left text-fg">{tt('reportIssue')}</span>
          </button>
        </div>

        {/* Saqlash — doim pastda sticky */}
        <div className="p-5 pt-3 bg-surface rounded-b-3xl">
          <button
            onClick={save}
            className="btn-3d-green w-full py-3.5 rounded-2xl font-black text-base"
          >
            {tt('saveBtn')}
          </button>
        </div>
      </div>

      {/* Picker sheet'lar */}
      {picker === 'fontSize' && (
        <PickerSheet
          title={tt('fontSize')}
          titleIcon={<Type size={18} />}
          value={local.fontSize}
          onClose={() => setPicker(null)}
          onSelect={(v) => set('fontSize', v as ApiSettings['fontSize'])}
          options={[
            { value: 'small',  label: tt('fontSmall')  },
            { value: 'medium', label: tt('fontMedium') },
            { value: 'large',  label: tt('fontLarge')  },
          ]}
        />
      )}
      {picker === 'fontStyle' && (
        <PickerSheet
          title={tt('fontStyle')}
          titleIcon={<Type size={18} />}
          value={local.fontStyle}
          onClose={() => setPicker(null)}
          onSelect={(v) => set('fontStyle', v as ApiSettings['fontStyle'])}
          options={[
            { value: 'default', label: tt('fontDefault') },
            { value: 'serif',   label: tt('fontSerif')   },
            { value: 'mono',    label: tt('fontMono')    },
          ]}
        />
      )}
      {picker === 'language' && (
        <PickerSheet
          title={tt('langLabel')}
          titleIcon={<Globe size={18} />}
          value={local.language}
          onClose={() => setPicker(null)}
          onSelect={(v) => set('language', v as ApiSettings['language'])}
          options={[
            { value: 'uz', label: tt('uzLang') },
            { value: 'ru', label: tt('ruLang') },
          ]}
        />
      )}
    </div>
  )
}
