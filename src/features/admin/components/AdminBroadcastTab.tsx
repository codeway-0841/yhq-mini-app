import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Send,
  Image as ImageIcon,
  Link,
  CheckCircle2,
  Loader2,
  Eye,
  Bot,
  ExternalLink,
  Check,
  Flame,
  Gift,
  Zap,
  Upload,
  Trash2,
  RotateCw,
} from 'lucide-react'
import { api } from '../../../shared/api'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import Confetti from '../../../shared/components/Confetti'

interface AdminBroadcastTabProps {
  lang: 'uz' | 'ru'
  currentUserId?: string
}

type BroadcastTarget = 'all' | 'free' | 'premium' | 'inactive_7d' | 'active_today'

const TARGET_LABELS: Record<BroadcastTarget, { title: string; desc: string; icon: string }> = {
  all: {
    title: 'Barcha foydalanuvchilar',
    desc: 'Barcha Telegram obunachilariga',
    icon: '👥',
  },
  free: {
    title: 'Faqat Bepul (Free)',
    desc: 'Aksiya va Premium taklif qilish uchun',
    icon: '🆓',
  },
  premium: {
    title: 'Faqat Premium',
    desc: 'Eksklyuziv yangiliklar va minnatdorchilik',
    icon: '👑',
  },
  inactive_7d: {
    title: 'Nofaollar (7+ kun)',
    desc: '7 kundan beri kirmagan o\'quvchilarni qaytarish',
    icon: '😴',
  },
  active_today: {
    title: 'Bugun faol bo\'lganlar',
    desc: 'Bugun ilovada test yechgan o\'quvchilarga',
    icon: '⚡',
  },
}

const TEMPLATES = [
  {
    title: '🎟 Aksiya & Promokod',
    icon: <Gift size={14} className="text-duo-purple" />,
    text:
      "🎁 KATTA AKSIYA!\n\n" +
      "Barcha yangi va faol o'quvchilarimiz uchun maxsus 7 kunlik bepul Premium taqdim etamiz!\n\n" +
      "🎟 Promokod: KIWI2026\n\n" +
      "Profil bo'limiga kiring va promokodni faollashtirib, barcha imtihonlarni bepul yeching! ⚡",
    btnText: '🎟 Promokodni kiritish',
  },
  {
    title: '⚡ Yangi Fanlar',
    icon: <Zap size={14} className="text-duo-gold" />,
    text:
      "🚀 ILovada yangi fanlar bazasi qo'shildi!\n\n" +
      "Endi siz nafaqat YHQ, balki Matematika, Fizika, Rus tili, Kimyo, Tarix va Biologiya fanlaridan ham testlarni yechishingiz mumkin!\n\n" +
      "Bilimingizni sinab ko'ring va ligada 1-o'ringa chiqing! 🏆",
    btnText: '📚 Fanlarni tanlash',
  },
  {
    title: '🔥 Intizom Eslatmasi',
    icon: <Flame size={14} className="text-duo-orange" />,
    text:
      "🔥 Seriyangizni yo'qotmang!\n\n" +
      "Bugungi kunlik mashg'ulotni bajarishni unutmadingizmi? 2 daqiqalik test — intizom va yuqori natija kaliti!\n\n" +
      "Hozir kiring va 5 ta savolga javob bering! 🎯",
    btnText: '🔥 Mashqni boshlash',
  },
]

const EMOJIS = ['🔥', '⭐', '🚀', '🎟️', '📚', '⚡', '👑', '🎁', '🏆', '🎯', '💡', '✅']

