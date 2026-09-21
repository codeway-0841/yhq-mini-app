import { PenLine, Eraser, Undo2, Redo2, Trash2, Keyboard, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../../shared/lib/cn'
import type { DrawingTool } from '../../test'

/**
 * Math Board — suzuvchi chizish toolbar (Faza 3, Chiron-style).
 * Past-o'ng fixed + safe-bottom (APK gesture bar/TG fullscreen).
 * Barcha tugmalar aria-label'li (a11y); Lasso — o'chiq + soon (Faza 2 scope).
 */

interface FloatingToolbarProps {
  tool: DrawingTool
  onTool: (tool: DrawingTool) => void
  canUndo: boolean
  canRedo: boolean
  canClear: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onKeyboard: () => void
  labels: {
    pen: string
    eraser: string
    undo: string
    redo: string
    clear: string
    keyboard: string
    lassoSoon: string
  }
}

function ToolButton({ active, disabled, onClick, label, children }: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'grid size-11 place-items-center rounded-2xl shadow-md transition-colors',
        'disabled:opacity-30 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
        active ? 'bg-pprimary text-white' : 'bg-pcard text-pmuted',
      )}
    >
      {children}
    </button>
  )
}

export default function FloatingToolbar(props: FloatingToolbarProps) {
  const { tool, onTool, labels } = props
  return (
    <div
      className="fixed bottom-[calc(1rem+var(--safe-bottom,0px))] right-4 z-40 flex flex-col items-center gap-2"
      role="toolbar"
      aria-label="drawing"
    >
      <ToolButton active={tool === 'pen'} onClick={() => onTool('pen')} label={labels.pen}>
        <PenLine size={19} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton active={tool === 'eraser'} onClick={() => onTool('eraser')} label={labels.eraser}>
        <Eraser size={19} strokeWidth={1.75} />
      </ToolButton>
      {/* Lasso — Faza 2 scope'dan tashqarida: o'chiq + soon */}
      <span className="relative">
        <ToolButton disabled onClick={() => {}} label={labels.lassoSoon}>
          <Sparkles size={19} strokeWidth={1.75} />
        </ToolButton>
        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-psurface px-1.5 py-px text-[10px] font-bold text-pmuted shadow-2xs">
          soon
        </span>
      </span>
      <ToolButton disabled={!props.canUndo} onClick={props.onUndo} label={labels.undo}>
        <Undo2 size={19} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton disabled={!props.canRedo} onClick={props.onRedo} label={labels.redo}>
        <Redo2 size={19} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton disabled={!props.canClear} onClick={props.onClear} label={labels.clear}>
        <Trash2 size={19} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton onClick={props.onKeyboard} label={labels.keyboard}>
        <Keyboard size={19} strokeWidth={1.75} />
      </ToolButton>
    </div>
  )
}
