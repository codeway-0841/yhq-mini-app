/**
 * UI ovoz effektlari — Web Audio API (audio FAYL KERAK EMAS).
 *
 * Prensip: juda xotirjam (past volume), premium "ASMR" tuyg'u:
 * qisqa sinus/chime portamento'siz, yumshoq envelope bilan.
 * Tema-moslashuv: har aksent temasining o'z asosiy chastotasi bor
 * (body[data-accent] dan o'qiladi) — Forest past va yumshoq,
 * Aurora yuqori va "futuristik" va h.k.
 *
 * AudioContext faqat birinchi foydalanuvchi harakatidan keyin yaratiladi
 * (browser autoplay siyosati) — shu bois birinchi tap ovozsiz bo'lishi normal.
 */

let ctx: AudioContext | null = null

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

// Autoplay unlock — birinchi harakatda kontekstni ochib qo'yamiz
if (typeof document !== 'undefined') {
  const unlock = () => ensureCtx()
  document.addEventListener('pointerdown', unlock, { once: true })
}

/** Har temaning asosiy chastotasi (Hz) — "ilova ovozi" temaga moslashadi */
const THEME_FREQ: Record<string, number> = {
  kiwi:     660,   // yorqin, standart
  aurora:   880,   // yuqori, futuristik
  violet:   740,   // binafsha "magic"
  ocean:    620,   // chuqur, sokin
  forest:   520,   // past, tabiiy
  sunset:   560,   // iliq
  sakura:   780,   // yengil, nafis
  obsidian: 440,   // minimal, jiddiy
  gold:     700,   // premium zang
  payme:    640,   // toza, moliyaviy
}

function themeBase(): number {
  const a = typeof document !== 'undefined' ? document.body.dataset.accent : undefined
  return THEME_FREQ[a ?? 'kiwi'] ?? THEME_FREQ.kiwi
}

function tone(freq: number, at: number, dur: number, type: OscillatorType, peak: number) {
  const c = ensureCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

export type SoundKind = 'click' | 'success' | 'error' | 'chime' | 'win' | 'combo' | 'match' | 'toggle' | 'emote_pop' | 'emote_whoosh' | 'emote_splash'

/** Master ovoz funksiyasi — barcha UI portlari shu orqali o'ynaydi */
export function playSound(kind: SoundKind) {
  const c = ensureCtx()
  if (!c) return
  const t = c.currentTime
  const base = themeBase()

  switch (kind) {
    case 'click':
      // Yumshoq premium "tap"
      tone(base, t, 0.09, 'sine', 0.05)
      break
    case 'success':
      // Yuqoriga ikki nota — yengil sevinch
      tone(base, t, 0.10, 'sine', 0.06)
      tone(base * 1.335, t + 0.08, 0.14, 'sine', 0.06)
      break
    case 'error':
      // Pastga yumshoq signal (qora emas)
      tone(base * 0.8, t, 0.12, 'triangle', 0.05)
      tone(base * 0.6, t + 0.07, 0.16, 'triangle', 0.05)
      break
    case 'chime':
      // Tema unlock — uch nota portamento'siz
      tone(base, t, 0.12, 'sine', 0.055)
      tone(base * 1.25, t + 0.09, 0.12, 'sine', 0.055)
      tone(base * 1.5, t + 0.18, 0.2, 'sine', 0.05)
      break
    case 'win':
      // Natija ochildi — qisqa fanfar
      tone(base, t, 0.12, 'sine', 0.055)
      tone(base * 1.25, t + 0.1, 0.12, 'sine', 0.055)
      tone(base * 1.5, t + 0.2, 0.14, 'sine', 0.055)
      tone(base * 2, t + 0.3, 0.26, 'sine', 0.05)
      break
    case 'combo':
      // 🔥 3+ to'g'ri javob ketma-ketligi — ko'tariladigan to'lqin
      tone(base * 1.25, t, 0.10, 'sine', 0.06)
      tone(base * 1.5, t + 0.07, 0.10, 'sine', 0.06)
      tone(base * 2, t + 0.14, 0.18, 'sine', 0.06)
      break
    case 'match':
      // ⚔ Raqib topildi — "game start" ikki zarb
      tone(base, t, 0.10, 'triangle', 0.06)
      tone(base * 2, t + 0.1, 0.16, 'triangle', 0.055)
      break
    case 'toggle':
      // Sozlamalar switch — juda qisqa tick
      tone(base * 1.5, t, 0.05, 'sine', 0.04)
      break
    case 'emote_pop':
      // 🎭 Jonli smaylik — ASMR pufakcha tovushi
      tone(base * 1.8, t, 0.06, 'sine', 0.06)
      tone(base * 2.4, t + 0.03, 0.08, 'sine', 0.05)
      break
    case 'emote_whoosh':
      // ⚡ Tezkor fraza — uchuvchi tovush
      tone(base * 1.2, t, 0.08, 'triangle', 0.05)
      tone(base * 1.6, t + 0.05, 0.12, 'sine', 0.05)
      break
    case 'emote_splash':
      // 🍅 Pomidor / Muz — splash tovushi
      tone(base * 0.9, t, 0.06, 'triangle', 0.06)
      tone(base * 1.4, t + 0.04, 0.09, 'sine', 0.05)
      break
  }
}

/* ── Global: asosiy CTA tugmalar bosilganda yumshoq "tap" ──────────────────
   Event delegation — har sahifaga alohida yozish shart emas. */
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('button.bg-pprimary')
    if (el && !(el as HTMLButtonElement).disabled) playSound('click')
  })
}
