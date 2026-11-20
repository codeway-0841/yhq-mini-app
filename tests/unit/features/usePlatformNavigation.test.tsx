import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlatformNavigation } from '../../../src/features/app/hooks/usePlatformNavigation'
import { COURSE_HOME_BACK_STATE, leaveCourseMap } from '../../../src/shared/lib/navigation'

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

  it('leaveCourseMap kurs bosh sahifasidan kirilganda navigate(-1), deep-linkda replace qiladi', () => {
    const navigate = vi.fn()
    leaveCourseMap(navigate, { pathname: '/darslik-rustili', state: COURSE_HOME_BACK_STATE })
    expect(navigate).toHaveBeenCalledWith(-1)

    navigate.mockClear()
    leaveCourseMap(navigate, { pathname: '/darslik-rustili', state: null })
    expect(navigate).toHaveBeenCalledWith({ pathname: '/darslik-rustili' }, { replace: true })
  })
})
