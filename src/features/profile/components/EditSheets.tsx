import { useState } from 'react'
import { Camera, ImagePlus, Trash2, X, Pencil } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'

// ── Bottom sheet — profil rasmini tahrirlash ────────────────────────────
export function PhotoEditSheet({ hasCustom, busy, onClose, onPick, onRemove }: {
  hasCustom: boolean
  busy: boolean
  onClose: () => void
  onPick: () => void
  onRemove: () => void
}) {
  return (
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="photo-edit-title">
      <div className="relative w-full bg-psurface rounded-t-sheet border-t border-pline p-5 pb-8">
        <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-4" />
        <p id="photo-edit-title" className="text-sm font-semibold mb-4 flex items-center justify-center gap-2">
          <Camera size={14} className="text-pprimary" />
          Profil rasmi
        </p>
        <div className="flex flex-col gap-2.5">
          <button onClick={onPick} disabled={busy}
            className="w-full py-3.5 rounded-control bg-pprimary text-ponprimary font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
            <ImagePlus size={16} />
            {busy ? 'Yuklanmoqda…' : 'Galereyadan tanlash'}
          </button>
          {hasCustom && (
            <button onClick={onRemove} disabled={busy}
              className="w-full py-3.5 rounded-control bg-psurface border border-pline text-pdanger font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
              <Trash2 size={16} />
              Rasmni o'chirish
            </button>
          )}
          <button onClick={onClose}
            className="w-full py-3 rounded-control text-pmuted font-semibold flex items-center justify-center gap-2 active:opacity-70">
            <X size={16} />
            Bekor qilish
          </button>
        </div>
      </div>
    </DialogOverlay>
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
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="name-edit-title">
      <div className="relative w-full bg-psurface rounded-t-sheet border-t border-pline p-5 pb-8">
        <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-4" />
        <p id="name-edit-title" className="text-sm font-semibold mb-3 flex items-center justify-center gap-2">
          <Pencil size={14} className="text-pblue" />
          Ismni o'zgartirish
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="Ismingiz"
          autoFocus
          className="w-full bg-pcanvas border border-pblue rounded-control px-4 py-3 text-sm text-pfg outline-none mb-4"
        />
        <button
          onClick={() => { onSave(name); onClose() }}
          className="w-full py-3.5 rounded-control bg-pprimary text-ponprimary font-semibold active:scale-[0.98] transition-transform">
          Saqlash
        </button>
      </div>
    </DialogOverlay>
  )
}
