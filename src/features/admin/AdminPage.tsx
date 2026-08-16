import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { Ticket, HelpCircle, Users, BarChart3, ChevronLeft, ShieldCheck, Send, Sparkles, MessageSquare } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import AdminPromoTab from './components/AdminPromoTab'
import AdminQuestionsTab from './components/AdminQuestionsTab'
import AdminAiStudioTab from './components/AdminAiStudioTab'
import AdminUsersTab from './components/AdminUsersTab'
import AdminBroadcastTab from './components/AdminBroadcastTab'
import AdminStatsTab from './components/AdminStatsTab'
import AdminSmsTab from './components/AdminSmsTab'

type AdminTab = 'promos' | 'questions' | 'studio' | 'users' | 'broadcast' | 'sms' | 'stats'

export default function AdminPage() {
  const navigate = useNavigate()
  const user = useAppStore((s) => s.user)
  const settings = useAppStore((s) => s.settings)
  const lang = settings?.language ?? 'uz'
  const [activeTab, setActiveTab] = useState<AdminTab>('promos')

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/profil', { replace: true })
    }
  }, [user?.isAdmin, navigate])

  if (!user?.isAdmin) return null

  const tabs: { id: AdminTab; label: string; icon: typeof Ticket }[] = [
    { id: 'promos',    label: 'Promokod',   icon: Ticket },
    { id: 'questions', label: 'Savollar',   icon: HelpCircle },
    { id: 'studio',    label: 'AI Studiya', icon: Sparkles },
    { id: 'users',     label: 'O\'quvchilar', icon: Users },
    { id: 'broadcast', label: 'E\'lonlar',   icon: Send },
    { id: 'sms',       label: 'SMS',        icon: MessageSquare },
    { id: 'stats',     label: 'Statistika', icon: BarChart3 },
  ]

  return (
    <div className="font-display min-h-screen bg-bg text-fg pb-20">
      {/* Top Header */}
      <div className="sticky top-0 bg-surface/90 backdrop-blur-md border-b border-line z-30 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => goBack(navigate)}
            className="w-9 h-9 rounded-2xl bg-elevated border border-line flex items-center justify-center text-muted hover:text-fg active:scale-95 transition-all"
            aria-label="Orqaga"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="text-center">
            <h1 className="text-sm font-black text-fg flex items-center justify-center gap-1.5">
              <ShieldCheck size={16} className="text-duo-purple" />
              KIWI Admin Panel
            </h1>
            <span className="text-[10px] text-muted font-bold">
              {user.firstName} (Admin)
            </span>
          </div>

          <div className="w-9" /> {/* Spacer */}
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-7 gap-1 mt-3 p-1 bg-elevated rounded-2xl border border-line">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-0.5 rounded-xl text-[10px] font-black flex flex-col items-center gap-1 transition-all ${
                  isActive
                    ? 'bg-duo-purple text-ponprimary shadow-md scale-[1.02]'
                    : 'text-muted hover:text-fg'
                }`}
              >
                <Icon size={15} />
                <span className="truncate max-w-full">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-md mx-auto">
        {activeTab === 'promos' && <AdminPromoTab />}
        {activeTab === 'questions' && <AdminQuestionsTab lang={lang} />}
        {activeTab === 'studio' && <AdminAiStudioTab />}
        {activeTab === 'users' && <AdminUsersTab />}
        {activeTab === 'broadcast' && <AdminBroadcastTab lang={lang} currentUserId={user.id} />}
        {activeTab === 'sms' && <AdminSmsTab />}
        {activeTab === 'stats' && <AdminStatsTab />}
      </div>
    </div>
  )
}
