export type OnboardingStep =
  | 'welcome'
  | 'persona'
  | 'interest'
  | 'interstitial_place'
  | 'daily_goal'
  | 'reminders'
  | 'level'
  | 'interstitial_efficacy'
  | 'testimonial'

export interface OnboardingState {
  persona: string | null
  interest: string | null
  dailyGoal: number | null
  level: string | null
  notificationsAllowed: boolean | null
}

export const ONBOARDING_STEPS_ORDER: OnboardingStep[] = [
  'welcome',
  'persona',
  'interest',
  'interstitial_place',
  'daily_goal',
  'reminders',
  'level',
  'interstitial_efficacy',
  'testimonial',
]

/** Progress percentage for each step matching the video progress bar */
export const STEP_PROGRESS: Record<OnboardingStep, number> = {
  welcome: 0,
  persona: 14,
  interest: 28,
  interstitial_place: 42,
  daily_goal: 56,
  reminders: 70,
  level: 82,
  interstitial_efficacy: 92,
  testimonial: 100,
}
