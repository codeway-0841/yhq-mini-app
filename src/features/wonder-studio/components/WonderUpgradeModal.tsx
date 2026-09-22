import { useState } from 'react'
import { X } from 'lucide-react'
import {
  WonderRedBear,
  WonderProCheckmark,
  WonderFreeCheckmark,
  WonderFreeXCircle,
} from './WonderIcons'

interface WonderUpgradeModalProps {
  onClose: () => void
}

export default function WonderUpgradeModal({ onClose }: WonderUpgradeModalProps) {
  const [isSuccess, setIsSuccess] = useState(false)

  const handleStartTrial = () => {
    setIsSuccess(true)
    setTimeout(() => {
      onClose()
    }, 1500)
  }

  const comparisonRows = [
    { feature: 'Personalized courses', free: true, pro: true },
    { feature: '15x more lessons', free: false, pro: true },
    { feature: '15x more AI chats', free: false, pro: true },
    { feature: 'Up to 15 courses/mo', free: false, pro: true },
    { feature: 'Jump ahead in courses', free: false, pro: true },
    { feature: 'More podcast usage', free: false, pro: true },
    { feature: 'Live tutor', free: false, pro: true },
    { feature: 'MCP access', free: false, pro: true },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs font-sans select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#F6F4EE] dark:bg-[#150F0D] border border-stone-200/90 dark:border-stone-800 shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden">
        {/* Radial Soft Blue Ambient Glow (1:1 with node_clicked_detail.png) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-70"
          style={{
            background:
              'radial-gradient(circle at 50% 28%, rgba(186, 230, 253, 0.55) 0%, rgba(246, 244, 238, 0) 70%)',
          }}
        />

        {/* Close Button in top right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 z-20 p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        {isSuccess ? (
          <div className="py-12 text-center space-y-3 relative z-10">
            <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl">
              ✓
            </div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
              Welcome to Wondering Pro!
            </h2>
            <p className="text-xs text-stone-500">
              Your free week has been activated. Enjoy unlimited learning without limits.
            </p>
          </div>
        ) : (
          <div className="relative z-10 space-y-6">
            {/* Mascot & Title (1:1 with node_clicked_detail.png) */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-tight">
                Learn without limits <br />
                <span className="text-[#67C2F9]">with Pro</span>
              </h2>

              {/* 1:1 Red Mascot Bear SVG Illustration */}
              <div className="py-1 flex items-center justify-center">
                <WonderRedBear size={110} />
              </div>
            </div>

            {/* Comparison Matrix Table (1:1 with screenshot) */}
            <div className="space-y-1 text-xs">
              {/* Table Header */}
              <div className="flex items-center justify-between px-2 pb-1.5 text-stone-400 font-semibold border-b border-stone-200 dark:border-stone-800">
                <span className="flex-1"></span>
                <span className="w-16 text-center">Free</span>
                <span className="w-16 text-center text-[#38BDF8] font-bold">Pro</span>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-stone-100 dark:divide-stone-800/60">
                {comparisonRows.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2.5 px-2 font-medium"
                  >
                    <span className="flex-1 text-stone-800 dark:text-stone-200 text-xs">
                      {row.feature}
                    </span>

                    {/* Free Column */}
                    <div className="w-16 flex items-center justify-center">
                      {row.free ? (
                        <WonderFreeCheckmark size={17} />
                      ) : (
                        <WonderFreeXCircle size={17} />
                      )}
                    </div>

                    {/* Pro Column */}
                    <div className="w-16 flex items-center justify-center">
                      <WonderProCheckmark size={17} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom 3D Blue Button (1:1 with screenshot) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartTrial}
                className="w-full py-3.5 rounded-xl bg-[#67C2F9] hover:bg-[#5BB9F5] text-[#261312] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center"
              >
                START MY FREE WEEK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
