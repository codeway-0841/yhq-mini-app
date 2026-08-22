import { describe, it, expect, beforeEach } from 'vitest'
import { getDuelHistory, recordDuelMatch } from '../../../src/features/octagon/duel-history'

describe('duel-history', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('boshida bosh massiv qaytaradi', () => {
    expect(getDuelHistory()).toEqual([])
  })

  it('oyin natijasini saqlaydi va royxat boshiga qoshadi', () => {
    recordDuelMatch({
      opponentName: 'Sardor',
      yourScore: 10,
      oppScore: 8,
      result: 'win',
    })

    const list = getDuelHistory()
    expect(list.length).toBe(1)
    expect(list[0]?.opponentName).toBe('Sardor')
    expect(list[0]?.result).toBe('win')
    expect(list[0]?.yourScore).toBe(10)
    expect(list[0]?.oppScore).toBe(8)
    expect(list[0]?.id).toMatch(/^match-/)
    expect(list[0]?.timestamp).toBeGreaterThan(0)
  })

  it('eng songgi oyinlar birinchi bolib turadi', () => {
    recordDuelMatch({ opponentName: 'Olim', yourScore: 5, oppScore: 7, result: 'lose' })
    recordDuelMatch({ opponentName: 'Anvar', yourScore: 8, oppScore: 6, result: 'win' })

    const list = getDuelHistory()
    expect(list.length).toBe(2)
    expect(list[0]?.opponentName).toBe('Anvar')
    expect(list[1]?.opponentName).toBe('Olim')
  })
})
