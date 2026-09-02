import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react'
import {
  X, Zap, Shuffle, Type, Globe, Flag, ChevronRight, Palette, Check, Bell, Clock, Timer,
} from 'lucide-react'
import { CoinIcon } from './CoinIcon'
import { PremiumIcon } from './PremiumIcon'
import { useAppStore, type ApiSettings } from '../store/useAppStore'
import { useQuestionsStore } from '../store/useQuestionsStore'
import { openTelegramLink } from '../../platform/telegram'
import { requestNotificationPermission } from '../../platform/native'
import { playSound } from '../lib/sounds'
import { useT } from '../i18n'
import { ACCENT_THEMES, getAccentTheme, resolveAccent, isAccentUnlocked } from '../config/themes'
import { getShopItem } from '../../../shared/shop-items'
import Toggle from './Toggle'
import PickerSheet from './PickerSheet'
import DialogOverlay from './DialogOverlay'
import { Button } from './ui/button'
import { cn } from '../lib/cn'

type LucideIcon = typeof Zap
type PickerKey = 'fontStyle' | 'language' | 'accent' | 'reminderTime' | null

/** Qator: chapda flat neytral ikonka + label + o'ngda boshqaruv (ModeRow / Grid uslubi). */
function Row({ icon: Icon, iconColor, label, children }: {
  icon: LucideIcon
  iconColor?: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-3.5 py-3.5 border-b border-pline last:border-0">
      <Icon
        size={20}
        strokeWidth={1.75}
        className={cn('shrink-0', !iconColor && 'text-pmuted')}
        style={iconColor ? { color: iconColor } : undefined}
      />
      <span className="flex-1 text-[14.5px] font-medium text-pfg">{label}</span>
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
  const ownedItems = useAppStore((s) => s.ownedItems)
  const ownedSet   = useMemo(() => new Set(ownedItems), [ownedItems])
  const [local, setLocal] = useState<ApiSettings>({ ...settings })
  const [picker, setPicker] = useState<PickerKey>(null)
  const tt = useT(local.language)

  // 3 soniyalik SINOV (preview) — lock'langan temani sotib olmasdan ko'rish
  const [preview, setPreview] = useState<string | null>(null)
  const previewTimer = useRef<number | undefined>(undefined)

  const restoreAccent = () => {
    const s = useAppStore.getState()
    document.body.dataset.accent = resolveAccent(s.accent, s.tariff === 'premium', new Set(s.ownedItems))
  }

  const stopPreview = () => {
    window.clearTimeout(previewTimer.current)
    restoreAccent()
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
    const s = useAppStore.getState()
    document.body.dataset.accent = resolveAccent(s.accent, s.tariff === 'premium', new Set(s.ownedItems))
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

  const fontStyleLabel = {
    default: tt('fontDefault'),
    jakarta: tt('fontJakarta'),
    rounded: tt('fontRounded'),
    grotesk: tt('fontGrotesk'),
    serif:   tt('fontSerif'),
    mono:    tt('fontMono'),
  }[local.fontStyle] ?? tt('fontDefault')
  const languageLabel  = { uz: tt('uzLang'), ru: tt('ruLang') }[local.language]

  const valueBtn = 'flex items-center gap-1 text-[12px] text-pmuted active:text-pfg transition-colors'

  return (
    <DialogOverlay onClose={onClose} labelId="settings-title">
      <div className="relative w-full rounded-t-sheet border-t border-plineStrong bg-pcard max-h-[85vh] flex flex-col">
        <div className="p-5 pb-0">
          <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between mb-2">
            <h2 id="settings-title" className="text-base font-semibold text-pfg">{tt('settingsTitle')}</h2>
            <button onClick={onClose} aria-label={tt('close')} className="text-pmuted hover:text-pfg transition-colors">
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Kontent — scrollable */}
        <div className="flex-1 overflow-y-auto px-5">
          <Row icon={Zap} label={tt('noAnimation')}>
            <Toggle label={tt('noAnimation')} checked={!local.noAnimation} onChange={(enabled) => set('noAnimation', !enabled)} />
          </Row>
          <Row icon={Shuffle} label={tt('shuffleOptions')}>
            <Toggle label={tt('shuffleOptions')} checked={local.shuffleOptions} onChange={(v) => set('shuffleOptions', v)} />
          </Row>

          {/* Shrift uslubi — picker */}
          <button className="w-full text-left" onClick={() => setPicker('fontStyle')} aria-label={`${tt('fontStyle')}: ${fontStyleLabel}`}>
            <Row icon={Type} label={tt('fontStyle')}>
              <span className={valueBtn}>{fontStyleLabel} <ChevronRight size={14} /></span>
            </Row>
          </button>

          {/* Ilova tili — picker */}
          <button className="w-full text-left" onClick={() => setPicker('language')} aria-label={`${tt('langLabel')}: ${languageLabel}`}>
            <Row icon={Globe} label={tt('langLabel')}>
              <span className={valueBtn}>{languageLabel} <ChevronRight size={14} /></span>
            </Row>
          </button>

          {/* Tema rangi (aksent) — Premium temalar faqat obunachilarga */}
          <button className="w-full text-left" onClick={() => setPicker('accent')} aria-label={`${tt('accentThemeLabel')}: ${getAccentTheme(accent).label[local.language]}`}>
            <Row icon={Palette} label={tt('accentThemeLabel')}>
              <span className={valueBtn}>
                <span className="w-4 h-4 rounded-full shadow-2xs"
                  style={{ background: getAccentTheme(accent).color }} />
                {getAccentTheme(accent).label[local.language]}
                {!isPremium && <PremiumIcon size={12} className="text-pmuted" />}
                <ChevronRight size={14} />
              </span>
            </Row>
          </button>

          {/* Kunlik eslatma — switch */}
          <Row icon={Bell} label={tt('dailyReminder')}>
            <Toggle checked={local.dailyReminder !== false}
              onChange={(c) => {
                set('dailyReminder', c)
                if (c) void requestNotificationPermission()
              }} />
          </Row>

          {/* Eslatma vaqti — faqat eslatma yoqiq bo'lsa */}
          {local.dailyReminder !== false && (
            <button className="w-full text-left" onClick={() => setPicker('reminderTime')} aria-label={`${tt('dailyReminderTime')}: ${local.dailyReminderTime || '20:00'}`}>
              <Row icon={Clock} label={tt('dailyReminderTime')}>
                <span className={valueBtn}>{local.dailyReminderTime || '20:00'} <ChevronRight size={14} /></span>
              </Row>
            </button>
          )}

          {/* Xatolik haqida xabar — Row bilan bir xil ritm (dublikat chip markup'i yo'q) */}
          <button className="w-full text-left" onClick={() => openTelegramLink('https://t.me/kiwi_uz_bot')} aria-label={tt('reportIssue')}>
            <Row icon={Flag} label={tt('reportIssue')}>
              <ChevronRight size={14} className="text-psubtle" />
            </Row>
          </button>
        </div>

        {/* Saqlash — doim pastda sticky */}
        <div className="p-5 pt-3 bg-pcard rounded-b-sheet">
          <Button block size="lg" onClick={save}>
            {tt('saveBtn')}
          </Button>
        </div>
      </div>

      {/* Picker sheet'lar */}
      {picker === 'fontStyle' && (
        <PickerSheet
          title={tt('fontStyle')}
          titleIcon={<Type size={18} />}
          value={local.fontStyle}
          onClose={() => setPicker(null)}
          onSelect={(v) => set('fontStyle', v as ApiSettings['fontStyle'])}
          options={[
            { value: 'default', label: tt('fontDefault') },
            { value: 'jakarta', label: tt('fontJakarta') },
            { value: 'rounded', label: tt('fontRounded') },
            { value: 'grotesk', label: tt('fontGrotesk') },
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

      {/* Aksent temasi sheet'i — premium temalar 🔒 (nested overlay: Escape faqat shuni yopadi) */}
      {picker === 'accent' && (
        <DialogOverlay onClose={() => setPicker(null)} zIndex={60} backdropClassName="bg-black/60" labelId="accent-title">
          <div className="relative w-full bg-psurface rounded-t-sheet border-t border-pline p-4 pb-8 max-h-[82vh] flex flex-col">
            <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-5 flex-none" />
            <p id="accent-title" className="flex items-center justify-center gap-2 text-base font-semibold text-pfg mb-1 flex-none">
              <Palette size={18} className="text-pprimary" />
              {tt('accentThemeLabel')}
            </p>
            <p className="text-center text-[11px] text-pmuted mb-3 flex-none">{tt('accentThemeDesc')}</p>
            {/* SINOV rejimi banneri + Premium upsell */}
            {preview && (
              <div className="flex-none flex items-center justify-between gap-2 mb-3 rounded-2xl px-3.5 py-2.5 animate-fadeIn bg-[rgb(var(--p-warning-rgb)/0.12)] shadow-xs">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-pwarning">
                  <Timer size={12} strokeWidth={1.75} />
                  {tt('themePreviewing')}
                </span>
                <button
                  onClick={() => { stopPreview(); setPicker(null); onClose(); openTelegramLink('https://t.me/kiwi_uz_bot?start=premium') }}
                  className="text-[11px] font-semibold text-pwarning underline underline-offset-2 active:opacity-70">
                  {tt('themeGetPremium')}
                </button>
              </div>
            )}
            {/* Scrollable ro'yxat — 10+ tema sig'adi, tepasi kesilmaydi */}
            <div className="flex flex-col gap-3 overflow-y-auto -mx-1 px-1 pb-1">
              {ACCENT_THEMES.map((theme) => {
                const selected = theme.id === accent
                const unlocked = isAccentUnlocked(theme.id, isPremium, ownedSet)
                const locked   = !unlocked
                const coinItem = locked ? getShopItem(theme.id) : null   // coin yo'li (#40)
                const premiumOnly = locked && theme.premium
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
                    className={`flex items-center gap-3 w-full rounded-2xl p-3.5 text-left transition-all active:scale-[0.98] shadow-xs ${
                      selected ? 'ring-2 ring-pprimary bg-[rgb(var(--p-primary-rgb)/0.15)]' :
                      preview === theme.id ? 'ring-2 ring-pwarning bg-[rgb(var(--p-warning-rgb)/0.10)]' : 'bg-pcard hover:bg-psurface'
                    }`}
                  >
                    {/* Mini atmosfera preview: fon + karta + aksent */}
                    <div className="relative w-14 h-11 rounded-xl overflow-hidden flex-none shadow-xs"
                      style={{ background: theme.bg }}>
                      <div className="absolute left-1.5 right-1.5 top-1.5 h-4 rounded-md"
                        style={{ background: theme.card, border: `1px solid ${theme.color}40` }} />
                      <span className="absolute bottom-1.5 left-1.5 w-6 h-1.5 rounded-full"
                        style={{ background: theme.color, boxShadow: theme.glow ? `0 0 6px ${theme.color}` : undefined }} />
                      {theme.glow && (
                        <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full"
                          style={{ background: theme.color, boxShadow: `0 0 6px ${theme.color}` }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-pfg">
                        {theme.label[local.language]}
                      </p>
                      {premiumOnly && (
                        <p className="text-[11px] text-pwarning font-semibold mt-0.5 flex items-center gap-1">
                          <PremiumIcon size={12} />
                          {preview === theme.id ? tt('themePreviewing') : tt('premiumThemesHint')}
                        </p>
                      )}
                      {/* Coin-eksklyuziv / premium temaning coin yo'li — narx tegi */}
                      {!premiumOnly && coinItem && (
                        <p className="text-[11px] text-pgold font-semibold mt-0.5 flex items-center gap-1">
                          <CoinIcon size={12} />
                          {preview === theme.id ? tt('themePreviewing') : `${coinItem.price} ${tt('shopCoinThemeBadge')}`}
                        </p>
                      )}
                    </div>
                    {selected && <Check size={18} className="text-pprimary flex-none" />}
                  </button>
                )
              })}
            </div>
          </div>
        </DialogOverlay>
      )}

      {picker === 'reminderTime' && (
        <PickerSheet
          title={tt('dailyReminderTime')}
          titleIcon={<Clock size={18} />}
          value={local.dailyReminderTime || '20:00'}
          onClose={() => setPicker(null)}
          onSelect={(v) => set('dailyReminderTime', v)}
          options={[
            { value: '08:00', label: '08:00', desc: tt('reminderMorning') },
            { value: '12:00', label: '12:00', desc: tt('reminderNoon') },
            { value: '18:00', label: '18:00', desc: tt('reminderEvening') },
            { value: '20:00', label: '20:00', desc: tt('reminderNight') },
            { value: '21:30', label: '21:30', desc: tt('reminderBeforeSleep') },
          ]}
        />
      )}
    </DialogOverlay>
  )
}
