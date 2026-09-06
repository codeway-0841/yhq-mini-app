import { useState, useRef, useEffect } from 'react'
import {
  PenLine, Calculator, BookOpen, NotebookPen, Bookmark,
  Eye, EyeOff, Sparkles, X,
} from 'lucide-react'
import { useT, type Lang } from '../../../shared/i18n'
import { haptics } from '../../../platform/haptics'

interface TestToolsHubProps {
  onOpenDrawing: () => void
  onOpenScratchpad: () => void
  onOpenCalculator: () => void
  onOpenFormulas: () => void
  onToggleSave: () => void
  isSaved: boolean
  hasStrokes: boolean
  drawingsVisible: boolean
  onToggleVisibility: () => void
  language: Lang
  raised?: boolean
}

export default function TestToolsHub({
  onOpenDrawing,
  onOpenScratchpad,
  onOpenCalculator,
  onOpenFormulas,
  onToggleSave,
  isSaved,
  hasStrokes,
  drawingsVisible,
  onToggleVisibility,
  language,
  raised = false,
}: TestToolsHubProps) {
  const tt = useT(language)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Tashqariga bosilganda menyuni yopish
  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [menuOpen])

  const toggleMenu = () => {
    haptics.impact('light')
    setMenuOpen((prev) => !prev)
  }

  return (
    <div
      ref={menuRef}
      className={`fixed right-4 z-40 flex flex-col items-end gap-2 transition-[bottom,transform] duration-200 ${
        raised
          ? 'bottom-[calc(6.5rem+var(--safe-bottom,0px))]'
          : 'bottom-[calc(1.5rem+var(--safe-bottom,0px))]'
      }`}
    >
      {/* Ochiladigan menyu (SpeedDial) */}
      {menuOpen && (
        <div
          role="menu"
          aria-label={tt('testTools')}
          className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-3 duration-150 mb-1"
        >
          {/* Formulalar */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              haptics.impact('light')
              setMenuOpen(false)
              onOpenFormulas()
            }}
            className="flex items-center gap-2.5 rounded-full bg-pcard px-3.5 py-2 text-xs font-semibold text-pfg shadow-lg hover:bg-psurface active:scale-95 transition-transform"
          >
            <span>{tt('toolFormulas')}</span>
            <span className="grid size-8 place-items-center rounded-full bg-pprimary/10 text-pprimary">
              <BookOpen size={16} />
            </span>
          </button>

          {/* Kalkulyator */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              haptics.impact('light')
              setMenuOpen(false)
              onOpenCalculator()
            }}
            className="flex items-center gap-2.5 rounded-full bg-pcard px-3.5 py-2 text-xs font-semibold text-pfg shadow-lg hover:bg-psurface active:scale-95 transition-transform"
          >
            <span>{tt('toolCalculator')}</span>
            <span className="grid size-8 place-items-center rounded-full bg-pprimary/10 text-pprimary">
              <Calculator size={16} />
            </span>
          </button>

          {/* Qoralama */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              haptics.impact('light')
              setMenuOpen(false)
              onOpenScratchpad()
            }}
            className="flex items-center gap-2.5 rounded-full bg-pcard px-3.5 py-2 text-xs font-semibold text-pfg shadow-lg hover:bg-psurface active:scale-95 transition-transform"
          >
            <span>{tt('toolScratchpad')}</span>
            <span className="grid size-8 place-items-center rounded-full bg-pprimary/10 text-pprimary">
              <NotebookPen size={16} />
            </span>
          </button>

          {/* Ko'z: agar chizma bo'lsa */}
          {hasStrokes && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                haptics.impact('light')
                onToggleVisibility()
              }}
              className="flex items-center gap-2.5 rounded-full bg-pcard px-3.5 py-2 text-xs font-semibold text-pfg shadow-lg hover:bg-psurface active:scale-95 transition-transform"
            >
              <span>{tt(drawingsVisible ? 'toolEyeHide' : 'toolEyeShow')}</span>
              <span className={`grid size-8 place-items-center rounded-full ${drawingsVisible ? 'bg-psurface text-pfg' : 'bg-pwarning/15 text-pwarning'}`}>
                {drawingsVisible ? <Eye size={16} /> : <EyeOff size={16} />}
              </span>
            </button>
          )}

          {/* Savolni saqlash */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              haptics.impact('light')
              onToggleSave()
            }}
            className="flex items-center gap-2.5 rounded-full bg-pcard px-3.5 py-2 text-xs font-semibold text-pfg shadow-lg hover:bg-psurface active:scale-95 transition-transform"
          >
            <span>{isSaved ? tt('removeSaved') : tt('toolBookmark')}</span>
            <span className={`grid size-8 place-items-center rounded-full ${isSaved ? 'bg-pwarning/15 text-pwarning' : 'bg-psurface text-pmuted'}`}>
              <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
            </span>
          </button>
        </div>
      )}

      {/* Asosiy suzuvchi tugmalar paneli (Floating Dock) */}
      <div className="flex items-center gap-2 rounded-2xl bg-pcard/95 backdrop-blur-md p-1.5 shadow-xl">
        {/* Yordamchilar menyusi tugmasi */}
        <button
          type="button"
          onClick={toggleMenu}
          aria-label={tt('testTools')}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title={tt('testTools')}
          className={`grid size-11 place-items-center rounded-xl transition-all active:scale-95 ${
            menuOpen
              ? 'bg-psurface text-pfg ring-2 ring-pprimary'
              : 'bg-psurface text-pmuted hover:text-pfg'
          }`}
        >
          {menuOpen ? <X size={20} /> : <Sparkles size={20} className="text-pprimary" />}
        </button>

        {/* Chizib yechish asosiy tugmasi */}
        <button
          type="button"
          onClick={() => {
            haptics.impact('light')
            setMenuOpen(false)
            onOpenDrawing()
          }}
          aria-label={tt('drawingOpen')}
          title={tt('toolDrawing')}
          className="grid size-11 place-items-center rounded-xl bg-pprimary text-white shadow-md hover:brightness-110 active:scale-95 transition-all"
        >
          <PenLine size={20} />
        </button>
      </div>
    </div>
  )
}
