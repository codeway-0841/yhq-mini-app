// YHQ Test — Splash ekran (mockup 1-chi ekran bo'yicha)
// Qalqon logotipi + progress bar + yuklanish matni
export default function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0a1520 0%, #0d1a2b 100%)' }}>

      {/* Dekorativ suvora tarqalgan ikonkalar */}
      <DecorIcon className="top-[12%] left-[18%]" rotate="-12deg"><CarIcon /></DecorIcon>
      <DecorIcon className="top-[9%] right-[20%]" rotate="10deg"><BookIcon /></DecorIcon>
      <DecorIcon className="top-[24%] right-[14%]" rotate="-8deg"><FlaskIcon /></DecorIcon>
      <DecorIcon className="top-[24%] left-[13%]" rotate="14deg"><ZapIcon /></DecorIcon>
      <DecorIcon className="bottom-[28%] left-[16%]" rotate="8deg"><GlobeIcon /></DecorIcon>
      <DecorIcon className="bottom-[32%] right-[18%]" rotate="-14deg"><PiIcon /></DecorIcon>
      <DecorIcon className="top-[46%] left-[7%]" rotate="20deg"><BookIcon /></DecorIcon>
      <DecorIcon className="top-[50%] right-[8%]" rotate="-18deg"><ZapIcon /></DecorIcon>

      {/* Qalqon — glow bilan */}
      <div className="relative">
        <div className="absolute inset-0 blur-3xl opacity-40 rounded-full"
          style={{ background: '#1cb0f6' }} />
        <ShieldLogo />
      </div>

      {/* Nom + tagline */}
      <h1 className="mt-10 text-[34px] font-black tracking-tight text-white">
        YHQ <span className="text-duo-green">Test</span>
      </h1>
      <p className="mt-1 text-[13px] font-semibold" style={{ color: '#7f93ab' }}>
        Imtihonga tayyorlaning
      </p>

      {/* Progress bar */}
      <div className="absolute bottom-24 w-48">
        <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ background: '#1e2c40' }}>
          <div className="h-full rounded-full splash-progress"
            style={{ background: 'linear-gradient(90deg, #58cc02, #46a302)' }} />
        </div>
        <p className="text-center text-[11px] font-semibold mt-3" style={{ color: '#5f7189' }}>
          Yuklanmoqda...
        </p>
      </div>
    </div>
  )
}

// ── Qalqon logotipi (SVG) ───────────────────────────────────────────────────
function ShieldLogo() {
  return (
    <svg width="200" height="220" viewBox="0 0 200 220" fill="none" className="relative">
      <defs>
        <linearGradient id="shieldFace" x1="60" y1="20" x2="145" y2="195" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b8eea" />
          <stop offset="1" stopColor="#1E5BC6" />
        </linearGradient>
        <linearGradient id="shieldEdge" x1="30" y1="10" x2="170" y2="210" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5db3ff" />
          <stop offset="1" stopColor="#1cb0f6" />
        </linearGradient>
      </defs>
      {/* Qalqon tanasi */}
      <path
        d="M100 12 L172 38 C172 38 176 118 158 156 C142 190 100 210 100 210 C100 210 58 190 42 156 C24 118 28 38 28 38 Z"
        fill="url(#shieldFace)" stroke="url(#shieldEdge)" strokeWidth="9" strokeLinejoin="round"
      />
      {/* Ichki soyali qovurg'a */}
      <path
        d="M100 30 L154 49 C154 49 157 115 143 145 C131 173 100 189 100 189 C100 189 69 173 57 145 C43 115 46 49 46 49 Z"
        fill="#ffffff" fillOpacity="0.07"
      />
      {/* YHQ / TEST matni */}
      <text x="100" y="112" textAnchor="middle" fill="#fff" fontFamily="Nunito, sans-serif"
        fontWeight="900" fontSize="46" letterSpacing="1">YHQ</text>
      <text x="100" y="146" textAnchor="middle" fill="#58cc02" fontFamily="Nunito, sans-serif"
        fontWeight="900" fontSize="22" letterSpacing="4">TEST</text>
      {/* Yashil tasdiq doirasi */}
      <circle cx="158" cy="182" r="30" fill="#58cc02" stroke="#0d1a2b" strokeWidth="6" />
      <path d="M144 181 L154 192 L172 171" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

// ── Dekorativ ikonkalar ─────────────────────────────────────────────────────
function DecorIcon({ children, className = '', rotate = '0deg' }: {
  children: React.ReactNode; className?: string; rotate?: string
}) {
  return (
    <div className={`absolute opacity-60 splash-float ${className}`}
      style={{ transform: `rotate(${rotate})`, color: '#3c5878' }}>
      {children}
    </div>
  )
}

const stroke = { strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function CarIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
      <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14a2 2 0 0 1 2 2v4h-2m-14 0H3v-4a2 2 0 0 1 2-2m2 8v-2h10v2" />
      <circle cx="7.5" cy="17" r="1.6" /> <circle cx="16.5" cy="17" r="1.6" />
    </svg>
  )
}
function BookIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
      <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
function FlaskIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
      <path d="M10 2v6L4.6 18a2 2 0 0 0 1.8 3h11.2a2 2 0 0 0 1.8-3L14 8V2M8.5 2h7" />
    </svg>
  )
}
function ZapIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#ffc800" stroke="none">
      <path d="M13 2L4.8 13.2c-.4.6 0 1.3.7 1.3H11l-1.5 7.3c-.2.8.9 1.2 1.4.5L19.4 9.9c.5-.6.1-1.4-.6-1.4H13l1.5-6.2c.2-.9-.9-1.3-1.5-.3z" />
    </svg>
  )
}
function GlobeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
  )
}
function PiIcon() {
  return <span style={{ fontSize: 26, fontWeight: 900, color: '#5a4a8a', fontFamily: 'Nunito, sans-serif' }}>π</span>
}
