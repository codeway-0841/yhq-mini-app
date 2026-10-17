/**
 * UI ovoz effektlari — Web Audio API (audio FAYL KERAK EMAS).
 *
 * Prensip: "ASMR", mayin, quloqqa yoqimli va odamni charchatmaydigan akustik tuyg'u:
 * - Dissonans va o'tkir (harsh/piercing) chastotalardan xoli;
 * - Past-o'tkazuvchi filtr (BiquadFilter) orqali raqamli qattiqlik yumshatilgan;
 * - Xato (error) ovozi: quloqqa botadigan keskin buzzer EMAS, balki mayin, sokin yog'och "uh-oh" zarbi;
 * - To'g'ri javob (success): yoqimli marimba/kalimba akkordi (dopamin beruvchi iliq jarang);
 * - Tugma bosilishi (click): mikrotaktil, suv tomchisi / bubble uslubidagi yumshoq tap.
 *
 * AudioContext faqat birinchi foydalanuvchi harakatidan keyin faollashadi.
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

/**
 * Har temaning asosiy chastotasi (Hz) — quloqqa eng qulay 440–554 Hz (A4–C#5) oralig'ida.
 * O'ta baland chastotalar chiqarib tashlandi, natijada har qanday temada ovozlar mayin va musiqiy eshitiladi.
 */
const THEME_FREQ: Record<string, number> = {
  kiwi:        523,   // C5 — yorqin, toza standart
  aurora:      554,   // C#5 — zamonaviy, yorug'
  violet:      523,   // C5 — mayin, sehrli
  ocean:       494,   // B4 — chuqur, sokin
  forest:      440,   // A4 — tabiiy, iliq
  sunset:      466,   // Bb4 — iliq oqshom
  sakura:      554,   // C#5 — nafis, yengil
  obsidian:    440,   // A4 — minimal, jiddiy
  linear:      440,   // A4 — professional
  gold:        523,   // C5 — olijanob
  payme:       523,   // C5 — toza
  cupertino:   523,   // C5 — Apple iOS uslubi
  titanium:    494,   // B4 — metallik, jiddiy Pro
  deeppurple:  523,   // C5 — nafis binafsha
  liquidglass: 554,   // C#5 — shaffof Vision chime
}

function themeBase(): number {
  const a = typeof document !== 'undefined' ? document.body.dataset.accent : undefined
  return THEME_FREQ[a ?? 'kiwi'] ?? THEME_FREQ.kiwi
}

interface NoteOptions {
  type?: OscillatorType
  pitchEnd?: number        // chastotaning tushishi (organik zarb effekti)
  warmth?: boolean         // mayin 2-garmonika (marimba/qo'ng'iroq iliqligi)
  filterCutoff?: number    // past-o'tkazuvchi filtr (o'tkir raqamli shovqinni kesish)
  attackTime?: number      // zarb vaqti
}

/**
 * Akustik mayin nota generatsiyasi (BiquadFilter + silliq envelope)
 */
function playWarmNote(
  freq: number,
  at: number,
  dur: number,
  volume = 0.05,
  options: NoteOptions = {},
) {
  const c = ensureCtx()
  if (!c) return

  const osc = c.createOscillator()
  const gain = c.createGain()

  // 1. Filtr — keskin raqamli chastotalarni yumshatish (agar brauzer qo'llasa)
  const filter = typeof c.createBiquadFilter === 'function' ? c.createBiquadFilter() : null
  if (filter) {
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(options.filterCutoff ?? 3200, at)
  }

  // 2. Osillyator turi va chastotasi
  osc.type = options.type ?? 'sine'
  osc.frequency.setValueAtTime(Math.max(20, freq), at)
  if (options.pitchEnd && options.pitchEnd > 0) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.pitchEnd), at + dur)
  }

  // 3. Ovoz darajasi (click/pop oldini olish uchun silliq attack + tabiiy eksponensial decay)
  const attack = options.attackTime ?? Math.min(0.008, dur * 0.15)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.linearRampToValueAtTime(volume, at + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)

  if (filter) {
    osc.connect(filter)
    filter.connect(gain)
  } else {
    osc.connect(gain)
  }
  gain.connect(c.destination)

  osc.start(at)
  osc.stop(at + dur + 0.02)

  // 4. Mayin 2-oktava garmonikasi (marimba / akustik rezonans iliqligi)
  if (options.warmth) {
    const harmOsc = c.createOscillator()
    const harmGain = c.createGain()
    harmOsc.type = 'sine'
    harmOsc.frequency.setValueAtTime(freq * 2, at)
    if (options.pitchEnd) {
      harmOsc.frequency.exponentialRampToValueAtTime(Math.max(40, options.pitchEnd * 2), at + dur * 0.7)
    }

    harmGain.gain.setValueAtTime(0.0001, at)
    harmGain.gain.linearRampToValueAtTime(volume * 0.22, at + attack)
    harmGain.gain.exponentialRampToValueAtTime(0.0001, at + dur * 0.65)

    if (filter) {
      harmOsc.connect(filter)
    } else {
      harmOsc.connect(harmGain)
    }
    harmGain.connect(c.destination)
    harmOsc.start(at)
    harmOsc.stop(at + dur * 0.7)
  }
}

/** Tanga yomg'iri (mayin oltin tangalar jiringlashi) */
function coinsCascade(baseFreq: number, at: number) {
  // Pentatonik iliq intervallar
  const intervals = [1.5, 1.875, 2.25, 2.5, 3.0]
  intervals.forEach((ratio, idx) => {
    const delay = at + idx * 0.04
    playWarmNote(baseFreq * ratio, delay, 0.14, 0.03, {
      filterCutoff: 3600,
      attackTime: 0.004,
    })
  })
}

