import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  X, Play, Zap, Shuffle, Type, Globe, Flag, ChevronRight, Palette, Crown, Check,
} from 'lucide-react'
import { useAppStore, type ApiSettings } from '../store/useAppStore'
import { useQuestionsStore } from '../store/useQuestionsStore'
import { openTelegramLink } from '../../platform/telegram'
import { playSound } from '../lib/sounds'
import { useT } from '../i18n'
import { ACCENT_THEMES, getAccentTheme, resolveAccent } from '../config/themes'
import Toggle from './Toggle'
import PickerSheet from './PickerSheet'

type LucideIcon = typeof Play
type PickerKey = 'fontSize' | 'fontStyle' | 'language' | 'accent' | null

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
  // Selector'li obuna — whole-store EMAS
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const accent     = useAppStore((s) => s.accent)
  const setAccent  = useAppStore((s) => s.setAccent)
  const isPremium  = useAppStore((s) => s.tariff === 'premium')
  const [local, setLocal] = useState<ApiSettings>({ ...settings })
  const [picker, setPicker] = useState<PickerKey>(null)
  const tt = useT(local.language)

  // 3 soniyalik SINOV (preview) — lock'langan premium temani sotib olmasdan ko'rish
  const [preview, setPreview] = useState<string | null>(null)
  const previewTimer = useRef<number | undefined>(undefined)

  const stopPreview = () => {
    window.clearTimeout(previewTimer.current)
    document.body.dataset.accent = resolveAccent(useAppStore.getState().accent, useAppStore.getState().tariff === 'premium')
    setPreview(null)
  }

  const startPreview = (themeId: string) => {
    window.clearTimeout(previewTimer.current)
    document.body.dataset.accent = themeId
    setPreview(themeId)
    previewTimer.current = window.setTimeout(stopPreview, 3000)
  }

  // Modal yopilganda yarim preview qolib ketmasligi uchun
  useEffect(() => () => {
    window.clearTimeout(previewTimer.current)
    document.body.dataset.accent = resolveAccent(useAppStore.getState().accent, useAppStore.getState().tariff === 'premium')
  }, [])

  // Escape tugmasi bilan yopish
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (picker) setPicker(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [picker, onClose])

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
          <Row icon={Play} iconColor="#3b82f6" label={tt('autoNextCorrect')}>
            <Toggle label={tt('autoNextCorrect')} checked={local.autoNextCorrect} onChange={(v) => set('autoNextCorrect', v)} />
          </Row>
          <Row icon={Play} iconColor="#3b82f6" label={tt('autoNextWrong')}>
            <Toggle label={tt('autoNextWrong')} checked={local.autoNextWrong} onChange={(v) => set('autoNextWrong', v)} />
          </Row>
          <Row icon={Zap} iconColor="#f59e0b" label={tt('noAnimation')}>
            <Toggle label={tt('noAnimation')} checked={local.noAnimation} onChange={(v) => set('noAnimation', v)} />
          </Row>
          <Row icon={Shuffle} iconColor="#8b5cf6" label={tt('shuffleOptions')}>
            <Toggle label={tt('shuffleOptions')} checked={local.shuffleOptions} onChange={(v) => set('shuffleOptions', v)} />
          </Row>

          {/* Shrift o'lchami — picker */}
          <button className="w-full text-left" onClick={() => setPicker('fontSize')} aria-label={`${tt('fontSize')}: ${fontSizeLabel}`}>
            <Row icon={Type} iconColor="#22c55e" label={tt('fontSize')}>
              <span className={valueBtn}>{fontSizeLabel} <ChevronRight size={14} /></span>
            </Row>
          </button>

          {/* Shrift uslubi — picker */}
          <button className="w-full text-left" onClick={() => setPicker('fontStyle')} aria-label={`${tt('fontStyle')}: ${fontStyleLabel}`}>
            <Row icon={Type} iconColor="#22c55e" label={tt('fontStyle')}>
              <span className={valueBtn}>{fontStyleLabel} <ChevronRight size={14} /></span>
            </Row>
          </button>

          {/* Ilova tili — picker */}
          <button className="w-full text-left" onClick={() => setPicker('language')} aria-label={`${tt('langLabel')}: ${languageLabel}`}>
            <Row icon={Globe} iconColor="#3b82f6" label={tt('langLabel')}>
              <span className={valueBtn}>{languageLabel} <ChevronRight size={14} /></span>
            </Row>
          </button>

          {/* Tema rangi (aksent) — Premium temalar faqat obunachilarga */}
          <button className="w-full text-left" onClick={() => setPicker('accent')} aria-label={`${tt('accentThemeLabel')}: ${getAccentTheme(accent).label[local.language]}`}>
            <Row icon={Palette} iconColor="#ec4899" label={tt('accentThemeLabel')}>
              <span className={valueBtn}>
                <span className="w-4 h-4 rounded-full border border-line"
                  style={{ background: getAccentTheme(accent).color }} />
                {getAccentTheme(accent).label[local.language]}
                {!isPremium && <Crown size={12} className="text-pgold" />}
                <ChevronRight size={14} />
              </span>
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

      {/* Aksent temasi sheet'i — premium temalar 🔒 */}
      {picker === 'accent' && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPicker(null)} />
          <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-4 pb-8 max-h-[82vh] flex flex-col">
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-5 flex-none" />
            <p className="flex items-center justify-center gap-2 text-base font-black mb-1 flex-none">
              <Palette size={18} className="text-muted" />
              {tt('accentThemeLabel')}
            </p>
            <p className="text-center text-[11px] text-muted mb-3 flex-none">{tt('accentThemeDesc')}</p>
            {/* SINOV rejimi banneri + Premium upsell */}
            {preview && (
              <div className="flex-none flex items-center justify-between gap-2 mb-3 rounded-xl px-3.5 py-2 animate-fadeIn"
                style={{ background: 'rgba(250, 204, 21, 0.10)', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
                <span className="text-[11px] font-bold text-duo-yellow">⏱ {tt('themePreviewing')}</span>
                <button
                  onClick={() => { stopPreview(); setPicker(null); onClose(); openTelegramLink('https://t.me/kiwi_uz_bot?start=premium') }}
                  className="text-[11px] font-black text-duo-yellow underline underline-offset-2 active:opacity-70">
                  {tt('themeGetPremium')}
                </button>
              </div>
            )}
            {/* Scrollable ro'yxat — 10+ tema sig'adi, tepasi kesilmaydi */}
            <div className="flex flex-col gap-3 overflow-y-auto -mx-1 px-1 pb-1">
              {ACCENT_THEMES.map((theme) => {
                const selected = theme.id === accent
                const locked   = theme.premium && !isPremium
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      if (locked) {
                        // 3 soniyalik SINOV — temani ko'rsatamiz, keyin avtomatik qaytadi
                        startPreview(theme.id)
                        return
                      }
                      stopPreview()
                      setAccent(theme.id)
                      playSound('chime') // tema unlock — tema-mos chime
                      setPicker(null)
                    }}
                    className={`flex items-center gap-3 w-full rounded-2xl border-2 p-3.5 text-left transition-all active:scale-[0.98] ${
                      selected ? 'border-duo-green bg-duo-green/15' :
                      preview === theme.id ? 'border-duo-yellow bg-duo-yellow/10' : 'border-line bg-canvas'
                    }`}
                  >
                    {/* Mini atmosfera preview: fon + karta + aksent */}
                    <div className="relative w-14 h-11 rounded-xl overflow-hidden flex-none border border-line"
                      style={{ background: theme.bg }}>
                      <div className="absolute left-1.5 right-1.5 top-1.5 h-4 rounded-[5px]"
                        style={{ background: theme.card, border: `1px solid ${theme.color}40` }} />
                      <span className="absolute bottom-1.5 left-1.5 w-6 h-1.5 rounded-full"
                        style={{ background: theme.color, boxShadow: theme.glow ? `0 0 6px ${theme.color}` : undefined }} />
                      {theme.glow && (
                        <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full"
                          style={{ background: theme.color, boxShadow: `0 0 6px ${theme.color}` }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-fg">
                        {theme.label[local.language]}
                      </p>
                      {locked && (
                        <p className="text-[11px] text-duo-yellow font-semibold mt-0.5 flex items-center gap-1">
                          <Crown size={11} fill="currentColor" />
                          {preview === theme.id ? tt('themePreviewing') : tt('premiumThemesHint')}
                        </p>
                      )}
                    </div>
                    {selected && <Check size={18} className="text-duo-green flex-none" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
