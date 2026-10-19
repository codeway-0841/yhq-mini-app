import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { LazyPath } from '../../../src/features/darslik-rustili/LazyPath'

type ObserverCallback = ConstructorParameters<typeof IntersectionObserver>[0]

class MockObserver {
  static instances: MockObserver[] = []
  callback: ObserverCallback
  disconnect = vi.fn()
  observe = vi.fn()
  unobserve = vi.fn()
  takeRecords = vi.fn(() => [])

  constructor(callback: ObserverCallback) {
    this.callback = callback
    MockObserver.instances.push(this)
  }

  emit(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

const realObserver = globalThis.IntersectionObserver

afterEach(() => {
  MockObserver.instances = []
  vi.unstubAllGlobals()
  globalThis.IntersectionObserver = realObserver
})

describe('LazyPath', () => {
  it('IntersectionObserver mavjud bo‘lsa, yo‘lni faqat ko‘rinish zonasida mount qiladi', () => {
    vi.stubGlobal('IntersectionObserver', MockObserver as unknown as typeof IntersectionObserver)
    render(
      <LazyPath rows={4}>
        <div data-testid="path-child">path</div>
      </LazyPath>,
    )

    expect(screen.queryByTestId('path-child')).toBeNull()
    expect(MockObserver.instances).toHaveLength(1)

    act(() => { MockObserver.instances[0].emit(true) })
    expect(screen.getByTestId('path-child')).toBeInTheDocument()
    expect(MockObserver.instances[0].disconnect).toHaveBeenCalled()
  })

  it('IntersectionObserver yo‘q bo‘lsa (eski WebView), darhol render qiladi', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(
      <LazyPath rows={4}>
        <div data-testid="path-child">path</div>
      </LazyPath>,
    )
    expect(screen.getByTestId('path-child')).toBeInTheDocument()
  })
})
