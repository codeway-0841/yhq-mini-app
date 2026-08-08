import { Camera, Pencil } from 'lucide-react'
import { useAppStore } from '../../../shared/store/useAppStore'

export function Avatar({ name, photoUrl, onEditName, onEditPhoto }: {
  name: string; photoUrl?: string; onEditName?: () => void; onEditPhoto?: () => void
}) {
  const customAvatar = useAppStore((s) => s.customAvatar)
  const src = customAvatar ?? photoUrl
  const letter = name?.[0]?.toUpperCase() ?? 'F'
  return (
    <div className="relative">
      <div className="w-[88px] h-[88px] rounded-full bg-gradient-to-br from-duo-blue to-duo-purple flex items-center justify-center text-white font-black text-4xl relative overflow-hidden ring-[3px] ring-duo-blue/40">
        {src ? (
          <img src={src} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          letter
        )}
      </div>
      {onEditName && (
        <button onClick={onEditName} aria-label="Ismni o'zgartirish"
          className="absolute top-0 right-0 w-7 h-7 rounded-full bg-duo-blue border-[2.5px] border-canvas flex items-center justify-center active:scale-90 transition-transform shadow-lg">
          <Pencil size={12} className="text-white" />
        </button>
      )}
      {onEditPhoto && (
        <button onClick={onEditPhoto} aria-label="Rasmni o'zgartirish"
          className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-duo-green border-[2.5px] border-canvas flex items-center justify-center active:scale-90 transition-transform shadow-lg">
          <Camera size={12} className="text-white" />
        </button>
      )}
    </div>
  )
}
