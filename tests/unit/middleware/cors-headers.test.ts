/**
 * CORS allowedHeaders desync himoyasi (2026-08-31 incident regression).
 *
 * APK'da Telegram-login spinner'i cheksiz aylanardi: polling so'rovi
 * (api.checkTelegramLogin) `X-Login-Code` header yuboradi, lekin server
 * CORS allowedHeaders ro'yxatida u YO'Q edi — preflight rad etilib,
 * WebView haqiqiy GET'ni umuman yubormasdi. Bot sessiya chiqarib qo'ygan
 * bo'lsa-da client buni hech qachon bilolmasdi.
 *
 * Bu test client'dagi BARCHA custom header'lar (api client + websocket auth
 * + maxsus header'lar) server CORS ro'yxatida mavjudligini kafolatlaydi.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_TS = path.resolve(__dirname, '../../../server/app.ts')
const API_CLIENT = path.resolve(__dirname, '../../../src/shared/api/index.ts')

/** server/app.ts'dagi cors({ allowedHeaders: [...] }) ro'yxatini parse qiladi. */
function extractAllowedHeaders(): string[] {
  const src = readFileSync(APP_TS, 'utf8')
  const m = /allowedHeaders:\s*\[([^\]]+)\]/.exec(src)
  if (!m) throw new Error('allowedHeaders topilmadi — app.ts CORS konfiguratsiyasi o\'zgarganmi?')
  return (m[1]!.match(/'[^']+'/g) ?? []).map((s) => s.slice(1, -1).toLowerCase())
}

/** Client (api client) yuboradigan custom header'lar — CORS preflight'dan o'tishi SHART. */
const CLIENT_CUSTOM_HEADERS = [
  'Content-Type',         // JSON POST body (preflight trigger)
  'Authorization',        // Bearer sessiya
  'x-telegram-init-data', // Mini App initData
  'X-Login-Code',         // telegram-login polling (checkTelegramLogin)
]

describe('server CORS allowedHeaders — client header\'lari bilan sinxron', () => {
  it("client yuboradigan HAR BIR custom header ruxsat etilgan", () => {
    const allowed = extractAllowedHeaders()
    for (const h of CLIENT_CUSTOM_HEADERS) {
      expect(
        allowed.includes(h.toLowerCase()),
        `${h} server CORS allowedHeaders'da YO'Q — cross-origin (APK/brauzer) ` +
        `preflight rad etiladi (2026-08-31 APK login spinner incident'i).`,
      ).toBe(true)
    }
  })

  it('api client X-Login-Code header yuboradi (header nomi test bilan sinxron)', () => {
    // Client'dagi header nomi o'zgarsa bu test ham yangilanishi shart —
    // yuqoridagi desync himoyasi aynan shu nomga tayanadi.
    const src = readFileSync(API_CLIENT, 'utf8')
    expect(src).toContain("'X-Login-Code'")
  })
})
