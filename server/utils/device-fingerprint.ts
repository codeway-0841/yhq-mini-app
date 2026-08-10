/**
 * Device fingerprinting utilities — generate stable device IDs from request metadata.
 * Used for device tracking, session management, and security monitoring.
 */

import { createHash } from 'crypto'
import { isIP } from 'net'
import type { Request } from 'express'

export interface DeviceInfo {
  id: string  // Stable fingerprint hash
  deviceName?: string
  deviceType?: string
  os?: string
  browser?: string
  fingerprint?: string
}

/**
 * Parse User-Agent to extract device info.
 * Basic implementation - production should use ua-parser-js or similar.
 */
function parseUserAgent(userAgent: string): Pick<DeviceInfo, 'deviceType' | 'os' | 'browser'> {
  const ua = userAgent.toLowerCase()

  // Device type
  let deviceType: string | undefined
  if (/(tablet|ipad)/.test(ua)) {
    deviceType = 'tablet'
  } else if (/(mobile|phone|android|iphone)/.test(ua)) {
    deviceType = 'mobile'
  } else {
    deviceType = 'desktop'
  }

  // OS detection
  let os: string | undefined
  if (/windows nt/.test(ua)) {
    os = 'Windows'
  } else if (/mac os x/.test(ua)) {
    os = 'macOS'
  } else if (/linux/.test(ua)) {
    os = 'Linux'
  } else if (/android/.test(ua)) {
    os = 'Android'
  } else if (/(iphone|ipad|ipod)/.test(ua)) {
    os = 'iOS'
  }

  // Browser detection
  let browser: string | undefined
  if (/edg\//.test(ua)) {
    browser = 'Edge'
  } else if (/chrome\//.test(ua) && !/edg/.test(ua)) {
    browser = 'Chrome'
  } else if (/safari\//.test(ua) && !/chrome/.test(ua)) {
    browser = 'Safari'
  } else if (/firefox\//.test(ua)) {
    browser = 'Firefox'
  } else if (/opera|opr\//.test(ua)) {
    browser = 'Opera'
  }

  return { deviceType, os, browser }
}

/**
 * Prepare IP for device fingerprinting.
 * IPv4: Anonymized to /24 prefix (192.168.1.234 → 192.168.1)
 * IPv6: Full address (:: compression makes simple prefix extraction unreliable)
 *
 * Privacy note: Final fingerprint is SHA-256 hashed before storage.
 * IPv6 privacy enhancement requires ipaddr.js or similar library for proper /64 prefix extraction.
 */
function prepareIpForFingerprint(ip: string): string {
  const ipType = isIP(ip)

  if (ipType === 4) {
    // IPv4 - anonymize to network prefix
    const octets = ip.split('.')
    return octets.slice(0, 3).join('.')
  }

  if (ipType === 6) {
    // IPv6 - use full address (hash provides privacy layer)
    // Simple string slicing fails with :: compression
    // Production enhancement: use ipaddr.js for proper /64 prefix
    return ip
  }

  return 'unknown'
}

/**
 * Generate stable device fingerprint from request.
 * Combines multiple signals: User-Agent, anonymized IP, Accept-Language.
 * Not cryptographically secure - for device tracking, not auth.
 */
export function generateDeviceFingerprint(req: Request): string {
  const userAgent = req.headers['user-agent'] || 'unknown'
  const acceptLang = req.headers['accept-language'] || ''

  // Use consistent IP resolution (handles proxies)
  const ip = getClientIp(req)
  const ipPrefix = prepareIpForFingerprint(ip)

  // Combine signals
  const raw = `${userAgent}|${ipPrefix}|${acceptLang}`

  // SHA-256 hash (first 16 bytes = 32 hex chars)
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

/**
 * Generate device ID - stable identifier for session/device tracking.
 * Format: 'dev_' + first 24 chars of fingerprint (shorter for DB storage).
 */
export function generateDeviceId(req: Request): string {
  const fingerprint = generateDeviceFingerprint(req)
  return `dev_${fingerprint.slice(0, 24)}`
}

/**
 * Extract full device info from request.
 * Computes fingerprint once and derives ID from it (efficiency).
 */
export function getDeviceInfo(req: Request): DeviceInfo {
  const userAgent = req.headers['user-agent'] || 'Unknown'
  const fingerprint = generateDeviceFingerprint(req)
  const id = `dev_${fingerprint.slice(0, 24)}`  // Derive ID from fingerprint (no recompute)
  const parsed = parseUserAgent(userAgent)

  // Generate friendly device name
  let deviceName = parsed.browser || 'Browser'
  if (parsed.os) {
    deviceName += ` on ${parsed.os}`
  }

  return {
    id,
    deviceName,
    deviceType: parsed.deviceType,
    os: parsed.os,
    browser: parsed.browser,
    fingerprint,
  }
}

/**
 * Get client IP address (handles proxies, X-Forwarded-For).
 * Validates all IPs using net.isIP() to prevent header injection.
 */
export function getClientIp(req: Request): string {
  // Trust proxy headers (Vercel/Express sets req.ip correctly via trust proxy)
  if (req.ip && isIP(req.ip)) {
    return req.ip
  }

  // Fallback: X-Forwarded-For header (can be string or string[])
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded
    if (forwardedStr) {
      // Take first IP (original client), ignore downstream proxies
      const ips = forwardedStr.split(',')
      const clientIp = ips[0].trim()
      // Validate using Node's isIP (returns 4 or 6 for valid, 0 for invalid)
      if (isIP(clientIp)) {
        return clientIp
      }
    }
  }

  // Real IP header (some proxies)
  const realIp = req.headers['x-real-ip']
  if (realIp) {
    const realIpStr = Array.isArray(realIp) ? realIp[0] : realIp
    if (realIpStr && isIP(realIpStr)) {
      return realIpStr
    }
  }

  // Socket fallback (direct connection)
  const socketIp = req.socket.remoteAddress
  if (socketIp && isIP(socketIp)) {
    return socketIp
  }

  return 'unknown'
}
