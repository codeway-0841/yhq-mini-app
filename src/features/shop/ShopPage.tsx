/**
 * Do'kon sahifasi (FIXPLAN #40) — coin iqtisodiyotining markazi.
 *
 * Bo'limlar:
 *  1) Balans hero + "tanga qanday olinadi" hint
 *  2) Temalar (coin-eksklyuziv + premium temalar coin'ga) — preview swatch
 *  3) Premium (1 kunlik consumable)
 *  4) Avatar ramkalari (owned → Tanlash/olib tashlash)
 *  5) Tangalar tarixi (talab bo'yicha yuklanadi)
 *
 * Server trust boundary: narx/egalik/debit FAQAT server'da — client faqat
 * katalog (shared/shop-items) ko'rsatadi va store'ni SERVER javobi bilan
 * yangilaydi (setCoins(balance), addOwnedItem, syncFromServer tariff uchun).
 */
import { useMemo, useState } from 'react'
import {
  ChevronLeft, Sparkles, Check, Loader2, Palette, History, Image as ImageIcon, Gift, Clock, Info,
} from 'lucide-react'
import { CoinIcon } from '../../shared/components/CoinIcon'
import { PremiumIcon } from '../../shared/components/PremiumIcon'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../shared/store/useAppStore'
import { api, ApiError } from '../../shared/api'
import { getAccentTheme, resolveAccent } from '../../shared/config/themes'
import { AVATAR_FRAMES } from '../../shared/config/avatar-frames'
import { SHOP_ITEMS, getShopItem, isDurableShopItem, isShopItemAvailable, seasonalDaysLeft, type ShopItem } from '../../../shared/shop-items'
import { goBack } from '../../shared/lib/navigation'
import { playSound } from '../../shared/lib/sounds'
import { newId } from '../../shared/lib/outbox'
import { track } from '../../shared/lib/analytics'
import { useT } from '../../shared/i18n'
import Confetti from '../../shared/components/Confetti'
import { Button } from '../../shared/components/ui/button'
import MerchSection from './MerchSection'
import SpinModal from './SpinModal'

/** 2'400 → "2 400" (UZ/RU ikkalasida ham bo'shliqli minglik ajratgich) */
function fmtCoins(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n).replace(/,/g, ' ')
}

