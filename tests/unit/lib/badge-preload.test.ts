import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ACHIEVEMENTS, getBadgeUrl } from '@/shared/config/achievements'
import { preloadAchievementImages, resetBadgePreloadForTests } from '@/shared/lib/badge-preload'

const RealImage = globalThis.Image

function stubImage(impl: (this: { src: string }) => void) {
  globalThis.Image = impl as unknown as typeof Image
}

describe('preloadAchievementImages', () => {
  beforeEach(() => {
    resetBadgePreloadForTests()
  })

  afterEach(() => {
    globalThis.Image = RealImage
    vi.restoreAllMocks()
  })

  it('har bir NOYOB badge URL uchun bitta Image yuklaydi', () => {
    const created: { src: string }[] = []
    stubImage(function (this: { src: string }) {
      created.push(this)
    })

    preloadAchievementImages()

    const expected = new Set<string>()
    for (const def of ACHIEVEMENTS) {
      const url = getBadgeUrl(def)
      if (url) expected.add(url)
    }
    expect(expected.size).toBeGreaterThan(0)
    expect(created.length).toBe(expected.size)
    expect(new Set(created.map((i) => i.src))).toEqual(expected)
  })

  it('idempotent — ikkinchi chaqiruv hech narsa yuklamaydi', () => {
    const spy = vi.fn()
    stubImage(function (this: unknown) {
      spy()
    })

    preloadAchievementImages()
    const first = spy.mock.calls.length
    expect(first).toBeGreaterThan(0)
    preloadAchievementImages()
    expect(spy.mock.calls.length).toBe(first)
  })
})
