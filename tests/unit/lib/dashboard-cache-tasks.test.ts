import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '@/shared/api'
import { fetchBossState, bossCache, normalizeBossState } from '@/shared/lib/dashboard-cache'

/**
 * Boss trust-boundary: `{ok:true}` kabi shaklsiz javob — THROW (BossCard
 * `failed` ga tushib yashirinadi), sog'lom payload — o'tadi.
 */
describe('normalizeBossState', () => {
  beforeEach(() => {
    try { localStorage.clear() } catch { /* ignore */ }
    bossCache.invalidate()
    vi.restoreAllMocks()
  })

  const healthy = {
    bossKey: 'golem', periodKey: '2026-09-14', status: 'active',
    hpTotal: 10000, totalDamage: 2500, top: [{ firstName: 'A' }],
  }

  it("buzilgan payload'da null", () => {
    for (const bad of [null, undefined, 42, 'x', { ok: true }, { ...healthy, top: null }, { ...healthy, hpTotal: '10000' }]) {
      expect(normalizeBossState(bad)).toBeNull()
    }
  })

  it("sog'lom payload o'tadi, fetchBossState rad etadi buzilganda", async () => {
    expect(normalizeBossState(healthy)).toEqual(healthy)
    vi.spyOn(api, 'getBossState').mockResolvedValue({ ok: true } as never)
    await expect(fetchBossState()).rejects.toThrow('boss_malformed')
    bossCache.invalidate()
    vi.spyOn(api, 'getBossState').mockResolvedValue(healthy as never)
    await expect(fetchBossState()).resolves.toEqual(healthy)
  })
})
