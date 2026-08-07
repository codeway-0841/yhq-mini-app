// KIWI — Splash ekran (brend rasm + progress bar)
// v2 premium: yumshoq kirish animatsiyasi + aksent-mos halo + shine progress
export default function SplashScreen() {
  return (
    <div className="font-display min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, var(--p-canvas) 0%, var(--p-surface) 100%)' }}>

      {/* Brend kartochkasi — yumshoq kirish; ortiqcha glow/halo YO'Q (toza) */}
      <div className="relative animate-premiumIn">
        <img
          src="/images/splash-brand.webp"
          alt="KIWI"
          className="relative w-[260px] rounded-3xl"
          style={{ boxShadow: '0 20px 50px -16px rgba(0, 0, 0, 0.55)' }}
        />
      </div>

      {/* Progress bar — aksent gradient + yuguruvchi shine */}
      <div className="absolute bottom-24 w-48">
        <div className="w-full h-[6px] rounded-full overflow-hidden relative"
          style={{ background: 'var(--p-line)' }}>
          <div className="h-full rounded-full splash-progress"
            style={{ background: 'linear-gradient(90deg, var(--p-primary), color-mix(in srgb, var(--p-primary) 72%, #000))' }} />
          <div className="absolute inset-0 shimmer" />
        </div>
        <p className="text-center text-[11px] font-medium mt-3 text-psubtle tracking-wide">
          Yuklanmoqda...
        </p>
      </div>
    </div>
  )
}

