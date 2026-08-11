import { useState, useCallback } from 'react'
import { ChevronLeft, Coins } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
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
import {
  MOCK_TASKS, MOCK_AVATARS, MOCK_MERCH, MOCK_BADGES, MOCK_PACKAGES,
} from './data'

export default function ShopPage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
  const totalCorrect = useAppStore((s) => s.totalCorrect)

  const [balance, setBalance] = useState(12450)
  const [ownedAvatars, setOwnedAvatars] = useState(15)
  const [ownedBadges, setOwnedBadges] = useState(8)

  const handlePurchaseAvatar = useCallback((id: string) => {
    const item = MOCK_AVATARS.find((a) => a.id === id)
    if (!item || balance < item.price) return
    setBalance((b) => b - item.price)
    setOwnedAvatars((c) => c + 1)
  }, [balance])

  const handlePurchaseMerch = useCallback((id: string) => {
    const item = MOCK_MERCH.find((m) => m.id === id)
    if (!item || balance < item.price) return
    setBalance((b) => b - item.price)
  }, [balance])

  const handlePurchaseBadge = useCallback((id: string) => {
    const item = MOCK_BADGES.find((b) => b.id === id)
    if (!item || balance < item.price) return
    setBalance((b) => b - item.price)
    setOwnedBadges((c) => c + 1)
  }, [balance])

  const handleDailyClaim = useCallback(() => {
    setBalance((b) => b + 3000)
  }, [])

  return (
    <div className="font-display min-h-screen bg-pcanvas text-pfg pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => goBack(navigate)} aria-label="Orqaga"
            className="text-psubtle hover:text-pfg text-xl px-1 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[17px] font-bold tracking-tight">
            {lang === 'ru' ? 'Магазин токенов' : "Tokenlar do'koni"}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 bg-pcard border border-pline rounded-full px-3 py-1.5">
          <Coins size={14} className="text-pgold" />
          <span className="text-[13px] font-bold text-pfg tabular-nums">{balance.toLocaleString()}</span>
        </div>
      </div>

      {/* Stats */}
      <StatsBar tokens={balance} badges={ownedBadges} avatars={ownedAvatars} lang={lang} />

      {/* Daily Reward */}
      <DailyReward lang={lang} nextRewardTokens={3000} onClaim={handleDailyClaim} />

      {/* Token Tasks */}
      <TokenTasks tasks={MOCK_TASKS} lang={lang} />

      {/* Level Progress */}
      <LevelProgress totalCorrect={totalCorrect} lang={lang} />

      {/* Avatar Shop */}
      <AvatarGrid avatars={MOCK_AVATARS} lang={lang} balance={balance} onPurchase={handlePurchaseAvatar} />

      {/* Merch Shop */}
      <MerchGrid items={MOCK_MERCH} lang={lang} balance={balance} onPurchase={handlePurchaseMerch} />

      {/* Badges */}
      <BadgeRow badges={MOCK_BADGES} lang={lang} balance={balance} onPurchase={handlePurchaseBadge} />

      {/* Token Packages */}
      <TokenPackages packages={MOCK_PACKAGES} lang={lang} />

      {/* VIP Banner */}
      <VipBanner lang={lang} isPremium={isPremium} />
    </div>
  )
}
