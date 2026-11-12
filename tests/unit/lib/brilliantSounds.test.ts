import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  BRILLIANT_SOUNDS,
  BRILLIANT_SOUND_GROUPS,
  getBrilliantSoundUrl,
  playBrilliantSound,
  stopBrilliantSound,
} from '../../../src/shared/lib/brilliantSounds'

describe('brilliantSounds — 26 ta asl Brilliant .mp3 effektlari', () => {
  it('barcha 26 ta .mp3 fayl diskda mavjud va guruhlari to‘liq', () => {
    expect(BRILLIANT_SOUNDS).toHaveLength(26)
    const groupIds = new Set(BRILLIANT_SOUND_GROUPS.map((g) => g.id))

    for (const s of BRILLIANT_SOUNDS) {
      expect(groupIds.has(s.group)).toBe(true)
      expect(getBrilliantSoundUrl(s.id)).toBe(`/brilliant/sounds/${s.id}.mp3`)
      const diskPath = path.resolve(process.cwd(), 'public', 'brilliant', 'sounds', `${s.id}.mp3`)
      expect(fs.existsSync(diskPath)).toBe(true)
      expect(fs.statSync(diskPath).size).toBeGreaterThan(1000)
    }
  })

  it('playBrilliantSound va stopBrilliantSound xavfsiz ishlaydi', async () => {
    const playMock = vi.fn().mockResolvedValue(undefined)
    const pauseMock = vi.fn()
    vi.stubGlobal(
      'Audio',
      class {
        preload = ''
        volume = 1
        currentTime = 0
        play = playMock
        pause = pauseMock
      },
    )

    const ok = await playBrilliantSound('continue', 0.8)
    expect(ok).toBe(true)
    expect(playMock).toHaveBeenCalledTimes(1)

    stopBrilliantSound('continue')
    expect(pauseMock).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  it('endstate va xp-tally bitta kanalda bo‘lib ustma-ust aralashmaydi', async () => {
    const events: string[] = []
    vi.stubGlobal(
      'Audio',
      class {
        src = ''
        preload = ''
        volume = 1
        loop = false
        currentTime = 0
        constructor(url: string) {
          this.src = url
        }
        play = vi.fn(() => {
          events.push(`play:${this.src}`)
          return Promise.resolve()
        })
        pause = vi.fn(() => {
          events.push(`pause:${this.src}`)
        })
      },
    )

    await playBrilliantSound('endstate')
    await playBrilliantSound('xp-tally')

    expect(events).toEqual([
      'play:/brilliant/sounds/endstate.mp3',
      'pause:/brilliant/sounds/endstate.mp3',
      'play:/brilliant/sounds/xp-tally.mp3',
    ])

    stopBrilliantSound()
    vi.unstubAllGlobals()
  })
})
