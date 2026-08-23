/**
 * Octagon duel natijalari — `duel_results` qatorlarini yasash mantig'i.
 * (Davr reytingi shu qatorlardan agregatlanadi: leaderboard duelTop.)
 */
import { describe, it, expect } from 'vitest'
import { buildDuelResultRows } from '../../../server/octagon'

describe('buildDuelResultRows', () => {
  it('ikkala o\'yinchi uchun qator yasaydi (win/lose)', () => {
    const rows = buildDuelResultRows('m1', [
      { userId: 'u1', opponentId: 'u2', selfScore: 5, oppScore: 3, result: 'win' },
      { userId: 'u2', opponentId: 'u1', selfScore: 3, oppScore: 5, result: 'lose' },
    ], false)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      matchId: 'm1', userId: 'u1', opponentId: 'u2',
      result: 'win', selfScore: 5, oppScore: 3, forfeit: false,
    })
    expect(rows[1]!.result).toBe('lose')
    expect(rows[1]!.selfScore).toBe(3)
  })

  it('durangda ikkala tomonga ham draw yozadi', () => {
    const rows = buildDuelResultRows('m2', [
      { userId: 'u1', opponentId: 'u2', selfScore: 4, oppScore: 4, result: 'draw' },
      { userId: 'u2', opponentId: 'u1', selfScore: 4, oppScore: 4, result: 'draw' },
    ], false)

    expect(rows.map((r) => r.result)).toEqual(['draw', 'draw'])
  })

  it('mehmon (guest \'0\') uchun qator yozmaydi, raqib mehmon bo\'lsa opponentId null', () => {
    const rows = buildDuelResultRows('m3', [
      { userId: 'u1', opponentId: '0',  selfScore: 6, oppScore: 2, result: 'win' },
      { userId: '0',  opponentId: 'u1', selfScore: 2, oppScore: 6, result: 'lose' },
    ], false)

    expect(rows).toHaveLength(1)
    expect(rows[0]!.userId).toBe('u1')
    expect(rows[0]!.opponentId).toBeNull()
  })

  it('ikkala o\'yinchi ham mehmon bo\'lsa bo\'sh massiv (DB\'ga yozuv yo\'q)', () => {
    expect(buildDuelResultRows('m4', [
      { userId: '0', opponentId: '0', selfScore: 1, oppScore: 0, result: 'win' },
      { userId: '0', opponentId: '0', selfScore: 0, oppScore: 1, result: 'lose' },
    ], false)).toEqual([])
  })

  it('forfeit bayrog\'ini har qatorga qo\'yadi', () => {
    const rows = buildDuelResultRows('m5', [
      { userId: 'u1', opponentId: 'u2', selfScore: 2, oppScore: 1, result: 'win' },
      { userId: 'u2', opponentId: 'u1', selfScore: 1, oppScore: 2, result: 'lose' },
    ], true)

    expect(rows.every((r) => r.forfeit)).toBe(true)
  })
})
