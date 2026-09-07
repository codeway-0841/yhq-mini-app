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
          {onOpenFormulas && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                haptics.impact('light')
                setMenuOpen(false)
                onOpenFormulas()
              }}
              className="flex items-center gap-2.5 rounded-full bg-slate-900/95 text-white backdrop-blur-xl border border-white/15 px-3.5 py-2 text-xs font-semibold shadow-2xl hover:bg-slate-800 active:scale-95 transition-all"
            >
              <span>{tt('toolFormulas')}</span>
              <span className="grid size-8 place-items-center rounded-full bg-purple-500/25 text-purple-300">
                <BookOpen size={16} />
              </span>
            </button>
          )}

          {/* Kalkulyator */}
          {onOpenCalculator && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                haptics.impact('light')
                setMenuOpen(false)
                onOpenCalculator()
              }}
              className="flex items-center gap-2.5 rounded-full bg-slate-900/95 text-white backdrop-blur-xl border border-white/15 px-3.5 py-2 text-xs font-semibold shadow-2xl hover:bg-slate-800 active:scale-95 transition-all"
            >
              <span>{tt('toolCalculator')}</span>
              <span className="grid size-8 place-items-center rounded-full bg-purple-500/25 text-purple-300">
                <Calculator size={16} />
              </span>
            </button>
          )}

          {/* Qoralama */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              haptics.impact('light')
              setMenuOpen(false)
              onOpenScratchpad()
            }}
            className="flex items-center gap-2.5 rounded-full bg-slate-900/95 text-white backdrop-blur-xl border border-white/15 px-3.5 py-2 text-xs font-semibold shadow-2xl hover:bg-slate-800 active:scale-95 transition-all"
          >
            <span>{tt('toolScratchpad')}</span>
            <span className="grid size-8 place-items-center rounded-full bg-purple-500/25 text-purple-300">
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
              className="flex items-center gap-2.5 rounded-full bg-slate-900/95 text-white backdrop-blur-xl border border-white/15 px-3.5 py-2 text-xs font-semibold shadow-2xl hover:bg-slate-800 active:scale-95 transition-all"
            >
              <span>{tt(drawingsVisible ? 'toolEyeHide' : 'toolEyeShow')}</span>
              <span className={`grid size-8 place-items-center rounded-full ${drawingsVisible ? 'bg-white/10 text-white' : 'bg-amber-500/25 text-amber-400'}`}>
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
            className="flex items-center gap-2.5 rounded-full bg-slate-900/95 text-white backdrop-blur-xl border border-white/15 px-3.5 py-2 text-xs font-semibold shadow-2xl hover:bg-slate-800 active:scale-95 transition-all"
          >
            <span>{isSaved ? tt('removeSaved') : tt('toolBookmark')}</span>
            <span className={`grid size-8 place-items-center rounded-full ${isSaved ? 'bg-amber-500/25 text-amber-400' : 'bg-white/10 text-white/70'}`}>
              <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
            </span>
          </button>
        </div>
      )}

      {/* Asosiy suzuvchi tugmalar paneli (Floating Dock — iPhone Dynamic Island uslubi) */}
      <div className="flex items-center gap-1.5 rounded-2xl bg-slate-900/95 text-white backdrop-blur-xl p-1.5 shadow-2xl border border-white/15 ring-1 ring-black/40">
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
              ? 'bg-purple-600 text-white ring-2 ring-purple-400 ring-inset shadow-md shadow-purple-600/40'
              : 'bg-white/10 text-purple-300 hover:bg-white/20 hover:text-white'
          }`}
        >
          {menuOpen ? <X size={20} /> : <Sparkles size={20} className="text-purple-300" />}
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
          className="grid size-11 place-items-center rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-600/40 hover:bg-purple-500 active:scale-95 transition-all"
        >
          <PenLine size={20} />
        </button>
      </div>
    </div>
  )
}
