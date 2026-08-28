import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, LogOut, Phone, Send } from 'lucide-react'
import { api, ApiError } from '../../../shared/api'
import {
  clearSessionToken, getSessionToken, setSessionToken,
} from '../../../shared/lib/session'
import { ensureAccountOwner, resetAccountToLoggedOut } from '../../../shared/store/account'
import { useAppStore } from '../../../shared/store/useAppStore'
import { getTelegramUser, openTelegramLink } from '../../../platform/telegram'
import { config } from '../../../shared/config'
import { useT } from '../../../shared/i18n'
import { Section, Item } from './Section'
import { authErrorKey, usePhoneInput, OTPInput } from '../../auth'

type Provider = 'telegram' | 'phone'

interface TgLinkCode { code: string; url: string | null; expiresInMinutes: number }

/**
 * "Hisobni bog'lash" bo'limi — provider'lar ro'yxati (/auth/me, mount'da 1 marta)
 * va ikki yo'nalishli ulash:
 *  - TG user → telefon qo'shish (parol o'rnatish/tasdiqlash → linkPhone);
 *  - Telefon user → Telegram ulash (bot deep-link kodi, 10 daqiqa).
 * Logout — FAQAT sessiya (Bearer) bilan kirganlarda (Mini App'da ko'rinmaydi).
 */
