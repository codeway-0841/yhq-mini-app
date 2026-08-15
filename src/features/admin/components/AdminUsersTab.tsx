import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Crown, User, Shield, Loader2, X, RotateCw, AlertCircle } from 'lucide-react'
import { api, type AdminUserItem } from '../../../shared/api'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'

export default function AdminUsersTab() {
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null)
  const [grantBusy, setGrantBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadUsers = useCallback(async (q = '') => {
    setError(null)
    try {
      const res = await api.searchAdminUsers(q)
      setUsers(res?.users ?? [])
    } catch (err: any) {
      setError(err?.message || "Foydalanuvchilarni yuklab bo'lmadi")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      loadUsers(search)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [loadUsers, search])

  const handleRefresh = () => {
    setRefreshing(true)
    haptics.impact('light')
    loadUsers(search)
  }

  const handleGrant = async (tariff: 'free' | 'premium', days: number | null) => {
    if (!selectedUser) return
    setGrantBusy(true)

    try {
      await api.grantAdminUserPremium(selectedUser.id, { tariff, days })
      playSound('win')
      haptics.notify('success')
      showToast(
        tariff === 'free'
          ? "Premium bekor qilindi"
          : days
          ? `${days} kunlik Premium berildi!`
          : "Umrbod Premium berildi!"
      )
      setSelectedUser(null)
      loadUsers(search)
    } catch {
      showToast("Amalni bajarishda xatolik")
    } finally {
      setGrantBusy(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header & Search */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-fg">Foydalanuvchilar</h2>
          <p className="text-xs text-muted">Jami {users.length} ta ko'rsatilmoqda</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2.5 rounded-2xl bg-surface border border-line text-muted hover:text-fg active:scale-95 transition-transform"
          title="Yangilash"
        >
          <RotateCw size={15} className={refreshing ? 'animate-spin text-duo-purple' : ''} />
        </button>
      </div>

      <div>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID, ism, username yoki telefon orqali qidirish..."
            className="w-full bg-card border border-line rounded-2xl pl-10 pr-4 py-3 text-xs font-semibold text-fg focus:outline-none focus:border-duo-purple transition-all"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="card-premium p-6 text-center border-duo-red/30 bg-duo-red/5">
          <AlertCircle size={28} className="mx-auto text-duo-red mb-2" />
          <p className="text-xs font-bold text-fg mb-1">{error}</p>
          <button
            onClick={() => loadUsers(search)}
            className="mt-3 btn-premium px-4 py-1.5 rounded-xl text-xs font-bold"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {/* Users List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted">
          <Loader2 size={24} className="animate-spin mb-2 text-duo-purple" />
          <p className="text-xs">Foydalanuvchilar yuklanmoqda...</p>
        </div>
      ) : users.length === 0 && !error ? (
        <div className="card-premium p-8 text-center">
          <User size={36} className="mx-auto text-muted/50 mb-2" />
          <p className="text-sm font-bold text-fg">Foydalanuvchi topilmadi</p>
          <p className="text-xs text-subtle mt-1">
            {search ? "Boshqa kalit so'z bilan qidiring" : "Bazaga hali foydalanuvchilar yozilmagan"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isPremium = u.tariff === 'premium' || (u.premiumUntil && new Date(u.premiumUntil) > new Date())
            return (
              <div key={u.id} className="card-premium p-4 rounded-2xl border border-line bg-card">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-surface border border-line flex items-center justify-center text-fg font-black text-sm flex-shrink-0">
                      {u.firstName?.[0] || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-fg truncate">
                          {u.firstName} {u.lastName || ''}
                        </span>
                        {u.isAdmin && (
                          <span title="Admin">
                            <Shield size={13} className="text-duo-yellow flex-shrink-0" />
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted truncate block font-mono">
                        {u.username ? `@${u.username}` : `ID: ${u.id}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {isPremium ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-duo-purple/15 text-duo-purple border border-duo-purple/30">
                        <Crown size={12} />
                        Premium
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-xl text-[10px] font-bold bg-surface border border-line text-muted">
                        Oddiy
                      </span>
                    )}
                  </div>
                </div>

                {/* Details info */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-line/60 my-2 text-[11px]">
                  <div>
                    <span className="text-muted block">Savollar:</span>
                    <span className="font-bold text-fg">{u.answered} ta</span>
                  </div>
                  <div>
                    <span className="text-muted block">To'g'ri:</span>
                    <span className="font-bold text-duo-green">{u.correct} ta</span>
                  </div>
                  <div>
                    <span className="text-muted block">Muddat:</span>
                    <span className="font-bold text-fg truncate block">
                      {u.premiumUntil ? new Date(u.premiumUntil).toLocaleDateString('uz-UZ') : isPremium ? 'Umrbod' : '—'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted">
                    {u.phone ? `📞 ${u.phone}` : `Ro'yxatdan: ${new Date(u.createdAt).toLocaleDateString('uz-UZ')}`}
                  </span>
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="btn-premium px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <Crown size={13} />
                    Premium boshqarish
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Grant Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-premiumIn">
          <div className="relative w-full max-w-sm rounded-3xl bg-surface border border-line p-6 shadow-2xl overflow-hidden">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-elevated border border-line flex items-center justify-center text-muted hover:text-fg"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-black text-fg mb-1 flex items-center gap-2">
              <Crown size={18} className="text-duo-purple" />
              Premium berish
            </h3>
            <p className="text-xs text-muted mb-4 truncate">
              Foydalanuvchi: <b className="text-fg">{selectedUser.firstName}</b> ({selectedUser.id})
            </p>

            {grantBusy ? (
              <div className="py-8 text-center text-muted">
                <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                <p className="text-xs">Bajarilmoqda...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleGrant('premium', 7)}
                  className="card-premium w-full p-3 rounded-2xl border text-left flex items-center justify-between text-xs font-bold hover:border-duo-purple transition-all"
                >
                  <span>👑 7 kunlik Premium</span>
                  <span className="text-muted text-[11px]">1 hafta</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrant('premium', 30)}
                  className="card-premium w-full p-3 rounded-2xl border text-left flex items-center justify-between text-xs font-bold hover:border-duo-purple transition-all"
                >
                  <span>👑 30 kunlik Premium</span>
                  <span className="text-muted text-[11px]">1 oy</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrant('premium', 90)}
                  className="card-premium w-full p-3 rounded-2xl border text-left flex items-center justify-between text-xs font-bold hover:border-duo-purple transition-all"
                >
                  <span>👑 90 kunlik Premium</span>
                  <span className="text-muted text-[11px]">3 oy</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrant('premium', 365)}
                  className="card-premium w-full p-3 rounded-2xl border text-left flex items-center justify-between text-xs font-bold hover:border-duo-purple transition-all"
                >
                  <span>👑 365 kunlik Premium</span>
                  <span className="text-muted text-[11px]">1 yil</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrant('premium', null)}
                  className="card-premium w-full p-3 rounded-2xl border text-left flex items-center justify-between text-xs font-bold border-duo-yellow/40 bg-duo-yellow/10 text-fg hover:border-duo-yellow transition-all"
                >
                  <span>⭐ Umrbod Premium (Lifetime)</span>
                  <span className="text-duo-yellow font-black text-[11px]">VIP</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrant('free', null)}
                  className="w-full p-3 rounded-2xl border border-duo-red/30 bg-duo-red/10 text-duo-red text-center text-xs font-bold hover:bg-duo-red/20 transition-all mt-2"
                >
                  Bekor qilish (Oddiy Free hisob)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 card-neon text-fg text-xs font-bold px-4 py-3 rounded-2xl text-center z-50 shadow-2xl animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  )
}
