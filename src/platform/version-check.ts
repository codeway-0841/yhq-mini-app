/**
 * APK versiya tekshiruvi — server'dan min/latest versiyani olib, joriy
 * bundle versiyasi bilan solishtiradi. Native APK'da FAQAT ishlaydi.
 *
 * Natija:
 *  - 'force'  → joriy versiya < minVersion (blokirovka ekrani)
 *  - 'soft'   → joriy versiya < latestVersion (dismiss qilinadigan taklif)
 *  - 'ok'     → yangilash kerak emas
 *  - null     → tekshirib bo'lmadi (tarmoq xato, TG muhit, brauzer)
 *
 * Boot path'da chaqiriladi — timeout 5s (API cold start + CDN).
 * Xato bo'lsa null qaytaradi (update check HECH QACHON ilovani sindirmaydi).
 */

/** Semver taqqoslash: a < b → -1, a === b → 0, a > b → 1 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na < nb) return -1
    if (na > nb) return 1
  }
  return 0
}

export interface AppVersionInfo {
  minVersion: string
  latestVersion: string
  updateUrl: string
}

import { create } from 'zustand'

export type UpdateStatus = 'force' | 'soft' | 'ok'

export interface UpdateStoreState {
  status: UpdateStatus | null
  info: AppVersionInfo | null
  currentVersion: string
  dismissed: boolean
  setUpdate: (data: { status: UpdateStatus; info: AppVersionInfo; currentVersion: string }) => void
  dismiss: () => void
}

export const useUpdateStore = create<UpdateStoreState>((set) => ({
  status: null,
  info: null,
  currentVersion: '',
  dismissed: false,
  setUpdate: (data) => set({ ...data, dismissed: false }),
  dismiss: () => set({ dismissed: true }),
}))

/**
 * build.gradle'dagi versionName — Capacitor build vaqtida
 * `@capacitor/app`'dan olinadi. Brauzer/TG'da null.
 */
export async function getNativeAppVersion(): Promise<string | null> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return null
    const { App } = await import('@capacitor/app')
    const info = await App.getInfo()
    return info.version  // versionName: "1.0.3"
  } catch {
    return null
  }
}

/**
 * Server'dan versiya talablarini oladi (GET /api/app-version, public, CDN keshli).
 */
export async function fetchAppVersionInfo(apiBase: string): Promise<AppVersionInfo | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${apiBase}/app-version`, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.json() as AppVersionInfo
  } catch {
    return null
  }
}

/**
 * To'liq versiya tekshiruvi — APK boot'da chaqiriladi.
 * Non-native muhitda null (tekshiruv o'tkazib yuboriladi).
 */
export async function checkAppUpdate(apiBase: string): Promise<{
  status: UpdateStatus
  info: AppVersionInfo
  currentVersion: string
} | null> {
  const currentVersion = await getNativeAppVersion()
  if (!currentVersion) return null  // brauzer/TG — skip

  const info = await fetchAppVersionInfo(apiBase)
  if (!info) return null  // tarmoq xato — xavfsiz skip

  if (compareSemver(currentVersion, info.minVersion) < 0) {
    return { status: 'force', info, currentVersion }
  }
  if (compareSemver(currentVersion, info.latestVersion) < 0) {
    return { status: 'soft', info, currentVersion }
  }
  return { status: 'ok', info, currentVersion }
}
