import { WonderFloatingMascot, WonderDrawerPeekTab } from './WonderIcons'
import { useWonderStore } from '../store/useWonderStore'
import { haptics } from '../../../platform/haptics'

export default function WonderMascot() {
  const toggleChat = useWonderStore((s) => s.toggleChat)
  const toggleNotesDrawer = useWonderStore((s) => s.toggleNotesDrawer)

  const handleMascotClick = () => {
    haptics.impact('light')
    toggleChat()
  }

  const handleTabClick = () => {
    haptics.selection()
    toggleNotesDrawer()
  }

  return (
    <div className="fixed bottom-[calc(1.25rem+var(--safe-bottom,0px))] right-4 z-40 flex flex-col items-end pointer-events-none select-none">
      {/* 1:1 Floating Drawer Peek Tab & Dark Star Mascot Button (from bottom_right_corner.png) */}
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        <WonderDrawerPeekTab
          onClick={handleTabClick}
          className="mr-[-16px] hover:mr-[-6px] transition-all"
        />
        <WonderFloatingMascot
          size={24}
          onClick={handleMascotClick}
          className="shadow-md"
        />
      </div>
    </div>
  )
}
