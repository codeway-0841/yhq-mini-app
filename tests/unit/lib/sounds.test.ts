import { describe, it, expect } from 'vitest'
import { playSound, resolveBrilliantSound, type SoundKind } from '../../../src/shared/lib/sounds'
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
