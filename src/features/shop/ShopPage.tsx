/**
 * Do'kon sahifasi (FIXPLAN #40) — coin iqtisodiyotining markazi.
 *
 * v2 REDESIGN (storefront modeli) — 4 qavatli ierarxiya:
 *  1) HERO "Bugun" vitrinasi — eng aktual taklif(lar): mavsumiy drop,
 *     kunlik BEPUL spin, premium-pass. Do'konga kirishga SABAB beradi.
 *  2) STICKY header: sarlavha + balans kapsulasi (skrollda) + bo'lim tab'lari
 *     scroll-spy bilan. Balans va navigatsiya doim qo'l ostida.
 *  3) BO'LIMLAR (`id` bilan — tab anchor'lari): temalar (mini-ilova preview),
 *     ramkalar, premium-pass, merch, hamyon.
 *  4) TARIX — hamyon ko'rinishi (kun bo'yicha guruhlangan, oy xulosasi bilan).
 *
 * Server trust boundary O'ZGARMAYDI: narx/egalik/debit FAQAT server'da —
 * client faqat katalog (shared/shop-items) ko'rsatadi va store'ni SERVER
 * javobi bilan yangilaydi (setCoins(balance), addOwnedItem, syncFromServer).
 * "Yetmaydi" holati ham faqat KO'RINISH — server baribir COINS_INSUFFICIENT
 * qaytaradi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Sparkles, Palette, Image as ImageIcon, Clock,
} from 'lucide-react'
import { CoinIcon } from '../../shared/components/CoinIcon'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../shared/store/useAppStore'
import { api, ApiError } from '../../shared/api'
import { getAccentTheme, resolveAccent } from '../../shared/config/themes'
import { AVATAR_FRAMES } from '../../shared/config/avatar-frames'
import { SHOP_ITEMS, getShopItem, isDurableShopItem, isShopItemAvailable, seasonalDaysLeft, type ShopItem } from '../../../shared/shop-items'
import { goBack } from '../../shared/lib/navigation'
import { PageHeader } from '../../shared/components/ui/page-header'
import { playSound } from '../../shared/lib/sounds'
import { newId } from '../../shared/lib/outbox'
import { track } from '../../shared/lib/analytics'
import { useT } from '../../shared/i18n'
import Confetti from '../../shared/components/Confetti'
import MerchSection from './MerchSection'
import SpinModal from './SpinModal'
import ShopHeroCarousel, { HERO_ICONS, type HeroCard } from './ShopHeroCarousel'
import ShopThemeCard from './ShopThemeCard'
import ShopTabs, { type ShopTab } from './ShopTabs'
import Stagger from './Stagger'
import { BalanceCapsule, BalanceHero } from './ShopBalance'
import { ShopEquipChip, ShopPriceChip } from './ShopPriceChip'
import { formatCoins as fmtCoins } from '../../shared/lib/format'
import { addPageScrollListener, pageScrollY } from '../../shared/lib/page-scroll'

/** Skrolldan keyin ixcham balans kapsulasi chiqadigan chegara (px) */
const CAPSULE_AFTER_PX = 140

