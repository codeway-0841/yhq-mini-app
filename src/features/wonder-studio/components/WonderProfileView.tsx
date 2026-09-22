import { useWonderStore } from '../store/useWonderStore'
import { WonderDiscordIcon } from './WonderIcons'

export default function WonderProfileView() {
  const setCurrentNav = useWonderStore((s) => s.setCurrentNav)

  return (
    <div className="relative flex-1 flex flex-col justify-between items-center px-4 py-8 font-sans select-none min-h-[calc(100vh-6rem)] animate-in fade-in duration-200">
      {/* 1:1 Subtle Radial Cyan Ambient Glow from auth_profile.png */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 22%, rgba(186, 230, 253, 0.45) 0%, rgba(246, 244, 238, 0) 65%)',
        }}
      />

      {/* Main Centered Content: Speech Bubble + Star Mascot + Headings */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto text-center max-w-md w-full">
        {/* Speech Bubble pointing down to mascot */}
        <div className="relative mb-3 inline-block">
          <div className="rounded-2xl border border-stone-800 dark:border-stone-200 bg-white dark:bg-[#1E1512] px-5 py-2 text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 shadow-2xs">
            Thanks for being here!
          </div>
          {/* Downward triangle pointer */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-stone-800 dark:border-t-stone-200" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-white dark:border-t-[#1E1512]" />
        </div>

        {/* 1:1 Solid Dark Chubby Star Mascot */}
        <div className="size-24 sm:size-28 flex items-center justify-center my-2 select-none">
          <img
            src="/star.svg"
            alt="Wondering Mascot"
            className="size-20 sm:size-24 object-contain select-none pointer-events-none"
          />
        </div>

        {/* Headings */}
        <h1 className="mt-4 text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-snug">
          You&apos;re one of the first to explore
          <span className="block mt-0.5 font-bold">Wondering</span>
        </h1>

        <p className="mt-2 text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-normal">
          It&apos;s early, your input will help shape what&apos;s next.
        </p>
      </div>

      {/* 1:1 Bottom Actions from auth_profile.png */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-md space-y-3 pt-6 pb-2">
        <p className="text-xs text-stone-600 dark:text-stone-400 font-medium">
          Join our Discord for feedback and learning tips!
        </p>

        {/* Button 1: JOIN OUR DISCORD (3D Beige Card) */}
        <a
          href="https://discord.gg"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 px-6 rounded-xl border border-[#D5CFC2] dark:border-stone-700 bg-[#FAF8F2] dark:bg-[#221A17] text-stone-900 dark:text-stone-100 font-mono font-bold text-xs uppercase tracking-wider shadow-[0_4px_0_0_#9E9789] dark:shadow-[0_4px_0_0_#292524] hover:bg-white dark:hover:bg-stone-800 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <WonderDiscordIcon size={18} className="text-stone-900 dark:text-stone-100" />
          <span>
            JOIN OUR <span className="text-[#5865F2]">DISCORD</span>
          </span>
        </a>

        {/* Button 2: LET'S GO! (3D Sky-Blue Extruded Button) */}
        <button
          type="button"
          onClick={() => setCurrentNav('home')}
          className="w-full py-3.5 px-6 rounded-xl bg-[#67C2F9] hover:bg-[#5BB9F5] text-[#261312] font-mono font-bold text-xs uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center"
        >
          LET&apos;S GO!
        </button>
      </div>
    </div>
  )
}
