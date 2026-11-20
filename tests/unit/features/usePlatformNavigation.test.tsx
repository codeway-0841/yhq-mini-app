import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlatformNavigation } from '../../../src/features/app/hooks/usePlatformNavigation'

function Harness() {
  const { pageRef } = usePlatformNavigation()
  return <div ref={pageRef} />
}

describe('usePlatformNavigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('section parametri bo‘lganda window.scrollTo(0, 0) chaqirmaydi', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(
      <MemoryRouter initialEntries={['/darslik-rustili?block=1&section=4']}>
        <Harness />
      </MemoryRouter>,
    )
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('oddiy marshrutda window.scrollTo(0, 0) chaqiradi', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(
      <MemoryRouter initialEntries={['/darslik-rustili?block=1']}>
        <Harness />
      </MemoryRouter>,
    )
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })
})
