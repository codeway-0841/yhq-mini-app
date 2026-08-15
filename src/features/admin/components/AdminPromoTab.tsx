import { useState, useEffect, useCallback } from 'react'
import { Plus, Ticket, Copy, Check, Trash2, Power, AlertCircle, Loader2, Sparkles, X, Calendar, Users } from 'lucide-react'
import { api, type AdminPromoCode } from '../../../shared/api'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'

export default function AdminPromoTab() {
  const [codes, setCodes] = useState<AdminPromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Form State
  const [newCode, setNewCode] = useState('')
  const [days, setDays] = useState(30)
  const [maxUses, setMaxUses] = useState<number | null>(null)
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadCodes = useCallback(async () => {
    try {
      const res = await api.getAdminPromoCodes()
      setCodes(res.codes)
    } catch {
      showToast("Promokodlarni yuklashda xatolik")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCodes()
  }, [loadCodes])

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    haptics.impact('light')
    showToast(`"${code}" nusxalandi!`)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleToggle = async (c: AdminPromoCode) => {
    try {
      await api.toggleAdminPromoCode(c.id, !c.isActive)
      setCodes((prev) => prev.map((item) => item.id === c.id ? { ...item, isActive: !item.isActive } : item))
      haptics.impact('medium')
      showToast(c.isActive ? 'Promokod to‘xtatildi' : 'Promokod faollashtirildi')
    } catch {
      showToast("O'zgartirishda xatolik")
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm("Rostdan ham bu promokodni o'chirmoqchimisiz?")) return
    try {
      await api.deleteAdminPromoCode(id)
      setCodes((prev) => prev.filter((item) => item.id !== id))
      playSound('click')
      showToast("Promokod o'chirildi")
    } catch {
      showToast("O'chirishda xatolik")
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newCode.trim().toUpperCase()
    if (!trimmed || trimmed.length < 3) {
      setFormError("Promokod kamida 3 ta belgidan iborat bo'lsin")
      return
    }

    setFormBusy(true)
    setFormError(null)

    try {
      const created = await api.createAdminPromoCode({
        code: trimmed,
        value: days,
        maxUses: maxUses || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      })

      setCodes((prev) => [created, ...prev])
      playSound('win')
      haptics.notify('success')
      showToast(`"${trimmed}" muvaffaqiyatli yaratildi!`)
      setCreating(false)
      setNewCode('')
      setDays(30)
      setMaxUses(null)
      setExpiresAt('')
    } catch (err: any) {
      setFormError(err.message || "Promokod yaratishda xatolik")
    } finally {
      setFormBusy(false)
    }
  }

  const generateRandomCode = () => {
    const prefixes = ['AVTO', 'KIWI', 'DRIVE', 'SUPER', 'BONUS']
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const num = Math.floor(100 + Math.random() * 900)
    setNewCode(`${prefix}${num}`)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-fg">Promokodlar boshqaruvi</h2>
          <p className="text-xs text-muted">Jami {codes.length} ta promokod mavjud</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="btn-premium flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-black"
        >
          <Plus size={15} />
          Yangi promokod
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted">
          <Loader2 size={24} className="animate-spin mb-2" />
          <p className="text-xs">Yuklanmoqda...</p>
        </div>
      ) : codes.length === 0 ? (
        <div className="card-premium p-8 text-center">
          <Ticket size={36} className="mx-auto text-muted/50 mb-2" />
          <p className="text-sm font-bold text-fg">Promokodlar hali mavjud emas</p>
          <p className="text-xs text-subtle mt-1 mb-4">Birinchi promokodni yarating</p>
          <button
            onClick={() => setCreating(true)}
            className="btn-premium px-4 py-2 rounded-xl text-xs font-bold"
          >
            Yaratish
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map((c) => {
            const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date()
            const isLimitFull = c.maxUses !== null && c.usedCount >= c.maxUses

            let statusBadge = (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-duo-green/15 text-duo-green border border-duo-green/30">
                Faol
              </span>
            )

            if (!c.isActive) {
              statusBadge = (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-muted/20 text-muted border border-line">
                  To'xtatilgan
                </span>
              )
            } else if (isExpired) {
              statusBadge = (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-duo-red/15 text-duo-red border border-duo-red/30">
                  Muddati o'tgan
                </span>
              )
            } else if (isLimitFull) {
              statusBadge = (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-duo-yellow/15 text-duo-yellow border border-duo-yellow/30">
                  Limit to'lgan
                </span>
              )
            }

            return (
              <div
                key={c.id}
                className={`card-premium p-4 rounded-2xl border transition-all ${
                  !c.isActive ? 'opacity-60 bg-surface/50' : 'bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-base text-fg tracking-wider bg-elevated px-2.5 py-1 rounded-xl border border-line">
                      {c.code}
                    </span>
                    <button
                      onClick={() => handleCopy(c.code)}
                      className="w-8 h-8 rounded-xl bg-surface border border-line flex items-center justify-center text-muted hover:text-fg active:scale-95 transition-transform"
                      title="Nusxalash"
                    >
                      {copiedCode === c.code ? <Check size={14} className="text-duo-green" /> : <Copy size={14} />}
                    </button>
                  </div>
                  {statusBadge}
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-line/60 my-2 text-[11px]">
                  <div>
                    <span className="text-muted block">Muddat:</span>
                    <span className="font-bold text-fg">👑 {c.value} kun</span>
                  </div>
                  <div>
                    <span className="text-muted block">Ishlatildi:</span>
                    <span className="font-bold text-fg">
                      {c.usedCount} / {c.maxUses === null ? '∞' : c.maxUses}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block">Tugash sanasi:</span>
                    <span className="font-bold text-fg">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('uz-UZ') : 'Cheksiz'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleToggle(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition-colors ${
                      c.isActive
                        ? 'border-line text-muted hover:text-fg'
                        : 'border-duo-green/40 text-duo-green bg-duo-green/10'
                    }`}
                  >
                    <Power size={13} />
                    {c.isActive ? "To'xtatish" : 'Faollashtirish'}
                  </button>

                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-1.5 rounded-xl border border-line text-muted hover:text-duo-red hover:border-duo-red/40 transition-colors"
                    title="O'chirish"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-premiumIn">
          <div className="relative w-full max-w-sm rounded-3xl bg-surface border border-line p-6 shadow-2xl overflow-hidden">
            <button
              onClick={() => setCreating(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-elevated border border-line flex items-center justify-center text-muted hover:text-fg"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-black text-fg mb-4 flex items-center gap-2">
              <Ticket size={18} className="text-duo-purple" />
              Yangi promokod yaratish
            </h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-fg">Promokod nomi</label>
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    className="text-[11px] font-bold text-duo-purple flex items-center gap-1 hover:underline"
                  >
                    <Sparkles size={11} /> Tasodifiy
                  </button>
                </div>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="Masalan: AVTO2026"
                  required
                  className="w-full bg-card border border-line rounded-2xl px-4 py-3 text-sm font-black tracking-wider text-fg uppercase focus:outline-none focus:border-duo-purple"
                />
              </div>

              {/* Kunlar presetlari */}
              <div>
                <label className="text-xs font-bold text-fg block mb-1.5">
                  Beriladigan muddat: <b className="text-duo-purple">{days} kun</b>
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[7, 15, 30, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        days === d
                          ? 'bg-duo-purple text-ponprimary border-duo-purple'
                          : 'bg-card border-line text-muted'
                      }`}
                    >
                      {d} kun
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDays(365)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      days === 365
                        ? 'bg-duo-purple text-ponprimary border-duo-purple'
                        : 'bg-card border-line text-muted'
                    }`}
                  >
                    1 yil (365 kun)
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    placeholder="Boshqa kun"
                    className="bg-card border border-line rounded-xl px-3 py-2 text-xs font-bold text-fg text-center focus:outline-none focus:border-duo-purple"
                  />
                </div>
              </div>

              {/* Ishlatish limiti */}
              <div>
                <label className="text-xs font-bold text-fg block mb-1.5 flex items-center gap-1">
                  <Users size={13} /> Ishlatish limiti (odam soni)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Cheksiz', val: null },
                    { label: '20 ta', val: 20 },
                    { label: '50 ta', val: 50 },
                    { label: '100 ta', val: 100 },
                  ].map((it, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMaxUses(it.val)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        maxUses === it.val
                          ? 'bg-duo-purple text-ponprimary border-duo-purple'
                          : 'bg-card border-line text-muted'
                      }`}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tugash sanasi */}
              <div>
                <label className="text-xs font-bold text-fg block mb-1.5 flex items-center gap-1">
                  <Calendar size={13} /> Amal qilish muddati (ixtiyoriy)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full bg-card border border-line rounded-xl px-3 py-2 text-xs font-bold text-fg focus:outline-none focus:border-duo-purple"
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-duo-red/10 border border-duo-red/30 text-duo-red text-xs">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={formBusy || newCode.trim().length < 3}
                className="btn-premium w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
              >
                {formBusy ? <Loader2 size={16} className="animate-spin" /> : "Promokod yaratish"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 card-neon text-fg text-xs font-bold px-4 py-3 rounded-2xl text-center z-50 shadow-2xl animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  )
}
