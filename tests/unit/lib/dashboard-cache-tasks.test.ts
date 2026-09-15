import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '@/shared/api'
import { fetchCoinTasks, coinTasksCache, fetchBossState, bossCache, normalizeBossState } from '@/shared/lib/dashboard-cache'

/**
 * Dashboard trust-boundary: buzilgan/kutilmagan /coins/tasks payload'ida
 * karta crash qilmasligi SHART (DailyTasksCard `.filter` chaqiradi —
 * e2e mock `{ok:true}` buni ErrorBoundary'ga olib chiqqan edi).
 */
describe('fetchCoinTasks payload gigiyenasi', () => {
  beforeEach(() => {
    try { localStorage.clear() } catch { /* ignore */ }
    coinTasksCache.invalidate()
    vi.restoreAllMocks()
  })

  it("tasks massiv bo'lmasa — BO'SH ro'yxat qaytadi (undefined/null/satr)", async () => {
    const spy = vi.spyOn(api, 'getCoinTasks')
    for (const bad of [undefined, null, 'oops', 42]) {
      spy.mockResolvedValueOnce({ tasks: bad } as never)
      await expect(fetchCoinTasks()).resolves.toEqual([])
    }
  })

  it('sog\'lom payload o\'zgarishsiz o\'tadi', async () => {
    const rows = [{ id: 'answer_5', progress: 5, target: 5, completed: true, claimed: false }]
    vi.spyOn(api, 'getCoinTasks').mockResolvedValue({ tasks: rows } as never)
    await expect(fetchCoinTasks()).resolves.toEqual(rows)
  })
})

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
