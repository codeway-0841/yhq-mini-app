import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSpeaking, speak, stopSpeaking, subscribeSpeaking } from '../../../src/shared/lib/speech'

class Utterance {
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public text: string) {}
}
const synth = { getVoices: vi.fn(() => []), speak: vi.fn(), cancel: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  stopSpeaking()
})
afterEach(() => { stopSpeaking(); vi.unstubAllGlobals() })

describe('speech lifecycle', () => {
  it('tracks queued speech and stops immediately even without a browser cancel event', () => {
    speak('Savol', 'uz')
    expect(isSpeaking()).toBe(true)
    stopSpeaking()
    expect(isSpeaking()).toBe(false)
    expect(synth.cancel).toHaveBeenCalled()
  })
  it.each(['onend', 'onerror'] as const)('clears the active state after %s', (event) => {
    speak('Savol', 'uz')
    const utterance = synth.speak.mock.lastCall![0] as Utterance
    utterance[event]!()
    expect(isSpeaking()).toBe(false)
  })
  it('ignores a late end event from a canceled utterance', () => {
    speak('Birinchi', 'uz')
    const first = synth.speak.mock.lastCall![0] as Utterance
    speak('Ikkinchi', 'uz')
    first.onend!()
    expect(isSpeaking()).toBe(true)
    ;(synth.speak.mock.lastCall![0] as Utterance).onend!()
    expect(isSpeaking()).toBe(false)
  })
  it('stays idle when speech is unsupported or throws', () => {
    vi.stubGlobal('speechSynthesis', undefined)
    expect(() => speak('Savol', 'uz')).not.toThrow()
    expect(isSpeaking()).toBe(false)
    vi.stubGlobal('speechSynthesis', synth)
    synth.speak.mockImplementationOnce(() => { throw new Error('unavailable') })
    speak('Savol', 'uz')
    expect(isSpeaking()).toBe(false)
  })
  it('unsubscribes listeners', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSpeaking(listener)
    speak('Savol', 'uz')
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    listener.mockClear()
    stopSpeaking()
    expect(listener).not.toHaveBeenCalled()
  })
})
