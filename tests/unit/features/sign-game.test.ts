/**
 * Belgilar o'yini — content integrity (signs-game.ts) + sof o'yin logikasi
 * (game-logic.ts) testlari.
 *
 * Nega: o'yin to'g'ri ishga tushishi uchun KAMIDA 4 unikal belgi (variantlar),
 * i18n nomlar (UZ+RU) va valid shakl/kontent kerak — desync = "yo'q belgi"
 * yoki takroriy variantli buzilgan raund.
 */
import { describe, it, expect } from 'vitest'
import { GAME_SIGNS, getGameSign } from '../../../src/content/signs-game'
import { buildSpeedRounds, buildMatchPairs, shuffled } from '../../../src/features/signs-game/game-logic'

/** Deterministik rand: ketma-ket qiymatlar (Fisher-Yates j uchun ham yetarli) */
function seededRand(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31
    return s / 2 ** 31
  }
}

describe('content/signs-game — data integrity', () => {
  it("barcha id'lar unikal, kamida 8 ta belgi (o'yinlar uchun minimum)", () => {
    const ids = GAME_SIGNS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(GAME_SIGNS.length).toBeGreaterThanOrEqual(8)
  })

  it('UZ+RU nomlar to\'ldirilgan; hex ranglar valid', () => {
    for (const s of GAME_SIGNS) {
      expect(s.name.uz.trim()).not.toBe('')
      expect(s.name.ru.trim()).not.toBe('')
      expect(s.bg).toMatch(/^#[0-9a-f]{6}$/i)
      if (s.rim !== null) expect(s.rim).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('content kind requiremments: emoji/value bor; bar/cross/slash valuesiz', () => {
    for (const s of GAME_SIGNS) {
      if (s.content.kind === 'emoji' || s.content.kind === 'text') {
        expect((s.content.value ?? '').trim()).not.toBe('')
      }
      if (s.content.kind === 'text') expect(s.content.color).toBeTruthy()
    }
  })

  it('getGameSign: nomaʼlum id → null', () => {
    expect(getGameSign('???')).toBeNull()
    expect(getGameSign(GAME_SIGNS[0].id)?.id).toBe(GAME_SIGNS[0].id)
  })
})

describe('features/signs-game — game-logic', () => {
  it('buildSpeedRounds: har round unikal belgi; 4 variant; javob options\'da 1 marta', () => {
    const rounds = buildSpeedRounds(GAME_SIGNS, 12, seededRand(42))
    expect(rounds.length).toBe(12)
    const signIds = rounds.map((r) => r.sign.id)
    expect(new Set(signIds).size).toBe(12)   // takror belgi YO'Q
    for (const r of rounds) {
      expect(r.options.length).toBe(4)
      expect(new Set(r.options.map((o) => o.id)).size).toBe(4)     // distraktorlar UNIKAL
      expect(r.options.filter((o) => o.id === r.sign.id).length).toBe(1)  // javob 1 ta
    }
  })

  it('buildSpeedRounds: count > belgilar soni → cheklanadi (pastki chegara)', () => {
    const four = GAME_SIGNS.slice(0, 4)
    const rounds = buildSpeedRounds(four, 10, seededRand(7))
    expect(rounds.length).toBe(4)
    // 4 belgida ham 4 variant chiqardi (chegara holat)
    for (const r of rounds) expect(r.options.length).toBe(4)
  })

  it('shuffled: elementlar saqlanadi (yo\'qotish/duplikat yo\'q), seed deterministik', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    const a = shuffled(src, seededRand(1))
    const b = shuffled(src, seededRand(1))
    expect([...a].sort((x, y) => x - y)).toEqual(src)
    expect(a).toEqual(b)                       // bir xil seed → bir xil tartib
    expect(src).toContain(1)                   // manbaga TEGMANG (mutatsiya yo'q)
  })

  it('buildMatchPairs: N juft = 2N tile; har signId uchun 1 icon + 1 name', () => {
    const tiles = buildMatchPairs(GAME_SIGNS, 6, seededRand(3))
    expect(tiles.length).toBe(12)
    const bySign = new Map<string, { icon: number; name: number }>()
    for (const t of tiles) {
      const rec = bySign.get(t.signId) ?? { icon: 0, name: 0 }
      rec[t.kind]++
      bySign.set(t.signId, rec)
    }
    expect(bySign.size).toBe(6)
    for (const [, rec] of bySign) {
      expect(rec).toEqual({ icon: 1, name: 1 })
    }
    // uid'lar unikal bo'lsin (React key + tanlov logikasi)
    expect(new Set(tiles.map((t) => t.uid)).size).toBe(12)
  })
})
