import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { getRouteChrome } from '../../../shared/config/route-chrome'

/** Route o'zgarganda shell chrome holatini bitta canonical registry'dan oladi. */
export function useRouteChrome() {
  const { pathname } = useLocation()
  const chrome = useMemo(() => getRouteChrome(pathname), [pathname])

  return { pathname, chrome }
}

