import type { Keys } from '../../shared/i18n'

export interface MascotAnimation {
  id: string
  file: string
  titleKey: Keys
  descriptionKey: Keys
  poster: string
  animations: readonly string[]
}

// Timeline names are case-sensitive and come from the extracted .riv files.
export const MASCOT_ANIMATIONS: readonly MascotAnimation[] = [
  {
    id: 'speech', file: 'koji_speech_apr_22_26.riv',
    titleKey: 'mascotSpeechTitle', descriptionKey: 'mascotSpeechDesc',
    poster: '/brilliant/mascot_blue.png',
    animations: ['idle', 'powerUp_one', 'powerUp_two', 'powerUp_three', 'powerUp_idle '],
  },
  {
    id: 'book', file: 'rux_short_apr_22_26.riv',
    titleKey: 'mascotBookTitle', descriptionKey: 'mascotBookDesc',
    poster: '/brilliant/mascot_gold.png',
    animations: ['4-Day', 'Mock-up', 'No-up'],
  },
  {
    id: 'briefcase', file: 'rux_long_apr_22_26.riv',
    titleKey: 'mascotBriefcaseTitle', descriptionKey: 'mascotBriefcaseDesc',
    poster: '/brilliant/mascot_purple.png',
    animations: ['30-Day', '30-Day 2', 'Mock-up'],
  },
  {
    id: 'practice', file: 'practice_tray_sep_30_2026.riv',
    titleKey: 'mascotPracticeTitle', descriptionKey: 'mascotPracticeDesc',
    poster: '/brilliant/mascot_blue.png',
    animations: ['Idle', 'Curling', 'Curling Struggle', 'Enter_Koji left', 'Exit_spin', 'Rest'],
  },
  {
    id: 'loader', file: 'lesson_loader_apr_13_26.riv',
    titleKey: 'mascotLoaderTitle', descriptionKey: 'mascotLoaderDesc',
    poster: '/brilliant/mascot_blue.png',
    animations: ['Loop_v05_Minimal_No Koji Blur', 'Loop_v05_Minimal', 'Koji ripple_on_Minimal', 'Loop_down_v03_Minimal'],
  },
  {
    id: 'celebration', file: 'post_checkout_apr_01_26.riv',
    titleKey: 'mascotCelebrationTitle', descriptionKey: 'mascotCelebrationDesc',
    poster: '/brilliant/mascot_done.png',
    animations: ['Burst_v02', 'Loading_v02', 'STILL'],
  },
  {
    id: 'phone', file: 'push_opt_in_apr_22_26.riv',
    titleKey: 'mascotPhoneTitle', descriptionKey: 'mascotPhoneDesc',
    poster: '/brilliant/mascot_blue.png',
    animations: ['Idle', 'Phone', 'STILL'],
  },
]
