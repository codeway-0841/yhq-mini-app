import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../lib/navigation'
import {
  Copy, Zap, Phone, Lock, Globe, CreditCard,
  WifiOff, RotateCcw, Moon, Sun, Monitor, MessageCircle,
  Radio, Star, Share2, Download, ChevronRight, Check, Pencil,
} from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useT } from '../../shared/i18n'
import { openTelegramLink, shareUrl } from '../../lib/telegram'
import PickerSheet from '../../components/PickerSheet'
import Toggle from '../../shared/components/Toggle'

/** Telegram "Ilovani o'rnatish" — addToHomeScreen API or fallback message */
function addToHomeScreen(): string {
  const tg = (window as { Telegram?: { WebApp?: { addToHomeScreen?: () => void } } }).Telegram?.WebApp
  if (tg?.addToHomeScreen) {
    tg.addToHomeScreen()
    return "Ilovani bosh ekranga qo'shing"
  }
  return "Bu Telegram versiyasida qo'llab-quvvatlanmaydi"
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        requestContact(callback: (ok: boolean, data?: { contact?: { phone_number: string } }) => void): void
      }
    }
  }
}

// ── Avatar ──────────────────────────────────────────────────────────────
function Avatar({ name, photoUrl, onEdit }: { name: string; photoUrl?: string; onEdit?: () => void }) {
  const letter = name?.[0]?.toUpperCase() ?? 'F'
  return (
    <div className="relative">
      <div className="w-[88px] h-[88px] rounded-full bg-gradient-to-br from-duo-blue to-duo-purple flex items-center justify-center text-white font-black text-4xl relative overflow-hidden ring-[3px] ring-duo-blue/40">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          letter
        )}
      </div>
      {onEdit && (
        <button onClick={onEdit} aria-label="Ismni o'zgartirish"
          className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-duo-blue border-[2.5px] border-canvas flex items-center justify-center active:scale-90 transition-transform shadow-lg">
          <Pencil size={12} className="text-white" />
        </button>
      )}
    </div>
  )
}

// ── Bottom sheet — ismni tahrirlash ─────────────────────────────────────
function NameEditSheet({ current, onClose, onSave }: {
  current: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(current)
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-2xl border-t border-line p-5 pb-8">
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
        <p className="text-sm font-bold mb-3 flex items-center justify-center gap-2">
          <Pencil size={14} className="text-duo-blue" />
          Ismni o'zgartirish
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="Ismingiz"
          autoFocus
          className="w-full bg-canvas border border-duo-blue rounded-xl px-4 py-3 text-sm text-white outline-none mb-4"
        />
        <button
          onClick={() => { onSave(name); onClose() }}
          className="w-full py-3.5 rounded-xl bg-green-600 text-white font-bold active:scale-[0.98] transition-transform">
          Saqlash
        </button>
      </div>
    </div>
  )
}

// ── Section wrapper ─────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-muted uppercase tracking-[0.12em] px-4 mb-1.5">{title}</p>
      <div className="card-neon mx-4 overflow-hidden divide-y divide-line/60">
        {children}
      </div>
    </div>
  )
}

