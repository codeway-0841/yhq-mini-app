import { RiveCanvas } from '../mascot-studio/RiveCanvas'

export type KojiMode = 'reminders' | 'workout' | 'testimonial' | 'place' | 'hero'

interface KojiMascotProps {
  mode: KojiMode
  className?: string
}

/**
 * KojiMascot — Brilliant'ning Koji mascotining 1:1 replikasi.
 * Har bir onboarding qadami uchun jonli Rive animatsiyalari va fallback posterlar:
 * - reminders: Koji "Allow" tugmasini bosib ko'rsatadi
 * - workout: Koji gantel ko'tarib tushiradi (jonli Rive curling mashqi)
 * - testimonial: Koji tabassum qilib nurlanuvchi aura bilan porlaydi (jonli Rive)
 * - place: Suzuvchi kartalar va Koji yumshoq havoda suzadi
 * - hero: Raketa ichidagi Koji va uchish vibratsiyasi
 */
export function KojiMascot({ mode, className = '' }: KojiMascotProps) {
  if (mode === 'hero') {
    return (
      <div className={`relative flex items-center justify-center select-none ${className}`}>
        <img
          src="/images/onboarding/hero_rocket.png"
          alt="Brilliant Rocket"
          className="max-h-full max-w-full object-contain animate-koji-float"
        />
      </div>
    )
  }

  if (mode === 'place') {
    return (
      <div className={`relative flex items-center justify-center select-none ${className}`}>
        <img
          src="/images/onboarding/place_cards.png"
          alt="You're in the right place"
          className="max-h-full max-w-full object-contain animate-koji-float"
        />
      </div>
    )
  }

  if (mode === 'reminders') {
    return (
      <div className={`relative flex items-center justify-center select-none ${className}`}>
        {/* Asl dialog kartochkasi va mascot */}
        <div className="relative flex items-center justify-center">
          <img
            src="/images/onboarding/notification_prompt.png"
            alt="Reach your daily goal with reminders"
            className="max-h-full max-w-full object-contain"
          />

          {/* Bosish pulsatsiyasi (Allow ustida) */}
          <span
            aria-hidden="true"
            className="absolute right-[22%] top-[38%] size-8 -translate-y-1/2 translate-x-1/2 rounded-full bg-emerald-400/30 animate-ping pointer-events-none"
            style={{ animationDuration: '2s' }}
          />
        </div>
      </div>
    )
  }

  if (mode === 'workout') {
    return (
      <div className={`relative flex items-center justify-center select-none ${className}`}>
        {/* Jonli Rive Koji gantel ko'tarish animatsiyasi (curling) */}
        <div className="relative flex items-center justify-center size-52">
          <RiveCanvas
            file="practice_tray_sep_30_2026.riv"
            animation="Curling"
            poster="/images/onboarding/efficacy_workout.png"
            label="Learn 6x more effectively"
            className="is-transparent w-full h-full"
            fit="contain"
          />
        </div>
      </div>
    )
  }

  if (mode === 'testimonial') {
    return (
      <div className={`relative flex items-center justify-center select-none ${className}`}>
        {/* Konsentrik nurlanuvchi auralar (video 0:28 - 0:29) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 m-auto size-40 rounded-full bg-lime-300/35 blur-xl animate-koji-aura"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 m-auto size-48 rounded-full bg-yellow-200/20 blur-2xl animate-koji-aura-outer"
        />

        {/* Tabassum qilayotgan jonli Rive Koji */}
        <div className="relative z-10 flex items-center justify-center size-48 animate-koji-float">
          <RiveCanvas
            file="lohp-cta-koji-rive.ad3fb542.riv"
            animation="react_smile"
            poster="/images/onboarding/testimonial_mascot.png"
            label="You're on your way!"
            className="is-transparent w-full h-full"
            fit="contain"
          />
        </div>
      </div>
    )
  }

  return null
}
