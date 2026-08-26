// KIWI — Splash ekran (brend rasm + progress bar)
// v2 premium: yumshoq kirish animatsiyasi + aksent-mos halo + shine progress
export default function SplashScreen() {
  return (
    <div className="font-display min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, var(--p-canvas) 0%, var(--p-surface) 100%)' }}>

      {/* Brend kartochkasi — yumshoq kirish; soya/glow YO'Q (toza) */}
      <div className="relative animate-premiumIn">
        {/* webp = 87 KB, png = 1.42 MB (16x). Splash birinchi ko'rinadigan
            rasm — png versiyasi boot'da bir necha soniya yeyardi. <picture>
            webp'ni qo'llamaydigan eski WebView'lar uchun png'ga tushadi. */}
        <picture>
          <source srcSet="/images/splash-brand.webp" type="image/webp" />
          <img
            src="/images/splash-brand.png"
            alt="KIWI"
            width={260}
            height={260}
            decoding="async"
            className="relative w-[260px] rounded-container"
          />
        </picture>
      </div>

      {/* Progress bar — neytral, neonsiz */}
      <div className="absolute bottom-24 w-48">
        <div className="w-full h-[6px] rounded-full overflow-hidden"
          style={{ background: 'var(--p-line)' }}>
          <div className="h-full rounded-full splash-progress"
            style={{ background: 'var(--p-muted)' }} />
        </div>
        <p className="text-center text-[11px] font-medium mt-3 text-psubtle tracking-wide">
          Yuklanmoqda...
        </p>
      </div>
    </div>
  )
}

