import { useState } from 'react'
import { Camera, ImagePlus, Trash2, X, Pencil } from 'lucide-react'

// ── Bottom sheet — profil rasmini tahrirlash ────────────────────────────
export function PhotoEditSheet({ hasCustom, busy, onClose, onPick, onRemove }: {
  hasCustom: boolean
  busy: boolean
  onClose: () => void
  onPick: () => void
  onRemove: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-2xl border-t border-line p-5 pb-8">
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
        <p className="text-sm font-bold mb-4 flex items-center justify-center gap-2">
          <Camera size={14} className="text-duo-green" />
          Profil rasmi
        </p>
        <div className="flex flex-col gap-2.5">
          <button onClick={onPick} disabled={busy}
            className="w-full py-3.5 rounded-xl bg-duo-green text-ponprimary font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
            <ImagePlus size={16} />
            {busy ? 'Yuklanmoqda…' : 'Galereyadan tanlash'}
          </button>
          {hasCustom && (
            <button onClick={onRemove} disabled={busy}
              className="w-full py-3.5 rounded-xl bg-elevated border border-line text-duo-red font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
              <Trash2 size={16} />
              Rasmni o'chirish
            </button>
          )}
          <button onClick={onClose}
            className="w-full py-3 rounded-xl text-muted font-bold flex items-center justify-center gap-2 active:opacity-70">
            <X size={16} />
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Bottom sheet — ismni tahrirlash ─────────────────────────────────────
export function NameEditSheet({ current, onClose, onSave }: {
  current: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(current)
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-2xl border-t border-line p-5 pb-8">
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
        <p className="text-sm font-bold mb-3 flex items-center justify-center gap-2">
          <Pencil size={14} className="text-duo-blue" />
          Ismni o'zgartirish
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="Ismingiz"
          autoFocus
          className="w-full bg-canvas border border-duo-blue rounded-xl px-4 py-3 text-sm text-fg outline-none mb-4"
        />
        <button
          onClick={() => { onSave(name); onClose() }}
          className="w-full py-3.5 rounded-xl bg-duo-green text-ponprimary font-bold active:scale-[0.98] transition-transform">
          Saqlash
        </button>
      </div>
    </div>
  )
}
