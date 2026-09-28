import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import DialogOverlay from './DialogOverlay'
import ModalMathGrid from './ModalMathGrid'
import ModalCloseButton from './ModalCloseButton'
import { cn } from '../lib/cn'
import { haptics } from '../../platform/haptics'
import { playSound } from '../lib/sounds'

type TabKey = 'theme' | 'charts' | 'icons'

interface AppearanceModalProps {
  onClose: () => void
  initialTab?: TabKey
}

export default function AppearanceModal({ onClose, initialTab = 'theme' }: AppearanceModalProps) {
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const tt = useT(settings.language)

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)

  const currentTheme = settings.theme === 'light' ? 'light' : 'dark'
  const currentChart = settings.chartStyle === 'bars' ? 'bars' : 'line'
  const currentIcon = settings.appIcon || 'default'

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const selectTheme = (theme: 'light' | 'dark') => {
    if (settings.theme === theme) return
    haptics.selection()
    playSound('click')
    updateSettings({ theme })
  }

  const selectChart = (chartStyle: 'line' | 'bars') => {
    if (settings.chartStyle === chartStyle) return
    haptics.selection()
    playSound('click')
    updateSettings({ chartStyle })
  }

  const selectIcon = (appIcon: 'default' | 'red' | 'green' | 'pro') => {
    if (settings.appIcon === appIcon) return
    haptics.selection()
    playSound('click')
    updateSettings({ appIcon })
  }

  return (
    <DialogOverlay onClose={onClose} labelId="appearance-modal-title" swipeToDismiss zIndex={65} backdropClassName="bg-black/60">
      <div
        className={cn(
          'relative w-full rounded-t-sheet bg-psurface text-pfg',
          'max-h-[88vh] flex flex-col shadow-2xl overflow-hidden pb-8 select-none'
        )}
      >
        {/* Apple subtle blueprint/math grid background in header */}
        <ModalMathGrid glowColor="theme" height={420} />
        <ModalCloseButton onClick={onClose} label={tt('close')} />

        {/* Top Drag Handle */}
        <div
          data-drag-handle
          className="w-10 h-1 rounded-full bg-plineStrong mx-auto mt-2.5 mb-2 cursor-grab active:cursor-grabbing touch-none relative z-10"
        />

        {/* Header Bar */}
        <div className="relative z-10 flex items-center justify-center px-5 pt-1 pb-4">
          <h2
            id="appearance-modal-title"
            className="text-lg font-bold text-pfg tracking-tight text-center"
          >
            {tt('appearanceTitle')}
          </h2>
        </div>

        {/* 3-Pill Segmented Control: Theme | Charts | Icons */}
        <div className="relative z-10 mx-5 mb-5 p-1 rounded-full bg-pcard flex items-center shadow-2xs">
          {(
            [
              { key: 'theme', label: tt('appearanceTabTheme') },
              { key: 'charts', label: tt('appearanceTabCharts') },
              { key: 'icons', label: tt('appearanceTabIcons') },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  haptics.selection()
                  setActiveTab(tab.key)
                }}
                className={cn(
                  'flex-1 py-1.5 text-center text-[13px] rounded-full transition-all duration-150',
                  isActive
                    ? 'bg-pprimary text-ponprimary font-bold shadow-xs'
                    : 'text-pmuted font-semibold hover:text-pfg'
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Scrollable Tab Content */}
        <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-2">
          {/* ══════════════ TAB 1: THEME ══════════════ */}
          {activeTab === 'theme' && (
            <div>
              <div className="grid grid-cols-2 gap-3.5">
                {/* Light Card */}
                <button
                  type="button"
                  onClick={() => selectTheme('light')}
                  className={cn(
                    'bg-pcard rounded-2xl p-3 transition-all text-left flex flex-col justify-between shadow-2xs group active:scale-[0.98]',
                    currentTheme === 'light'
                      ? 'ring-2 ring-pprimary shadow-md'
                      : 'hover:shadow-xs'
                  )}
                >
                  <div className="w-full h-[88px] rounded-xl bg-psurface p-2 flex flex-col justify-between">
                    <div className="w-full h-full rounded-lg bg-pcard p-2.5 shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="w-12 h-2 rounded-full bg-pfg" />
                        <div className="w-16 h-1 rounded-full bg-pmuted mt-1.5" />
                      </div>
                      <div className="w-8 h-1 rounded-full bg-plineStrong mt-auto" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 px-1">
                    <span className="text-[14px] font-semibold text-pfg">
                      {settings.language === 'ru' ? 'Светлая' : 'Light'}
                    </span>
                    {currentTheme === 'light' && (
                      <span className="size-5 rounded-full bg-pprimary text-ponprimary flex items-center justify-center shadow-xs">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>

                {/* Dark Card */}
                <button
                  type="button"
                  onClick={() => selectTheme('dark')}
                  className={cn(
                    'bg-pcard rounded-2xl p-3 transition-all text-left flex flex-col justify-between shadow-2xs group active:scale-[0.98]',
                    currentTheme === 'dark'
                      ? 'ring-2 ring-pprimary shadow-md'
                      : 'hover:shadow-xs'
                  )}
                >
                  <div className="w-full h-[88px] rounded-xl bg-[#0E131D] p-2 flex flex-col justify-between">
                    <div className="w-full h-full rounded-lg bg-[#000000] p-2.5 shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="w-12 h-2 rounded-full bg-white" />
                        <div className="w-16 h-1 rounded-full bg-gray-600 mt-1.5" />
                      </div>
                      <div className="w-8 h-1 rounded-full bg-gray-700 mt-auto" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 px-1">
                    <span className="text-[14px] font-semibold text-pfg">
                      {settings.language === 'ru' ? 'Тёмная' : 'Dark'}
                    </span>
                    {currentTheme === 'dark' && (
                      <span className="size-5 rounded-full bg-pprimary text-ponprimary flex items-center justify-center shadow-xs">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Footnote */}
              <p className="mt-4 text-[13px] text-pmuted leading-relaxed font-normal">
                {tt('themeFootnote')}
              </p>
            </div>
          )}

          {/* ══════════════ TAB 2: CHARTS ══════════════ */}
          {activeTab === 'charts' && (
            <div>
              <div className="grid grid-cols-2 gap-3.5">
                {/* Line Card */}
                <button
                  type="button"
                  onClick={() => selectChart('line')}
                  className={cn(
                    'bg-pcard rounded-2xl p-3 transition-all text-left flex flex-col justify-between shadow-2xs group active:scale-[0.98]',
                    currentChart === 'line'
                      ? 'ring-2 ring-pprimary shadow-md'
                      : 'hover:shadow-xs'
                  )}
                >
                  <div className="w-full h-[88px] rounded-xl bg-psurface p-2 flex flex-col justify-between">
                    <div className="w-full h-full rounded-lg bg-pcard p-1.5 shadow-2xs flex items-center justify-center relative overflow-hidden">
                      <svg viewBox="0 0 100 48" className="w-full h-full overflow-hidden" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartLineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--p-primary)" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="var(--p-primary)" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 6 34 C 14 34, 18 28, 28 30 C 38 32, 44 24, 54 26 C 64 28, 70 18, 80 20 C 88 22, 92 12, 96 14 L 96 48 L 6 48 Z"
                          fill="url(#chartLineGrad)"
                        />
                        <path
                          d="M 6 34 C 14 34, 18 28, 28 30 C 38 32, 44 24, 54 26 C 64 28, 70 18, 80 20 C 88 22, 92 12, 96 14"
                          fill="none"
                          stroke="var(--p-primary)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 px-1">
                    <span className="text-[14px] font-semibold text-pfg">
                      {settings.language === 'ru' ? 'Линия' : 'Line'}
                    </span>
                    {currentChart === 'line' && (
                      <span className="size-5 rounded-full bg-pprimary text-ponprimary flex items-center justify-center shadow-xs">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>

                {/* Bars Card */}
                <button
                  type="button"
                  onClick={() => selectChart('bars')}
                  className={cn(
                    'bg-pcard rounded-2xl p-3 transition-all text-left flex flex-col justify-between shadow-2xs group active:scale-[0.98]',
                    currentChart === 'bars'
                      ? 'ring-2 ring-pprimary shadow-md'
                      : 'hover:shadow-xs'
                  )}
                >
                  <div className="w-full h-[88px] rounded-xl bg-psurface p-2 flex flex-col justify-between">
                    <div className="w-full h-full rounded-lg bg-pcard p-2 shadow-2xs flex flex-col justify-end relative overflow-hidden">
                      {/* Dashed baseline guide */}
                      <div className="absolute top-2.5 left-2 right-2 border-b border-dashed border-pline" />
                      {/* 9 vertical bars */}
                      <div className="flex items-end justify-between gap-1 w-full h-[38px] px-1 relative z-10">
                        {[24, 38, 18, 56, 32, 78, 46, 92, 64].map((h, idx) => (
                          <div
                            key={idx}
                            style={{ height: `${h}%` }}
                            className="flex-1 rounded-t-[3px] rounded-b-[1px] bg-pprimary"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 px-1">
                    <span className="text-[14px] font-semibold text-pfg">
                      {settings.language === 'ru' ? 'Столбцы' : 'Bars'}
                    </span>
                    {currentChart === 'bars' && (
                      <span className="size-5 rounded-full bg-pprimary text-ponprimary flex items-center justify-center shadow-xs">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Footnote */}
              <p className="mt-4 text-[13px] text-pmuted leading-relaxed font-normal">
                {tt('chartFootnote')}
              </p>
            </div>
          )}

          {/* ══════════════ TAB 3: ICONS ══════════════ */}
          {activeTab === 'icons' && (
            <div>
              <div className="grid grid-cols-2 gap-3.5">
                {/* 1. Default (Blue) */}
                <button
                  type="button"
                  onClick={() => selectIcon('default')}
                  className={cn(
                    'bg-pcard rounded-2xl p-3.5 transition-all text-left flex flex-col items-center shadow-2xs group active:scale-[0.98]',
                    currentIcon === 'default'
                      ? 'ring-2 ring-pprimary shadow-md'
                      : 'hover:shadow-xs'
                  )}
                >
                  <div className="size-16 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#00C0FF] shadow-md flex items-center justify-center relative overflow-hidden">
                    {/* Concentric grid lines overlay */}
                    <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" fill="none" stroke="white" strokeWidth="0.75" />
                      <line x1="0" y1="32" x2="64" y2="32" stroke="white" strokeWidth="0.5" />
                      <line x1="32" y1="0" x2="32" y2="64" stroke="white" strokeWidth="0.5" />
                    </svg>
                    {/* White wave glyph */}
                    <svg viewBox="0 0 32 32" className="size-8 text-white fill-white drop-shadow-xs relative z-10">
                      <path d="M 8 21 C 9.5 15, 12 18, 15 14 C 18 10, 20.5 9, 24 11 C 23.5 18, 18.5 24, 13 24 C 9 24, 8 21, 8 21 Z" />
                    </svg>
                  </div>
                  <div className="w-full flex items-center justify-between mt-3 px-1">
                    <span className="text-[14px] font-semibold text-pfg">Default</span>
                    {currentIcon === 'default' && (
                      <span className="size-5 rounded-full bg-pprimary text-ponprimary flex items-center justify-center shadow-xs">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>

                {/* 2. Red */}
                <button
                  type="button"
                  onClick={() => selectIcon('red')}
                  className={cn(
                    'bg-pcard rounded-2xl p-3.5 transition-all text-left flex flex-col items-center shadow-2xs group active:scale-[0.98]',
                    currentIcon === 'red'
                      ? 'ring-2 ring-pprimary shadow-md'
                      : 'hover:shadow-xs'
                  )}
                >
                  <div className="size-16 rounded-2xl bg-gradient-to-br from-[#FF2D55] to-[#FF6B8B] shadow-md flex items-center justify-center relative overflow-hidden">
                    <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" fill="none" stroke="white" strokeWidth="0.75" />
                      <line x1="0" y1="32" x2="64" y2="32" stroke="white" strokeWidth="0.5" />
                      <line x1="32" y1="0" x2="32" y2="64" stroke="white" strokeWidth="0.5" />
                    </svg>
                    <svg viewBox="0 0 32 32" className="size-8 text-white fill-white drop-shadow-xs relative z-10">
                      <path d="M 8 21 C 9.5 15, 12 18, 15 14 C 18 10, 20.5 9, 24 11 C 23.5 18, 18.5 24, 13 24 C 9 24, 8 21, 8 21 Z" />
                    </svg>
                  </div>
                  <div className="w-full flex items-center justify-between mt-3 px-1">
                    <span className="text-[14px] font-semibold text-pfg">Red</span>
                    {currentIcon === 'red' && (
                      <span className="size-5 rounded-full bg-pprimary text-ponprimary flex items-center justify-center shadow-xs">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>

                {/* 3. Green */}
                <button
                  type="button"
                  onClick={() => selectIcon('green')}
                  className={cn(
                    'bg-pcard rounded-2xl p-3.5 transition-all text-left flex flex-col items-center shadow-2xs group active:scale-[0.98]',
                    currentIcon === 'green'
                      ? 'ring-2 ring-pprimary shadow-md'
                      : 'hover:shadow-xs'
                  )}
                >
                  <div className="size-16 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#34D399] shadow-md flex items-center justify-center relative overflow-hidden">
                    <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" fill="none" stroke="white" strokeWidth="0.75" />
                      <line x1="0" y1="32" x2="64" y2="32" stroke="white" strokeWidth="0.5" />
                      <line x1="32" y1="0" x2="32" y2="64" stroke="white" strokeWidth="0.5" />
                    </svg>
                    <svg viewBox="0 0 32 32" className="size-8 text-white fill-white drop-shadow-xs relative z-10">
                      <path d="M 8 21 C 9.5 15, 12 18, 15 14 C 18 10, 20.5 9, 24 11 C 23.5 18, 18.5 24, 13 24 C 9 24, 8 21, 8 21 Z" />
                    </svg>
                  </div>
                  <div className="w-full flex items-center justify-between mt-3 px-1">
                    <span className="text-[14px] font-semibold text-pfg">Green</span>
                    {currentIcon === 'green' && (
                      <span className="size-5 rounded-full bg-pprimary text-ponprimary flex items-center justify-center shadow-xs">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>

                {/* 4. Pro (Dark Checkerboard + Royal Crown) */}
                <button
                  type="button"
                  onClick={() => selectIcon('pro')}
                  className={cn(
                    'bg-pcard rounded-2xl p-3.5 transition-all text-left flex flex-col items-center shadow-2xs group active:scale-[0.98]',
                    currentIcon === 'pro'
                      ? 'ring-2 ring-pprimary shadow-md'
                      : 'hover:shadow-xs'
                  )}
                >
                  <div className="size-16 rounded-2xl bg-[#141416] shadow-md flex items-center justify-center relative overflow-hidden">
                    {/* Checkerboard texture */}
                    <div
                      className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        backgroundImage:
                          'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
                        backgroundSize: '16px 16px',
                        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                      }}
                    />
                    {/* Royal Golden Crown */}
                    <svg viewBox="0 0 36 36" className="size-9 drop-shadow-md relative z-10">
                      <defs>
                        <linearGradient id="crownGold" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FFE066" />
                          <stop offset="40%" stopColor="#F59E0B" />
                          <stop offset="100%" stopColor="#D97706" />
                        </linearGradient>
                      </defs>
                      {/* Crown base and spikes */}
                      <path
                        d="M 5 26 L 7 14 L 13 21 L 18 10 L 23 21 L 29 14 L 31 26 Z"
                        fill="url(#crownGold)"
                        stroke="#B45309"
                        strokeWidth="1"
                        strokeLinejoin="round"
                      />
                      {/* Bottom band */}
                      <path
                        d="M 5 26 Q 18 28 31 26 L 31 28 Q 18 30 5 28 Z"
                        fill="#D97706"
                      />
                      {/* Jewels */}
                      <circle cx="7" cy="13" r="2" fill="#EF4444" />
                      <circle cx="18" cy="9" r="2.2" fill="#3B82F6" />
                      <circle cx="29" cy="13" r="2" fill="#10B981" />
                      <circle cx="13" cy="25" r="1.4" fill="#EF4444" />
                      <circle cx="18" cy="25" r="1.6" fill="#3B82F6" />
                      <circle cx="23" cy="25" r="1.4" fill="#10B981" />
                    </svg>
                  </div>
                  <div className="w-full flex items-center justify-between mt-3 px-1">
                    <span className="text-[14px] font-semibold text-pfg">Pro</span>
                    {currentIcon === 'pro' && (
                      <span className="size-5 rounded-full bg-pprimary text-ponprimary flex items-center justify-center shadow-xs">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Footnote */}
              <p className="mt-4 text-[13px] text-pmuted leading-relaxed font-normal">
                {tt('iconFootnote')}
              </p>
            </div>
          )}
        </div>
      </div>
    </DialogOverlay>
  )
}
