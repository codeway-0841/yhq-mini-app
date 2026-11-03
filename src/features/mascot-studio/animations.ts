import type { Keys } from '../../shared/i18n'

export interface MascotAnimation {
  id: string
  file: string
  titleKey: Keys
  descriptionKey: Keys
  poster: string
  artboard?: string
  alignment?: 'center' | 'bottom'
  animations: readonly string[]
}

// Timeline names are case-sensitive and come from the extracted .riv files.
export const MASCOT_ANIMATIONS: readonly MascotAnimation[] = [
  {
    id: 'speech',
    file: 'nux_revamp.d192d940.riv',
    titleKey: 'mascotSpeechTitle',
    descriptionKey: 'mascotSpeechDesc',
    poster: '/brilliant/mascot_blue.png',
    artboard: 'MAIN_Koji-speech',
    animations: ['wave_oneBubble', 'wave_twoBubble', 'wave_threeBubble', 'idle'],
  },
  {
    id: 'streak',
    file: 'nux-koji.2611eb62.riv',
    titleKey: 'mascotStreakTitle',
    descriptionKey: 'mascotStreakDesc',
    poster: '/brilliant/mascot_purple.png',
    artboard: 'koji',
    animations: ['what_gain-loop', 'koji_glow', 'streaks_gain_low-rise', 'what_loss-idle'],
  },
  {
    id: 'practice',
    file: 'nux_revamp.d192d940.riv',
    titleKey: 'mascotPracticeTitle',
    descriptionKey: 'mascotPracticeDesc',
    poster: '/brilliant/mascot_blue.png',
    artboard: 'MAIN_dumbbell-tricks',
    animations: ['Curling_L', 'Curling_R', 'Toss_L > R', 'force_field_surprise spin', 'inspect_loopable'],
  },
  {
    id: 'book',
    file: 'rux_short_apr_22_26.riv',
    titleKey: 'mascotBookTitle',
    descriptionKey: 'mascotBookDesc',
    poster: '/brilliant/mascot_gold.png',
    artboard: 'MAIN_RUXKojiBook',
    animations: ['IDLE_1', 'IDLE_2', 'NoJump-SitUp', 'Koji_IntroFULL'],
  },
  {
    id: 'habits',
    file: 'nux_koji_reactions_v2.c14662ad.riv',
    titleKey: 'mascotHabitsTitle',
    descriptionKey: 'mascotHabitsDesc',
    poster: '/brilliant/mascot_done.png',
    artboard: 'Koji Reaction Daily Habit',
    animations: ['Tea Idle', 'Bounce', 'Coffee Happy Idle', 'Crossword Idle', 'Phone Idle', 'Idle'],
  },
  {
    id: 'powerUp',
    file: 'koji_speech_apr_22_26.riv',
    titleKey: 'mascotPowerUpTitle',
    descriptionKey: 'mascotPowerUpDesc',
    poster: '/brilliant/mascot_blue.png',
    artboard: 'MAIN_KojiSpeech',
    animations: ['wave_oneBubble', 'powerUp_one', 'powerUp_two', 'powerUp_three'],
  },
  {
    id: 'askKoji',
    file: 'ask_koji.410199b8.riv',
    titleKey: 'mascotAskTitle',
    descriptionKey: 'mascotAskDesc',
    poster: '/brilliant/mascot_blue.png',
    animations: ['enterSwoop', 'lookUp', 'lookRight', 'lookDown', 'lookLeft', 'waveLeft'],
  },
  {
    id: 'onboarding',
    file: 'onboarding-koji.4bd87127.riv',
    titleKey: 'mascotOnboardingTitle',
    descriptionKey: 'mascotOnboardingDesc',
    poster: '/brilliant/mascot_blue.png',
    artboard: 'MAIN_KojiOnboarding',
    animations: ['OnboardingPt3_v03', 'OnboardingPt5', 'OnboardingPt6', 'OnboardingPt7'],
  },
  {
    id: 'phone',
    file: 'push_opt_in_apr_22_26.riv',
    titleKey: 'mascotPhoneTitle',
    descriptionKey: 'mascotPhoneDesc',
    poster: '/brilliant/mascot_blue.png',
    animations: ['Idle', 'Phone'],
  },
  {
    id: 'celebration',
    file: 'post_checkout_apr_01_26.riv',
    titleKey: 'mascotCelebrationTitle',
    descriptionKey: 'mascotCelebrationDesc',
    poster: '/brilliant/mascot_done.png',
    animations: ['Burst_v02', 'Loading_v02'],
  },
  {
    id: 'loader',
    file: 'lesson_loader_apr_13_26.riv',
    titleKey: 'mascotLoaderTitle',
    descriptionKey: 'mascotLoaderDesc',
    poster: '/brilliant/mascot_blue.png',
    animations: ['Loop_down_v03_Minimal', 'Loop_v05_Minimal', 'Koji ripple_on_Minimal'],
  },
  {
    id: 'reactions',
    file: 'lohp-cta-koji-rive.ad3fb542.riv',
    titleKey: 'mascotReactionsTitle',
    descriptionKey: 'mascotReactionsDesc',
    poster: '/brilliant/mascot_gold.png',
    artboard: 'koji asset',
    animations: ['react_smile', 'react_annoyed', 'react_rise', 'active_idle_Left', 'active_idle_Right', 'Talking Loop'],
  },
  {
    id: 'glow',
    file: 'nux-koji.2611eb62.riv',
    titleKey: 'mascotGlowTitle',
    descriptionKey: 'mascotGlowDesc',
    poster: '/brilliant/mascot_done.png',
    artboard: 'koji',
    animations: ['koji_dumbbell', 'koji_glow', 'what_gain-loop', 'what_loss-idle'],
  },
]
