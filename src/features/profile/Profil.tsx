import { useState, useEffect, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import {
  Copy, Zap, Phone, Lock, Globe, CreditCard,
  WifiOff, RotateCcw, Moon, Sun, Monitor, MessageCircle,
  Radio, Star, Share2, Download, ChevronRight, ChevronLeft, Check, Pencil,
  BarChart2, CloudUpload, Ticket, Award, Coins, Car, X,
} from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { api } from '../../shared/api'
import { useT } from '../../shared/i18n'
import { flushOutbox, getOutboxCount, onOutboxChange } from '../../shared/lib/outbox'
import { openTelegramLink, shareUrl, promptAddToHomeScreen } from '../../platform/telegram'
import PickerSheet from '../../shared/components/PickerSheet'
import Toggle from '../../shared/components/Toggle'
import { Button } from '../../shared/components/ui/button'
import { useToast } from '../../shared/components/ToastContainer'
import { Section, Item } from './components/Section'
import { Avatar } from './components/Avatar'
import { PhotoEditSheet, NameEditSheet } from './components/EditSheets'
import PromoCodeModal from '../../shared/components/PromoCodeModal'
import { CertificateModal } from '../test'
import { AchievementsSection } from './components/AchievementsSection'
import { LinkAccountSection } from './components/LinkAccountSection'
import { useAvatarUpload } from './hooks/useAvatarUpload'
import { usePhoneContact } from './hooks/usePhoneContact'
import { OTPInput } from '../auth'

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
  const coins          = useAppStore((s) => s.coins)
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
  const [showNameEdit, setShowNameEdit]   = useState(false)
  const [showPhotoEdit, setShowPhotoEdit] = useState(false)
  const [showLangPicker, setShowLangPicker]   = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showPromoModal, setShowPromoModal]   = useState(false)
  const [showCertModal, setShowCertModal]     = useState(false)

  // Lokal toast state O'RNIGA markazlashgan ToastProvider (main.tsx da mount)
  const { info } = useToast()
  const showToast = info

  const { fileRef, avatarBusy, handleAvatarFile, removeAvatar } = useAvatarUpload({
    showToast,
    closeSheet: () => setShowPhotoEdit(false),
  })
  const {
    phoneLoading, otpPhone, phoneError,
    handleAddPhone, submitPhoneOtp, cancelPhoneOtp,
  } = usePhoneContact()
  // OTP bosqichi (SMS egalik isboti) lokal holati
  const [otpCode, setOtpCode] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)
  const [otpErrorKey, setOtpErrorKey] = useState<Parameters<typeof tt>[0] | null>(null)

  const onSubmitPhoneOtp = async (code: string) => {
    setOtpBusy(true)
    setOtpErrorKey(null)
    try {
      await submitPhoneOtp(code)
      setOtpCode('')
    } catch (err: any) {    // 401 → noto'g'ri kod; 429 → lockout
      setOtpErrorKey(err?.status === 401 ? 'authInvalidOtp' : err?.status === 429 ? 'authRateLimited' : 'authGenericError')
      setOtpCode('')
    } finally {
      setOtpBusy(false)
    }
  }

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
    ?? (user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : tt('guestName'))
  const userId = user?.id ?? '—'

  const copyId = () => {
    navigator.clipboard.writeText(String(userId)).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleReset = () => {
    if (window.confirm(tt('resetProgressConfirm'))) resetProgress()
  }

  const handleSync = () => {
    if (user?.id) syncFromServer(user.id)
  }

  const offlineOn = settings.offlineMode

  return (
    <div className="pt-4 pb-8 safe-bottom">
      {/* ← Back */}
      <div className="mb-1 px-5">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="flex h-11 items-center gap-1 rounded-control text-sm text-pmuted transition-opacity hover:text-pfg active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={18} strokeWidth={1.75} />
          <span>{tt('backWord')}</span>
        </button>
      </div>

      {/* Page title */}
      <h1 className="mb-6 px-5 font-display text-[22px] font-semibold tracking-[-0.02em] text-pfg">{tt('profile')}</h1>

      {/* Avatar + Name + ID */}
      <div className="mb-7 flex flex-col items-center gap-2.5 px-5">
        <Avatar name={name} photoUrl={user?.photoUrl}
          onEditName={() => setShowNameEdit(true)}
          onEditPhoto={() => setShowPhotoEdit(true)} />
        <p className="mt-1 font-display text-[18px] font-semibold tracking-[-0.015em] text-pfg">{name}</p>
        <button
          type="button"
          onClick={copyId}
          className="flex h-8 items-center gap-1.5 rounded-control border border-pline bg-psurface px-3 text-[11px] tabular-nums text-pmuted transition-transform duration-[120ms] ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
        >
          <span>ID: {userId}</span>
          {copied ? <Check size={11} strokeWidth={1.75} className="text-psuccess" /> : <Copy size={11} strokeWidth={1.75} />}
        </button>
      </div>

      {/* ── SIZNING TARIFINGIZ ── */}
      <Section title={tt('yourTariff').toUpperCase()}>
        {/* Tariff card */}
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-[14px] border border-pline bg-psurface">
            <Car size={22} strokeWidth={1.75} className="text-pmuted" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-pfg">{tariff === 'free' ? tt('freeTariff') : tt('premiumTariff')}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-pmuted">
              {tariff === 'free' ? tt('upgradeHint') : tt('premiumHint')}
            </p>
          </div>
          {tariff === 'free' && (
            <Button
              variant="gold"
              size="sm"
              className="flex-shrink-0"
              onClick={() => openTelegramLink('https://t.me/kiwi_uz_bot?start=premium')}
            >
              <Zap strokeWidth={1.75} />
              {tt('upgrade')} · 250
              <Star size={12} strokeWidth={1.75} />
            </Button>
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
                ? <span aria-hidden="true" className="size-4 rounded-full border-2 border-pmuted border-t-transparent motion-safe:animate-spin" />
                : <span className="text-[12px] text-pmuted">{tt('profileAddPhoneCta')}</span>
          }
          onPress={user?.phone || otpPhone ? undefined : handleAddPhone}
          disabled={phoneLoading || !!user?.phone || !!otpPhone}
        />

        {/* SMS OTP bosqichi (H-2: egalik isbotisiz telefon yozilmaydi) */}
        {phoneError && <p className="px-4 pb-1 text-[12px] text-pdanger">{tt(phoneError)}</p>}
        {otpPhone && !user?.phone && (
          <div className="px-4 pb-3 animate-premiumIn">
            <p className="mb-2 text-[12px] text-pmuted">
              {tt('authSmsCodeSent')}: <span className="font-semibold text-pfg">{otpPhone}</span>
            </p>
            <div className="flex items-center gap-3">
              <OTPInput
                value={otpCode}
                onChange={setOtpCode}
                onComplete={onSubmitPhoneOtp}
                disabled={otpBusy}
                error={!!otpErrorKey}
              />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Button
                size="sm"
                loading={otpBusy}
                disabled={otpCode.length !== 6}
                onClick={() => onSubmitPhoneOtp(otpCode)}
              >
                {tt('authLinkPhoneConfirm')}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={tt('backWord')}
                disabled={otpBusy}
                onClick={() => { cancelPhoneOtp(); setOtpCode(''); setOtpErrorKey(null) }}
              >
                <X strokeWidth={1.75} />
              </Button>
              {otpErrorKey && <span className="text-[12px] text-pdanger">{tt(otpErrorKey)}</span>}
            </div>
          </div>
        )}

        {/* SMS marketing roziligi — FAQAT telefon ulangan bo'lsa ko'rinadi */}
        {user?.phone && (
          <Item
            icon={MessageCircle}
            label={tt('smsOptInLabel')}
            right={
              <Toggle
                checked={!!user.smsOptIn}
                onChange={(next) => {
                  const id = user?.id
                  if (!id) return
                  // Optimistik yangilash; xatoda qaytamiz
                  useAppStore.setState({ user: { ...user, smsOptIn: next } })
                  api.setSmsConsent(id, next).catch(() => {
                    useAppStore.setState({ user: { ...user, smsOptIn: !next } })
                  })
                }}
              />
            }
          />
        )}

        {/* Yopiq guruh */}
        <Item icon={Lock} label={tt('closedGroup')}
          right={<span className="text-[12px] text-pmuted">{tt('joinWord')}</span>}
          onPress={() => openTelegramLink('https://t.me/kiwi_uz_bot')} />
      </Section>

      {/* ── DO'KON (#40) — coin balansi + do'kon sahifasiga o'tish ── */}
      <Section title={tt('shopTitle').toUpperCase()}>
        <Item
          icon={Coins}
          label={tt('shopMenuItem')}
          right={
            <span className="flex items-center gap-1.5 text-[13px] font-semibold tabular-nums text-pgold">
              <Coins size={14} strokeWidth={1.75} />
              {coins}
              <ChevronRight size={15} strokeWidth={1.75} className="text-psubtle" />
            </span>
          }
          onPress={() => navigate('/shop')}
        />
      </Section>

      {/* ── REFERAL: do'st taklif = +3 kun Premium ── */}
      <div className="mx-5 mb-6 flex items-center gap-3 rounded-container border border-pline bg-pcard px-4 py-3">
        <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-[14px] border border-[rgb(var(--p-primary-rgb)/0.26)] bg-pwash">
          <Share2 size={19} strokeWidth={1.75} className="text-pprimary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-pfg">{tt('refTitle')}</p>
          <p className="mt-0.5 text-[10.5px] leading-snug text-pmuted">{tt('refDesc')}</p>
          {refStats && refStats.invited > 0 && (
            <p className="mt-1 text-[10.5px] font-semibold leading-snug text-pprimary">
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
          className="inline-flex h-[34px] flex-shrink-0 items-center gap-1.5 rounded-control bg-pprimary px-3 text-[12px] font-semibold text-ponprimary transition-transform duration-[120ms] ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas">
          <Share2 size={13} strokeWidth={1.75} />
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
            right={<ChevronRight size={16} strokeWidth={1.75} className="text-psubtle" />}
            onPress={() => navigate('/admin')}
          />
        </Section>
      )}

      {/* ── UMUMIY ── */}
      <Section title={tt('generalSection')}>
        <Item icon={Globe} label={tt('langLabel')}
          right={<span className="text-[12px] text-pmuted">{settings.language === 'ru' ? 'Русский' : "O'zbekcha"}</span>}
          onPress={() => setShowLangPicker(true)} />

        <Item
          icon={Award}
          label={tt('certOfficialTitle')}
          right={<ChevronRight size={16} strokeWidth={1.75} className="text-psubtle" />}
          onPress={() => setShowCertModal(true)}
        />

        <Item
          icon={Ticket}
          label={tt('promoCodeTitle')}
          right={<ChevronRight size={16} strokeWidth={1.75} className="text-psubtle" />}
          onPress={() => setShowPromoModal(true)}
        />

        <Item icon={BarChart2} label={settings.language === 'ru' ? 'Статистика' : 'Statistika'}
          onPress={() => navigate('/statistika')} />

        <Item icon={CreditCard} label={tt('payHistory')}
          onPress={() => showToast(tt('payHistoryEmpty'))} />

        <Item
          icon={WifiOff} label={tt('offlineMode')}
          right={<Toggle size="sm" checked={offlineOn} onChange={(v) => updateSettings({ offlineMode: v })} />}
        />

        <Item icon={RotateCcw} iconColor="var(--p-danger)" label={tt('resetProgress')}
          onPress={handleReset} />

        <Item icon={Moon} label={tt('themeLabel')}
          right={<span className="text-[12px] text-pmuted">{themeLabel}</span>}
          onPress={() => setShowThemePicker(true)} />

        {syncPending > 0 && (
          <Item
            icon={CloudUpload} iconColor="var(--p-warning)"
            label={`${tt('syncPending')}: ${syncPending}`}
            right={<span className="text-[11px] text-pmuted">{tt('syncPendingDesc')}</span>}
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
          onPress={() => shareUrl('https://t.me/kiwi_uz_bot', tt('shareAppText'))} />
        <Item icon={Download}   label={tt('installApp')}
          onPress={() => showToast(promptAddToHomeScreen()
            ? tt('installAppPrompt')
            : tt('installAppUnsupported'))} />
      </Section>

      {/* Name edit sheet */}
      {showNameEdit && (
        <NameEditSheet
          current={name}
          onClose={() => setShowNameEdit(false)}
          onSave={(n) => { setDisplayName(n); showToast(tt('profileNameSaved')) }}
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
          onRemove={() => void removeAvatar()}
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
          titleIcon={<Sun size={18} className="text-ppurple" />}
          value={settings.theme}
          options={[
            { value: 'light',  label: tt('lightTheme'),  desc: tt('lightThemeDesc'),  icon: <Sun size={18} className="text-pwarning" /> },
            { value: 'dark',   label: tt('darkTheme'),   desc: tt('darkThemeDesc'),   icon: <Moon size={18} className="text-ppurple" /> },
            { value: 'system', label: tt('themeSystem'), desc: tt('themeSystemDesc'), icon: <Monitor size={18} className="text-pblue" /> },
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

      {/* Rasmiy Sertifikat modali */}
      {showCertModal && (
        <CertificateModal
          score={38}
          total={40}
          percent={95}
          onClose={() => setShowCertModal(false)}
        />
      )}

      <p className="text-center text-[10px] text-lineStrong mt-3">KIWI · build {__APP_VERSION__}</p>
    </div>
  )
}
