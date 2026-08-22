import { Camera, Pencil } from 'lucide-react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { getAvatarFrame } from '../../../shared/config/avatar-frames'
import { cn } from '../../../shared/lib/cn'

/** Profil sahifasidagi katta avatar.
 *  Doira shakli ATAYLAB saqlanadi — sotib olinadigan ramka kosmetikasi
 *  (avatar-frames) doira halqa uchun chizilgan. */
export function Avatar({ name, photoUrl, onEditName, onEditPhoto }: {
  name: string; photoUrl?: string; onEditName?: () => void; onEditPhoto?: () => void
}) {
  const customAvatar = useAppStore((s) => s.customAvatar)
  const avatarFrame  = useAppStore((s) => s.avatarFrame)
  const frameClass = getAvatarFrame(avatarFrame)?.cssClass ?? null
  const src = customAvatar ?? photoUrl
  const letter = name?.[0]?.toUpperCase() ?? 'F'
  const ring = (
    <div className="relative flex size-[88px] items-center justify-center overflow-hidden rounded-full border border-pline bg-pwash font-display text-[34px] font-semibold text-pprimary">
      {src ? (
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        letter
      )}
    </div>
  )

  /** Avatar ustidagi kichik amal tugmasi — 28px vizual, 44px bosish maydoni. */
  const editBtn = 'absolute grid size-7 place-items-center rounded-full border-[2.5px] border-pcanvas transition-transform duration-[120ms] ease-out active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas'

  return (
    <div className="relative">
      {/* #40: sotib olingan avatar ramkasi (gradient ring, avatar-frames config) */}
      {frameClass ? (
        <span className={`avatar-frame ${frameClass}`}>{ring}</span>
      ) : ring}
      {onEditName && (
        <button onClick={onEditName} aria-label="Ismni o'zgartirish"
          className={cn(editBtn, 'right-0 top-0 bg-psurface text-pmuted hover:text-pfg')}>
          <Pencil size={12} strokeWidth={1.75} />
        </button>
      )}
      {onEditPhoto && (
        <button onClick={onEditPhoto} aria-label="Rasmni o'zgartirish"
          className={cn(editBtn, 'bottom-0 right-0 bg-pprimary text-ponprimary')}>
          <Camera size={12} strokeWidth={1.75} />
        </button>
      )}
    </div>
  )
}
