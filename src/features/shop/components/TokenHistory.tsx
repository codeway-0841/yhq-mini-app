import { useState, useEffect } from 'react'
import { ArrowLeft, TrendingUp, Gift, ShoppingBag, Star, RotateCcw, Package, type LucideIcon } from 'lucide-react'
import { api, type TokenTransaction } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'

const TYPE_META: Record<string, { icon: LucideIcon; label: { uz: string; ru: string }; color: string }> = {
  task:     { icon: Star,         label: { uz: 'Topshiriq', ru: 'Задание' },     color: 'text-yellow-500' },
  daily:    { icon: Gift,         label: { uz: 'Kundalik', ru: 'Ежедневное' },   color: 'text-green-500' },
  purchase: { icon: ShoppingBag,  label: { uz: 'Xarid', ru: 'Покупка' },         color: 'text-red-400' },
  level_up: { icon: TrendingUp,   label: { uz: 'Level up', ru: 'Уровень' },      color: 'text-blue-500' },
  refund:   { icon: RotateCcw,    label: { uz: 'Qaytarish', ru: 'Возврат' },     color: 'text-orange-400' },
  package:  { icon: Package,      label: { uz: 'Paket', ru: 'Пакет' },           color: 'text-purple-500' },
}

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  onClose: () => void
}

export function TokenHistory({ onClose }: Props) {
  const lang = useAppStore((s) => s.settings.language)
  const userId = useAppStore((s) => s.user?.id)
  const [history, setHistory] = useState<TokenTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    api.getShopHistory(userId).then((res) => {
      if (controller.signal.aborted) return
      setHistory(res.history)
      setLoading(false)
    }).catch((e) => {
      if (controller.signal.aborted) return
      setError(e instanceof Error ? e.message : 'Failed to load history')
      setLoading(false)
    })
    return () => { controller.abort() }
  }, [userId])

  return (
    <div className="fixed inset-0 z-40 bg-pcanvas flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-pline">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-pcard active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-[16px] font-bold">
          {lang === 'ru' ? 'История токенов' : 'Token tarixi'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-pprimary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-400 text-[13px]">{error}</div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-pmuted text-[13px]">
            {lang === 'ru' ? 'Пока нет операций' : "Hozircha amallar yo'q"}
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((tx) => {
              const meta = TYPE_META[tx.type] ?? TYPE_META.task
              const Icon = meta.icon
              const positive = tx.amount > 0
              return (
                <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-pcard">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-pcanvas ${meta.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-pfg truncate">
                      {meta.label[lang === 'ru' ? 'ru' : 'uz']}
                    </p>
                    <p className="text-[11px] text-pmuted">{formatDate(tx.createdAt, lang)}</p>
                  </div>
                  <span className={`text-[14px] font-bold ${positive ? 'text-green-500' : 'text-red-400'}`}>
                    {positive ? '+' : ''}{tx.amount.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
