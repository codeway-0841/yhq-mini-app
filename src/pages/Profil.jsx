import React, { useState } from 'react'
import {
  Copy, Zap, Phone, Lock, Globe, CreditCard,
  WifiOff, RotateCcw, Moon, Sun, MessageCircle,
  Radio, Star, Share2, Download, ChevronRight,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

function Avatar({ name, size = 'lg' }) {
  const letter = name?.[0]?.toUpperCase() || 'F'
  const cls = size === 'lg'
    ? 'w-20 h-20 text-3xl'
    : 'w-10 h-10 text-base'
  return (
    <div className={`${cls} rounded-full bg-[#1f6feb] flex items-center justify-center text-white font-black`}>
      {letter}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-[#8b949e] uppercase tracking-widest px-4 mb-1">
        {title}
      </p>
      <div className="bg-[#161b22] rounded-2xl border border-[#30363d] overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function Item({ icon: Icon, label, right, onPress, danger }) {
  return (
    <button
      onClick={onPress}
      className={`flex items-center gap-3 w-full px-4 py-3.5 border-b border-[#30363d] last:border-0 active:bg-[#21262d] transition-colors ${
        danger ? 'text-red-400' : 'text-[#e6edf3]'
      }`}
    >
      <Icon size={18} className={danger ? 'text-red-400' : 'text-[#8b949e]'} />
      <span className="flex-1 text-sm text-left">{label}</span>
      {right ?? <ChevronRight size={16} className="text-[#8b949e]" />}
    </button>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        checked ? 'bg-[#1f6feb]' : 'bg-[#30363d]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export default function Profil() {
  const { user, settings, updateSettings, resetProgress, tariff } = useAppStore()
  const [copied, setCopied] = useState(false)

  const name = user
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : 'Foydalanuvchi'
  const userId = user?.id ?? '—'

  const copyId = () => {
    navigator.clipboard.writeText(String(userId)).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const offlineOn = settings?.offlineMode ?? false
  const isDark    = (settings?.theme ?? 'dark') === 'dark'

  return (
    <div className="pt-4 pb-8">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-2 mb-6 px-4">
        <div className="relative">
          <Avatar name={name} />
          <button className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#1f6feb] flex items-center justify-center text-white text-xs border-2 border-[#0d1117]">
            ✎
          </button>
        </div>
        <p className="text-lg font-bold">{name}</p>
        <button
          onClick={copyId}
          className="flex items-center gap-1.5 text-xs text-[#8b949e] bg-[#21262d] px-3 py-1 rounded-full"
        >
          <span>ID: {userId}</span>
          <Copy size={12} />
          {copied && <span className="text-green-400">✓</span>}
        </button>
      </div>

      {/* Tariff */}
      <Section title="SIZNING TARIFINGIZ">
        <div className="px-4 py-3 flex items-center gap-3 border-b border-[#30363d]">
          <div className="flex-1">
            <p className="text-sm font-bold">
              {tariff === 'free' ? 'Matiz — Bepul' : 'Premium'}
            </p>
            <p className="text-xs text-[#8b949e] mt-0.5">
              {tariff === 'free' ? 'Cheklangan imkoniyatlar' : 'Barcha imkoniyatlar'}
            </p>
          </div>
          <span className="text-3xl">🚗</span>
        </div>
        <Item icon={Zap}   label="⚡ Kuchaytirish — Premium"     right={<span className="text-xs text-[#1f6feb] font-bold">Upgrade</span>} />
        <Item icon={Phone} label="Telefon raqami qo'shish" />
        <Item icon={Lock}  label="Yopiq guruh" right={<Lock size={14} className="text-[#8b949e]" />} />
      </Section>

      {/* General */}
      <Section title="UMUMIY">
        <Item
          icon={Globe}
          label="Ilova tili"
          right={
            <span className="text-xs text-[#8b949e]">
              {settings?.language === 'ru' ? 'Русский' : "O'zbekcha"}
            </span>
          }
        />
        <Item icon={CreditCard} label="To'lovlar tarixi" />
        <Item
          icon={WifiOff}
          label="Oflayn rejim"
          right={
            <Toggle
              checked={offlineOn}
              onChange={(v) => updateSettings({ offlineMode: v })}
            />
          }
        />
        <Item
          icon={RotateCcw}
          label="Progresni qayta boshlash"
          danger
          onPress={() => {
            if (window.confirm('Barcha progress o\'chadi. Davom etasizmi?')) resetProgress()
          }}
          right={null}
        />
        <Item
          icon={isDark ? Moon : Sun}
          label="Mavzu"
          right={
            <div className="flex gap-1">
              {['dark', 'light'].map((t) => (
                <button
                  key={t}
                  onClick={(e) => { e.stopPropagation(); updateSettings({ theme: t }) }}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-colors ${
                    (settings?.theme ?? 'dark') === t
                      ? 'bg-[#1f6feb] text-white'
                      : 'bg-[#21262d] text-[#8b949e]'
                  }`}
                >
                  {t === 'dark' ? 'Qorong\'i' : 'Yorug\''}
                </button>
              ))}
            </div>
          }
        />
      </Section>

      {/* Help */}
      <Section title="YORDAM">
        <Item icon={MessageCircle} label="Biz bilan bog'lanish" />
        <Item icon={Radio}         label="Telegram kanalimiz"  />
        <Item icon={Star}          label="Ilovani baholash"     />
        <Item icon={Share2}        label="Ulashish"             />
        <Item icon={Download}      label="Ilovani o'rnatish"    />
      </Section>

      <p className="text-center text-[10px] text-[#8b949e] mt-2">
        v1.0.0 · Build 2025.01
      </p>
    </div>
  )
}
