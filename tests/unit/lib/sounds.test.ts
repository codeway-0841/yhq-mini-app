import { describe, it, expect } from 'vitest'
import { isActiveSound, playSound, resolveBrilliantSound, type SoundKind } from '../../../src/shared/lib/sounds'
import { BRILLIANT_SOUNDS } from '../../../src/shared/lib/brilliantSounds'
import { haptics } from '../../../src/platform/haptics'

describe('shared/lib/sounds — Brilliant.org 1:1 audio mapping', () => {
  it('all legacy and Brilliant sound kinds resolve and execute safely without throwing', () => {
    const legacyKinds: SoundKind[] = [
      'click',
      'success',
      'error',
      'coins',
      'chime',
      'win',
      'achievement',
      'combo',
      'match',
      'toggle',
      'emote_pop',
      'emote_whoosh',
      'emote_splash',
    ]
    for (const k of legacyKinds) {
      expect(BRILLIANT_SOUNDS.some((s) => s.id === resolveBrilliantSound(k))).toBe(true)
      expect(() => playSound(k)).not.toThrow()
    }
    for (const s of BRILLIANT_SOUNDS) {
      expect(resolveBrilliantSound(s.id)).toBe(s.id)
      expect(() => playSound(s.id)).not.toThrow()
    }
  })

  it('faqat ruxsat etilgan tovushlar faol (to‘g‘ri/xato, toggle, A/B/C/D variant, yakun/XP/streak/liga faol; qo‘pol tugma kliklari o‘chirilgan)', () => {
    const enabled: SoundKind[] = [
      'correct',
      'incorrect',
      'success',
      'error',
      'lesson-failed',
      'toggle',
      'toggle-on',
      'toggle-off',
      'assessment-click-option-1',
      'assessment-click-option-2',
      'assessment-click-option-3',
      'assessment-click-option-4',
      'lightweight-choice',
      'endstate',
      'win',
      'diagnostic-complete',
      'achievement',
      'xp-tally',
      'coins',
      'tutor-xp-countup-start',
      'tutor-xp-countup-stop',
    ]
    const muted: SoundKind[] = [
      'click',
      'continue',
      'skip',
      'hint',
      'start-lesson',
      'highlight-node',
    ]

    for (const k of enabled) expect(isActiveSound(k)).toBe(true)
    for (const k of muted) expect(isActiveSound(k)).toBe(false)
  })
})

describe('platform/haptics — safe haptic feedback', () => {
  it('impact, notify and select execute safely', () => {
    expect(() => haptics.impact('light')).not.toThrow()
    expect(() => haptics.impact('medium')).not.toThrow()
    expect(() => haptics.impact('heavy')).not.toThrow()
    expect(() => haptics.notify('success')).not.toThrow()
    expect(() => haptics.notify('error')).not.toThrow()
    expect(() => haptics.notify('warning')).not.toThrow()
    expect(() => haptics.select()).not.toThrow()
  })
})
