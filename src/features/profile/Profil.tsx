import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Copy, Zap, Phone, Lock, Globe, CreditCard,
  WifiOff, RotateCcw, Moon, Sun, MessageCircle,
  Radio, Star, Share2, Download, ChevronRight, Check, Pencil,
} from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useT } from '../../shared/i18n'
import { openTelegramLink, shareUrl } from '../../lib/telegram'
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

interface AvatarProps { name: string; photoUrl?: string; size?: 'sm' | 'lg'; onEdit?: () => void }
function Avatar({ name, photoUrl, size = 'lg', onEdit }: AvatarProps) {
  const letter = name?.[0]?.toUpperCase() ?? 'F'
  const cls = size === 'lg' ? 'w-20 h-20 text-3xl' : 'w-10 h-10 text-base'
  return (
    <div className="relative">
      <div className={`${cls} rounded-full bg-[#1f6feb] flex items-center justify-center text-white font-black relative overflow-hidden`}>
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          letter
        )}
      </div>
      {onEdit && (
        <button onClick={onEdit} aria-label="Ismni o'zgartirish"
          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1f6feb] border-2 border-[#0d1117] flex items-center justify-center active:scale-90 transition-transform">
          <Pencil size={12} className="text-white" />
        </button>
      )}
    </div>
  )
}

