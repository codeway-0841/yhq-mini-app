import { describe, it, expect } from 'vitest'
import { playSound, type SoundKind } from '../../../src/shared/lib/sounds'
import { haptics } from '../../../src/platform/haptics'

describe('shared/lib/sounds — ASMR audio synthesis', () => {
  it('all sound kinds execute safely without throwing', () => {
    const kinds: SoundKind[] = [
      'click',
      'success',
      'error',
      'coins',
      'chime',
      'win',
      'combo',
      'match',
      'toggle',
      'emote_pop',
      'emote_whoosh',
      'emote_splash',
    ]
    for (const k of kinds) {
      expect(() => playSound(k)).not.toThrow()
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
