/**
 * Route chrome — mobil app shell'ning yagona navigatsiya siyosati.
 *
 * Bu fayl route komponentlarini import qilmaydi: shared qatlam sof qoladi,
 * lekin AppShell va IosDock bir xil qarordan foydalanadi.
 */
export type RouteChromeMode = 'tab' | 'detail' | 'workspace' | 'immersive'
export type AppShellVariant = 'standard' | 'fullscreen'

export interface RouteChrome {
  mode: RouteChromeMode
  bottomNavigation: boolean
  shell: AppShellVariant
}

export const TAB_ROOT_PATHS = ['/', '/testlar', '/octagon', '/rejimlar'] as const

const TAB_CHROME: RouteChrome = {
  mode: 'tab',
  bottomNavigation: true,
  shell: 'standard',
}

const DETAIL_CHROME: RouteChrome = {
  mode: 'detail',
  bottomNavigation: false,
  shell: 'standard',
}

const WORKSPACE_CHROME: RouteChrome = {
  mode: 'workspace',
  bottomNavigation: false,
  shell: 'standard',
}

const IMMERSIVE_CHROME: RouteChrome = {
  mode: 'immersive',
  bottomNavigation: false,
  shell: 'standard',
}

const FULLSCREEN_CHROME: RouteChrome = {
  mode: 'immersive',
  bottomNavigation: false,
  shell: 'fullscreen',
}

const WORKSPACE_PREFIXES = ['/ai-tutor', '/snap-solve', '/ai-test', '/camai', '/doska'] as const
const IMMERSIVE_PREFIXES = ['/test/', '/octagon/', '/belgilar-oyini', '/kutubxona/kitob/', '/live/'] as const

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

function isPathOrDescendant(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function getRouteChrome(pathname: string): RouteChrome {
  const normalized = normalizePathname(pathname)

  if ((TAB_ROOT_PATHS as readonly string[]).includes(normalized)) {
    return TAB_CHROME
  }

  // Wonder Studio o'zining to'liq ekranli canvas/shell'iga ega.
  if (isPathOrDescendant(normalized, '/wonder') || isPathOrDescendant(normalized, '/wonder-studio')) {
    return FULLSCREEN_CHROME
  }

  if (WORKSPACE_PREFIXES.some((prefix) => isPathOrDescendant(normalized, prefix))) {
    return WORKSPACE_CHROME
  }

  if (IMMERSIVE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix))) {
    return IMMERSIVE_CHROME
  }

  return DETAIL_CHROME
}

export function isTabRootRoute(pathname: string): boolean {
  return getRouteChrome(pathname).bottomNavigation
}

