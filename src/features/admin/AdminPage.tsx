import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { Ticket, HelpCircle, Users, BarChart3, ShieldCheck, Send, Sparkles, MessageSquare, Package } from 'lucide-react'
import { PageHeader } from '../../shared/components/ui/page-header'
import { useAppStore } from '../../shared/store/useAppStore'
import AdminPromoTab from './components/AdminPromoTab'
import AdminQuestionsTab from './components/AdminQuestionsTab'
import AdminAiStudioTab from './components/AdminAiStudioTab'
import AdminUsersTab from './components/AdminUsersTab'
import AdminBroadcastTab from './components/AdminBroadcastTab'
import AdminStatsTab from './components/AdminStatsTab'
import AdminSmsTab from './components/AdminSmsTab'
import AdminOrdersTab from './components/AdminOrdersTab'

type AdminTab = 'promos' | 'questions' | 'studio' | 'users' | 'broadcast' | 'sms' | 'stats' | 'orders'

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
    { id: 'orders',    label: 'Buyurtmalar', icon: Package },
  ]

  return (
    <div className="font-display bg-pcanvas text-pfg pb-6 px-4">
      {/* Top Header (PageHeader SSOT) */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-ppurple" />
            KIVVI Admin Panel
          </span>
        }
        subtitle={`${user.firstName} (Admin)`}
        size="lg"
        onBack={() => goBack(navigate)}
        backLabel={lang === 'ru' ? 'Назад' : 'Orqaga'}
        className="-mx-4 mb-4"
      >
        <div className="px-4 pb-2">
          <div className="grid grid-cols-8 gap-1 p-1 bg-psurface rounded-2xl shadow-xs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-0.5 rounded-xl text-[10px] font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-ppurple text-ponprimary shadow-md scale-[1.02]'
                      : 'text-pmuted hover:text-pfg'
                  }`}
                >
                  <Icon size={15} />
                  <span className="truncate max-w-full">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </PageHeader>

      {/* Tab Content — desktop'da keng (jadvallar nafas oladi) */}
      <div className="max-w-md mx-auto lg:max-w-2xl">
        {activeTab === 'promos' && <AdminPromoTab />}
        {activeTab === 'questions' && <AdminQuestionsTab lang={lang} />}
        {activeTab === 'studio' && <AdminAiStudioTab />}
        {activeTab === 'users' && <AdminUsersTab />}
        {activeTab === 'broadcast' && <AdminBroadcastTab lang={lang} currentUserId={user.id} />}
        {activeTab === 'sms' && <AdminSmsTab />}
        {activeTab === 'stats' && <AdminStatsTab />}
        {activeTab === 'orders' && <AdminOrdersTab />}
      </div>
    </div>
  )
}
