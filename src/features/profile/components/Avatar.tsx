import { Pencil } from 'lucide-react'
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
  const parts = name?.trim().split(/\s+/) || []
  const letter = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (name?.[0]?.toUpperCase() || 'F')

  const sizeClass = size === 'lg'
    ? 'w-[88px] h-[88px] text-[32px]'
    : size === 'sm'
      ? 'w-11 h-11 text-base'
      : 'w-14 h-14 text-xl'

  const ring = (
    <div
      onClick={onEditPhoto}
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-full font-display font-bold shrink-0 select-none transition-transform shadow-xs',
        src ? 'bg-pwash text-pprimary' : 'bg-[#22c55e] text-white',
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

  const editBtn = cn(
    'absolute z-10 grid place-items-center rounded-full border-[2px] border-pcard transition-transform duration-150 ease-out active:scale-90',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcard',
    'before:absolute before:-inset-2 before:content-[""]',
    size === 'lg' ? 'size-7 bottom-0 right-0' : size === 'sm' ? 'size-5 bottom-0 right-0' : 'size-[22px] bottom-0 right-0',
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
    </div>
  )
}
