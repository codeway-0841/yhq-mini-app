/**
 * initData stale-401 recovery — 2026-08-27 incident regression.
 *
 * Incident: Mini App 1+ soat ochiq qolganda server initData'ni rad etadi
 * (replay oynasi 3600s) va client `window.location.reload()` qilardi — lekin
 * Telegram reload'da O'SHA eski initData'ni qaytaradi (auth_date sessiyaga
 * mixlangan). Natija: cheksiz reload→401→reload sikli (72 daqiqada 218 ta
 * full-bank fetch), test javobi yuborganda sahifa qayta yuklanardi, yangi
 * akkaunt profili umuman ochilmasdi.
 *
 * Qoida: har bir NOYOB auth_date uchun FAQAT 1 reload; Telegram xuddi shu
 * auth_date'ni qaytarsa — DEAD (App blokirovka ekrani: "yopib-qayta oching").
 */
import { describe, it, expect } from 'vitest'
import { nextInitDataAction } from '../../../src/platform/telegram'

const NOW = 1_800_000_000_000

describe("nextInitDataAction — har auth_date'ga 1 reload, keyin DEAD", () => {
  it('yozuv yo\'q — birinchi urinish: reload', () => {
    expect(nextInitDataAction(null, 1000, NOW)).toBe('reload')
  })

  it('xuddi shu auth_date bilan reload qilingan — DEAD (Telegram yangilamaydi)', () => {
    expect(nextInitDataAction({ at: NOW - 30_000, authDate: 1000 }, 1000, NOW)).toBe('dead')
  })

  it('auth_date O\'ZGARGAN (yangi launch) — yangi sessiyaga 1 reload huquqi', () => {
    expect(nextInitDataAction({ at: NOW - 30_000, authDate: 1000 }, 2000, NOW)).toBe('reload')
  })

  it('yozuv 10 daqiqadan eski — avvalgi sessiya merosi: kechiriladi (reload)', () => {
    expect(nextInitDataAction({ at: NOW - 11 * 60_000, authDate: 1000 }, 1000, NOW)).toBe('reload')
  })

  it('auth_date null (mock/dev muhit) — takroriy null ham DEAD', () => {
    expect(nextInitDataAction(null, null, NOW)).toBe('reload')
    expect(nextInitDataAction({ at: NOW - 5_000, authDate: null }, null, NOW)).toBe('dead')
  })
})