/** Bo'lim sarlavhasi (SSOT — bir xil ritm, aksent faqat "yangi/maxsus"da) */
function SectionLabel({
  children, icon, accent = false,
}: { children: React.ReactNode; icon: React.ReactNode; accent?: boolean }) {
  return (
    <p className={`mb-2.5 flex items-center gap-1.5 px-5 text-[10px] font-semibold uppercase tracking-[0.14em] ${accent ? 'text-pprimary' : 'text-psubtle'}`}>
      {icon} {children}
    </p>
  )
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

  const pageRef   = useRef<HTMLDivElement>(null)

  const ownedSet = useMemo(() => new Set(owned), [owned])
  const [busy, setBusy]       = useState<string | null>(null)   // qaysi item jarayonda
  const [error, setError]     = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  /** Xarid paytida uchib chiqadigan tanga (mavjud `.coin-pop` klassi) */
  const [coinPop, setCoinPop] = useState(false)
  const [spinOpen, setSpinOpen] = useState(false)
  const [spunToday, setSpunToday] = useState<boolean | null>(null)
  const [scrolled, setScrolled] = useState(false)

  /** Balans — FAQAT ko'rinish uchun (server har doim qayta tekshiradi) */
  const safeCoins = Number.isFinite(coins) ? Math.max(0, coins) : 0
  const affordable = (price: number) => safeCoins >= price
  const missingFor = (price: number) => Math.max(0, price - safeCoins)
  // useCallback SHART: `missingLabel` heroCards useMemo'sining dependency'si —
  // har renderda yangi funksiya bo'lsa karta massivi behuda qayta qurilardi.
  const missingLabel = useCallback((m: string) => tt('shopMissingCoins').replace('{n}', m), [tt])

  // Hero "BEPUL" kartasi bugun aylanilgan bo'lsa jim o'chadi (yolg'on CTA bermaymiz)
  useEffect(() => {
    let alive = true
    api.getSpinState()
      .then((state) => { if (alive) setSpunToday(state.spun) })
      .catch(() => { if (alive) setSpunToday(false) })
    return () => { alive = false }
  }, [])

  // Sticky balans kapsulasi — haqiqiy scroller'da (mobil: window, desktop: panel)
  useEffect(() => {
    const update = () => setScrolled(pageScrollY() > CAPSULE_AFTER_PX)
    update()
    return addPageScrollListener(update)
  }, [])

  const showError = (msg: string) => { setError(msg); playSound('error'); window.setTimeout(() => setError(null), 3500) }

  const celebrateOnce = () => {
    setCelebrate(true)
    playSound('win')
    window.setTimeout(() => setCelebrate(false), 3200)
  }

  /**
   * `buy` har renderda yangi funksiya (ko'p holatga bog'liq). Uni `heroCards`
   * useMemo'sining dependency'siga qo'shsak, karta massivi har renderda qayta
   * quriladi (behuda). Ref orqali "eng yangi" versiyani chaqiramiz — hero
   * CTA'lari doim to'g'ri funksiyaga tushadi, memo esa barqaror qoladi.
   */
  const buyRef = useRef<(itemId: string) => void>(() => {})

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
        // "Tanga uchdi" mikro-effekti (TestPage'dagi `.coin-pop` bilan bir xil
        // til): narx kartadan chiqib ketganini ko'z bilan sezish.
        setCoinPop(true)
        window.setTimeout(() => setCoinPop(false), 1300)
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
  buyRef.current = (itemId: string) => void buy(itemId)

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

  const themeItems   = SHOP_ITEMS.filter((i) => i.kind === 'accent-theme')
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
      <div key={frame.id} className="relative flex flex-col items-center gap-2.5 rounded-2xl bg-pcard p-3.5 shadow-xs">
        {countdownBadge && (
          <div className="flex w-full items-center justify-center">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9.5px] font-medium"
              style={{ background: 'rgb(var(--p-primary-rgb) / 0.12)', color: 'var(--p-primary)' }}
            >
              <Clock size={10} strokeWidth={2} className="flex-none" />
              {countdownBadge}
            </span>
          </div>
        )}
        {/* Ramka preview */}
        <span className={`avatar-frame ${frame.cssClass}`}>
          <span className="flex size-14 items-center justify-center rounded-full bg-pcard text-lg font-semibold text-pmuted">
            {initial}
          </span>
        </span>
        <p className="w-full truncate text-center text-[12.5px] font-semibold">{frame.label[lang]}</p>
        {isOwned ? (
          <ShopEquipChip
            equipped={isEquipped}
            busy={busy === 'equip'}
            disabled={busy !== null && busy !== 'equip'}
            onToggle={() => equip(isEquipped ? null : frame.id)}
            equipLabel={tt('shopEquip')}
            unequipLabel={tt('shopUnequip')}
          />
        ) : (
          <ShopPriceChip
            price={item.price}
            affordable={affordable(item.price)}
            missing={missingFor(item.price)}
            busy={busy === item.id}
            disabled={busy !== null && busy !== item.id}
            onBuy={() => void buy(item.id)}
            missingLabel={missingLabel}
          />
        )}
      </div>
    )
  }

  // ── Hero "Bugun" kartalari (faqat real taklif bo'lsa) ──────────────────────
  const heroCards = useMemo<HeroCard[]>(() => {
    const cards: HeroCard[] = []

    // 1) Mavsumiy drop — tugash sanasi bilan (time-limited merchandising)
    const seasonal = seasonalFrameItems[0]
    if (seasonal) {
      const frame = AVATAR_FRAMES.find((f) => f.id === seasonal.id)
      const left = seasonal.seasonal ? seasonalDaysLeft(seasonal.seasonal, now) : null
      if (frame) {
        const aff = safeCoins >= seasonal.price
        cards.push({
          id: `hero-${seasonal.id}`,
          eyebrow: tt('shopSeasonalTitle'),
          title: frame.label[lang],
          desc: tt('shopSeasonalDesc'),
          icon: HERO_ICONS.seasonal,
          accentRgb: '20 111 221',
          badge: left !== null ? { text: `${left} ${tt('shopSeasonalDays')}`, tone: 'primary' } : null,
          price: seasonal.price,
          affordable: aff,
          missing: aff ? 0 : seasonal.price - safeCoins,
          missingLabel,
          ctaLabel: fmtCoins(seasonal.price),
          onCta: () => buyRef.current(seasonal.id),
          busy: busy === seasonal.id,
          disabled: busy !== null && busy !== seasonal.id,
        })
      }
    }

    // 2) Kunlik spin — BEPUL (aylanilgan bo'lsa karta chiqmaydi)
    if (spunToday === false) {
      cards.push({
        id: 'hero-spin',
        eyebrow: tt('spinTitle'),
        title: tt('spinTitle'),
        desc: tt('spinDesc'),
        icon: HERO_ICONS.spin,
        accentRgb: '139 127 212',
        badge: { text: tt('shopHeroFree'), tone: 'gold' },
        price: null,
        affordable: true,
        missing: 0,
        missingLabel,
        ctaLabel: tt('spinButton'),
        onCta: () => { playSound('click'); setSpinOpen(true) },
      })
    }

    return cards
    // `buy` ATAYLAB yo'q — `buyRef` orqali chaqiriladi (ref barqaror, memo
    // har renderda qayta qurilmaydi). `busy` esa kerak: karta spinneri.
  }, [seasonalFrameItems, spunToday, safeCoins, busy, lang, now, tt, missingLabel])

  const tabs = useMemo<ShopTab[]>(() => [
    { id: 'shop-themes',   label: tt('shopThemesTitle') },
    { id: 'shop-frames',   label: tt('shopFramesTitle') },
    { id: 'shop-merch',    label: tt('merchTitle') },
  ], [tt])

  return (
    <div ref={pageRef} className="font-display bg-pcanvas pb-4 text-pfg">
      {celebrate && <Confetti count={40} />}
      {coinPop && (
        <div className="coin-pop flex items-center gap-1 text-[22px] font-bold text-pdanger">
          <CoinIcon size={26} />
          <span className="tabular-nums">−</span>
        </div>
      )}

      {/* Header (PageHeader SSOT): sarlavha + skrollda ixcham balans kapsulasi
          + bo'lim navigatsiyasi. Strip header ICHIDA — aks holda header
          elementi (z-30) uni qoplaydi (sticky overlap, skrinshotda tasdiqlangan). */}
      <PageHeader
        title={tt('shopTitle')}
        subtitle={tt('shopSubtitle')}
        size="lg"
        onBack={() => goBack(navigate)}
        backLabel={tt('backWord')}
      >
        <div className="px-4 pb-1">
          <BalanceCapsule coins={safeCoins} visible={scrolled} label={tt('shopBalance')} />
        </div>
        <ShopTabs tabs={tabs} containerRef={pageRef} />
      </PageHeader>

      {/* Balans hero — ixcham "hamyon" kartasi */}
      <div className="mx-5 mt-2">
        <BalanceHero
          coins={safeCoins}
          isPremium={isPremium}
          label={tt('shopBalance')}
          earnHint={tt('shopEarnHint')}
        />
      </div>

      {error && (
        <div
          className="mx-5 mt-3 animate-fadeIn rounded-2xl px-4 py-3 text-[12.5px] font-semibold text-pwarning shadow-xs"
          style={{ background: 'rgb(var(--p-warning-rgb) / 0.12)' }}
        >
          {error}
        </div>
      )}

      {/* ── HERO: "Bugun" vitrinasi (har doim ko'rinadi — do'kon yuzi) ── */}
      {heroCards.length > 0 && (
        <section className="mt-5">
          <SectionLabel icon={<Sparkles size={11} className="text-pprimary" />}>
            {tt('shopHeroToday')}
          </SectionLabel>
          <ShopHeroCarousel cards={heroCards} />
        </section>
      )}

      {/* ── TEMALAR ── */}
      <section id="shop-themes" className="pt-5">
        <SectionLabel icon={<Palette size={11} className="text-pprimary" />}>
          {tt('shopThemesTitle')}
        </SectionLabel>
        <div className="grid grid-cols-2 gap-3 px-5 lg:grid-cols-3 xl:grid-cols-4">
          <Stagger>
            {themeItems.map((item) => {
              const theme = getAccentTheme(item.id)
              return (
                <ShopThemeCard
                  key={theme.id}
                  theme={theme}
                  lang={lang}
                  price={item.price}
                  owned={ownedSet.has(theme.id)}
                  active={resolveAccent(accent, isPremium, ownedSet) === theme.id}
                  affordable={affordable(item.price)}
                  missing={missingFor(item.price)}
                  busy={busy === item.id}
                  disabled={busy !== null && busy !== item.id}
                  onBuy={() => void buy(item.id)}
                />
              )
            })}
          </Stagger>
        </div>
      </section>

      {/* ── RAMKALAR (mavsumiy drop + doimiy kolleksiya) ── */}
      <section id="shop-frames" className="pt-6">
        <SectionLabel icon={<ImageIcon size={11} className="text-pprimary" />}>
          {tt('shopFramesTitle')}
        </SectionLabel>

        {seasonalFrameItems.length > 0 && (
          <>
            <SectionLabel icon={<Sparkles size={11} />} accent>
              {tt('shopSeasonalTitle')}
            </SectionLabel>
            <div className="mb-4 grid grid-cols-2 gap-3 px-5 lg:grid-cols-3 xl:grid-cols-4">
              {seasonalFrameItems.map((item) => {
                const left = item.seasonal ? seasonalDaysLeft(item.seasonal, now) : null
                return renderFrameCard(item, left !== null ? `${tt('shopSeasonalLeft')} ${left} ${tt('shopSeasonalDays')}` : null)
              })}
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3 px-5 lg:grid-cols-3 xl:grid-cols-4">
          <Stagger>{frameItems.map((item) => renderFrameCard(item))}</Stagger>
        </div>
      </section>

      {/* ── MERCH (real fizik tovarlar, #40 Faza 3) ── */}
      <section id="shop-merch" className="pt-6">
        <MerchSection onCelebration={celebrateOnce} />
      </section>

      {spinOpen && (
        <SpinModal onClose={() => { setSpinOpen(false); setSpunToday(true) }} />
      )}
    </div>
  )
}
