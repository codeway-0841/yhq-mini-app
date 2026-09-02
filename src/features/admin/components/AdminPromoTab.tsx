import { useState, useEffect, useCallback } from 'react'
import { Plus, Ticket, Copy, Check, Trash2, Power, AlertCircle, Loader2, Sparkles, X, Calendar, Users, Percent } from 'lucide-react'
import { PremiumIcon } from '../../../shared/components/PremiumIcon'
import { api, type AdminPromoCode } from '../../../shared/api'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import DialogOverlay from '../../../shared/components/DialogOverlay'

export default function AdminPromoTab() {
  const [codes, setCodes] = useState<AdminPromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Form State
  const [newCode, setNewCode] = useState('')
  const [promoType, setPromoType] = useState<'premium_days' | 'discount_percent'>('premium_days')
  const [days, setDays] = useState(30)
  const [percent, setPercent] = useState(25)
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

    if (promoType === 'discount_percent' && (percent < 1 || percent > 99)) {
      setFormError("Chegirma 1 dan 99 gacha bo'lsin")
      return
    }

    setFormBusy(true)
    setFormError(null)

    try {
      const created = await api.createAdminPromoCode({
        code: trimmed,
        type: promoType,
        value: promoType === 'discount_percent' ? percent : days,
        maxUses: maxUses || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      })

      setCodes((prev) => [created, ...prev])
      playSound('win')
      haptics.notify('success')
      showToast(`"${trimmed}" muvaffaqiyatli yaratildi!`)
      setCreating(false)
      setNewCode('')
      setPromoType('premium_days')
      setDays(30)
      setPercent(25)
      setMaxUses(null)
      setExpiresAt('')
    } catch (err: any) {
      setFormError(err.message || "Promokod yaratishda xatolik")
    } finally {
      setFormBusy(false)
    }
  }

  const generateRandomCode = () => {
    const prefixes = ['AVTO', 'KIVVI', 'DRIVE', 'SUPER', 'BONUS']
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const num = Math.floor(100 + Math.random() * 900)
    setNewCode(`${prefix}${num}`)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-pfg">Promokodlar boshqaruvi</h2>
          <p className="text-xs text-pmuted">Jami {codes.length} ta promokod mavjud</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-semibold"
        >
          <Plus size={15} />
          Yangi promokod
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-pmuted">
          <Loader2 size={24} className="motion-safe:animate-spin mb-2" />
          <p className="text-xs">Yuklanmoqda...</p>
        </div>
      ) : codes.length === 0 ? (
        <div className="rounded-2xl border border-pline bg-pcard p-8 text-center">
          <Ticket size={36} className="mx-auto text-pmuted/50 mb-2" />
          <p className="text-sm font-semibold text-pfg">Promokodlar hali mavjud emas</p>
          <p className="text-xs text-psubtle mt-1 mb-4">Birinchi promokodni yarating</p>
          <button
            onClick={() => setCreating(true)}
            className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 px-4 py-2 rounded-xl text-xs font-semibold"
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
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pprimary/15 text-pprimary border border-pprimary/30">
                Faol
              </span>
            )

            if (!c.isActive) {
              statusBadge = (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted/20 text-pmuted border border-pline">
                  To'xtatilgan
                </span>
              )
            } else if (isExpired) {
              statusBadge = (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pdanger/15 text-pdanger border border-pdanger/30">
                  Muddati o'tgan
                </span>
              )
            } else if (isLimitFull) {
              statusBadge = (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pwarning/15 text-pwarning border border-pwarning/30">
                  Limit to'lgan
                </span>
              )
            }

            return (
              <div
                key={c.id}
                className={`rounded-2xl border border-pline bg-pcard p-4 rounded-2xl border transition-all ${
                  !c.isActive ? 'opacity-60 bg-psurface/50' : 'bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-base text-pfg tracking-wider bg-psurface px-2.5 py-1 rounded-xl border border-pline">
                      {c.code}
                    </span>
                    <button
                      onClick={() => handleCopy(c.code)}
                      className="w-8 h-8 rounded-xl bg-psurface border border-pline flex items-center justify-center text-pmuted hover:text-pfg active:scale-95 transition-transform"
                      title="Nusxalash"
                    >
                      {copiedCode === c.code ? <Check size={14} className="text-pprimary" /> : <Copy size={14} />}
                    </button>
                  </div>
                  {statusBadge}
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-pline my-2 text-[11px]">
                  <div>
                    <span className="text-pmuted block">
                      {c.type === 'discount_percent' ? 'Chegirma:' : 'Muddat:'}
                    </span>
                    <span className="font-semibold text-pfg flex items-center gap-1">
                      {c.type === 'discount_percent' ? (
                        <>
                          <Percent size={11} strokeWidth={1.75} className="text-ppurple" /> {c.value}% chegirma
                        </>
                      ) : (
                        <>
                          <PremiumIcon size={12} className="text-pgold" /> {c.value} kun
                        </>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-pmuted block">Ishlatildi:</span>
                    <span className="font-semibold text-pfg">
                      {c.usedCount} / {c.maxUses === null ? '∞' : c.maxUses}
                    </span>
                  </div>
                  <div>
                    <span className="text-pmuted block">Tugash sanasi:</span>
                    <span className="font-semibold text-pfg">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('uz-UZ') : 'Cheksiz'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleToggle(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-colors ${
                      c.isActive
                        ? 'border-pline text-pmuted hover:text-pfg'
                        : 'border-pprimary/40 text-pprimary bg-pprimary/10'
                    }`}
                  >
                    <Power size={13} />
                    {c.isActive ? "To'xtatish" : 'Faollashtirish'}
                  </button>

                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-1.5 rounded-xl border border-pline text-pmuted hover:text-pdanger hover:border-pdanger/40 transition-colors"
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
        <DialogOverlay onClose={() => setCreating(false)} position="center" labelId="promo-create-title" className="animate-premiumIn" backdropClassName="bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-sm rounded-2xl bg-psurface border border-pline p-6 shadow-2xl overflow-hidden">
            <button
              onClick={() => setCreating(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-psurface border border-pline flex items-center justify-center text-pmuted hover:text-pfg"
            >
              <X size={16} />
            </button>

            <h3 id="promo-create-title" className="text-base font-semibold text-pfg mb-4 flex items-center gap-2">
              <Ticket size={18} className="text-ppurple" />
              Yangi promokod yaratish
            </h3>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Promokod turi */}
              <div>
                <label className="text-xs font-semibold text-pfg block mb-1.5">Promokod turi</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPromoType('premium_days')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      promoType === 'premium_days'
                        ? 'bg-ppurple text-ponprimary border-ppurple'
                        : 'bg-card border-pline text-pmuted'
                    }`}
                  >
                    <PremiumIcon size={14} /> Premium kun
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromoType('discount_percent')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      promoType === 'discount_percent'
                        ? 'bg-ppurple text-ponprimary border-ppurple'
                        : 'bg-card border-pline text-pmuted'
                    }`}
                  >
                    <Percent size={13} /> Chegirma (to'lov)
                  </button>
                </div>
                {promoType === 'discount_percent' && (
                  <p className="text-[11px] text-pmuted mt-1.5">
                    Bu kod tarif sotib olishda (Click/Payme) narxni tushiradi — ishlatilishi to'lov yakunlanganda hisoblanadi.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-pfg">Promokod nomi</label>
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    className="text-[11px] font-semibold text-ppurple flex items-center gap-1 hover:underline"
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
                  className="w-full bg-card border border-pline rounded-2xl px-4 py-3 text-sm font-semibold tracking-wider text-pfg uppercase focus:outline-none focus:border-ppurple"
                />
              </div>

              {promoType === 'discount_percent' ? (
                /* Chegirma foizi presetlari */
                <div>
                  <label className="text-xs font-semibold text-pfg block mb-1.5">
                    Chegirma miqdori: <b className="text-ppurple">{percent}%</b>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[10, 15, 25, 50].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPercent(p)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                          percent === p
                            ? 'bg-ppurple text-ponprimary border-ppurple'
                            : 'bg-card border-pline text-pmuted'
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={percent}
                    onChange={(e) => setPercent(Number(e.target.value))}
                    placeholder="Boshqa foiz (1-99)"
                    className="w-full bg-card border border-pline rounded-xl px-3 py-2 text-xs font-semibold text-pfg text-center focus:outline-none focus:border-ppurple"
                  />
                </div>
              ) : (
                /* Kunlar presetlari */
                <div>
                  <label className="text-xs font-semibold text-pfg block mb-1.5">
                    Beriladigan muddat: <b className="text-ppurple">{days} kun</b>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[7, 15, 30, 90].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDays(d)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                          days === d
                            ? 'bg-ppurple text-ponprimary border-ppurple'
                            : 'bg-card border-pline text-pmuted'
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
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        days === 365
                          ? 'bg-ppurple text-ponprimary border-ppurple'
                          : 'bg-card border-pline text-pmuted'
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
                      className="bg-card border border-pline rounded-xl px-3 py-2 text-xs font-semibold text-pfg text-center focus:outline-none focus:border-ppurple"
                    />
                  </div>
                </div>
              )}

              {/* Ishlatish limiti */}
              <div>
                <label className="text-xs font-semibold text-pfg block mb-1.5 flex items-center gap-1">
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
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        maxUses === it.val
                          ? 'bg-ppurple text-ponprimary border-ppurple'
                          : 'bg-card border-pline text-pmuted'
                      }`}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tugash sanasi */}
              <div>
                <label className="text-xs font-semibold text-pfg block mb-1.5 flex items-center gap-1">
                  <Calendar size={13} /> Amal qilish muddati (ixtiyoriy)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full bg-card border border-pline rounded-xl px-3 py-2 text-xs font-semibold text-pfg focus:outline-none focus:border-ppurple"
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-pdanger/10 border border-pdanger/30 text-pdanger text-xs">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={formBusy || newCode.trim().length < 3}
                className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2"
              >
                {formBusy ? <Loader2 size={16} className="motion-safe:animate-spin" /> : "Promokod yaratish"}
              </button>
            </form>
          </div>
        </DialogOverlay>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-[calc(1.5rem+var(--safe-bottom,0px))] left-4 right-4 rounded-2xl border border-pline bg-pcard text-pfg text-xs font-semibold px-4 py-3 rounded-2xl text-center z-50 shadow-2xl animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  )
}
