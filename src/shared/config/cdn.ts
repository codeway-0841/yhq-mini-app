/**
 * Cloudflare CDN URL Resolution Utilities
 *
 * All static media assets (badges, book covers, test images, avatars)
 * are resolved through the Cloudflare CDN base URL.
 */

const RAW_CDN_BASE = (
  (import.meta.env['VITE_CLOUDFLARE_CDN_URL'] as string | undefined) ||
  (import.meta.env['VITE_CDN_URL'] as string | undefined) ||
  ''
).trim().replace(/\/+$/, '')

/**
 * Canonical Cloudflare CDN base URL
 */
export const CDN_BASE = RAW_CDN_BASE

/**
 * Resolves any relative asset path or full URL through Cloudflare CDN.
 */
export function resolveCdnUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  const trimmed = pathOrUrl.trim()
  if (!trimmed) return null

  // Already absolute or inline data URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed
  }

  // If CDN_BASE is configured, prefix with CDN_BASE, otherwise return root-relative path
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (CDN_BASE) {
    return `${CDN_BASE}${normalizedPath}`
  }
  return normalizedPath
}

/**
 * Resolves badge asset URL
 */
export function resolveBadgeUrl(badgeImage: string | null | undefined): string | null {
  return resolveCdnUrl(badgeImage)
}

/**
 * Resolves book/course cover asset URL
 */
export function resolveCoverUrl(coverImage: string | null | undefined): string | null {
  return resolveCdnUrl(coverImage)
}

/**
 * Resolves question / test image URL
 */
export function resolveTestImageUrl(image: string | null | undefined): string | null {
  return resolveCdnUrl(image)
}
