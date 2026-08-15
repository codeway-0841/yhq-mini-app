import { useState, useEffect, useCallback } from 'react'
import { Users, Crown, Activity, HelpCircle, CheckCircle2, Ticket, RotateCw, Loader2, TrendingUp } from 'lucide-react'
import { api, type AdminStats } from '../../../shared/api'
import { haptics } from '../../../platform/haptics'

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
      <div className="flex flex-col items-center justify-center py-20 text-muted">
        <Loader2 size={28} className="animate-spin mb-3 text-duo-purple" />
        <p className="text-xs font-semibold">Statistika hisoblanmoqda...</p>
      </div>
    )
  }

  const items = [
    {
      title: "Jami foydalanuvchilar",
      value: stats?.totalUsers.toLocaleString() ?? '0',
      icon: Users,
      color: 'text-duo-blue',
      bg: 'bg-duo-blue/15 border-duo-blue/30',
      desc: "Ro'yxatdan o'tganlar",
    },
    {
      title: "Premium a'zolar",
      value: stats?.premiumUsers.toLocaleString() ?? '0',
      icon: Crown,
      color: 'text-duo-purple',
      bg: 'bg-duo-purple/15 border-duo-purple/30',
      desc: "Faol obunalar",
    },
    {
      title: "Bugun faol (DAU)",
      value: stats?.todayActiveUsers.toLocaleString() ?? '0',
      icon: Activity,
      color: 'text-duo-green',
      bg: 'bg-duo-green/15 border-duo-green/30',
      desc: "Bugun test yechganlar",
    },
    {
      title: "Savollar bazasi",
      value: stats?.totalQuestions.toLocaleString() ?? '0',
      icon: HelpCircle,
      color: 'text-duo-yellow',
      bg: 'bg-duo-yellow/15 border-duo-yellow/30',
      desc: "Test savollari",
    },
    {
      title: "Yechilgan testlar",
      value: stats?.totalAnswered.toLocaleString() ?? '0',
      icon: CheckCircle2,
      color: 'text-duo-green',
      bg: 'bg-duo-green/15 border-duo-green/30',
      desc: "Jami javoblar",
    },
    {
      title: "Promokodlar",
      value: stats?.totalPromoCodes.toLocaleString() ?? '0',
      icon: Ticket,
      color: 'text-duo-purple',
      bg: 'bg-duo-purple/15 border-duo-purple/30',
      desc: "Barcha aksiyalar",
    },
  ]

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-fg flex items-center gap-2">
            <TrendingUp size={18} className="text-duo-green" />
            Jonli Tizim Statistikasi
          </h2>
          <p className="text-xs text-muted">Platformaning asosiy ko'rsatkichlari</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2.5 rounded-2xl bg-surface border border-line text-muted hover:text-fg active:scale-95 transition-transform flex items-center justify-center"
          title="Yangilash"
        >
          <RotateCw size={15} className={refreshing ? 'animate-spin text-duo-purple' : ''} />
        </button>
      </div>

      {/* Grid Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        {items.map((it, idx) => {
          const Icon = it.icon
          return (
            <div key={idx} className="card-premium p-4 rounded-3xl border border-line bg-card relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-muted">{it.title}</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${it.bg} ${it.color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-fg tracking-tight mb-1">{it.value}</p>
              <p className="text-[10px] text-subtle font-medium">{it.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
