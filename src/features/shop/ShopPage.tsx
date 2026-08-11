import { useState, useCallback } from 'react'
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
import {
  MOCK_TASKS, MOCK_AVATARS, MOCK_MERCH, MOCK_BADGES, MOCK_PACKAGES,
} from './data'

export default function ShopPage() {
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
          tokens={balance}
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
        <TokenTasks tasks={MOCK_TASKS} lang={lang} />
        <LevelProgress totalCorrect={totalCorrect} lang={lang} />
      </div>

      {/* Avatar Shop */}
      <AvatarGrid avatars={MOCK_AVATARS} lang={lang} balance={balance} onPurchase={handlePurchaseAvatar} />

      {/* Merch Shop */}
      <MerchGrid items={MOCK_MERCH} lang={lang} balance={balance} onPurchase={handlePurchaseMerch} />

      {/* Badges */}
      <div id="badges-section">
        <BadgeRow badges={MOCK_BADGES} lang={lang} balance={balance} onPurchase={handlePurchaseBadge} />
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
