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
  cupertino:   520,   // toza, Apple iOS chime
  titanium:    580,   // metallik, jiddiy Pro
  deeppurple:  760,   // nafis binafsha
  liquidglass: 840,   // kristall, shaffof Vision chime
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
  osc.frequency.setValueAtTime(freq, at)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.012, dur * 0.2))
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

/** ASMR Kristall "ting" — fundamental nota + shaffof garmonika va yumshoq aks sado */
function crystalTing(baseFreq: number, at: number, volume = 0.075) {
  const c = ensureCtx()
  if (!c) return
  // 1. Asosiy tiniq nota
  tone(baseFreq, at, 0.22, 'sine', volume)
  // 2. Yuqori shaffof kristall garmonika (2.76x)
  tone(baseFreq * 2.756, at, 0.12, 'sine', volume * 0.45)
  // 3. Mayin sevinch akkordi (1.335x)
  tone(baseFreq * 1.335, at + 0.05, 0.26, 'sine', volume * 0.85)
  // 4. Yuqori oktava aks-sadosi
  tone(baseFreq * 2.0, at + 0.09, 0.28, 'sine', volume * 0.4)
}

/** Oltin tangalar yomg'iri (ASMR coin cascade) */
function coinsCascade(baseFreq: number, at: number) {
  const freqs = [
    baseFreq * 1.5,
    baseFreq * 1.88,
    baseFreq * 2.25,
    baseFreq * 2.66,
    baseFreq * 3.0,
    baseFreq * 3.55,
  ]
  freqs.forEach((f, idx) => {
    const delay = at + idx * 0.045
    tone(f, delay, 0.14, 'sine', 0.045)
    tone(f * 2.4, delay, 0.06, 'triangle', 0.02)
  })
}

export type SoundKind =
  | 'click'
  | 'success'
  | 'error'
  | 'coins'
  | 'chime'
  | 'win'
  | 'combo'
  | 'match'
  | 'toggle'
  | 'emote_pop'
  | 'emote_whoosh'
  | 'emote_splash'

/** Master ovoz funksiyasi — barcha UI portlari shu orqali o'ynaydi */
export function playSound(kind: SoundKind) {
  const c = ensureCtx()
  if (!c) return
  const t = c.currentTime
  const base = themeBase()

  switch (kind) {
    case 'click':
      // Yoqimli shaffof "tap" (ASMR bubble click)
      tone(base * 1.1, t, 0.035, 'sine', 0.045)
      break
    case 'success':
      // ✨ Kristall "ting" ovozi — juda yoqimli to'g'ri javob effekti
      crystalTing(base, t, 0.075)
      break
    case 'error':
      // Yumshoq pastki signal (quloqqa botmaydigan)
      tone(base * 0.75, t, 0.09, 'triangle', 0.045)
      tone(base * 0.55, t + 0.06, 0.12, 'triangle', 0.04)
      break
    case 'coins':
      // 🪙 Oltin tangalar yomg'iri / tanga yutib olish
      coinsCascade(base, t)
      break
    case 'chime':
      // Tema unlock — uch nota
      tone(base, t, 0.12, 'sine', 0.055)
      tone(base * 1.25, t + 0.08, 0.12, 'sine', 0.055)
      tone(base * 1.5, t + 0.16, 0.22, 'sine', 0.05)
      break
    case 'win':
      // 🏆 G'alaba tantanasi + oltin tangalar yomg'iri
      crystalTing(base, t, 0.08)
      crystalTing(base * 1.25, t + 0.12, 0.08)
      coinsCascade(base, t + 0.24)
      break
    case 'combo':
      // 🔥 3+ to'g'ri javob ketma-ketligi — shiddatli quvvat akkordi
      crystalTing(base * 1.25, t, 0.08)
      crystalTing(base * 1.5, t + 0.08, 0.085)
      break
    case 'match':
      // ⚔ Raqib topildi — "game start" ikki zarb
      tone(base, t, 0.10, 'triangle', 0.06)
      tone(base * 2, t + 0.1, 0.16, 'triangle', 0.055)
      break
    case 'toggle':
      // Sozlamalar switch — juda qisqa tick
      tone(base * 1.6, t, 0.04, 'sine', 0.04)
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
