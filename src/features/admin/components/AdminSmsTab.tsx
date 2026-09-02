/**
 * SMS marketing kampaniyalari — admin tab.
 * FAQAT sms_opt_in berilgan userlarga yuboriladi (audience preview'da ko'rinadi).
 * Chunk'li dispatch: "Yuborish" → server har chaqiruvda 30 ta yuboradi,
 * UI remaining=0 bo'lguncha avtomatik davom ettiradi (progress bar bilan).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageSquare, Loader2, Send, Users, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { api, type AdminSmsCampaign } from '../../../shared/api'

const MAX_LEN = 300

export default function AdminSmsTab() {
  const [campaigns, setCampaigns] = useState<AdminSmsCampaign[]>([])
  const [audience, setAudience] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)

  /** dispatch holati: campaignId → yuborilmoqda/progress */
  const [sendingId, setSendingId] = useState<number | null>(null)
  const cancelRef = useRef(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    try {
      const [aud, list] = await Promise.all([api.getSmsAudience(), api.getSmsCampaigns()])
      setAudience(aud.optedIn)
      setCampaigns(list.campaigns)
    } catch {
      showToast("Ma'lumotlarni yuklashda xatolik")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => () => { cancelRef.current = true }, [])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await api.createSmsCampaign({ title, message })
      setCampaigns((prev) => [res.campaign, ...prev])
      setTitle('')
      setMessage('')
      showToast(`Kampaniya #${res.campaign.id} yaratildi (draft)`)
    } catch (err) {
      showToast(String((err as Error)?.message ?? 'Xatolik'))
    } finally {
      setCreating(false)
    }
  }

  /** Chunk'li yuborish — remaining=0 yoki xatogacha davom */
  const handleSend = async (id: number) => {
    setSendingId(id)
    cancelRef.current = false
    try {
      for (;;) {
        if (cancelRef.current) break
        const res = await api.sendSmsCampaignChunk(id)
        setCampaigns((prev) => prev.map((c) => (c.id === id ? res.campaign : c)))
        if (res.remaining <= 0 || res.status === 'sent') break
      }
      showToast('Yuborish yakunlandi')
    } catch (err) {
      showToast(`Yuborishda xatolik: ${String((err as Error)?.message ?? err)} — qayta bosib davom ettiring`)
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <div className="bg-psurface text-pfg text-xs font-semibold px-3 py-2 rounded-xl text-center shadow-xs">
          {toast}
        </div>
      )}

      {/* Compose */}
      <div className="rounded-2xl bg-pcard p-4 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare size={16} className="text-ppurple" /> Yangi kampaniya
          </p>
          <span className="text-[11px] text-pmuted flex items-center gap-1">
            <Users size={12} /> {audience ?? '…'} kishi (opt-in)
          </span>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nomi (masalan: Chegirma haftaligi)"
          maxLength={80}
          className="w-full bg-psurface rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ppurple shadow-xs"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={"SMS matni (min 10 belgi). Masalan: KIVVI'da bugun Premium 20% chegirma! To'xtatish: Profil → SMS sozlamasi"}
          maxLength={MAX_LEN}
          rows={4}
          className="w-full bg-psurface rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ppurple shadow-xs resize-none"
        />
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-semibold ${message.length > MAX_LEN - 30 ? 'text-pwarning' : 'text-pmuted'}`}>
            {message.length}/{MAX_LEN} belgi
          </span>
          <button
            onClick={handleCreate}
            disabled={creating || title.trim().length < 3 || message.trim().length < 10 || (audience ?? 0) === 0}
            className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,background-color,filter] duration-[120ms] flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-50 shadow-xs"
          >
            {creating ? <Loader2 size={14} className="motion-safe:animate-spin" /> : <Send size={14} />}
            Yaratish
          </button>
        </div>
        {audience === 0 && (
          <p className="text-[11px] text-pwarning font-semibold">
            Opt-in bergan foydalanuvchi yo'q — avval auditoriya to'planadi (Profil → SMS eslatmalar).
          </p>
        )}
      </div>

      {/* History */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="motion-safe:animate-spin text-pmuted" /></div>
      ) : campaigns.length === 0 ? (
        <p className="text-center text-pmuted text-xs py-4">Kampaniyalar yo'q</p>
      ) : (
        campaigns.map((c) => {
          const total = Math.max(c.targetCount, c.sentCount + c.failedCount)
          const pct = total > 0 ? Math.round(((c.sentCount + c.failedCount) / total) * 100) : 0
          const isSending = sendingId === c.id
          return (
            <div key={c.id} className="rounded-2xl bg-pcard p-4 flex flex-col gap-2 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">#{c.id} {c.title}</p>
                  <p className="text-[11px] text-pmuted line-clamp-2">{c.message}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>

              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="text-psuccess flex items-center gap-1"><CheckCircle2 size={12} /> {c.sentCount}</span>
                <span className="text-pdanger flex items-center gap-1"><XCircle size={12} /> {c.failedCount}</span>
                <span className="text-pmuted flex items-center gap-1"><Users size={12} /> {c.targetCount}</span>
              </div>

              {c.status !== 'sent' && (
                <>
                  <div className="h-1.5 bg-psurface rounded-full overflow-hidden">
                    <div className="h-full bg-ppurple rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <button
                    onClick={() => handleSend(c.id)}
                    disabled={isSending}
                    className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,background-color,filter] duration-[120ms] flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-50 shadow-xs"
                  >
                    {isSending
                      ? <><Loader2 size={14} className="motion-safe:animate-spin" /> Yuborilmoqda…
                          {total > 0 && ` ${pct}%`}
                        </>
                      : <><Send size={14} /> {c.status === 'draft' ? 'Yuborish' : 'Davom ettirish'}</>}
                  </button>
                </>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: AdminSmsCampaign['status'] }) {
  if (status === 'sent') {
    return <span className="text-[10px] font-semibold text-psuccess bg-psuccess/10 border border-psuccess/30 px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> Yuborildi</span>
  }
  if (status === 'sending') {
    return <span className="text-[10px] font-semibold text-pwarning bg-pwarning/10 border border-pwarning/30 px-2 py-1 rounded-full flex items-center gap-1"><Clock size={10} /> Yuborilmoqda</span>
  }
  return <span className="text-[10px] font-semibold text-pmuted bg-psurface px-2.5 py-1 rounded-full shadow-2xs">Draft</span>
}
