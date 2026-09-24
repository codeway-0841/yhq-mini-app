import { useState, useEffect, useRef, useSyncExternalStore, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { config } from '../../shared/config'
import { PageHeader } from '../../shared/components/ui/page-header'
import {
  Copy, Phone, Lock, Globe, CreditCard,
  RotateCcw, Moon, Sun, Monitor, MessageCircle,
  Radio, Star, Share2, Download, ChevronRight, Check, Pencil,
  BarChart2, CloudUpload, Ticket, Award, X,
} from 'lucide-react'
import { CoinIcon } from '../../shared/components/CoinIcon'
import { PremiumIcon } from '../../shared/components/PremiumIcon'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { api, avatarSrcFor, type AchievementStats } from '../../shared/api'
import { useT } from '../../shared/i18n'
import { flushOutbox, getOutboxCount, onOutboxChange } from '../../shared/lib/outbox'
import { openTelegramLink, shareUrl, promptAddToHomeScreen } from '../../platform/telegram'
import { transitionTheme } from '../../shared/lib/theme-transition'
import PickerSheet from '../../shared/components/PickerSheet'
import { Button } from '../../shared/components/ui/button'
import { useToast } from '../../shared/components/ToastContainer'
import { Section, Item } from './components/Section'
import { Avatar } from './components/Avatar'
import { PhotoEditSheet, NameEditSheet, PhoneEditSheet } from './components/EditSheets'
import { PaymentHistorySheet } from './components/PaymentHistorySheet'
import { ClosedGroupSheet } from './components/ClosedGroupSheet'
import type { PlanKey } from '../../../shared/premium-plans'
import PromoCodeModal from '../../shared/components/PromoCodeModal'
import { CertificateModal } from '../test'
import AchievementsScreen, { type TabKey } from './components/AchievementsScreen'
import { LinkAccountSection } from './components/LinkAccountSection'
import { BadgesPreviewSection } from './components/BadgesPreviewSection'
import { MilestonesPreviewSection } from './components/MilestonesPreviewSection'
import { useAvatarUpload } from './hooks/useAvatarUpload'
import { usePhoneContact } from './hooks/usePhoneContact'
import { OTPInput } from '../auth'
import { SubscriptionModal } from '../premium'
import { levelFromXp, levelProgress } from '../../../shared/xp'
import { haptics } from '../../platform/haptics'
import StatInfoSheet from '../../shared/components/StatInfoSheet'

/** Bot havolasi — barcha profil linklari shu bazadan quriladi */
const BOT_URL = `https://t.me/${config.botUsername}`

// ── Main Profil ─────────────────────────────────────────────────────────
export default function Profil() {
  const navigate = useNavigate()
  // Selector'li obuna — whole-store EMAS (har counter o'zgarishida re-render bo'lmasligi uchun)
  const user           = useAppStore((s) => s.user)
  const settings       = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const resetProgress  = useAppStore((s) => s.resetProgress)
  const tariff         = useAppStore((s) => s.tariff)
  const displayName    = useAppStore((s) => s.displayName)
  const setDisplayName = useAppStore((s) => s.setDisplayName)
  const customAvatar   = useAppStore((s) => s.customAvatar)
  const coins          = useAppStore((s) => s.coins)
  const xp             = useAppStore((s) => s.xp)
  const tt = useT(settings.language)
  const level = levelFromXp(xp)

  // ── Yutuqlar (Achievements & Stats) ──────────────────────────────────
  const [achStats, setAchStats] = useState<AchievementStats | null>(null)
  const [showAchievementsModal, setShowAchievementsModal] = useState(false)
  const [achievementsInitialTab, setAchievementsInitialTab] = useState<TabKey>('all')

  useEffect(() => {
    const uid = user?.id
    if (!uid || uid === '0') return
    api.getAchievements(uid).then((d) => setAchStats(d.stats)).catch(() => {})
  }, [user?.id, settings.language])

  const handleOpenAchievements = (tab: TabKey = 'all') => {
    setAchievementsInitialTab(tab)
    setShowAchievementsModal(true)
  }

  // ── Referal statistikasi (Profil kartasidagi "N do'st · +M kun" qatori) ──
  const [refStats, setRefStats] = useState<{ invited: number; rewarded: number; pending: number; rewardDays: number } | null>(null)
  useEffect(() => {
    const uid = user?.id
    if (!uid || uid === '0') return
    api.getReferrals(uid).then(setRefStats).catch(() => {})
  }, [user?.id])

  // Backend warmUp
  useEffect(() => { api.warmUp() }, [])

  // Offline Sync Center: serverga yetmagan mutation'lar soni
  const syncUserId = user?.id ?? ''
  const syncPending = useSyncExternalStore(onOutboxChange, () => getOutboxCount(syncUserId))

  const [copied, setCopied]               = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])
  const [showNameEdit, setShowNameEdit]   = useState(false)
  const [showPhotoEdit, setShowPhotoEdit] = useState(false)
  const [showLevelInfo, setShowLevelInfo] = useState(false)
  const [showLangPicker, setShowLangPicker]   = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showPromoModal, setShowPromoModal]   = useState(false)
  const [showCertModal, setShowCertModal]     = useState(false)
  const [showPhoneSheet, setShowPhoneSheet]   = useState(false)
  const [showPayHistory, setShowPayHistory]   = useState(false)
  const [showGroupSheet, setShowGroupSheet]   = useState(false)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [subInitialPlan, setSubInitialPlan]   = useState<PlanKey | undefined>(undefined)

  const { current: xpCurrent, needed: xpNeeded } = levelProgress(xp)
  const xpToNext = xpNeeded - xpCurrent

  const { info } = useToast()
  const showToast = info

  const { fileRef, avatarBusy, handleAvatarFile, removeAvatar } = useAvatarUpload({
    showToast,
    closeSheet: () => setShowPhotoEdit(false),
  })
  const {
    phoneLoading, otpPhone, phoneError, phoneNotice,
    handleAddPhone, startManualPhone, submitPhoneOtp, cancelPhoneOtp,
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
    } catch (err: any) {
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

  const copyId = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!user?.id || user.id === '0') return
    navigator.clipboard.writeText(String(userId)).catch(() => {})
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => { setCopied(false); copyTimer.current = null }, 1500)
    if (copied) return
    setCopied(true)
    showToast(tt('idCopied'))
  }

  const handleReset = () => {
    if (window.confirm(tt('resetProgressConfirm'))) resetProgress()
  }

  const isPremiumUser = tariff === 'premium' || Boolean(user?.premiumUntil)
  const premiumStatusText = useMemo(() => {
    if (!isPremiumUser) return tt('upgradeHint')
    if (user?.premiumUntil) {
      const days = Math.max(0, Math.ceil((new Date(user.premiumUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      if (days === 0) return settings.language === 'ru' ? 'Заканчивается сегодня' : 'Bugun tugaydi'
      return settings.language === 'ru' ? `Активна · осталось ${days} дн.` : `Faol · ${days} kun qoldi`
    }
    return settings.language === 'ru' ? 'Активна · Навсегда' : 'Faol · Umrbod'
  }, [isPremiumUser, user?.premiumUntil, settings.language, tt])

  return (
    <div className="pb-8 lg:mx-auto lg:w-full lg:max-w-2xl">
      <PageHeader title={tt('profile')} size="lg" onBack={() => goBack(navigate)} backLabel={tt('backWord')} className="mb-4" />

      {/* ── Gorizontal Profil Kartasi ── */}
      <div className="mx-5 mb-6 flex items-center gap-3.5 rounded-2xl bg-pcard p-4 transition-all duration-150 shadow-xs">
        {/* Avatar (chapda) */}
        <Avatar
          name={name}
          photoUrl={avatarSrcFor(user) ?? undefined}
          size="md"
          onEditPhoto={() => setShowPhotoEdit(true)}
        />

        {/* Markaziy qism (Ism, ID, Nishonlar) */}
        <div className="min-w-0 flex-1">
          {/* Ism */}
          <div className="flex items-center gap-1.5">
            <p className="truncate font-display text-[17px] font-semibold tracking-[-0.015em] text-pfg">
              {name}
            </p>
            <button
              type="button"
              onClick={() => setShowNameEdit(true)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center -my-2 -mx-1.5 rounded text-psubtle transition-colors hover:text-pfg active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pprimary"
              aria-label={tt('editProfile')}
            >
              <Pencil size={12} strokeWidth={1.75} />
            </button>
          </div>

          {/* ID: 00458547 ❐ · Level X (daraja yozuvi ID qatori oxirida, neytral) */}
          <div className="mt-0.5 flex items-center">
            <button
              type="button"
              onClick={copyId}
              className="inline-flex items-center gap-1.5 rounded text-[12px] tabular-nums text-pmuted transition-colors hover:text-pfg active:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pprimary"
              aria-label="ID nusxalash"
            >
              <span>ID: {userId}</span>
              {copied ? (
                <Check key="copied" size={12} strokeWidth={2} className="text-psuccess animate-swapRollIn" />
              ) : (
                <Copy key="copy" size={12} strokeWidth={1.75} className="text-psubtle animate-swapRollIn" />
              )}
            </button>
            {/* Daraja — bosilganda daraja va XP haqida tushuntirish modali ochiladi */}
            <span className="mx-1.5 text-psubtle select-none">·</span>
            <button
              type="button"
              onClick={() => {
                haptics.impact('light')
                setShowLevelInfo(true)
              }}
              className="rounded text-[12px] font-semibold text-pmuted transition-colors hover:text-pfg active:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pprimary"
              aria-label={`${tt('level')} ${level}`}
            >
              Level {level}
            </button>
          </div>
        </div>
      </div>

      {/* ── SIZNING TARIFINGIZ ── */}
      <Section title={tt('yourTariff').toUpperCase()}>
        {/* Tariff card */}
        <div className="px-4 py-3.5 flex items-center gap-3.5">
          <PremiumIcon size={22} className="shrink-0 text-pmuted" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[14.5px] font-semibold text-pfg">
                {isPremiumUser ? tt('premiumTariff') : tt('freeTariff')}
              </p>
              {isPremiumUser && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--p-success-rgb)/0.12)] px-2 py-0.5 text-[10.5px] font-semibold text-psuccess">
                  <Check size={11} strokeWidth={2.5} />
                  {settings.language === 'ru' ? 'Активен' : 'Faol'}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] leading-tight text-pmuted">
              {premiumStatusText}
            </p>
          </div>
          <Button
            size="sm"
            className="flex-shrink-0 font-bold tracking-tight text-[12.5px] px-3.5 py-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer"
            onClick={() => {
              haptics.impact('light')
              setShowSubscriptionModal(true)
            }}
          >
            {isPremiumUser
              ? (settings.language === 'ru' ? 'Тарифы' : 'Tariflar')
              : tt('subscribe')}
          </Button>
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
          onPress={otpPhone ? undefined : () => setShowPhoneSheet(true)}
          disabled={phoneLoading || !!otpPhone}
        />

        {/* SMS OTP bosqichi */}
        {phoneError && <p className="px-4 pb-1 text-[12px] text-pdanger">{tt(phoneError)}</p>}
        {phoneNotice && <p className="px-4 pb-1 text-[12px] text-psuccess">{tt(phoneNotice)}</p>}
        {otpPhone && (
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

        {/* Yopiq guruh */}
        <Item
          icon={Lock}
          label={tt('closedGroup')}
          right={
            <span className={`text-[12px] ${tariff === 'premium' ? 'font-medium text-psuccess' : 'text-pmuted'}`}>
              {tariff === 'premium' ? tt('openWord') : tt('joinWord')}
            </span>
          }
          onPress={() => setShowGroupSheet(true)}
        />
      </Section>

      {/* ── NISHONLAR (BADGES) — IXCHAM PREVIEW ── */}
      <BadgesPreviewSection
        stats={achStats}
        tt={tt}
        onOpenAll={handleOpenAchievements}
      />

      {/* ── MARRALAR (MILESTONES) — IXCHAM PREVIEW ── */}
      <MilestonesPreviewSection
        stats={achStats}
        tt={tt}
        onOpenAll={handleOpenAchievements}
      />

      {/* ── HISOBNI BOG'LASH (multi-provider auth + logout) ── */}
      <LinkAccountSection />

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
        {/* Do'kon (#40) — coin balansi + do'kon sahifasiga o'tish */}
        <Item
          icon={CoinIcon}
          label={tt('shopMenuItem')}
          right={
            <span className="flex items-center gap-1.5 text-[13px] font-semibold tabular-nums text-pgold">
              <CoinIcon size={15} />
              {coins}
              <ChevronRight size={15} strokeWidth={1.75} className="text-psubtle" />
            </span>
          }
          onPress={() => navigate('/shop')}
        />

        <Item icon={Globe} label={tt('langLabel')}
          right={<span className="text-[12px] text-pmuted">{settings.language === 'ru' ? 'Русский' : "O'zbekcha"}</span>}
          onPress={() => setShowLangPicker(true)} />

        <Item
          icon={Award}
          label={tt('certOfficialTitle')}
          right={<span className="text-[12px] text-pmuted">{tt('certSampleBadge')}</span>}
          onPress={() => setShowCertModal(true)}
        />

        <Item
          icon={Ticket}
          label={tt('promoCodeTitle')}
          right={<ChevronRight size={16} strokeWidth={1.75} className="text-psubtle" />}
          onPress={() => setShowPromoModal(true)}
        />

        <Item icon={BarChart2} label={tt('statsTitle')}
          onPress={() => navigate('/statistika')} />

        <Item icon={CreditCard} label={tt('payHistory')}
          onPress={() => setShowPayHistory(true)} />

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
      </Section>

      {/* ── YORDAM ── */}
      <Section title={tt('helpSection')}>
        <Item icon={MessageCircle} label={tt('contactUs')}
          onPress={() => openTelegramLink(BOT_URL)} />
        <Item icon={Radio}      label={tt('tgChannel')}
          onPress={() => openTelegramLink(BOT_URL)} />
        <Item icon={Star}      label={tt('rateApp')}
          onPress={() => openTelegramLink(BOT_URL)} />

        {/* Referal: do'st taklif qilish */}
        <div className="px-4 py-3.5 flex items-center gap-3.5">
          <Share2 size={20} strokeWidth={1.75} className="shrink-0 text-pmuted" />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-pfg">{tt('refTitle')}</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-pmuted">{tt('refDesc')}</p>
            {refStats && refStats.invited > 0 && (
              <p className="mt-1 text-[10.5px] font-semibold leading-snug text-pprimary">
                {refStats.rewarded} {tt('refStatFriends')} · +{refStats.rewarded * refStats.rewardDays} {tt('refStatDays')}
                {refStats.pending > 0 ? ` · ${refStats.pending} ${tt('refStatPending')}` : ''}
              </p>
            )}
          </div>
          <Button
            size="sm"
            className="flex-shrink-0 font-bold tracking-tight text-[12.5px] px-3.5 py-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer"
            onClick={() => {
              if (!user) return
              shareUrl(`${BOT_URL}?start=ref_${user.id}`, tt('refShareText'))
            }}
          >
            {tt('refBtn')}
          </Button>
        </div>

        <Item icon={Download}   label={tt('installApp')}
          onPress={() => showToast(promptAddToHomeScreen()
            ? tt('installAppPrompt')
            : tt('installAppUnsupported'))} />
      </Section>

      {/* ── Modals & Sheets ── */}
      {/* Achievements Fullscreen Modal with Tabs */}
      {showAchievementsModal && achStats && (
        <AchievementsScreen
          stats={achStats}
          tt={tt}
          initialTab={achievementsInitialTab}
          onClose={() => setShowAchievementsModal(false)}
        />
      )}

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

      {/* Telefon qo'shish/o'zgartirish */}
      {showPhoneSheet && (
        <PhoneEditSheet
          currentPhone={user?.phone ?? null}
          busy={phoneLoading}
          onClose={() => setShowPhoneSheet(false)}
          onTelegram={() => { setShowPhoneSheet(false); handleAddPhone() }}
          onSms={(p) => { setShowPhoneSheet(false); void startManualPhone(p) }}
        />
      )}

      {/* Ilova tili tanlash */}
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

      {/* Mavzu tanlash */}
      {showThemePicker && (
        <PickerSheet
          title={tt('themeLabel')}
          titleIcon={<Sun size={18} className="text-pmuted" />}
          value={settings.theme}
          options={[
            { value: 'light',  label: tt('lightTheme'),  desc: tt('lightThemeDesc'),  icon: <Sun size={18} className="text-pmuted" /> },
            { value: 'dark',   label: tt('darkTheme'),   desc: tt('darkThemeDesc'),   icon: <Moon size={18} className="text-pmuted" /> },
            { value: 'system', label: tt('themeSystem'), desc: tt('themeSystemDesc'), icon: <Monitor size={18} className="text-pmuted" /> },
          ]}
          onSelect={(v) => void transitionTheme(v as 'dark' | 'light' | 'system')}
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

      {/* Sertifikat NAMUNASI */}
      {showCertModal && (
        <CertificateModal
          sample
          score={38}
          total={40}
          percent={95}
          onClose={() => setShowCertModal(false)}
        />
      )}

      {/* Daraja / Level ma'lumot sheet */}
      {showLevelInfo && (
        <StatInfoSheet
          icon={<Award size={20} strokeWidth={1.75} />}
          title={tt('levelInfoTitle')}
          body={tt('levelInfoBody')}
          extra={`${tt('xpToNextLevel')}: ${xpToNext} XP`}
          onClose={() => setShowLevelInfo(false)}
        />
      )}

      {/* To'lovlar tarixi sheet'i */}
      {showPayHistory && (
        <PaymentHistorySheet onClose={() => setShowPayHistory(false)} />
      )}

      {/* Yopiq guruh sheet'i */}
      {showGroupSheet && (
        <ClosedGroupSheet
          isSubscribed={tariff === 'premium'}
          onClose={() => setShowGroupSheet(false)}
          onGetPlan={(planKey) => {
            setShowGroupSheet(false)
            setSubInitialPlan(planKey)
            setShowSubscriptionModal(true)
          }}
        />
      )}

      {/* Obuna bo'lish modali */}
      {showSubscriptionModal && (
        <SubscriptionModal
          initialPlanKey={subInitialPlan}
          onClose={() => setShowSubscriptionModal(false)}
        />
      )}

      <p className="text-center text-[10px] text-lineStrong mt-3">KIVVI · build {__APP_VERSION__}</p>
    </div>
  )
}
