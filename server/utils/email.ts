/**
 * Email utilities — verification, password reset, notifications.
 * Uses Resend API for transactional emails (config.email.resendApiKey).
 * Stub implementation returns success without sending (dev/test mode).
 */

import { config } from '../config'

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

/** HTML escape to prevent XSS in email templates */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Validate email format */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Validate URL to prevent open redirects — must be app domain or localhost */
function validateAppUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // deploy.appUrl host'ini ham ruxsat etish SHART — linklar aynan shu
    // bazadan quriladi (`config.deploy.appUrl/verify-email?...`); faqat
    // APP_DOMAIN'ga qarasak boshqa host'dagi deploy'da template throw qilar edi.
    let deployHost: string | null = null
    try { deployHost = new URL(config.deploy.appUrl).hostname } catch { /* config allaqachon tekshirgan */ }
    const allowedHosts = [
      'localhost',
      '127.0.0.1',
      config.appDomain || 'kiwi.uz',
      ...(deployHost ? [deployHost] : []),
    ]
    if (!allowedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      throw new Error(`URL host not allowed: ${parsed.hostname}`)
    }
    return url
  } catch (err) {
    throw new Error(`Invalid URL: ${err instanceof Error ? err.message : 'parse failed'}`, { cause: err })
  }
}

/**
 * Send email via Resend API.
 * Stub: returns success without actual send if API key not configured.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ sent: boolean }> {
  if (!options.to || !isValidEmail(options.to)) {
    throw new Error('Invalid recipient email address')
  }
  if (!options.subject?.trim() || !options.html?.trim()) {
    throw new Error('Email subject and body are required')
  }

  if (!config.email?.resendApiKey) {
    console.warn('[Email] No Resend API key configured — skipping email send:', options.subject)
    return { sent: false }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || config.email.fromAddress || 'noreply@kiwi.uz',
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    })

    if (!response.ok) {
      const error = await response.text().catch(() => response.statusText)
      throw new Error(`Resend API error ${response.status}: ${error}`)
    }

    return { sent: true }
  } catch (err) {
    console.error('[Email] Failed to send:', err)
    throw err
  }
}

/**
 * Generate email verification HTML template.
 * All user inputs sanitized to prevent XSS.
 * Links validated to prevent open redirect.
 */
export function emailVerificationTemplate(verificationLink: string, firstName: string, language: 'uz' | 'ru' = 'uz'): string {
  const safeLink = validateAppUrl(verificationLink)
  const safeName = escapeHtml(firstName.trim() || 'User')

  const text = language === 'ru' ? {
    greeting: `Здравствуйте, ${safeName}!`,
    body: 'Спасибо за регистрацию в KIVVI. Пожалуйста, подтвердите свой адрес электронной почты, нажав на кнопку ниже:',
    button: 'Подтвердить email',
    footer: 'Если вы не регистрировались на KIVVI, проигнорируйте это письмо.',
    expire: 'Эта ссылка действительна в течение 24 часов.',
  } : {
    greeting: `Salom, ${safeName}!`,
    body: 'KIVVI\'da ro\'yxatdan o\'tganingiz uchun rahmat. Email manzilingizni quyidagi tugmani bosib tasdiqlang:',
    button: 'Emailni tasdiqlash',
    footer: 'Agar siz KIVVI\'da ro\'yxatdan o\'tmagan bo\'lsangiz, bu xatni e\'tiborsiz qoldiring.',
    expire: 'Bu havola 24 soat davomida amal qiladi.',
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #1a1a1a;">KIVVI</h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 20px 40px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5; color: #1a1a1a;">${text.greeting}</p>
                  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #666666;">${text.body}</p>
                  <table role="presentation" style="width: 100%;">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${safeLink}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">${text.button}</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.5; color: #999999;">${text.expire}</p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 40px 40px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="margin: 0; font-size: 13px; color: #999999;">${text.footer}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
 * Generate password reset HTML template.
 * All user inputs sanitized to prevent XSS.
 * Links validated to prevent open redirect.
 */
export function passwordResetTemplate(resetLink: string, firstName: string, language: 'uz' | 'ru' = 'uz'): string {
  const safeLink = validateAppUrl(resetLink)
  const safeName = escapeHtml(firstName.trim() || 'User')

  const text = language === 'ru' ? {
    greeting: `Здравствуйте, ${safeName}!`,
    body: 'Мы получили запрос на сброс пароля для вашего аккаунта KIVVI. Нажмите кнопку ниже, чтобы создать новый пароль:',
    button: 'Сбросить пароль',
    footer: 'Если вы не запрашивали сброс пароля, проигнорируйте это письмо. Ваш пароль останется без изменений.',
    expire: 'Эта ссылка действительна в течение 1 часа.',
  } : {
    greeting: `Salom, ${safeName}!`,
    body: 'KIVVI akkauntingiz uchun parol tiklash so\'rovi qabul qilindi. Yangi parol yaratish uchun quyidagi tugmani bosing:',
    button: 'Parolni tiklash',
    footer: 'Agar siz parol tiklashni so\'ramagan bo\'lsangiz, bu xatni e\'tiborsiz qoldiring. Parolingiz o\'zgarmaydi.',
    expire: 'Bu havola 1 soat davomida amal qiladi.',
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #1a1a1a;">KIVVI</h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 20px 40px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5; color: #1a1a1a;">${text.greeting}</p>
                  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #666666;">${text.body}</p>
                  <table role="presentation" style="width: 100%;">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${safeLink}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">${text.button}</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.5; color: #999999;">${text.expire}</p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 40px 40px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="margin: 0; font-size: 13px; color: #999999;">${text.footer}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}
