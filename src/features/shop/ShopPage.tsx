import { useCallback } from 'react'
import { Clock, HelpCircle } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { StatsBar } from './components/StatsBar'
import { DailyReward } from './components/DailyReward'
import { TokenTasks } from './components/TokenTasks'
import { LevelProgress } from './components/LevelProgress'
import { AvatarGrid } from './components/AvatarGrid'
import { MerchGrid } from './components/MerchGrid'
import { BadgeRow } from './components/BadgeRow'
import { TokenPackages } from './components/TokenPackages'
import { VipBanner } from './components/VipBanner'
import { useShop } from './useShop'
import { MOCK_PACKAGES } from './data'
import type { AvatarCategory, MerchCategory } from './data'
import PageLoader from '../../shared/components/PageLoader'

export default function ShopPage() {
  const lang = useAppStore((s) => s.settings.language)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
  const totalCorrect = useAppStore((s) => s.totalCorrect)

  const shop = useShop()

  const ownedAvatars = [...shop.purchases].filter((id) =>
    shop.avatars.some((a) => a.id === id)
  ).length
  const ownedBadges = [...shop.purchases].filter((id) =>
    shop.badges.some((b) => b.id === id)
  ).length

  const taskProgressMap = new Map(shop.taskProgress.map((p) => [p.taskId, p]))

  const mappedTasks = shop.tasks.map((t) => {
    const tp = taskProgressMap.get(t.id)
    return {
      id: t.id, titleUz: t.titleUz, titleRu: t.titleRu,
      reward: t.reward, total: t.total,
      progress: tp?.progress ?? 0,
      completed: tp?.completed ?? false,
    }
  })

  const handlePurchase = useCallback((id: string) => {
    shop.purchase(id)
  }, [shop.purchase])

  const handleDailyClaim = useCallback(() => {
    shop.claimDaily()
  }, [shop.claimDaily])

  if (shop.loading) return <PageLoader />

  return (
    <div className="font-display min-h-screen bg-pcanvas text-pfg pb-10">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight leading-tight">
              {lang === 'ru' ? 'Магазин токенов' : "Tokenlar do'koni"}
            </h1>
            <p className="text-[12px] text-pmuted mt-1 leading-snug">
              {lang === 'ru'
                ? 'Выполняйте задания, копите токены и получайте подарки!'
                : "Topshiriqlarni bajaring, tokenlar to'plang va sovg'alarni oling!"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-pprimary/40 bg-pprimary/5 text-pprimary text-[11px] font-semibold transition-all active:scale-95"
              onClick={() => {/* TODO: Token history */}}
            >
              <Clock size={13} />
              <span className="hidden xs:inline">
                {lang === 'ru' ? 'История' : 'Tarixi'}
              </span>
            </button>
            <button
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-pline bg-pcard text-pfg text-[11px] font-semibold transition-all active:scale-95"
              onClick={() => {/* TODO: How it works */}}
            >
              <HelpCircle size={13} />
              <span className="hidden xs:inline">
                {lang === 'ru' ? 'Как работает?' : 'Qanday ishlaydi?'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats + Daily Reward */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto] gap-3 px-4">
        <StatsBar
          tokens={shop.balance}
          badges={ownedBadges}
          avatars={ownedAvatars}
          lang={lang}
          onGetMoreTokens={() => document.getElementById('token-packages')?.scrollIntoView({ behavior: 'smooth' })}
          onViewBadges={() => document.getElementById('badges-section')?.scrollIntoView({ behavior: 'smooth' })}
          onViewAvatars={() => document.getElementById('avatars-section')?.scrollIntoView({ behavior: 'smooth' })}
        />
        <DailyReward lang={lang} nextRewardTokens={3000} onClaim={handleDailyClaim} />
      </div>

      {/* Token Tasks + Level Progress */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <TokenTasks tasks={mappedTasks} lang={lang} />
        <LevelProgress totalCorrect={totalCorrect} lang={lang} />
      </div>

      {/* Avatar Shop */}
      <AvatarGrid avatars={shop.avatars.map((a) => ({
        id: a.id, name: a.nameUz, nameRu: a.nameRu, image: a.image,
        price: a.price, category: a.category as AvatarCategory,
      }))} lang={lang} balance={shop.balance} onPurchase={handlePurchase} />

      {/* Merch Shop */}
      <MerchGrid items={shop.merch.map((m) => ({
        id: m.id, name: m.nameUz, nameRu: m.nameRu, image: m.image,
        price: m.price, category: m.category as MerchCategory,
      }))} lang={lang} balance={shop.balance} onPurchase={handlePurchase} />

      {/* Badges */}
      <div id="badges-section">
        <BadgeRow badges={shop.badges.map((b) => ({
          id: b.id, name: b.nameUz, nameRu: b.nameRu, icon: b.image, price: b.price,
        }))} lang={lang} balance={shop.balance} onPurchase={handlePurchase} />
      </div>

      {/* Token Packages */}
      <div id="token-packages">
        <TokenPackages packages={MOCK_PACKAGES} lang={lang} />
      </div>

      {/* VIP Banner */}
      <VipBanner lang={lang} isPremium={isPremium} />
    </div>
  )
}
