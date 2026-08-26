/**
 * Auth allowlist desync himoyasi (audit C1 regression).
 *
 * Production'da `telegramAuth` credentials'siz so'rovlarni 401 qiladi —
 * FAQAT PUBLIC_AUTH_POST / PUBLIC_AUTH_GET_PREFIXES ro'yxatidagi login
 * endpoint'lari o'tadi. Router'ga yangi PUBLIC endpoint qo'shilganda bu
 * ro'yxat unutilsa, foydalanuvchi hech qachon login qila OLMAYDI
 * (email-auth aynan shu holatda o'lik edi).
 *
 * Bu test auth.router.ts'ni skan qiladi: `requireAuth` belgilanganmagan HAR
 * BIR route allowlist'dan o'tishi SHART. OAuth callback'lar — ataylab
 * istisno (501-stub, public emas = fail-closed).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Request } from 'express'
import { isPublicAuthPost, isPublicAuthGet, isPublicGet } from '../../../server/middleware/auth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROUTER_PATH = path.resolve(__dirname, '../../../server/modules/auth/auth.router.ts')

/** 501-stub OAuth callback'lar — amalga oshirilmagan, public ochilmaydi (fail-closed). */
const INTENTIONALLY_BLOCKED = new Set(['auth/google/callback', 'auth/apple/callback'])

const req = (method: string, path: string): Request => ({ method, path }) as unknown as Request

/** Router source'dan: method, '/auth/...' yo'l (parametrsiz ko'rinishda), requireAuth bormi. */
function extractAuthRoutes(): Array<{ method: string; path: string; guarded: boolean }> {
  const src = readFileSync(ROUTER_PATH, 'utf8')
  const routes: Array<{ method: string; path: string; guarded: boolean }> = []
  const re = /router\.(post|get)\(\s*'([^']+)',([\s\S]*?)\n\s*\)/g
  for (const m of src.matchAll(re)) {
    const method = m[1]!.toUpperCase()
    const path = m[2]!.replace(/^\//, '') // '/auth/x' → 'auth/x'
    routes.push({ method, path, guarded: (m[3] ?? '').includes('requireAuth') })
  }
  return routes
}

describe('auth.middleware — public route allowlist (C1)', () => {
  it('login-flow endpoint\'lari public: phone/otp/telegram + email + password-reset', () => {
    const publicPosts = [
      'auth/phone/register', 'auth/phone/login',
      'auth/otp/request', 'auth/otp/verify/login', 'auth/otp/verify/register',
      'auth/telegram', 'auth/telegram-login',
      // email-auth (C1 fix — UI disable bo'lsa ham API ishlaydigan bo'lsin)
      'auth/email/register', 'auth/email/login',
      'auth/forgot-password', 'auth/reset-password',
    ]
    for (const p of publicPosts) {
      expect(isPublicAuthPost(req('POST', `/${p}`)), `POST /${p} public bo'lsin`).toBe(true)
    }
    expect(isPublicAuthGet(req('GET', '/auth/telegram-login/Ab12Cd34Ef5'))).toBe(true)
    expect(isPublicAuthGet(req('GET', '/auth/verify-email?token=x'))).toBe(true)
  })

  it("himoyali endpoint'lar PUBLIC EMAS (fail-closed qoladi)", () => {
    const guarded = [
      'auth/me', 'auth/logout', 'auth/phone/link', 'auth/tg-link-code',
      'auth/change-password', 'auth/resend-verification',
      'auth/google/callback', 'auth/apple/callback',
    ]
    for (const p of guarded) {
      expect(isPublicAuthPost(req('POST', `/${p}`)), `POST /${p} public bo'lmasin`).toBe(false)
      expect(isPublicAuthGet(req('GET', `/${p}`)), `GET /${p} public bo'lmasin`).toBe(false)
    }
    expect(isPublicGet(req('GET', '/auth/me'))).toBe(false)
    // Audit 2026-08-26: savollar banki anonim yig'ishdan himoyalangan — auth MAJBURIY
    expect(isPublicGet(req('GET', '/api/questions'))).toBe(false)
    expect(isPublicGet(req('GET', '/api/topics'))).toBe(false)
  })

  it('traversal/encoding bilan public-list aylanib o\'tilmaydi', () => {
    expect(isPublicAuthPost(req('POST', '/auth/%2e%2e/progress/result'))).toBe(false)
    // uch marta encode qilingan traversal ham normalize natijasida himoyalida qoladi
    expect(isPublicAuthPost(req('POST', '/auth/%252e%252e%252fprogress/result'))).toBe(false)
  })

  it('ROUTER ↔ ALLOWLIST SINXRON: requireAuth\'siz har bir route allowlist\'da', () => {
    const routes = extractAuthRoutes()
    expect(routes.length).toBeGreaterThan(0)
    for (const r of routes) {
      if (r.guarded || INTENTIONALLY_BLOCKED.has(r.path)) continue
      // ':code' kabi parametrli yo'llarni real namuna bilan tekshiramiz
      const sample = r.path.replace(/:[^/]+/g, 'Sample1234')
      const isPublic = r.method === 'POST'
        ? isPublicAuthPost(req('POST', `/${sample}`))
        : isPublicAuthGet(req('GET', `/${sample}`))
      expect(
        isPublic,
        `${r.method} /${r.path} — requireAuth'siz, lekin middleware allowlist'da YO'Q ` +
        `(prod'da 401 bo'ladi). PUBLIC_AUTH_POST/GET_PREFIXES ga qo'shing yoki requireAuth belgilang.`,
      ).toBe(true)
    }
  })
})
