import { Camera, Pencil } from 'lucide-react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { getAvatarFrame } from '../../../shared/config/avatar-frames'
import { cn } from '../../../shared/lib/cn'

/** Profil sahifasidagi avatar.
 *  Doira shakli ATAYLAB saqlanadi — sotib olinadigan ramka kosmetikasi
 *  (avatar-frames) doira halqa uchun chizilgan. */
export function Avatar({
  name,
  photoUrl,
  size = 'md',
  onEditName,
  onEditPhoto,
  className,
}: {
  name: string
  photoUrl?: string
  size?: 'lg' | 'md' | 'sm'
  onEditName?: () => void
  onEditPhoto?: () => void
  className?: string
}) {
  const customAvatar = useAppStore((s) => s.customAvatar)
  const user         = useAppStore((s) => s.user)
  const avatarFrame  = useAppStore((s) => s.avatarFrame)
  const frameClass   = getAvatarFrame(avatarFrame)?.cssClass ?? null
  const src = customAvatar ?? photoUrl ?? user?.photoUrl ?? null
  const letter = name?.[0]?.toUpperCase() || 'F'

  const sizeClass = size === 'lg'
    ? 'w-[88px] h-[88px] text-[32px]'
    : size === 'sm'
      ? 'w-11 h-11 text-base'
      : 'w-14 h-14 text-xl'

  const ring = (
    <div
      onClick={onEditPhoto}
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-full bg-pwash font-display font-bold text-pprimary shrink-0 select-none transition-transform shadow-xs',
        onEditPhoto && 'cursor-pointer active:scale-95',
        sizeClass,
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name} className="size-full object-cover rounded-full" />
      ) : (
        <span>{letter}</span>
      )}
    </div>
  )

  /** Avatar ustidagi kichik amal tugmasi */
  const editBtn = cn(
    'absolute grid place-items-center rounded-full border-[2px] border-pcanvas transition-transform duration-150 ease-out active:scale-90',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
    size === 'lg' ? 'size-7' : 'size-6',
  )

  return (
    <div className="relative shrink-0 flex items-center justify-center">
      {/* #40: sotib olingan avatar ramkasi (gradient ring, avatar-frames config) */}
      {frameClass ? (
        <span className={`avatar-frame ${frameClass}`}>{ring}</span>
      ) : ring}

      {onEditName && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEditName()
          }}
          aria-label="Ismni o'zgartirish"
          className={cn(editBtn, 'right-0 top-0 bg-psurface text-pmuted hover:text-pfg')}
        >
          <Pencil size={size === 'lg' ? 12 : 10} strokeWidth={1.75} />
        </button>
      )}

      {onEditPhoto && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEditPhoto()
          }}
          aria-label="Rasmni o'zgartirish"
          className={cn(editBtn, '-bottom-0.5 -right-0.5 bg-pprimary text-ponprimary shadow-sm')}
        >
          <Camera size={size === 'lg' ? 12 : 11} strokeWidth={1.75} />
        </button>
      )}
    </div>
  )
}