export type SoundKind =
  | 'click'
  | 'success'
  | 'error'
  | 'coins'
  | 'chime'
  | 'win'
  | 'achievement'
  | 'combo'
  | 'match'
  | 'toggle'
  | 'emote_pop'
  | 'emote_whoosh'
  | 'emote_splash'

/** Master ovoz funksiyasi — barcha UI portlari shu orqali yangraydi */
export function playSound(kind: SoundKind) {
  const c = ensureCtx()
  if (!c) return
  const t = c.currentTime
  const base = themeBase()

  switch (kind) {
    case 'click':
      // 🫧 Taktil mayin tap (ASMR suv tomchisi / nozik pufakcha)
      playWarmNote(360, t, 0.024, 0.038, {
        pitchEnd: 110,
        filterCutoff: 1800,
        attackTime: 0.002,
      })
      break

    case 'success':
      // ✨ To'g'ri javob — mayin marimba zangi (dopamin beruvchi iliq akkord)
      // 1-nota: Asosiy ton (masalan, C5)
      playWarmNote(base, t, 0.16, 0.055, { warmth: true, filterCutoff: 2800 })
      // 2-nota: Kvantli ko'tarilish (sof kvinta, masalan, G5)
      playWarmNote(base * 1.5, t + 0.05, 0.24, 0.06, { warmth: true, filterCutoff: 3000 })
      // 3-nota: Nozik yuqori zarracha (oktava aks sadosi)
      playWarmNote(base * 2.0, t + 0.09, 0.18, 0.025, { filterCutoff: 3200 })
      break

    case 'error':
      // 🍃 Xato — quloqqa botmaydigan, mayin yog'och zarbi ("uh-oh" xotirjam ton)
      // Hech qanday g'ijirlaydigan uchburchak/saw yo'q — faqat yumshoq past sinus
      playWarmNote(base * 0.62, t, 0.08, 0.038, {
        pitchEnd: base * 0.52,
        filterCutoff: 750,
      })
      playWarmNote(base * 0.48, t + 0.065, 0.12, 0.032, {
        pitchEnd: base * 0.40,
        filterCutoff: 650,
      })
      break

    case 'coins':
      // 🪙 Oltin tangalar — mayin, shaffof jiringlash
      coinsCascade(base, t)
      break

    case 'chime':
      // 🔔 Tinchlantiruvchi iliq akkord
      playWarmNote(base, t, 0.32, 0.045, { warmth: true, filterCutoff: 2400 })
      playWarmNote(base * 1.5, t + 0.04, 0.38, 0.04, { warmth: true, filterCutoff: 2600 })
      break

    case 'win':
      // 🏆 G'alaba — iliq tantanavor akkord + tangalar
      playWarmNote(base, t, 0.18, 0.055, { warmth: true })
      playWarmNote(base * 1.25, t + 0.06, 0.20, 0.055, { warmth: true })
      playWarmNote(base * 1.5, t + 0.12, 0.24, 0.06, { warmth: true })
      playWarmNote(base * 2.0, t + 0.18, 0.32, 0.045, { filterCutoff: 3200 })
      coinsCascade(base, t + 0.25)
      break

    case 'achievement':
      // 🌟 Yutuq / Nishon ochilishi — chuqur, shukuhli akkord
      playWarmNote(base * 0.75, t, 0.22, 0.05, { warmth: true })
      playWarmNote(base, t + 0.07, 0.24, 0.055, { warmth: true })
      playWarmNote(base * 1.25, t + 0.14, 0.26, 0.06, { warmth: true })
      playWarmNote(base * 1.5, t + 0.21, 0.32, 0.065, { warmth: true })
      playWarmNote(base * 2.0, t + 0.28, 0.38, 0.05, { filterCutoff: 3400 })
      coinsCascade(base * 1.1, t + 0.38)
      break

    case 'combo':
      // 🔥 3+ ketma-ket to'g'ri javob — shiddatli, quvnoq o'sish
      playWarmNote(base, t, 0.14, 0.05, { warmth: true })
      playWarmNote(base * 1.25, t + 0.045, 0.16, 0.055, { warmth: true })
      playWarmNote(base * 1.5, t + 0.09, 0.24, 0.065, { warmth: true })
      playWarmNote(base * 2.0, t + 0.13, 0.22, 0.035, { filterCutoff: 3400 })
      break

    case 'match':
      // ⚔ Raqib topildi — yoqimli ikki zarb
      playWarmNote(base * 0.85, t, 0.11, 0.05, { warmth: true, pitchEnd: base * 0.75 })
      playWarmNote(base * 1.25, t + 0.09, 0.18, 0.055, { warmth: true })
      break

    case 'toggle':
      // 🔘 Mayin mikrosvitsh
      playWarmNote(420, t, 0.016, 0.035, { pitchEnd: 180, filterCutoff: 1600 })
      break

    case 'emote_pop':
      // 🎭 Tabiiy pufakcha ovozi
      playWarmNote(300, t, 0.035, 0.05, { pitchEnd: 750, filterCutoff: 2400 })
      break

    case 'emote_whoosh':
      // ⚡ Yengil shabada
      playWarmNote(360, t, 0.07, 0.04, { pitchEnd: 160, filterCutoff: 1200 })
      break

    case 'emote_splash':
      // 💧 Mayin tomchi
      playWarmNote(520, t, 0.045, 0.045, { pitchEnd: 240, filterCutoff: 1800 })
      playWarmNote(720, t + 0.03, 0.06, 0.035, { filterCutoff: 2200 })
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
