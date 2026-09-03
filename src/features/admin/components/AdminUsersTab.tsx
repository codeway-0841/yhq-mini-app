import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, User, Shield, Loader2, X, RotateCw, AlertCircle, Phone } from 'lucide-react'
import { PremiumIcon } from '../../../shared/components/PremiumIcon'
import { api, type AdminUserItem } from '../../../shared/api'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import DialogOverlay from '../../../shared/components/DialogOverlay'

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
          <h2 className="text-base font-semibold text-pfg">Foydalanuvchilar</h2>
          <p className="text-xs text-pmuted">Jami {users.length} ta ko'rsatilmoqda</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2.5 rounded-2xl bg-psurface text-pmuted hover:text-pfg active:scale-95 transition-transform shadow-xs"
          title="Yangilash"
        >
          <RotateCw size={15} className={refreshing ? 'motion-safe:animate-spin text-ppurple' : ''} />
        </button>
      </div>

      <div>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pmuted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID, ism, username yoki telefon orqali qidirish..."
            className="w-full bg-card border border-pline rounded-2xl pl-10 pr-4 py-3 text-xs font-semibold text-pfg focus:outline-none focus:border-ppurple transition-all"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl p-6 text-center border border-pdanger/30 bg-pdanger/5 shadow-xs">
          <AlertCircle size={28} className="mx-auto text-pdanger mb-2" />
          <p className="text-xs font-semibold text-pfg mb-1">{error}</p>
          <button
            onClick={() => loadUsers(search)}
            className="mt-3 bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 px-4 py-1.5 rounded-xl text-xs font-semibold"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {/* Users List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-pmuted">
          <Loader2 size={24} className="motion-safe:animate-spin mb-2 text-ppurple" />
          <p className="text-xs">Foydalanuvchilar yuklanmoqda...</p>
        </div>
      ) : users.length === 0 && !error ? (
        <div className="rounded-2xl bg-pcard p-8 text-center shadow-xs">
          <User size={36} className="mx-auto text-pmuted/50 mb-2" />
          <p className="text-sm font-semibold text-pfg">Foydalanuvchi topilmadi</p>
          <p className="text-xs text-psubtle mt-1">
            {search ? "Boshqa kalit so'z bilan qidiring" : "Bazaga hali foydalanuvchilar yozilmagan"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isPremium = u.tariff === 'premium' || (u.premiumUntil && new Date(u.premiumUntil) > new Date())
            return (
              <div key={u.id} className="rounded-2xl bg-pcard p-4 shadow-xs">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-psurface flex items-center justify-center text-pfg font-semibold text-sm flex-shrink-0 shadow-xs">
                      {u.firstName?.[0] || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-pfg truncate">
                          {u.firstName} {u.lastName || ''}
                        </span>
                        {u.isAdmin && (
                          <span title="Admin">
                            <Shield size={13} className="text-pwarning flex-shrink-0" />
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-pmuted truncate block font-mono">
                        {u.username ? `@${u.username}` : `ID: ${u.id}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {isPremium ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold bg-ppurple/15 text-ppurple border border-ppurple/30">
                        <PremiumIcon size={12} />
                        Premium
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-xl text-[10px] font-semibold bg-psurface text-pmuted shadow-2xs">
                        Oddiy
                      </span>
                    )}
                  </div>
                </div>

                {/* Details info */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-pline my-2 text-[11px]">
                  <div>
                    <span className="text-pmuted block">Savollar:</span>
                    <span className="font-semibold text-pfg">{u.answered} ta</span>
                  </div>
                  <div>
                    <span className="text-pmuted block">To'g'ri:</span>
                    <span className="font-semibold text-pprimary">{u.correct} ta</span>
                  </div>
                  <div>
                    <span className="text-pmuted block">Muddat:</span>
                    <span className="font-semibold text-pfg truncate block">
                      {u.premiumUntil ? new Date(u.premiumUntil).toLocaleDateString('uz-UZ') : isPremium ? 'Umrbod' : '—'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-pmuted flex items-center gap-1">
                    {u.phone
                      ? <><Phone size={10} strokeWidth={1.75} /> {u.phone}</>
                      : `Ro'yxatdan: ${new Date(u.createdAt).toLocaleDateString('uz-UZ')}`}
                  </span>
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1"
                  >
                    <PremiumIcon size={13} />
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
        <DialogOverlay onClose={() => setSelectedUser(null)} position="center" labelId="grant-premium-title" className="animate-premiumIn" backdropClassName="bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-sm rounded-3xl bg-pcard p-6 shadow-2xl overflow-hidden">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-psurface shadow-xs flex items-center justify-center text-pmuted hover:text-pfg"
            >
              <X size={16} />
            </button>

            <h3 id="grant-premium-title" className="text-base font-semibold text-pfg mb-1 flex items-center gap-2">
              <PremiumIcon size={18} className="text-ppurple" />
              Premium berish
            </h3>
            <p className="text-xs text-pmuted mb-4 truncate">
              Foydalanuvchi: <b className="text-pfg">{selectedUser.firstName}</b> ({selectedUser.id})
            </p>

            {grantBusy ? (
              <div className="py-8 text-center text-pmuted">
                <Loader2 size={24} className="motion-safe:animate-spin mx-auto mb-2" />
                <p className="text-xs">Bajarilmoqda...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleGrant('premium', 7)}
                  className="rounded-2xl bg-pcard w-full p-3 text-left flex items-center justify-between text-xs font-semibold hover:bg-psurface transition-all shadow-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <PremiumIcon size={13} className="text-ppurple" />
                    7 kunlik Premium
                  </span>
                  <span className="text-pmuted text-[11px]">1 hafta</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrant('premium', 30)}
                  className="rounded-2xl bg-pcard w-full p-3 text-left flex items-center justify-between text-xs font-semibold hover:bg-psurface transition-all shadow-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <PremiumIcon size={13} className="text-ppurple" />
                    30 kunlik Premium
                  </span>
                  <span className="text-pmuted text-[11px]">1 oy</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrant('premium', 90)}
                  className="rounded-2xl bg-pcard w-full p-3 text-left flex items-center justify-between text-xs font-semibold hover:bg-psurface transition-all shadow-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <PremiumIcon size={13} className="text-ppurple" />
                    90 kunlik Premium
                  </span>
                  <span className="text-pmuted text-[11px]">3 oy</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrant('premium', 365)}
                  className="rounded-2xl bg-pcard w-full p-3 text-left flex items-center justify-between text-xs font-semibold hover:bg-psurface transition-all shadow-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <PremiumIcon size={13} className="text-ppurple" />
                    365 kunlik Premium
                  </span>
                  <span className="text-pmuted text-[11px]">1 yil</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrant('premium', null)}
                  className="rounded-2xl bg-pwarning/10 w-full p-3 text-left flex items-center justify-between text-xs font-semibold border border-pwarning/40 text-pfg hover:bg-pwarning/15 transition-all shadow-xs"
                >
                  <span>⭐ Umrbod Premium (Lifetime)</span>
                  <span className="text-pwarning font-semibold text-[11px]">VIP</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrant('free', null)}
                  className="w-full p-3 rounded-2xl border border-pdanger/30 bg-pdanger/10 text-pdanger text-center text-xs font-semibold hover:bg-pdanger/20 transition-all mt-2"
                >
                  Bekor qilish (Oddiy Free hisob)
                </button>
              </div>
            )}
          </div>
        </DialogOverlay>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-[calc(1.5rem+var(--safe-bottom,0px))] left-4 right-4 rounded-2xl bg-pcard text-pfg text-xs font-semibold px-4 py-3 text-center z-50 shadow-2xl animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  )
}
