import { useState } from 'react'
import { Camera, ImagePlus, Trash2, X, Pencil } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { Button } from '../../../shared/components/ui/button'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'

// ── Bottom sheet — profil rasmini tahrirlash ────────────────────────────
export function PhotoEditSheet({ hasCustom, busy, onClose, onPick, onRemove }: {
  hasCustom: boolean
  busy: boolean
  onClose: () => void
  onPick: () => void
  onRemove: () => void
}) {
  const tt = useT(useAppStore((s) => s.settings.language))
  return (
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="photo-edit-title">
      <div className="relative w-full bg-psurface rounded-t-sheet border-t border-pline p-5 pb-8">
        <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-4" />
        <p id="photo-edit-title" className="text-sm font-semibold mb-4 flex items-center justify-center gap-2 text-pfg">
          <Camera size={14} className="text-pprimary" />
          {tt('photoEditTitle')}
        </p>
        <div className="flex flex-col gap-2.5">
          <Button block loading={busy} onClick={onPick}>
            <ImagePlus size={16} />
            {busy ? tt('uploadingPhoto') : tt('pickFromGallery')}
          </Button>
          {hasCustom && (
            <Button block variant="destructive" disabled={busy} onClick={onRemove}>
              <Trash2 size={16} />
              {tt('removePhoto')}
            </Button>
          )}
          <Button block variant="ghost" onClick={onClose}>
            <X size={16} />
            {tt('cancel')}
          </Button>
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
  const tt = useT(useAppStore((s) => s.settings.language))
  const [name, setName] = useState(current)
  return (
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="name-edit-title">
      <div className="relative w-full bg-psurface rounded-t-sheet border-t border-pline p-5 pb-8">
        <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-4" />
        <p id="name-edit-title" className="text-sm font-semibold mb-3 flex items-center justify-center gap-2 text-pfg">
          <Pencil size={14} className="text-pblue" />
          {tt('nameEditTitle')}
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder={tt('yourNamePlaceholder')}
          autoFocus
          className="w-full bg-pcanvas border border-pline rounded-control px-4 py-3 text-sm text-pfg outline-none mb-4 focus:border-pprimary"
        />
        <Button block onClick={() => { onSave(name); onClose() }}>
          {tt('saveBtn')}
        </Button>
      </div>
    </DialogOverlay>
  )
}