export default function ShopPage() {
  const navigate = useNavigate()
  const lang       = useAppStore((s) => s.settings.language)
  const tt         = useT(lang)
  const coins      = useAppStore((s) => s.coins)
  const owned      = useAppStore((s) => s.ownedItems)
  const accent     = useAppStore((s) => s.accent)
  const avatarFrame  = useAppStore((s) => s.avatarFrame)
  const isPremium    = useAppStore((s) => s.tariff === 'premium')
  const setCoins       = useAppStore((s) => s.setCoins)
  const addOwnedItem   = useAppStore((s) => s.addOwnedItem)
  const setAvatarFrame = useAppStore((s) => s.setAvatarFrame)
  const syncFromServer = useAppStore((s) => s.syncFromServer)
  const userId         = useAppStore((s) => s.user?.id)
  const firstName      = useAppStore((s) => s.user?.firstName)
  const initial = firstName?.[0]?.toUpperCase() ?? 'F'

  const ownedSet = useMemo(() => new Set(owned), [owned])
  const [busy, setBusy]       = useState<string | null>(null)   // qaysi item jarayonda
  const [error, setError]     = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const [spinOpen, setSpinOpen] = useState(false)
  // Tarix (talab bo'yicha)
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.getCoinHistory>>['rows'] | null>(null)
  const [historyBusy, setHistoryBusy] = useState(false)

  const showError = (msg: string) => { setError(msg); playSound('error'); window.setTimeout(() => setError(null), 3500) }

  const celebrateOnce = () => {
    setCelebrate(true)
    playSound('win')
    window.setTimeout(() => setCelebrate(false), 3200)
  }

  const buy = async (itemId: string) => {
    const item = getShopItem(itemId)
    if (!item || busy) return
    setError(null)
    setBusy(itemId)
    try {
      const res = await api.purchaseItem({ itemId, purchaseId: newId() })
      setCoins(res.balance)
      if (isDurableShopItem(item)) addOwnedItem(item.id)
      if (!res.duplicate) {
        track('shop_purchase', { itemId, kind: item.kind, price: item.price })
        celebrateOnce()
        // consumable premium: tariff server'da o'zgardi — profilni to'liq yangilaymiz
        if (item.kind === 'premium-days' && userId) void syncFromServer(userId)
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined
      showError(
        code === 'COINS_INSUFFICIENT' ? tt('shopInsufficient') :
        code === 'ITEM_ALREADY_OWNED' ? tt('shopAlreadyOwned') :
        code === 'ITEM_SEASON_EXPIRED' ? tt('shopSeasonExpired') :
        tt('shopError'),
      )
    } finally {
      setBusy(null)
    }
  }

  const equip = async (frameId: string | null) => {
    if (busy) return
    setBusy('equip')
    try {
      await api.equipFrame(frameId)
      setAvatarFrame(frameId)
      playSound(frameId ? 'toggle' : 'click')
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined
      showError(code === 'ITEM_NOT_OWNED' ? tt('shopAlreadyOwned') : tt('shopError'))
    } finally {
      setBusy(null)
    }
  }

  const toggleHistory = async () => {
    if (history !== null) { setHistory(null); return }
    setHistoryBusy(true)
    try {
      const res = await api.getCoinHistory()
      setHistory(res.rows.slice(0, 12))
    } catch {
      showError(tt('shopError'))
    } finally {
      setHistoryBusy(false)
    }
  }

  const themeItems   = SHOP_ITEMS.filter((i) => i.kind === 'accent-theme')
  const premiumItem  = SHOP_ITEMS.find((i) => i.kind === 'premium-days') ?? null
  // Mavsumiy drop: aktiv oynadagi ramkalar alohida bo'limda; oyna yopiq
  // mavsumiy ramka FAQAT egasiga ko'rinadi (umrbod saqlanadi — equip uchun)
  const allItems: readonly ShopItem[] = SHOP_ITEMS   // 'as const' literal union → generic
  const now = useMemo(() => new Date(), [])
  const isActiveSeasonal = (i: ShopItem) => Boolean(i.seasonal) && isShopItemAvailable(i, now)
  const seasonalFrameItems = allItems.filter((i) => i.kind === 'avatar-frame' && isActiveSeasonal(i))
  const frameItems = allItems.filter((i) =>
    i.kind === 'avatar-frame' && !isActiveSeasonal(i) && (!i.seasonal || ownedSet.has(i.id)),
  )

  /** Ramka kartasi (umumiy — oddiy grid va mavsumiy bo'lim ikkalasi ishlatadi) */
  const renderFrameCard = (item: ShopItem, countdownBadge?: string | null) => {
    const frame = AVATAR_FRAMES.find((f) => f.id === item.id)
    if (!frame) return null
    const isOwned    = ownedSet.has(frame.id)
    const isEquipped = avatarFrame === frame.id
    return (
      <div key={frame.id} className="rounded-container border border-pline bg-pcard p-3.5 flex flex-col items-center gap-2.5 relative">
        {countdownBadge && (
          <div className="w-full flex items-center justify-center -mt-0.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9.5px] font-medium"
              style={{
                background: 'rgb(var(--p-primary-rgb) / 0.10)',
                border: '1px solid rgb(var(--p-primary-rgb) / 0.30)',
                color: 'var(--p-primary)',
              }}>
              <Clock size={10} strokeWidth={2} className="flex-shrink-0" />
              {countdownBadge}
            </span>
          </div>
        )}
        {/* Ramka preview */}
        <span className={`avatar-frame ${frame.cssClass}`}>
          <span className="w-14 h-14 rounded-full bg-pcard flex items-center justify-center text-lg font-semibold text-pmuted">
            {initial}
          </span>
        </span>
        <p className="text-[12.5px] font-semibold text-center truncate w-full">{frame.label[lang]}</p>
        {isOwned ? (
          <button
            onClick={() => equip(isEquipped ? null : frame.id)}
            disabled={busy !== null}
            className="w-full text-[11.5px] font-semibold py-1.5 rounded-control active:scale-[0.97] transition-transform disabled:opacity-50"
            style={isEquipped ? {
              background: 'rgb(var(--p-success-rgb) / 0.12)',
              color: 'var(--p-success)',
              border: '1px solid rgb(var(--p-success-rgb) / 0.35)',
            } : {
              background: 'rgb(var(--p-primary-rgb) / 0.12)',
              color: 'var(--p-primary)',
              border: '1px solid rgb(var(--p-primary-rgb) / 0.35)',
            }}>
            {busy === 'equip' ? <Loader2 size={13} className="animate-spin mx-auto" />
              : isEquipped ? tt('shopUnequip') : tt('shopEquip')}
          </button>
        ) : (
          <button
            onClick={() => buy(item.id)}
            disabled={busy !== null}
            className="w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold py-2 rounded-control border border-pline bg-psurface text-pfg active:scale-[0.97] transition-transform disabled:opacity-50">
            {busy === item.id
              ? <Loader2 size={13} className="animate-spin" />
              : <><CoinIcon size={14} className="text-pgold" /> {fmtCoins(item.price)}</>}
          </button>
        )}
      </div>
    )
  }

  const reasonLabel = (reason: string): string => ({
    answer:       tt('coinReasonAnswer'),
    purchase:     tt('coinReasonPurchase'),
    task_claim:   tt('coinReasonTask'),
    spin:         tt('coinReasonSpin'),
    boss_reward:  tt('coinReasonBoss'),
    ai_test:      tt('coinReasonAiTest'),
    merch:        tt('coinReasonMerch'),
    merch_refund: tt('coinReasonRefund'),
    admin:        tt('coinReasonAdmin'),
  } as Record<string, string>)[reason] ?? reason

  return (
    <div className="font-display bg-pcanvas text-pfg pb-4">
      {celebrate && <Confetti count={40} />}

      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-3 pb-2">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga"
          className="grid size-10 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h1 className="text-lg font-semibold tracking-tight">{tt('shopTitle')}</h1>
      </div>

      {/* Balans — ixcham karta (gradient border'siz); hint pastki qatorda */}
      <div className="mx-5 mt-2 rounded-container border border-pline bg-pcard px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em]">{tt('shopBalance')}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[26px] font-semibold tracking-tight tabular-nums">
              <CoinIcon size={22} className="flex-none text-pgold" />
              {fmtCoins(coins)}
            </p>
          </div>
          {isPremium && (
            <span className="inline-flex flex-none items-center gap-1 rounded-full border border-[rgb(var(--p-gold-rgb)/0.35)] bg-[rgb(var(--p-gold-rgb)/0.12)] px-2.5 py-1 text-[10.5px] font-semibold text-pgold">
              <PremiumIcon size={12} /> Premium
            </span>
          )}
        </div>
        <p className="mt-3 flex items-center gap-1.5 border-t border-pline pt-2.5 text-[11px] text-pmuted">
          <Info size={12} strokeWidth={1.75} className="flex-none text-psubtle" />
          {tt('shopEarnHint')}
        </p>
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-container px-4 py-3 text-[12.5px] font-semibold text-pwarning animate-fadeIn"
          style={{ background: 'rgb(var(--p-warning-rgb) / 0.10)', border: '1px solid rgb(var(--p-warning-rgb) / 0.35)' }}>
          {error}
        </div>
      )}

      {/* ── Temalar ── */}
      <p className="px-5 mt-6 mb-2.5 text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em] flex items-center gap-1.5">
        <Palette size={11} className="text-pprimary" /> {tt('shopThemesTitle')}
      </p>
      <div className="grid grid-cols-2 gap-3 px-5">
        {themeItems.map((item) => {
          const theme = getAccentTheme(item.id)
          const isOwned    = ownedSet.has(theme.id)
          const isActiveTheme = resolveAccent(accent, isPremium, ownedSet) === theme.id
          return (
            <div key={theme.id} className="rounded-container border border-pline bg-pcard p-3 flex flex-col gap-2 relative overflow-hidden">
              {/* Mini atmosfera preview */}
              <div className="h-[52px] rounded-control overflow-hidden border border-pline relative"
                style={{ background: theme.bg }}>
                <div className="absolute left-2 right-2 top-2 h-5 rounded-[6px]"
                  style={{ background: theme.card, border: `1px solid ${theme.color}4d` }} />
                <span className="absolute bottom-2 left-2 w-7 h-1.5 rounded-full"
                  style={{ background: theme.color }} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12.5px] font-semibold truncate">{theme.label[lang]}</p>
                {isActiveTheme && <Check size={14} className="text-psuccess flex-none" />}
              </div>
              {isOwned ? (
                <span className="text-center text-[11px] font-semibold py-2 rounded-control"
                  style={{
                    background: 'rgb(var(--p-success-rgb) / 0.12)',
                    color: 'var(--p-success)',
                    border: '1px solid rgb(var(--p-success-rgb) / 0.35)',
                  }}>
                  {isActiveTheme ? tt('shopActive') : tt('shopOwned')}
                </span>
              ) : (
                <button
                  onClick={() => buy(item.id)}
                  disabled={busy !== null}
                  className="flex items-center justify-center gap-1.5 text-[12px] font-semibold py-2 rounded-control border border-pline bg-psurface text-pfg active:scale-[0.97] transition-transform disabled:opacity-50">
                  {busy === item.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <><CoinIcon size={14} className="text-pgold" /> {fmtCoins(item.price)}</>}
                </button>
              )}
            </div>
          )
        })}
      </div>

          {/* ── Premium (consumable) ── */}
      {premiumItem && (
        <>
          <p className="px-5 mt-6 mb-2.5 text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em] flex items-center gap-1.5">
            <PremiumIcon size={12} /> Premium
          </p>
          <div className="mx-5 rounded-container border border-pline bg-pcard px-4 py-3.5 flex items-center gap-3">
            <div className="flex size-11 flex-none items-center justify-center rounded-[14px] border border-[rgb(var(--p-gold-rgb)/0.30)] bg-[rgb(var(--p-gold-rgb)/0.12)]">
              <Sparkles size={19} strokeWidth={1.75} className="text-pgold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold">{tt('shopPremiumDays')}</p>
              <p className="text-[11px] text-pmuted mt-0.5 leading-snug">{tt('shopPremiumDaysDesc')}</p>
            </div>
            <Button
              variant="gold"
              size="sm"
              className="flex-none"
              loading={busy === premiumItem.id}
              disabled={busy !== null}
              onClick={() => buy(premiumItem.id)}
            >
              <CoinIcon size={14} /> {fmtCoins(premiumItem.price)}
            </Button>
          </div>
        </>
      )}

      {/* ── Omad g'ildiragi (kunlik bepul spin) ── */}
      <div className="mx-5 mt-4 rounded-container border border-pline bg-pcard px-4 py-3.5 flex items-center gap-3">
        <div className="flex size-11 flex-none items-center justify-center rounded-[14px] border border-[rgb(var(--p-purple-rgb)/0.30)] bg-[rgb(var(--p-purple-rgb)/0.12)]">
          <Gift size={19} strokeWidth={1.75} className="text-ppurple" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold">{tt('spinTitle')}</p>
          <p className="text-[11px] text-pmuted mt-0.5 leading-snug">{tt('spinDesc')}</p>
        </div>
        <Button
          variant="gold"
          size="sm"
          className="flex-none"
          onClick={() => { playSound('click'); setSpinOpen(true) }}
        >
          {tt('spinButton')}
        </Button>
      </div>

      {/* ── Mavsumiy drop (aktiv oynadagi ramkalar, countdown bilan) ── */}
      {seasonalFrameItems.length > 0 && (
        <>
          <p className="px-5 mt-6 mb-2.5 text-[10px] font-semibold text-pprimary uppercase tracking-[0.14em] flex items-center gap-1.5">
            <Sparkles size={11} /> {tt('shopSeasonalTitle')}
          </p>
          <div className="grid grid-cols-2 gap-3 px-5">
            {seasonalFrameItems.map((item) => {
              const left = item.seasonal ? seasonalDaysLeft(item.seasonal, now) : null
              return renderFrameCard(item, left !== null ? `${tt('shopSeasonalLeft')} ${left} ${tt('shopSeasonalDays')}` : null)
            })}
          </div>
        </>
      )}

      {/* ── Avatar ramkalari ── */}
      <p className="px-5 mt-6 mb-2.5 text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em] flex items-center gap-1.5">
        <ImageIcon size={11} className="text-pprimary" /> {tt('shopFramesTitle')}
      </p>
      <div className="grid grid-cols-2 gap-3 px-5">
        {frameItems.map((item) => renderFrameCard(item))}
      </div>

      {/* ── Merch (real fizik tovarlar, #40 Faza 3) ── */}
      <MerchSection onCelebration={celebrateOnce} />

      {spinOpen && <SpinModal onClose={() => setSpinOpen(false)} />}

      {/* ── Tangalar tarixi ── */}
      <div className="mx-5 mt-6">        <button onClick={toggleHistory}
          className="w-full rounded-container border border-pline bg-pcard p-3.5 flex items-center justify-center gap-2 text-[12.5px] font-semibold text-pmuted active:scale-[0.98] transition-transform">
          {historyBusy ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}
          {history === null ? tt('shopHistoryTitle') : tt('shopHideHistory')}
        </button>
        {history !== null && (
          <div className="rounded-container border border-pline bg-pcard mt-2 divide-y divide-pline animate-fadeIn">
            {history.length === 0 && (
              <p className="text-center text-[12px] text-psubtle py-5">{tt('shopHistoryEmpty')}</p>
            )}
            {history.map((tx, i) => (
              <div key={`${tx.refId}-${i}`} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold truncate">{reasonLabel(tx.reason)}</p>
                  <p className="text-[10.5px] text-psubtle">
                    {new Date(tx.createdAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ',
                      { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-[13px] font-semibold flex-none ${tx.delta > 0 ? 'text-psuccess' : 'text-pwarning'}`}>
                  {tx.delta > 0 ? '+' : ''}{fmtCoins(tx.delta)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