// ── List Item ───────────────────────────────────────────────────────────
interface ItemProps {
  icon: React.ElementType
  iconBg: string
  label: string
  right?: React.ReactNode
  onPress?: () => void
  disabled?: boolean
}
function Item({ icon: Icon, iconBg, label, right, onPress, disabled }: ItemProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onPress}
      disabled={disabled}
      className={`flex items-center gap-3 w-full px-4 py-3.5 transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'active:bg-elevated'
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={15} className="text-white" />
      </div>
      <span className="flex-1 text-[14px] text-left text-fg">{label}</span>
      {right !== undefined ? right : <ChevronRight size={16} className="text-lineStrong" />}
    </button>
  )
}

// ── Main Profil ─────────────────────────────────────────────────────────
export default function Profil() {
  const navigate = useNavigate()
  const {
    user, settings, updateSettings, updatePhone, resetProgress, tariff,
    syncFromServer,
    displayName, setDisplayName,
  } = useAppStore()
  const tt = useT(settings.language)

  const [copied, setCopied]           = useState(false)
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [, setPhoneError]             = useState<string | null>(null)
  const [toast, setToast]             = useState<string | null>(null)
  const [showNameEdit, setShowNameEdit] = useState(false)
  const [showLangPicker, setShowLangPicker]   = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)

  const themeLabel = settings.theme === 'dark'
    ? tt('darkTheme')
    : settings.theme === 'light'
      ? tt('lightTheme')
      : tt('themeSystem')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const setLanguage = (lang: 'uz' | 'ru') => {
    updateSettings({ language: lang })
    useQuestionsStore.getState().setLang(lang)
  }

  const name   = displayName
    ?? (user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Foydalanuvchi')
  const userId = user?.id ?? '—'

  const copyId = () => {
    navigator.clipboard.writeText(String(userId)).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleReset = () => {
    if (window.confirm("Barcha progress o'chadi. Davom etasizmi?")) resetProgress()
  }

  const handleSync = () => {
    if (user?.id) syncFromServer(user.id)
  }

  const handleAddPhone = () => {
    const tgWebApp = window.Telegram?.WebApp
    if (!tgWebApp?.requestContact) {
      setPhoneError('Telegram orqali kirish kerak')
      setTimeout(() => setPhoneError(null), 3000)
      return
    }

    setPhoneLoading(true)
    setPhoneError(null)

    tgWebApp.requestContact((ok, data) => {
      if (!ok || !data?.contact?.phone_number) {
        setPhoneLoading(false)
        setPhoneError('Ruxsat berilmadi')
        setTimeout(() => setPhoneError(null), 3000)
        return
      }

      let phone = data.contact.phone_number.trim()
      if (!phone.startsWith('+')) phone = '+' + phone

      updatePhone(phone)
        .catch(() => setPhoneError("Saqlashda xato. Qayta urinib ko'ring."))
        .finally(() => {
          setPhoneLoading(false)
          setTimeout(() => setPhoneError(null), 3000)
        })
    })
  }

  const offlineOn = settings.offlineMode

  return (
    <div className="pt-4 pb-8 safe-bottom">
      {/* ← Back */}
      <div className="px-4 mb-0.5">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga"
          className="flex items-center gap-1 text-muted hover:text-white text-sm active:opacity-70 transition-opacity">
          <span className="text-lg">←</span>
          <span>Back</span>
        </button>
      </div>

      {/* Page title */}
      <p className="text-[18px] font-bold px-4 mb-5 text-white">Profil</p>

      {/* Avatar + Name + ID */}
      <div className="flex flex-col items-center gap-2.5 mb-7 px-4">
        <Avatar name={name} photoUrl={user?.photoUrl} onEdit={() => setShowNameEdit(true)} />
        <p className="text-[18px] font-bold text-white mt-1">{name}</p>
        <button
          type="button"
          onClick={copyId}
          className="flex items-center gap-1.5 text-[11px] text-muted bg-elevated px-3 py-1 rounded-full active:scale-95 transition-transform"
        >
          <span>ID: {userId}</span>
          {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
        </button>
      </div>

      {/* ── SIZNING TARIFINGIZ ── */}
      <Section title={tt('yourTariff').toUpperCase()}>
        {/* Tariff card */}
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-elevated flex items-center justify-center text-3xl flex-shrink-0">
            🚗
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-white">{tariff === 'free' ? tt('freeTariff') : tt('premiumTariff')}</p>
            <p className="text-[11px] text-muted mt-0.5 leading-tight">
              {tariff === 'free' ? tt('upgradeHint') : tt('premiumHint')}
            </p>
          </div>
          {tariff === 'free' && (
            <button type="button"
              onClick={() => showToast('Premium tez kunda! Hozircha barcha funksiyalar bepul.')}
              className="flex items-center gap-1.5 bg-duo-blue text-white text-[12px] font-bold px-3.5 py-2 rounded-xl flex-shrink-0 active:scale-95 transition-transform shadow-lg shadow-blue-500/20">
              <Zap size={13} fill="white" />
              {tt('upgrade')}
            </button>
          )}
        </div>

        {/* Phone */}
        <Item
          icon={Phone}
          iconBg="bg-green-500"
          label={tt('addPhone')}
          right={
            user?.phone
              ? <span className="text-[12px] text-green-400">{user.phone}</span>
              : phoneLoading
                ? <span className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                : <span className="text-[12px] text-muted">Qo'shish</span>
          }
          onPress={user?.phone ? undefined : handleAddPhone}
          disabled={phoneLoading || !!user?.phone}
        />

        {/* Yopiq guruh */}
        <Item icon={Lock} iconBg="bg-purple-500" label={tt('closedGroup')}
          right={<span className="text-[12px] text-muted">{tt('joinWord')}</span>}
          onPress={() => openTelegramLink('https://t.me/prava_oson_bot')} />
      </Section>

      {/* ── UMUMIY ── */}
      <Section title={tt('generalSection')}>
        <Item icon={Globe} iconBg="bg-blue-500" label={tt('langLabel')}
          right={<span className="text-[12px] text-muted">{settings.language === 'ru' ? 'Русский' : "O'zbekcha"}</span>}
          onPress={() => setShowLangPicker(true)} />

        <Item icon={CreditCard} iconBg="bg-duo-purple" label={tt('payHistory')}
          onPress={() => showToast("To'lovlar hali yo'q — barcha funksiyalar bepul")} />

        <Item
          icon={WifiOff} iconBg="bg-green-500" label={tt('offlineMode')}
          right={<Toggle size="sm" checked={offlineOn} onChange={(v) => updateSettings({ offlineMode: v })} />}
          onPress={() => updateSettings({ offlineMode: !offlineOn })}
        />

        <Item icon={RotateCcw} iconBg="bg-red-500" label={tt('resetProgress')}
          onPress={handleReset} />

        <Item icon={Moon} iconBg="bg-duo-purple" label={tt('themeLabel')}
          right={<span className="text-[12px] text-muted">{themeLabel}</span>}
          onPress={() => setShowThemePicker(true)} />

        <Item icon={RotateCcw} iconBg="bg-blue-500" label={tt('syncServer')}
          onPress={handleSync} />
      </Section>

      {/* ── YORDAM ── */}
      <Section title={tt('helpSection')}>
        <Item icon={MessageCircle} iconBg="bg-green-500" label={tt('contactUs')}
          onPress={() => openTelegramLink('https://t.me/prava_oson_bot')} />
        <Item icon={Radio}    iconBg="bg-blue-500"   label={tt('tgChannel')}
          onPress={() => openTelegramLink('https://t.me/prava_oson_bot')} />
        <Item icon={Star}     iconBg="bg-amber-500"  label={tt('rateApp')}
          onPress={() => openTelegramLink('https://t.me/prava_oson_bot')} />
        <Item icon={Share2}   iconBg="bg-pink-500"   label={tt('shareApp')}
          onPress={() => shareUrl('https://t.me/prava_oson_bot', "YHQ imtihoniga tayyorlaning — ajoyib ilova! 🚗")} />
        <Item icon={Download} iconBg="bg-blue-400"   label={tt('installApp')}
          onPress={() => showToast(addToHomeScreen())} />
      </Section>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-4 right-4 bg-duo-blue text-white text-xs font-semibold px-4 py-3 rounded-xl text-center z-40 shadow-lg animate-fadeIn">
          {toast}
        </div>
      )}

      {/* Name edit sheet */}
      {showNameEdit && (
        <NameEditSheet
          current={name}
          onClose={() => setShowNameEdit(false)}
          onSave={(n) => { setDisplayName(n); showToast('Ism saqlandi ✓') }}
        />
      )}

      {/* Ilova tili tanlash — rasmdagidek bottom sheet */}
      {showLangPicker && (
        <PickerSheet
          title={tt('langLabel')}
          titleIcon={<Globe size={18} />}
          value={settings.language}
          options={[
            { value: 'uz', label: "O'zbekcha" },
            { value: 'ru', label: 'Русский' },
          ]}
          onSelect={(v) => setLanguage(v as 'uz' | 'ru')}
          onClose={() => setShowLangPicker(false)}
        />
      )}

      {/* Mavzu tanlash — rasmdagidek bottom sheet */}
      {showThemePicker && (
        <PickerSheet
          title={tt('themeLabel')}
          titleIcon={<Sun size={18} className="text-duo-purple" />}
          value={settings.theme}
          options={[
            { value: 'light',  label: tt('lightTheme'),  desc: tt('lightThemeDesc'),  icon: <Sun size={18} className="text-duo-yellow" /> },
            { value: 'dark',   label: tt('darkTheme'),   desc: tt('darkThemeDesc'),   icon: <Moon size={18} className="text-duo-purple" /> },
            { value: 'system', label: tt('themeSystem'), desc: tt('themeSystemDesc'), icon: <Monitor size={18} className="text-duo-blue" /> },
          ]}
          onSelect={(v) => updateSettings({ theme: v as 'dark' | 'light' | 'system' })}
          onClose={() => setShowThemePicker(false)}
        />
      )}

      <p className="text-center text-[10px] text-lineStrong mt-3">v1.1.0 · Build 2026.08</p>
    </div>
  )
}
