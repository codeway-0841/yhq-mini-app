import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSidebarStore } from '../../../src/shared/store/useSidebarStore'

describe('useSidebarStore (desktop collapse)', () => {
  beforeEach(() => {
    localStorage.clear()
    useSidebarStore.setState({ collapsed: false })
  })

  it('default yoyilgan (collapsed=false)', async () => {
    vi.resetModules()
    const fresh = await import('../../../src/shared/store/useSidebarStore')
    expect(fresh.useSidebarStore.getState().collapsed).toBe(false)
  })

  it('toggle yigadi va yoyadi', () => {
    expect(useSidebarStore.getState().collapsed).toBe(false)
    useSidebarStore.getState().toggle()
    expect(useSidebarStore.getState().collapsed).toBe(true)
    useSidebarStore.getState().toggle()
    expect(useSidebarStore.getState().collapsed).toBe(false)
  })

  it("persist: collapsed holat reload'dan keyin tiklanadi", async () => {
    useSidebarStore.getState().setCollapsed(true)
    // persist async yozadi — microtask'lar bajarilsin
    await Promise.resolve()
    const raw = localStorage.getItem('yhq-sidebar')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).state.collapsed).toBe(true)

    vi.resetModules()
    const fresh = await import('../../../src/shared/store/useSidebarStore')
    // rehydrate async — bir tick kutamiz
    await new Promise((r) => setTimeout(r, 50))
    expect(fresh.useSidebarStore.getState().collapsed).toBe(true)
  })
})
