import { useState, useEffect, useCallback } from 'react'
import { Users, Activity, HelpCircle, CheckCircle2, Ticket, RotateCw, Loader2, TrendingUp } from 'lucide-react'
import { PremiumIcon } from '../../../shared/components/PremiumIcon'
import { api, type AdminStats } from '../../../shared/api'
import { haptics } from '../../../platform/haptics'
import { formatCoins } from '../../../shared/lib/format'

export default function AdminStatsTab() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getAdminStats()
      setStats(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const handleRefresh = () => {
    setRefreshing(true)
    haptics.impact('light')
    loadStats()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-pmuted">
        <Loader2 size={28} className="motion-safe:animate-spin mb-3 text-ppurple" />
        <p className="text-xs font-semibold">Statistika hisoblanmoqda...</p>
      </div>
    )
  }

  const items = [
    {
      title: "Jami foydalanuvchilar",
      value: formatCoins(stats?.totalUsers ?? 0) ?? '0',
      icon: Users,
      color: 'text-pblue',
      bg: 'bg-[rgb(var(--p-blue-rgb)/0.15)] border-[rgb(var(--p-blue-rgb)/0.3)]',
      desc: "Ro'yxatdan o'tganlar",
    },
    {
      title: "Premium a'zolar",
      value: formatCoins(stats?.premiumUsers ?? 0) ?? '0',
      icon: PremiumIcon,
      color: 'text-ppurple',
      bg: 'bg-[rgb(var(--p-purple-rgb)/0.15)] border-[rgb(var(--p-purple-rgb)/0.3)]',
      desc: "Faol obunalar",
    },
    {
      title: "Bugun faol (DAU)",
      value: formatCoins(stats?.todayActiveUsers ?? 0) ?? '0',
      icon: Activity,
      color: 'text-pprimary',
      bg: 'bg-[rgb(var(--p-primary-rgb)/0.15)] border-[rgb(var(--p-primary-rgb)/0.3)]',
      desc: "Bugun test yechganlar",
    },
    {
      title: "Savollar bazasi",
      value: formatCoins(stats?.totalQuestions ?? 0) ?? '0',
      icon: HelpCircle,
      color: 'text-pwarning',
      bg: 'bg-[rgb(var(--p-warning-rgb)/0.15)] border-[rgb(var(--p-warning-rgb)/0.3)]',
      desc: "Test savollari",
    },
    {
      title: "Yechilgan testlar",
      value: formatCoins(stats?.totalAnswered ?? 0) ?? '0',
      icon: CheckCircle2,
      color: 'text-pprimary',
      bg: 'bg-[rgb(var(--p-primary-rgb)/0.15)] border-[rgb(var(--p-primary-rgb)/0.3)]',
      desc: "Jami javoblar",
    },
    {
      title: "Promokodlar",
      value: formatCoins(stats?.totalPromoCodes ?? 0) ?? '0',
      icon: Ticket,
      color: 'text-ppurple',
      bg: 'bg-[rgb(var(--p-purple-rgb)/0.15)] border-[rgb(var(--p-purple-rgb)/0.3)]',
      desc: "Barcha aksiyalar",
    },
  ]

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-pfg flex items-center gap-2">
            <TrendingUp size={18} className="text-pprimary" />
            Jonli Tizim Statistikasi
          </h2>
          <p className="text-xs text-pmuted">Platformaning asosiy ko'rsatkichlari</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2.5 rounded-xl bg-psurface text-pmuted hover:text-pfg active:scale-95 transition-transform flex items-center justify-center shadow-xs"
          aria-label="Yangilash"
        >
          <RotateCw size={15} className={refreshing ? 'motion-safe:animate-spin text-pprimary' : ''} />
        </button>
      </div>

      {/* Grid Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        {items.map((it, idx) => {
          const Icon = it.icon
          return (
            <div key={idx} className="rounded-2xl bg-pcard p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-pmuted">{it.title}</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${it.bg} ${it.color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <p className="text-2xl font-semibold text-pfg tracking-tight mb-1">{it.value}</p>
              <p className="text-[10px] text-psubtle font-medium">{it.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
