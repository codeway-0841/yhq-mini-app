/**
 * Octagon PvP — Separation of Concerns & Architecture Regression Test.
 * Yangi modullar chegaralarini, responsibilitiy va backward-compatibility'ni tekshiradi.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Facade import
import * as octagonFacade from '../../../server/octagon'
// Yangi modullar importi
import * as gateway from '../../../server/modules/octagon/octagon.gateway'
import * as engine from '../../../server/modules/octagon/octagon.engine'
import * as repository from '../../../server/modules/octagon/octagon.repository'

describe('Octagon Separation of Concerns & Dependency Boundaries', () => {
  const SERVER_DIR = path.resolve(__dirname, '../../../server')
  const OCTAGON_MODULES_DIR = path.join(SERVER_DIR, 'modules/octagon')

  it('repository faylida engine yoki gateway import qilinmagan (bir tomonlama bog\'liqlik)', () => {
    const repoFile = fs.readFileSync(path.join(OCTAGON_MODULES_DIR, 'octagon.repository.ts'), 'utf8')
    expect(repoFile).not.toContain('octagon.engine')
    expect(repoFile).not.toContain('octagon.gateway')
  })

  it('engine faylida to\'g\'ridan-to\'g\'ri db yoki drizzle ORM ulanishi yo\'q', () => {
    const engineFile = fs.readFileSync(path.join(OCTAGON_MODULES_DIR, 'octagon.engine.ts'), 'utf8')
    expect(engineFile).not.toContain("from '../../db/connection'")
    expect(engineFile).not.toContain("from 'drizzle-orm'")
    expect(engineFile).not.toContain('db.select')
    expect(engineFile).not.toContain('db.insert')
    expect(engineFile).not.toContain('db.update')
  })

  it('gateway faylida to\'g\'ridan-to\'g\'ri db yoki drizzle ORM ulanishi yo\'q', () => {
    const gatewayFile = fs.readFileSync(path.join(OCTAGON_MODULES_DIR, 'octagon.gateway.ts'), 'utf8')
    expect(gatewayFile).not.toContain("from '../../db/connection'")
    expect(gatewayFile).not.toContain("from 'drizzle-orm'")
    expect(gatewayFile).not.toContain('db.select')
    expect(gatewayFile).not.toContain('db.insert')
  })

  it('resolveWsUserId gateway\'da auth orchestration sifatida joylashgan', () => {
    expect(typeof gateway.resolveWsUserId).toBe('function')
    expect(typeof octagonFacade.resolveWsUserId).toBe('function')
  })

  it('buildDuelResultRows engine\'da pure domain logic sifatida joylashgan', () => {
    expect(typeof engine.buildDuelResultRows).toBe('function')
    expect(typeof octagonFacade.buildDuelResultRows).toBe('function')

    const outcomes: engine.DuelOutcome[] = [
      { userId: '123', opponentId: '456', selfScore: 7, oppScore: 3, result: 'win' },
      { userId: '456', opponentId: '123', selfScore: 3, oppScore: 7, result: 'lose' },
    ]
    const rows = engine.buildDuelResultRows('test-match-1', outcomes, false)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      matchId: 'test-match-1',
      userId: '123',
      opponentId: '456',
      result: 'win',
      selfScore: 7,
      oppScore: 3,
      forfeit: false,
    })
  })

  it('mehmon (user 0) match yakunida duel_results uchun chiqarib tashlanadi', () => {
    const outcomes: engine.DuelOutcome[] = [
      { userId: '0', opponentId: '456', selfScore: 2, oppScore: 8, result: 'lose' },
      { userId: '456', opponentId: '0', selfScore: 8, oppScore: 2, result: 'win' },
    ]
    const rows = engine.buildDuelResultRows('guest-match', outcomes, false)
    expect(rows).toHaveLength(1)
    expect(rows[0].userId).toBe('456')
    expect(rows[0].opponentId).toBeNull()
  })

  it('server/octagon.ts facade barcha kerakli funksiyalarni to\'liq re-export qiladi (backward compatibility)', () => {
    // Gateway exports
    expect(octagonFacade.attachOctagon).toBe(gateway.attachOctagon)
    expect(octagonFacade.getOctagonStats).toBe(gateway.getOctagonStats)
    expect(octagonFacade.getOnlineUsers).toBe(gateway.getOnlineUsers)
    expect(octagonFacade.triggerOnlineBroadcast).toBe(gateway.triggerOnlineBroadcast)
    expect(octagonFacade.DEFAULT_OCTAGON_LIMITS).toBe(gateway.DEFAULT_OCTAGON_LIMITS)

    // Engine exports
    expect(octagonFacade.loadOctagonPools).toBe(engine.loadOctagonPools)
    expect(octagonFacade.reloadOctagonPools).toBe(engine.reloadOctagonPools)
    expect(octagonFacade.DUEL_CODE_RE).toBe(engine.DUEL_CODE_RE)
    expect(octagonFacade.ROUNDS).toBe(10)
    expect(octagonFacade.ROUND_TIMEOUT).toBe(15000)
    expect(octagonFacade.REJOIN_MIN_ANSWER_MS).toBe(3000)
    expect(octagonFacade.QUEUE_TIMEOUT).toBe(60000)
    expect(octagonFacade.DUEL_TIMEOUT).toBe(300000)

    // Repository exports
    expect(octagonFacade.fetchOnlineRowsCached).toBe(repository.fetchOnlineRowsCached)
    expect(octagonFacade.resolveAvatars).toBe(repository.resolveAvatars)
    expect(octagonFacade.countDuelPairsLast24h).toBe(repository.countDuelPairsLast24h)
    expect(octagonFacade.addOctagonWin).toBe(repository.addOctagonWin)
  })

  it('o\'yin konstantalari va limitlar o\'zgarishsiz qolgan', () => {
    expect(gateway.DEFAULT_OCTAGON_LIMITS.authDeadlineMs).toBe(10000)
    expect(gateway.DEFAULT_OCTAGON_LIMITS.heartbeatMs).toBe(30000)
    expect(gateway.DEFAULT_OCTAGON_LIMITS.reconnectWindowMs).toBe(60000)
    expect(gateway.DEFAULT_OCTAGON_LIMITS.pauseBudgetMs).toBe(90000)
    expect(engine.MAX_MATCHES).toBe(500)
    expect(engine.SAME_PAIR_24H_CAP).toBe(5)
  })

  it('DUEL_CODE_RE PIN kod formatlarini to\'g\'ri tekshiradi', () => {
    expect(engine.DUEL_CODE_RE.test('123456')).toBe(true)
    expect(engine.DUEL_CODE_RE.test('duel-abcdef')).toBe(true)
    expect(engine.DUEL_CODE_RE.test('room-abcdef')).toBe(true)
    expect(engine.DUEL_CODE_RE.test('short')).toBe(false)
  })
})
