import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  registerModal,
  closeTopModal,
  hasOpenModal,
  subscribeModalStack,
  goBack,
} from '../../../src/shared/lib/navigation'

describe('navigation — modal stack & safe back handling', () => {
  beforeEach(() => {
    while (hasOpenModal()) {
      closeTopModal()
    }
  })

  it('modal roʻyxatdan oʻtganda stack soni oshadi va listener chaqiriladi', () => {
    const counts: number[] = []
    const unsub = subscribeModalStack((c) => counts.push(c))

    const id1 = Symbol('modal1')
    const close1 = vi.fn()
    const unregister1 = registerModal(id1, close1)

    expect(hasOpenModal()).toBe(true)
    expect(counts).toContain(1)

    unregister1()
    expect(hasOpenModal()).toBe(false)
    expect(counts[counts.length - 1]).toBe(0)

    unsub()
  })

  it('closeTopModal eng oxirgi modal onClose funksiyasini chaqiradi', () => {
    const id1 = Symbol('modal1')
    const close1 = vi.fn()
    const id2 = Symbol('modal2')
    const close2 = vi.fn()

    const unreg1 = registerModal(id1, close1)
    const unreg2 = registerModal(id2, close2)

    expect(hasOpenModal()).toBe(true)

    const res2 = closeTopModal()
    expect(res2).toBe(true)
    expect(close2).toHaveBeenCalledOnce()
    expect(close1).not.toHaveBeenCalled()

    const res1 = closeTopModal()
    expect(res1).toBe(true)
    expect(close1).toHaveBeenCalledOnce()

    const res0 = closeTopModal()
    expect(res0).toBe(false)

    unreg1()
    unreg2()
  })

  it('goBack modal ochiq boʻlsa avval modalni yopadi va navigate qilinmaydi', () => {
    const navigate = vi.fn()
    const id1 = Symbol('modal1')
    const close1 = vi.fn()

    const unreg = registerModal(id1, close1)

    goBack(navigate)

    expect(close1).toHaveBeenCalledOnce()
    expect(navigate).not.toHaveBeenCalled()

    unreg()
  })

  it('goBack modal boʻlmasa router navigate(-1) yoki fallback ga oʻtadi', () => {
    const navigate = vi.fn()

    // History state null bo'lsa -> '/'
    window.history.replaceState(null, '')
    goBack(navigate)
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })

    // History state idx > 0 bo'lsa -> -1
    window.history.replaceState({ idx: 2 }, '')
    goBack(navigate)
    expect(navigate).toHaveBeenCalledWith(-1)
  })
})
