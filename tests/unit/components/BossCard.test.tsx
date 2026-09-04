import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BossCard from '../../../src/features/boss/BossCard'

const fixture = vi.hoisted(() => ({ damage: 199999 }))
vi.mock('../../../src/shared/lib/dashboard-cache', () => ({
  bossCache: { peek: () => null },
  fetchBossState: async () => ({
    bossKey: 'colossus', periodKey: '2026-09-07', status: 'active',
    hpTotal: 200000, totalDamage: fixture.damage, myDamage: 5, top: [],
  }),
}))
vi.mock('../../../src/shared/store/useAppStore', () => ({
  useAppStore: (select: (state: unknown) => unknown) => select({ settings: { language: 'uz' } }),
}))

describe('BossCard remaining HP', () => {
  it('keeps a boss alive with 1 HP even when damage rounds to 100%', async () => {
    fixture.damage = 199999
    render(<BossCard />)
    const bar = await screen.findByRole('progressbar', { name: 'Qolgan HP' })
    expect(bar).toHaveAttribute('aria-valuenow', '1')
    expect(screen.queryByText(/Yengildi!/)).not.toBeInTheDocument()
    expect(screen.getByText(/Jamoaviy zarar/)).toBeInTheDocument()
  })

  it('clamps overkill to zero and displays defeat', async () => {
    fixture.damage = 200005
    render(<BossCard />)
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByText(/Yengildi!/)).toBeInTheDocument()
  })
})
