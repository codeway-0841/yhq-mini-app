import { useState, useEffect, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import {
  Copy, Zap, Phone, Lock, Globe, CreditCard,
  WifiOff, RotateCcw, Moon, Sun, Monitor, MessageCircle,
  Radio, Star, Share2, Download, ChevronRight, Check, Pencil,
  BarChart2, CloudUpload, Ticket,
} from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { api } from '../../shared/api'
import { useT } from '../../shared/i18n'
import { flushOutbox, getOutboxCount, onOutboxChange } from '../../shared/lib/outbox'
import { openTelegramLink, shareUrl, promptAddToHomeScreen } from '../../platform/telegram'
import PickerSheet from '../../shared/components/PickerSheet'
import Toggle from '../../shared/components/Toggle'
import { Section, Item } from './components/Section'
import { Avatar } from './components/Avatar'
import { PhotoEditSheet, NameEditSheet } from './components/EditSheets'
import PromoCodeModal from '../../shared/components/PromoCodeModal'
import { AchievementsSection } from './components/AchievementsSection'
import { LinkAccountSection } from './components/LinkAccountSection'
import { useAvatarUpload } from './hooks/useAvatarUpload'
import { usePhoneContact } from './hooks/usePhoneContact'

// ── Main Profil ─────────────────────────────────────────────────────────
export default function Profil() {
  const navigate = useNavigate()
  // Selector'li obuna — whole-store EMAS (har counter o'zgarishida re-render bo'lmasligi uchun)
  const user           = useAppStore((s) => s.user)
  const settings       = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const resetProgress  = useAppStore((s) => s.resetProgress)
  const tariff         = useAppStore((s) => s.tariff)
  const syncFromServer = useAppStore((s) => s.syncFromServer)
  const displayName    = useAppStore((s) => s.displayName)
  const setDisplayName = useAppStore((s) => s.setDisplayName)
  const customAvatar   = useAppStore((s) => s.customAvatar)
  const setCustomAvatar = useAppStore((s) => s.setCustomAvatar)
  const tt = useT(settings.language)

  // ── Referal statistikasi (Profil kartasidagi "N do'st · +M kun" qatori) ──
  const [refStats, setRefStats] = useState<{ invited: number; rewarded: number; pending: number; rewardDays: number } | null>(null)
  useEffect(() => {
    const uid = user?.id
    if (!uid || uid === '0') return
    api.getReferrals(uid).then(setRefStats).catch(() => {})
  }, [user?.id])

  // Offline Sync Center: serverga yetmagan mutation'lar soni (0 bo'lsa yashirin)
  const syncUserId = user?.id ?? ''
  const syncPending = useSyncExternalStore(onOutboxChange, () => getOutboxCount(syncUserId))

  const [copied, setCopied]               = useState(false)
  const [toast, setToast]                 = useState<string | null>(null)
  const [showNameEdit, setShowNameEdit]   = useState(false)
  const [showPhotoEdit, setShowPhotoEdit] = useState(false)
  const [showLangPicker, setShowLangPicker]   = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showPromoModal, setShowPromoModal]   = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const { fileRef, avatarBusy, handleAvatarFile } = useAvatarUpload({
    showToast,
    closeSheet: () => setShowPhotoEdit(false),
  })
  const { phoneLoading, handleAddPhone } = usePhoneContact()

  const themeLabel = settings.theme === 'dark'
    ? tt('darkTheme')
    : settings.theme === 'light'
      ? tt('lightTheme')
      : tt('themeSystem')

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
    const msg = settings.language === 'ru'
      ? 'Весь прогресс будет сброшен. Продолжить?'
      : "Barcha progress o'chadi. Davom etasizmi?"
    if (window.confirm(msg)) resetProgress()
  }

  const handleSync = () => {
    if (user?.id) syncFromServer(user.id)
  }

  const offlineOn = settings.offlineMode

  return (
    <div className="pt-4 pb-8 safe-bottom">
      {/* ← Back */}
      <div className="px-4 mb-0.5">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="flex items-center gap-1 text-muted hover:text-fg text-sm active:opacity-70 transition-opacity">
          <span className="text-lg">←</span>
          <span>{tt('backWord')}</span>
        </button>
      </div>

      {/* Page title */}
      <p className="text-[18px] font-bold px-4 mb-5 text-fg">{tt('profile')}</p>

      {/* Avatar + Name + ID */}
      <div className="flex flex-col items-center gap-2.5 mb-7 px-4">
        <Avatar name={name} photoUrl={user?.photoUrl}
          onEditName={() => setShowNameEdit(true)}
          onEditPhoto={() => setShowPhotoEdit(true)} />
        <p className="text-[18px] font-bold text-fg mt-1">{name}</p>
        <button
          type="button"
          onClick={copyId}
          className="flex items-center gap-1.5 text-[11px] text-muted bg-elevated px-3 py-1 rounded-full active:scale-95 transition-transform"
        >
          <span>ID: {userId}</span>
          {copied ? <Check size={11} className="text-psuccess" /> : <Copy size={11} />}
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
            <p className="text-[14px] font-bold text-fg">{tariff === 'free' ? tt('freeTariff') : tt('premiumTariff')}</p>
            <p className="text-[11px] text-muted mt-0.5 leading-tight">
              {tariff === 'free' ? tt('upgradeHint') : tt('premiumHint')}
            </p>
          </div>
          {tariff === 'free' && (
            <button type="button"
              onClick={() => openTelegramLink('https://t.me/kiwi_uz_bot?start=premium')}
               className="btn-premium-gold text-[12px] px-3.5 py-2 rounded-xl flex-shrink-0 active:scale-95 transition-transform">
              <Zap size={13} fill="white" />
              {tt('upgrade')} · ⭐250
            </button>
          )}
        </div>

        {/* Phone */}
        <Item
          icon={Phone}
          label={tt('addPhone')}
          right={
            user?.phone
              ? <span className="text-[12px] text-psuccess">{user.phone}</span>
              : phoneLoading
                ? <span className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                : <span className="text-[12px] text-muted">Qo'shish</span>
          }
          onPress={user?.phone ? undefined : handleAddPhone}
          disabled={phoneLoading || !!user?.phone}
        />

        {/* Yopiq guruh */}
        <Item icon={Lock} label={tt('closedGroup')}
          right={<span className="text-[12px] text-muted">{tt('joinWord')}</span>}
          onPress={() => openTelegramLink('https://t.me/kiwi_uz_bot')} />
      </Section>

      {/* ── REFERAL: do'st taklif = +3 kun Premium ── */}
      <div className="card-neon mx-4 mt-4 mb-1 flex items-center gap-3 px-4 py-3">
        <div className="w-11 h-11 rounded-xl bg-duo-green/15 border border-duo-green/40 flex items-center justify-center flex-shrink-0">
          <Share2 size={19} className="text-duo-green" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-fg">{tt('refTitle')}</p>
          <p className="text-[10.5px] text-muted mt-0.5 leading-snug">{tt('refDesc')}</p>
          {refStats && refStats.invited > 0 && (
            <p className="text-[10.5px] text-duo-green font-bold mt-1 leading-snug">
              {refStats.rewarded} {tt('refStatFriends')} · +{refStats.rewarded * refStats.rewardDays} {tt('refStatDays')}
              {refStats.pending > 0 ? ` · ${refStats.pending} ${tt('refStatPending')}` : ''}
            </p>
          )}
        </div>
        <button type="button"
          onClick={() => {
            if (!user) return
            shareUrl(`https://t.me/kiwi_uz_bot?start=ref_${user.id}`, tt('refShareText'))
          }}
          className="flex items-center gap-1.5 bg-duo-green text-ponprimary text-[12px] font-bold px-3.5 py-2 rounded-xl flex-shrink-0 active:scale-95 transition-transform">
          <Share2 size={13} />
          {tt('refBtn')}
        </button>
      </div>

      {/* ── HISOBNI BOG'LASH (multi-provider auth + logout) ── */}
      <LinkAccountSection />

      {/* ── YUTUQLAR (server metrikalari asosidagi badge'lar) ── */}
      <AchievementsSection lang={settings.language} tt={tt} userId={user?.id} />

      {/* ── ADMIN (faqat is_admin foydalanuvchilariga ko'rinadi) ── */}
      {user?.isAdmin && (
        <Section title="ADMIN">
          <Item
            icon={Pencil}
            label="Savollar boshqaruvi"
            right={<ChevronRight size={16} className="text-muted" />}
            onPress={() => navigate('/admin')}
          />
        </Section>
      )}

      {/* ── UMUMIY ── */}
      <Section title={tt('generalSection')}>
        <Item icon={Globe} label={tt('langLabel')}
          right={<span className="text-[12px] text-muted">{settings.language === 'ru' ? 'Русский' : "O'zbekcha"}</span>}
          onPress={() => setShowLangPicker(true)} />

        <Item
          icon={Ticket}
          iconColor="#a855f7"
          label={tt('promoCodeTitle')}
          right={<ChevronRight size={16} className="text-muted" />}
          onPress={() => setShowPromoModal(true)}
        />

        <Item icon={BarChart2} label={settings.language === 'ru' ? 'Статистика' : 'Statistika'}
          onPress={() => navigate('/statistika')} />

        <Item icon={CreditCard} label={tt('payHistory')}
          onPress={() => showToast("To'lovlar hali yo'q — barcha funksiyalar bepul")} />

        <Item
          icon={WifiOff} label={tt('offlineMode')}
          right={<Toggle size="sm" checked={offlineOn} onChange={(v) => updateSettings({ offlineMode: v })} />}
        />

        <Item icon={RotateCcw} iconColor="#ef4444" label={tt('resetProgress')}
          onPress={handleReset} />

        <Item icon={Moon} label={tt('themeLabel')}
          right={<span className="text-[12px] text-muted">{themeLabel}</span>}
          onPress={() => setShowThemePicker(true)} />

        {syncPending > 0 && (
          <Item
            icon={CloudUpload} iconColor="#f59e0b"
            label={`${tt('syncPending')}: ${syncPending}`}
            right={<span className="text-[11px] text-muted">{tt('syncPendingDesc')}</span>}
            onPress={() => { if (user?.id) void flushOutbox(user.id) }}
          />
        )}

        <Item icon={RotateCcw} label={tt('syncServer')}
          onPress={handleSync} />
      </Section>

      {/* ── YORDAM ── */}
      <Section title={tt('helpSection')}>
        <Item icon={MessageCircle} label={tt('contactUs')}
          onPress={() => openTelegramLink('https://t.me/kiwi_uz_bot')} />
        <Item icon={Radio}      label={tt('tgChannel')}
          onPress={() => openTelegramLink('https://t.me/kiwi_uz_bot')} />
        <Item icon={Star}      label={tt('rateApp')}
          onPress={() => openTelegramLink('https://t.me/kiwi_uz_bot')} />
        <Item icon={Share2}     label={tt('shareApp')}
          onPress={() => shareUrl('https://t.me/kiwi_uz_bot', "YHQ imtihoniga tayyorlaning — ajoyib ilova! 🚗")} />
        <Item icon={Download}   label={tt('installApp')}
          onPress={() => showToast(promptAddToHomeScreen()
            ? "Ilovani bosh ekranga qo'shing"
            : "Bu Telegram versiyasida qo'llab-quvvatlanmaydi")} />
      </Section>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-4 right-4 card-neon text-fg text-xs font-semibold px-4 py-3 rounded-xl text-center z-40 shadow-lg animate-fadeIn">
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

      {/* Rasm tanlash — yashirin file input */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />

      {/* Photo edit sheet */}
      {showPhotoEdit && (
        <PhotoEditSheet
          hasCustom={!!customAvatar}
          busy={avatarBusy}
          onClose={() => setShowPhotoEdit(false)}
          onPick={() => fileRef.current?.click()}
          onRemove={() => { setCustomAvatar(null); setShowPhotoEdit(false); showToast("Rasm o'chirildi") }}
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

      {/* Promokod kiritish modali */}
      {showPromoModal && (
        <PromoCodeModal
          language={settings.language}
          onClose={() => setShowPromoModal(false)}
        />
      )}

      <p className="text-center text-[10px] text-lineStrong mt-3">KIWI · build {__APP_VERSION__}</p>
    </div>
  )
}