export default function AdminBroadcastTab({ lang: _lang, currentUserId }: AdminBroadcastTabProps) {
  const [target, setTarget] = useState<BroadcastTarget>('all')
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageFileName, setImageFileName] = useState<string | null>(null)
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload')
  const [buttonText, setButtonText] = useState('📱 Ilovani ochish')
  const [buttonUrl, setButtonUrl] = useState('')
  const [testTgId, setTestTgId] = useState(currentUserId && /^\d+$/.test(currentUserId) ? currentUserId : '')
  const [targetCount, setTargetCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [result, setResult] = useState<{
    total: number
    sent: number
    blocked: number
    failed: number
    durationMs: number
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Image File Processing & Canvas Compression ───────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImageFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const rawDataUrl = String(evt.target?.result || '')
      const img = new Image()
      img.onload = () => {
        // Resize image to max 1280px to optimize size
        const maxDim = 1280
        let width = img.width
        let height = img.height
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const compressed = canvas.toDataURL('image/jpeg', 0.85)
          setImageData(compressed)
        } else {
          setImageData(rawDataUrl)
        }
        haptics.impact('light')
      }
      img.src = rawDataUrl
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImageData(null)
    setImageFileName(null)
    setImageUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    haptics.impact('light')
  }

  // ── Load Target Count on selection ─────────────────────────────────────────
  const loadCount = useCallback(async (selectedTarget: BroadcastTarget) => {
    setCountLoading(true)
    try {
      const res = await api.getBroadcastPreviewCount(selectedTarget)
      setTargetCount(res.count)
    } catch {
      setTargetCount(null)
    } finally {
      setCountLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCount(target)
  }, [loadCount, target])

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji)
    haptics.impact('light')
  }

  const applyTemplate = (tpl: (typeof TEMPLATES)[0]) => {
    setText(tpl.text)
    setButtonText(tpl.btnText)
    haptics.impact('medium')
  }

  // ── Send Test Message ──────────────────────────────────────────────────────
  const handleSendTest = async () => {
    if (!text.trim()) {
      alert('Xabar matnini kiriting')
      return
    }
    if (!testTgId.trim() || !/^\d+$/.test(testTgId.trim())) {
      alert("Telegram ID raqamingizni to'g'ri kiriting")
      return
    }

    setSending(true)
    try {
      const res = await api.sendBroadcast({
        target,
        text: text.trim(),
        imageUrl: imageMode === 'url' ? imageUrl.trim() || null : null,
        imageData: imageMode === 'upload' ? imageData : null,
        buttonText: buttonText.trim() || null,
        buttonUrl: buttonUrl.trim() || null,
        testTelegramId: testTgId.trim(),
      })

      if (res.sent > 0) {
        playSound('win')
        haptics.notify('success')
        alert(`✅ Test xabar Telegram ID (${testTgId}) ga muvaffaqiyatli yuborildi!`)
      } else {
        alert(`❌ Xabar yuborilmadi. Sabab: Bot bloklangan yoki chat topilmadi.`)
      }
    } catch (err: any) {
      alert(err?.message || 'Xatolik yuz berdi')
    } finally {
      setSending(false)
    }
  }

  // ── Send Broadcast to Audience ─────────────────────────────────────────────
  const handleSendAll = async () => {
    if (!text.trim()) {
      alert('Xabar matnini kiriting')
      return
    }

    setSending(true)
    setConfirmOpen(false)
    try {
      const res = await api.sendBroadcast({
        target,
        text: text.trim(),
        imageUrl: imageMode === 'url' ? imageUrl.trim() || null : null,
        imageData: imageMode === 'upload' ? imageData : null,
        buttonText: buttonText.trim() || null,
        buttonUrl: buttonUrl.trim() || null,
      })

      setResult(res)
      if (res.sent > 0) {
        playSound('win')
        haptics.notify('success')
        setConfetti(true)
        setTimeout(() => setConfetti(false), 5000)
      }
    } catch (err: any) {
      alert(err?.message || 'Ommaviy xabar yuborishda xatolik yuz berdi')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 space-y-5">
      {confetti && <Confetti />}

      {/* Header */}
      <div>
        <h2 className="text-base font-black text-fg flex items-center gap-2">
          <Send size={18} className="text-duo-purple" />
          <span>Telegram Ommaviy Xabarnoma (Broadcast)</span>
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Bot obunachilariga e'lonlar, aksiyalar va eslatmalar yuborish
        </p>
      </div>

      {/* Audience Selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-fg flex items-center justify-between">
          <span>🎯 Qabul qiluvchi auditoriya:</span>
          <span className="text-[11px] font-black text-duo-purple">
            {countLoading ? (
              <Loader2 size={12} className="animate-spin inline" />
            ) : targetCount !== null ? (
              `~${targetCount} ta obunachi`
            ) : (
              '——'
            )}
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(TARGET_LABELS) as BroadcastTarget[]).map((key) => {
            const item = TARGET_LABELS[key]
            const isSelected = target === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTarget(key)
                  haptics.impact('light')
                }}
                className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-duo-purple/15 border-duo-purple shadow-sm'
                    : 'bg-surface border-line hover:border-duo-purple/40 text-muted'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black ${isSelected ? 'text-fg' : 'text-fg/80'}`}>
                    {item.title}
                  </p>
                  <p className="text-[10px] text-muted truncate mt-0.5">{item.desc}</p>
                </div>
                {isSelected && <Check size={14} className="text-duo-purple flex-shrink-0 mt-0.5" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Template Presets */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-muted block">💡 Tayyor andozalar:</label>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {TEMPLATES.map((tpl, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="px-3 py-1.5 rounded-xl bg-surface border border-line text-xs font-bold text-fg hover:border-duo-purple flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-all flex-shrink-0"
            >
              {tpl.icon}
              <span>{tpl.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Message Form & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Input Form */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-fg">Xabar matni (Markdown)</label>
              <span className="text-[10px] text-muted">{text.length} / 4000</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Xabar matnini kiriting (masalan: 🎁 Katta aksiya boshlandi!)..."
              className="w-full bg-card border border-line rounded-2xl p-3 text-xs text-fg focus:outline-none focus:border-duo-purple transition-all"
            />
            {/* Emoji Toolbar */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => insertEmoji(em)}
                  className="px-2 py-1 rounded-lg bg-surface border border-line text-xs hover:scale-110 active:scale-95 transition-all"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Image Upload / URL Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-fg flex items-center gap-1.5">
                <ImageIcon size={14} className="text-duo-blue" />
                <span>Rasm (ixtiyoriy)</span>
              </label>
              <div className="flex items-center gap-1 bg-elevated p-0.5 rounded-xl border border-line text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setImageMode('upload')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    imageMode === 'upload' ? 'bg-duo-purple text-ponprimary shadow-xs' : 'text-muted hover:text-fg'
                  }`}
                >
                  Fayl yuklash
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode('url')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    imageMode === 'url' ? 'bg-duo-purple text-ponprimary shadow-xs' : 'text-muted hover:text-fg'
                  }`}
                >
                  URL manzil
                </button>
              </div>
            </div>

            {imageMode === 'upload' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {imageData ? (
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-surface border border-duo-purple/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={imageData}
                        alt="Selected preview"
                        className="w-12 h-12 rounded-xl object-cover border border-line flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-fg truncate">
                          {imageFileName || 'Tanlangan rasm'}
                        </p>
                        <span className="text-[10px] text-duo-green font-bold flex items-center gap-1 mt-0.5">
                          <CheckCircle2 size={11} /> Tayyor
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-xl bg-elevated border border-line text-muted hover:text-fg active:scale-95 transition-all"
                        title="Boshqa rasm tanlash"
                      >
                        <RotateCw size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="p-2 rounded-xl bg-duo-red/10 border border-duo-red/30 text-duo-red hover:bg-duo-red/20 active:scale-95 transition-all"
                        title="O'chirish"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-line hover:border-duo-purple/60 rounded-2xl p-4 text-center cursor-pointer bg-card transition-all active:scale-[0.99] flex flex-col items-center justify-center gap-1"
                  >
                    <Upload size={20} className="text-duo-purple" />
                    <p className="text-xs font-bold text-fg">Rasmni yuklash uchun bosing</p>
                    <p className="text-[10px] text-muted">JPG, PNG yoki WEBP formatlari</p>
                  </div>
                )}
              </div>
            ) : (
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/banner.jpg"
                className="w-full bg-card border border-line rounded-xl px-3 py-2 text-xs text-fg focus:outline-none focus:border-duo-purple transition-all"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-fg flex items-center gap-1 mb-1">
                <span>Tugma nomi</span>
              </label>
              <input
                type="text"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder="📱 Ilovani ochish"
                className="w-full bg-card border border-line rounded-xl px-3 py-2 text-xs text-fg focus:outline-none focus:border-duo-purple transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-fg flex items-center gap-1 mb-1">
                <Link size={13} className="text-muted" />
                <span>Tugma havolasi</span>
              </label>
              <input
                type="url"
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
                placeholder="Bo'sh qolsa ilova ochiladi"
                className="w-full bg-card border border-line rounded-xl px-3 py-2 text-xs text-fg focus:outline-none focus:border-duo-purple transition-all"
              />
            </div>
          </div>

          {/* Test Send Input */}
          <div className="p-3 rounded-2xl bg-surface border border-line space-y-2">
            <label className="text-[11px] font-bold text-muted block">
              🧪 Avval o'zingizga test qilib yuboring:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testTgId}
                onChange={(e) => setTestTgId(e.target.value)}
                placeholder="Telegram ID raqamingiz (masalan: 123456789)"
                className="flex-1 bg-card border border-line rounded-xl px-3 py-2 text-xs text-fg font-mono focus:outline-none focus:border-duo-purple transition-all"
              />
              <button
                type="button"
                disabled={sending || !text.trim() || !testTgId.trim()}
                onClick={handleSendTest}
                className="px-3 py-2 rounded-xl bg-elevated border border-line text-xs font-bold text-fg hover:border-duo-purple active:scale-95 disabled:opacity-40 transition-all whitespace-nowrap flex items-center gap-1"
              >
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Test</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Telegram Mockup Preview */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted flex items-center gap-1.5">
            <Eye size={14} className="text-duo-purple" />
            <span>Telegram'dagi ko'rinishi (Jonli Preview):</span>
          </label>

          <div className="rounded-3xl bg-[#0f172a] border border-line p-4 shadow-xl">
            {/* Telegram Chat Message Bubble */}
            <div className="max-w-[320px] mx-auto bg-[#1e293b] rounded-2xl overflow-hidden border border-white/5 shadow-md">
              {/* Optional Photo (uploaded file or URL) */}
              {imageData || imageUrl ? (
                <div className="w-full h-36 bg-black/40 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={imageData || imageUrl}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                </div>
              ) : null}

              {/* Message Content */}
              <div className="p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold text-duo-blue">
                  <Bot size={13} />
                  <span>KIWI Bot</span>
                </div>
                <p className="text-xs text-white/90 whitespace-pre-wrap leading-relaxed">
                  {text || "Xabar matni kiritilmagan..."}
                </p>
                <span className="text-[9px] text-white/40 block text-right">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Inline CTA Button */}
              {buttonText ? (
                <div className="p-2 pt-0">
                  <div className="w-full py-2.5 rounded-xl bg-duo-purple/20 hover:bg-duo-purple/30 border border-duo-purple/40 text-duo-purple font-black text-xs text-center flex items-center justify-center gap-1.5 shadow-sm">
                    <span>{buttonText}</span>
                    <ExternalLink size={12} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Execution Results Summary */}
      {result && (
        <div className="p-4 rounded-2xl bg-surface border border-line space-y-2 animate-premiumIn">
          <h4 className="text-xs font-black text-fg flex items-center gap-2">
            <CheckCircle2 size={16} className="text-duo-green" />
            <span>Xabarnoma yuborildi!</span>
          </h4>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-card border border-line">
              <span className="text-[10px] text-muted block">Jami</span>
              <span className="font-black text-fg">{result.total}</span>
            </div>
            <div className="p-2 rounded-xl bg-duo-green/10 border border-duo-green/30">
              <span className="text-[10px] text-duo-green block">Yetib bordi</span>
              <span className="font-black text-duo-green">{result.sent}</span>
            </div>
            <div className="p-2 rounded-xl bg-duo-red/10 border border-duo-red/30">
              <span className="text-[10px] text-duo-red block">Bloklangan</span>
              <span className="font-black text-duo-red">{result.blocked}</span>
            </div>
            <div className="p-2 rounded-xl bg-card border border-line">
              <span className="text-[10px] text-muted block">Vaqt</span>
              <span className="font-black text-fg">{(result.durationMs / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Broadcast Action Button */}
      <button
        type="button"
        disabled={sending || !text.trim() || targetCount === 0}
        onClick={() => setConfirmOpen(true)}
        className="w-full btn-premium py-3.5 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
      >
        {sending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Yuborilmoqda...</span>
          </>
        ) : (
          <>
            <Send size={16} />
            <span>{targetCount !== null ? `${targetCount} ta obunachiga yuborish` : "Ommaviy yuborish"}</span>
          </>
        )}
      </button>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl bg-surface border border-line p-5 space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-duo-purple/20 border border-duo-purple/40 flex items-center justify-center mx-auto text-duo-purple">
              <Send size={26} />
            </div>
            <div>
              <h3 className="text-base font-black text-fg">Ommaviy xabarni tasdiqlaysizmi?</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Ushbu xabar <strong className="text-fg">{TARGET_LABELS[target].title}</strong> guruhidagi{' '}
                <strong className="text-duo-purple">{targetCount} ta</strong> foydalanuvchiga Telegram bot orqali yuboriladi.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-elevated text-xs font-bold text-muted hover:text-fg"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={handleSendAll}
                className="flex-1 btn-premium py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <span>Ha, yuborilsin</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
