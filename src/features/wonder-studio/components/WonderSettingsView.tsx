import { useState } from 'react'
import {
  ArrowLeft,
  SunMoon,
  Languages,
  Check,
} from 'lucide-react'
import { useWonderStore } from '../store/useWonderStore'

interface WonderSettingsViewProps {
  onOpenUpgrade?: () => void
}

export default function WonderSettingsView({ onOpenUpgrade: _onOpenUpgrade }: WonderSettingsViewProps) {
  const setCurrentNav = useWonderStore((s) => s.setCurrentNav)
  const factsAboutYou = useWonderStore((s) => s.factsAboutYou)
  const setFactsAboutYou = useWonderStore((s) => s.setFactsAboutYou)

  const [isEditingFacts, setIsEditingFacts] = useState(false)
  const [factsInput, setFactsInput] = useState(factsAboutYou)
  const [appearance, setAppearance] = useState('Light')
  const [appLang, setAppLang] = useState('English')
  const [contentLang, setContentLang] = useState('English')

  const handleSaveFacts = () => {
    setFactsAboutYou(factsInput)
    setIsEditingFacts(false)
  }

  return (
    <div className="max-w-4xl mx-auto py-3 font-sans select-none space-y-6 animate-in fade-in duration-150">
      {/* 1:1 Top Back to Profile Link from live_auth_settings.png */}
      <button
        type="button"
        onClick={() => setCurrentNav('profile')}
        className="flex items-center gap-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
      >
        <ArrowLeft size={15} strokeWidth={2} />
        <span>Back to Profile</span>
      </button>

      {/* Main Heading */}
      <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 font-sans tracking-tight">
        Settings
      </h1>

      {/* Card 1: Facts About You (1:1 with live_auth_settings.png) */}
      <div className="rounded-2xl border border-[#E7E2D6] dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1E1512] p-5 sm:p-6 space-y-4 shadow-2xs">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
            Facts About You
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
            The more you share, the better Wondering can shape every lesson, practice, and conversation around you.
          </p>
        </div>

        {isEditingFacts ? (
          <div className="space-y-3">
            <textarea
              rows={3}
              value={factsInput}
              onChange={(e) => setFactsInput(e.target.value)}
              placeholder="e.g., I am a visual learner who prefers high-level intuition before mathematical proofs."
              className="w-full p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 outline-hidden font-medium resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingFacts(false)}
                className="px-3.5 py-1.5 rounded-xl bg-stone-200 dark:bg-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFacts}
                className="px-4 py-1.5 rounded-xl bg-[#0284C7] text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Check size={14} />
                <span>Save</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {factsAboutYou ? (
              <div className="p-3.5 rounded-xl bg-[#FAF8F2] dark:bg-stone-900 border border-[#E7E2D6] dark:border-stone-800 text-xs text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
                {factsAboutYou}
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-center text-xs text-stone-400 italic">
                Hozircha ma&apos;lumot kiritilmagan. O&apos;qish uslubingiz va qiziqishlaringizni qo&apos;shing.
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setFactsInput(factsAboutYou)
                setIsEditingFacts(true)
              }}
              className="w-full py-3 rounded-xl bg-[#D7D1C5] hover:bg-[#CEC8BC] dark:bg-stone-800 border border-[#BCB4A7] dark:border-stone-700 text-[#544F46] dark:text-stone-200 font-mono font-bold text-xs uppercase tracking-wider shadow-[0_4px_0_0_#BCB4A7] dark:shadow-[0_4px_0_0_#292524] active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center"
            >
              EDIT FACTS
            </button>
          </div>
        )}
      </div>

      {/* Card 2: Appearance (1:1 with live_auth_settings.png) */}
      <div className="rounded-2xl border border-[#E7E2D6] dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1E1512] p-5 sm:p-6 space-y-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-[#E0F2FE] dark:bg-sky-950/60 text-[#0284C7] dark:text-sky-300 flex items-center justify-center shrink-0">
            <SunMoon size={18} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
              Appearance
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Choose a light or dark theme, or follow your device settings.
            </p>
          </div>
        </div>

        <div className="relative">
          <select
            value={appearance}
            onChange={(e) => setAppearance(e.target.value)}
            className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl bg-white dark:bg-stone-900 border border-[#E7E2D6] dark:border-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 outline-hidden cursor-pointer shadow-2xs"
          >
            <option value="Light">Light</option>
            <option value="Dark">Dark</option>
            <option value="System">System</option>
          </select>
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Card 3: App Language (1:1 with live_auth_settings.png) */}
      <div className="rounded-2xl border border-[#E7E2D6] dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1E1512] p-5 sm:p-6 space-y-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-[#E0F2FE] dark:bg-sky-950/60 text-[#0284C7] dark:text-sky-300 flex items-center justify-center shrink-0">
            <Languages size={18} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
              App Language
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Choose the language used for buttons, navigation, settings, and other app controls.
            </p>
          </div>
        </div>

        <div className="relative">
          <select
            value={appLang}
            onChange={(e) => setAppLang(e.target.value)}
            className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl bg-white dark:bg-stone-900 border border-[#E7E2D6] dark:border-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 outline-hidden cursor-pointer shadow-2xs"
          >
            <option value="English">English</option>
            <option value="O'zbekcha">O'zbekcha</option>
            <option value="Русский">Русский</option>
          </select>
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Card 4: Content Language (1:1 with live_auth_settings.png) */}
      <div className="rounded-2xl border border-[#E7E2D6] dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1E1512] p-5 sm:p-6 space-y-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-[#E0F2FE] dark:bg-sky-950/60 text-[#0284C7] dark:text-sky-300 flex items-center justify-center shrink-0">
            <Languages size={18} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
              Content Language
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              The language used for generated learning content and AI responses.
            </p>
          </div>
        </div>

        <div className="relative">
          <select
            value={contentLang}
            onChange={(e) => setContentLang(e.target.value)}
            className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl bg-white dark:bg-stone-900 border border-[#E7E2D6] dark:border-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 outline-hidden cursor-pointer shadow-2xs"
          >
            <option value="English">English</option>
            <option value="O'zbekcha">O'zbekcha</option>
            <option value="Русский">Русский</option>
          </select>
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