/** Bottom sheet — ismni tahrirlash (lokal saqlanadi) */
function NameEditSheet({ current, onClose, onSave }: {
  current: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(current)
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-[#161b22] rounded-t-2xl border-t border-[#30363d] p-5 pb-8">
        <div className="w-10 h-1 bg-[#30363d] rounded-full mx-auto mb-4" />
        <p className="text-sm font-bold mb-3 flex items-center justify-center gap-2">
          <Pencil size={14} className="text-[#1f6feb]" />
          Ismni o'zgartirish
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="Ismingiz"
          autoFocus
          className="w-full bg-[#0d1117] border border-[#1f6feb] rounded-xl px-4 py-3 text-sm text-white outline-none mb-4"
        />
        <button
          onClick={() => { onSave(name); onClose() }}
          className="w-full py-3.5 rounded-xl bg-green-600 text-white font-bold">
          Saqlash
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-[#8b949e] uppercase tracking-widest px-4 mb-1">{title}</p>
      <div className="bg-[#161b22] rounded-2xl border border-[#30363d] overflow-hidden">{children}</div>
    </div>
  )
}

interface ItemProps {
  icon: React.ElementType
  iconBg?: string
  label: string
  right?: React.ReactNode
  onPress?: () => void
  danger?: boolean
  disabled?: boolean
}
function Item({ icon: Icon, iconBg, label, right, onPress, danger, disabled }: ItemProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onPress}
      disabled={disabled}
      className={`flex items-center gap-3 w-full px-4 py-3.5 border-b border-[#30363d] last:border-0 transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'active:bg-[#21262d]'
      } ${danger ? 'text-red-400' : 'text-[#e6edf3]'}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg ?? 'bg-[#21262d]'}`}>
        <Icon size={16} className={danger ? 'text-red-400' : 'text-white'} />
      </div>
      <span className="flex-1 text-sm text-left">{label}</span>
      {right !== undefined ? right : <ChevronRight size={16} className="text-[#8b949e]" />}
    </button>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl bg-[#161b22] border border-[#30363d] p-3 text-center">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-[10px] text-[#8b949e] mt-0.5">{label}</p>
    </div>
  )
}

export default function Profil() {
  const navigate = useNavigate()
  const {
    user, settings, updateSettings, updatePhone, resetProgress, tariff,
    totalCorrect, totalWrong, totalAnswered, streak, syncFromServer,
    displayName, setDisplayName,
  } = useAppStore()
  const tt = useT(settings.language)

  const [copied, setCopied]           = useState(false)
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneError, setPhoneError]   = useState<string | null>(null)
  const [toast, setToast]             = useState<string | null>(null)
  const [showNameEdit, setShowNameEdit] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const toggleLanguage = () => {
    const next = settings.language === 'uz' ? 'ru' as const : 'uz' as const
    updateSettings({ language: next })
    useQuestionsStore.getState().setLang(next)
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
  const isDark    = settings.theme === 'dark'

  const phoneLabel = user?.phone
    ? user.phone
    : phoneLoading
      ? 'Yuklanmoqda...'
      : phoneError ?? "Qo'shish"

  const phoneRight = user?.phone
    ? <Check size={14} className="text-green-400" />
    : phoneLoading
      ? <span className="w-4 h-4 border-2 border-[#8b949e] border-t-transparent rounded-full animate-spin" />
      : <ChevronRight size={16} className="text-[#8b949e]" />

  return (
    <div className="pt-4 pb-8">
      <div className="px-4">
        <button onClick={() => navigate(-1)} aria-label="Orqaga"
          className="text-[#8b949e] hover:text-white text-xl px-1">←</button>
      </div>
      <div className="flex flex-col items-center gap-2 mb-6 px-4">
        <Avatar name={name} photoUrl={user?.photoUrl} onEdit={() => setShowNameEdit(true)} />
        <p className="text-lg font-bold">{name}</p>
        {user?.username && (
          <p className="text-xs text-[#8b949e]">@{user.username}</p>
        )}
        <button
          type="button"
          onClick={copyId}
          className="flex items-center gap-1.5 text-xs text-[#8b949e] bg-[#21262d] px-3 py-1 rounded-full"
        >
          <span>ID: {userId}</span>
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 mb-4">
        <StatCard label={tt('correctShort')} value={totalCorrect} color="text-green-400"  />
        <StatCard label={tt('wrongShort')}   value={totalWrong}   color="text-red-400"    />
        <StatCard label={tt('streakCol')}    value={streak}       color="text-orange-400" />
      </div>
      <p className="text-center text-xs text-[#8b949e] mb-4">{totalAnswered} {tt('qAnswered')}</p>

      <Section title={tt('yourTariff').toUpperCase()}>
        <div className="px-4 py-3 flex items-center gap-3 border-b border-[#30363d]">
          <div className="flex-1">
            <p className="text-sm font-bold">{tariff === 'free' ? tt('freeTariff') : tt('premiumTariff')}</p>
            <p className="text-xs text-[#8b949e] mt-0.5">
              {tariff === 'free' ? tt('upgradeHint') : tt('premiumHint')}
            </p>
          </div>
          {tariff === 'free' && (
            <button type="button"
              onClick={() => showToast('Premium tez kunda! Hozircha barcha funksiyalar bepul.')}
              className="flex items-center gap-1.5 bg-[#1f6feb] text-white text-xs font-bold px-3 py-1.5 rounded-xl">
              <Zap size={12} />
              {tt('upgrade')}
            </button>
          )}
        </div>
        <Item
          icon={Phone}
          iconBg="bg-green-600"
          label={phoneLabel}
          right={phoneRight}
          onPress={user?.phone ? undefined : handleAddPhone}
          disabled={phoneLoading || !!user?.phone}
        />
        <Item icon={Lock} iconBg="bg-purple-600" label={tt('closedGroup')}
          right={<span className="text-xs text-[#8b949e]">{tt('joinWord')}</span>}
          onPress={() => openTelegramLink('https://t.me/osonprava_bot')} />
      </Section>

      <Section title={tt('generalSection')}>
        <Item icon={Globe} iconBg="bg-blue-500" label={tt('langLabel')}
          right={<span className="text-xs text-[#8b949e]">{settings.language === 'ru' ? 'Русский' : "O'zbekcha"}</span>}
          onPress={toggleLanguage} />
        <Item icon={CreditCard} iconBg="bg-[#8b5cf6]" label={tt('payHistory')}
          onPress={() => showToast("To'lovlar hali yo'q — barcha funksiyalar bepul")} />
        <Item
          icon={WifiOff} iconBg="bg-green-500" label={tt('offlineMode')}
          right={<Toggle size="sm" checked={offlineOn} onChange={(v) => updateSettings({ offlineMode: v })} />}
          onPress={() => updateSettings({ offlineMode: !offlineOn })}
        />
        <Item
          icon={isDark ? Moon : Sun} iconBg="bg-[#8b949e]" label="Mavzu"
          right={
            <div className="flex gap-1">
              {(['dark', 'light'] as const).map((t) => (
                <button key={t} type="button"
                  onClick={(e) => { e.stopPropagation(); updateSettings({ theme: t }) }}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-colors ${
                    settings.theme === t ? 'bg-[#1f6feb] text-white' : 'bg-[#21262d] text-[#8b949e]'
                  }`}>
                  {t === 'dark' ? "Qorong'i" : "Yorug'"}
                </button>
              ))}
            </div>
          }
        />
        <Item icon={RotateCcw} iconBg="bg-blue-600" label={tt('syncServer')}  onPress={handleSync}  right={null} />
        <Item icon={RotateCcw} iconBg="bg-red-600"  label={tt('resetProgress')} danger onPress={handleReset} right={null} />
      </Section>

      <Section title={tt('helpSection')}>
        <Item icon={MessageCircle} iconBg="bg-green-500"  label={tt('contactUs')}
          onPress={() => openTelegramLink('https://t.me/osonprava_bot')} />
        <Item icon={Radio}         iconBg="bg-blue-500"   label={tt('tgChannel')}
          onPress={() => openTelegramLink('https://t.me/osonprava_bot')} />
        <Item icon={Star}          iconBg="bg-orange-400" label={tt('rateApp')}
          onPress={() => openTelegramLink('https://t.me/osonprava_bot')} />
        <Item icon={Share2}        iconBg="bg-pink-500"   label={tt('shareApp')}
          onPress={() => shareUrl('https://t.me/osonprava_bot', "YHQ imtihoniga tayyorlaning — ajoyib ilova! 🚗")} />
        <Item icon={Download}      iconBg="bg-blue-400"   label={tt('installApp')}
          onPress={() => showToast(addToHomeScreen())} />
      </Section>

      {toast && (
        <div className="fixed bottom-20 left-4 right-4 bg-[#1f6feb] text-white text-xs font-semibold px-4 py-3 rounded-xl text-center z-40 shadow-lg">
          {toast}
        </div>
      )}

      {showNameEdit && (
        <NameEditSheet
          current={name}
          onClose={() => setShowNameEdit(false)}
          onSave={(n) => { setDisplayName(n); showToast('Ism saqlandi ✓') }}
        />
      )}

      <p className="text-center text-[10px] text-[#8b949e] mt-2">v1.1.0 · Build 2026.07</p>
    </div>
  )
}
