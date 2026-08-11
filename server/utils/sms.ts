/**
 * SMS OTP service — Eskiz.uz provider (O'zbekiston SMS gateway)
 *
 * ENV: ESKIZ_EMAIL, ESKIZ_PASSWORD
 */

import { createHash, randomInt } from 'crypto'
import { config } from '../config'

interface EskizAuthResponse {
  message: string
  data: { token: string }
}

interface EskizSendResponse {
  message: string
  status: string
  id?: string
}

let cachedToken: { token: string; expiresAt: number } | null = null

/** Eskiz.uz API uchun auth token olish (cache'da 29 kun saqlanadi) */
async function getEskizToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const response = await fetch('https://notify.eskiz.uz/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: config.sms.eskizEmail,
      password: config.sms.eskizPassword,
    }),
  })

  if (!response.ok) {
    throw new Error(`Eskiz auth failed: ${response.status}`)
  }

  const data: EskizAuthResponse = await response.json()
  cachedToken = {
    token: data.data.token,
    expiresAt: Date.now() + 29 * 86_400_000, // 29 kun
  }
  return cachedToken.token
}

/**
 * SMS yuborish — OTP kodi telefon raqamga.
 * @param phone E.164 format: +998901234567
 * @param code 6 raqamli kod
 */
export async function sendOTP(phone: string, code: string): Promise<boolean> {
  if (!config.sms.enabled) {
    // Dev — kod console'ga (test uchun zarur), prod — error
    if (config.env === 'development') {
      console.warn(`[SMS DEV] ${phone} → ${code}`)
      return true
    }
    throw new Error('SMS_ENABLED=false in production (set ESKIZ_EMAIL + ESKIZ_PASSWORD)')
  }

  const token = await getEskizToken()
  const response = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mobile_phone: phone.replace(/^\+/, ''), // +998... → 998...
      message: `Sizning YHQ tasdiqlash kodingiz: ${code}`,
      from: '4546',
      callback_url: config.sms.callbackUrl || '',
    }),
  })

  if (!response.ok) {
    // Token eskirgan bo'lishi mumkin — cache'ni tozalaymiz
    cachedToken = null
    throw new Error(`SMS send failed: ${response.status}`)
  }

  const data: EskizSendResponse = await response.json()
  return data.status === 'success' || data.message === 'Waiting for SMS'
}

/**
 * Random 6 raqamli OTP kod generatsiya.
 * CSPRNG (crypto.randomInt) — Math.random() bashorat qilinadigan xorshift128+,
 * login kodi uchin-kod bo'lgani uchun zaif PRNG mumkin emas.
 */
export function generateOTP(): string {
  return randomInt(100000, 1000000).toString()
}

/**
 * OTP kodni hash qilish — DB'da plain text saqlanmaydi.
 * Verification: hash(userInput) === stored hash.
 */
export function hashOTP(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}