export function LinkAccountSection() {
  const tt = useT(useAppStore((s) => s.settings.language))
  const user = useAppStore((s) => s.user)
  // Mini App'da "Chiqish" ko'rinmaydi (initData yo'li sessiyasiz)
  const isTelegram = Boolean(getTelegramUser()?.id)
  const hasSession = Boolean(getSessionToken())

  const [providers, setProviders] = useState<Provider[] | null>(null)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [okMsg, setOkMsg]   = useState<string | null>(null)

  const refresh = useCallback(() => {
    api.getAuthMe()
      .then((d) => setProviders(d.providers))
      .catch(() => {
        const tgUser = getTelegramUser()
        const provs: Provider[] = []
        if (tgUser?.id || (user?.id && !user.id.startsWith('p_'))) provs.push('telegram')
        if (user?.phone || user?.id?.startsWith('p_')) provs.push('phone')
        setProviders(provs)
      })
  }, [user])
  useEffect(() => { refresh() }, [refresh])

  // ── Telefon qo'shish formasi (TG user) ────────────────────────────────────
  const phone = usePhoneInput()
  const [password, setPassword] = useState('')
  const [phoneOpen, setPhoneOpen] = useState(false)
  /** Adaptiv OTP: server "otp_required" deganda (raqam YANGI) kod bosqichi ochiladi */
  const [otpStep, setOtpStep] = useState(false)
  const [otpCode, setOtpCode] = useState('')

  const submitPhoneLink = async () => {
    if (busy || !phone.isValid || password.length < 8) return
    setBusy(true)
    setError(null)
    setOkMsg(null)
    try {
      // Server har safar YANGI token qaytaradi; 'adopted' bo'lsa user.id
      // o'zgarishi mumkin (p_… → telegram raqam id) — ensureAccountOwner SHART
      const data = await api.linkPhone({ phone: phone.value, password, ...(otpStep ? { otp: otpCode } : {}) })
      setSessionToken(data.sessionToken)
      ensureAccountOwner(data.user.id)
      useAppStore.getState().hydrateFromProfile(data)
      setProviders(data.providers)
      setOkMsg(tt('authPhoneSetOk'))
      setPhoneOpen(false)
      setOtpStep(false)
      setOtpCode('')
      setPassword('')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'otp_required') {
        // Raqam yangi — SMS kod bilan tasdiqlash kerak
        try {
          await api.requestOTP({ phone: phone.value })
          setOtpStep(true)
          setOtpCode('')
          setError(null)
          return
        } catch {
          setError(tt('authRateLimited'))
          return
        }
      }
      setError(
        e instanceof ApiError && e.code === 'accounts_merge_required'
          ? tt('authMergeConflict')
          : tt(authErrorKey(e)),
      )
    } finally {
      setBusy(false)
    }
  }

  // ── Telegram ulash kodi (telefon sessiyasi) ───────────────────────────────
  const [tgLink, setTgLink] = useState<TgLinkCode | null>(null)
  const [copied, setCopied] = useState(false)

  const startTgLink = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.createTelegramLinkCode()
      setTgLink(res)
      // url bor bo'lsa darhol botga o'tamiz; yo'q bo'lsa kod + qo'lda yo'riqnoma
      if (res.url) openTelegramLink(res.url)
    } catch {
      setError(tt('authGenericError'))
    } finally {
      setBusy(false)
    }
  }

  const copyCode = () => {
    if (!tgLink) return
    navigator.clipboard.writeText(tgLink.url ?? tgLink.code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Bot'da tasdiqlab qaytganda (fokus qaytganda) — providers + profil yangilanadi
  // (adopt-merge id almashinuvi bo'lsa hydrateFromProfile ushlab qoladi).
  useEffect(() => {
    if (!tgLink) return
    const onFocus = () => {
      api.getAuthMe()
        .then((d) => {
          ensureAccountOwner(d.user.id)
          useAppStore.getState().hydrateFromProfile(d)
          setProviders(d.providers)
          if (d.providers.includes('telegram')) {
            setTgLink(null)
            setOkMsg(tt('authTgLinkedOk'))
          }
        })
        .catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tgLink])

  const handleLogout = () => {
    if (!window.confirm(tt('authLogoutConfirm'))) return
    void api.logout()           // catch yutuvchi — offline'da ham lokal reset ishlaydi
    clearSessionToken()
    resetAccountToLoggedOut()
  }

  if (!user) return null

  // Telegram Mini App foydalanuvchisi uchun (yoki phoneEmailAuthEnabled o'chiq bo'lsa)
  // "Telegram ulangan" va dublikat telefon bog'lash ma'nosiz — bo'lim ko'rsatilmaydi.
  if (isTelegram || !config.phoneEmailAuthEnabled) {
    if (!isTelegram && hasSession) {
      return (
        <Section title={tt('authLinkAccount')}>
          <Item
            icon={LogOut}
            iconColor="var(--p-danger)"
            label={tt('authLogout')}
            onPress={handleLogout}
          />
        </Section>
      )
    }
    return null
  }

  const loadingRow = (
    <span className="size-4 border-2 border-pmuted border-t-transparent rounded-full animate-spin" />
  )
  const linkedRow = (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-psuccess">
      <Check size={13} strokeWidth={2.5} />
      {tt('authLinked')}
    </span>
  )

  return (
    <Section title={tt('authLinkAccount')}>
      {/* ── Telegram provider ── */}
      <Item
        icon={Send}
        iconColor="#0284c7"
        label="Telegram"
        right={
          providers === null
            ? loadingRow
            : providers.includes('telegram')
              ? linkedRow
              : <span className="text-[12px] text-pmuted">{tt('authLinkTelegram')}</span>
        }
        onPress={providers?.includes('telegram') ? undefined : startTgLink}
        disabled={busy || providers === null || providers.includes('telegram')}
      />

      {/* ── Telefon provider ── */}
      <Item
        icon={Phone}
        iconColor="#10b981"
        label={tt('authPhone')}
        right={
          providers === null
            ? loadingRow
            : providers.includes('phone')
              ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-psuccess">
                  <Check size={13} strokeWidth={2.5} />
                  {user.phone ?? tt('authLinked')}
                </span>
              )
              : <span className="text-[12px] text-pmuted">{phoneOpen ? '–' : tt('authLinkPhone')}</span>
        }
        onPress={providers?.includes('phone') ? undefined : () => setPhoneOpen((o) => !o)}
        disabled={busy || providers === null || providers.includes('phone')}
      />

      {/* Telefon ulash formasi (telefon provider hali bog'lanmagan) */}
      {phoneOpen && providers !== null && !providers.includes('phone') && (
        <div className="px-4 pb-3.5 flex flex-col gap-2 border-t border-pline pt-3">
          <div className="w-full bg-pcanvas border border-pline rounded-control px-3.5 flex items-center gap-2">
            <span className="text-pmuted text-sm font-semibold select-none">+998</span>
            <input
              value={phone.digits}
              onChange={(e) => phone.setDigits(e.target.value)}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="90 123 45 67"
              maxLength={11}
              disabled={busy}
              className="flex-1 min-w-0 bg-transparent outline-none py-3 text-sm text-pfg placeholder:text-pmuted tracking-widest"
            />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            maxLength={72}
            placeholder={`${tt('authPassword')} · ${tt('authPasswordHint')}`}
            disabled={busy}
            className="w-full bg-pcanvas border border-pline rounded-control px-3.5 py-3 text-sm text-pfg placeholder:text-pmuted outline-none"
          />
          {otpStep && (
            <>
              <p className="text-[11.5px] text-pmuted leading-snug">
                {tt('authSmsCodeSent')} <span className="font-semibold text-pfg">{phone.value}</span>
              </p>
              <OTPInput value={otpCode} onChange={setOtpCode} disabled={busy} error={!!error} />
            </>
          )}
          <button
            type="button"
            onClick={() => void submitPhoneLink()}
            disabled={busy || !phone.isValid || password.length < 8 || (otpStep && otpCode.length !== 6)}
            className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 w-full py-2.5 rounded-control text-[13px] flex items-center justify-center gap-2"
          >
            {busy && (
              <span className="w-3.5 h-3.5 border-2 border-ponprimary/60 border-t-transparent rounded-full animate-spin" />
            )}
            {otpStep ? tt('authLinkPhoneConfirm') : tt('authLinkPhone')}
          </button>
        </div>
      )}

      {/* TG ulash kodi — bot'dan tasdiqlanadi */}
      {tgLink && (
        <div className="px-4 pb-3.5 border-t border-pline pt-3 flex flex-col gap-2">
          <p className="text-[11.5px] text-pmuted leading-snug">{tt('authLinkCodeHint')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-pcanvas border border-pline rounded-lg px-2.5 py-2 text-[12px] text-pfg truncate">
              {tgLink.url ?? tgLink.code}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="w-9 h-9 rounded-lg bg-psurface border border-pline flex items-center justify-center active:scale-95 transition-transform"
            >
              {copied ? <Check size={14} className="text-psuccess" /> : <Copy size={14} className="text-pmuted" />}
            </button>
          </div>
          <p className="text-[10.5px] text-pmuted">{tt('authCodeExpires')}</p>
        </div>
      )}

      {/* Xato / muvaffaqiyat xabarlari */}
      {error && <p className="px-4 pb-3 text-[12px] font-semibold text-pdanger">{error}</p>}
      {okMsg && <p className="px-4 pb-3 text-[12px] font-semibold text-psuccess">{okMsg}</p>}

      {/* ── Logout (faqat Bearer sessiya bilan kirganlarda) ── */}
      {!isTelegram && hasSession && (
        <Item
          icon={LogOut}
          iconColor="var(--p-danger)"
          label={tt('authLogout')}
          onPress={handleLogout}
        />
      )}
    </Section>
  )
}
