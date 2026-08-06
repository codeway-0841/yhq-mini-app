// KIWI — Splash ekran (brend rasm + progress bar)
export default function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #070f1d 0%, #0a1626 100%)' }}>

      {/* Brend kartochkasi — qalqon logo + atrof-dekor bilan */}
      <div className="relative animate-fadeIn">
        <div className="absolute inset-0 blur-3xl opacity-30 rounded-full"
          style={{ background: '#1cb0f6' }} />
        <img
          src="/images/splash-brand.webp"
          alt="KIWI"
          className="relative w-[260px] rounded-3xl shadow-2xl"
          style={{ boxShadow: '0 24px 60px -12px rgba(28, 176, 246, 0.35)' }}
        />
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-24 w-48">
        <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ background: '#1e2c40' }}>
          <div className="h-full rounded-full splash-progress"
            style={{ background: 'linear-gradient(90deg, var(--p-primary), color-mix(in srgb, var(--p-primary) 72%, #000))' }} />
        </div>
        <p className="text-center text-[11px] font-semibold mt-3" style={{ color: '#5f7189' }}>
          Yuklanmoqda...
        </p>
      </div>
    </div>
  )
}
