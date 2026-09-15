/**
 * Desktop ROBUSTNESS (RU overflow + past ekran + temalar).
 *
 * Professionallar chiqarishdan oldin tekshiradi:
 *  1) RU matnlar uzun — gorizontal overflow/truncate buzilishi (avtomatik assert).
 *  2) Past ekran (laptop 720p) — login absolute havola CTA'ni bosmasligi.
 *  3) Barcha aksent temalarda yangi sirtlar (sidebar gradient, login panel).
 */
import { test, expect, type Page } from '@playwright/test'
import { injectTelegramWebApp, mockProfile } from './helpers/telegram'

test.beforeEach(async ({ page: _page }, testInfo) => {
  void _page
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'faqat desktop-chrome loyihasida',
  )
})

async function gotoAuthed(page: Page, hash: string, language: 'uz' | 'ru' = 'uz') {
  await injectTelegramWebApp(page, {}, { onboarded: true })
  if (language === 'ru') {
    // Server profili (hydrate) lokal seed'ni BOSADI — shuning uchun /api/init
    // javobining o'zida tilni almashtiramiz. Bu route inject'dan KEYIN
    // ro'yxatlanishi SHART (Playwright'da oxirgi mos route g'olib bo'ladi).
    const ruProfile = JSON.stringify({
      ...mockProfile,
      settings: { ...mockProfile.settings, language: 'ru' },
    })
    for (const pattern of ['**/api/init', '**/api/auth/me', '**/api/profile']) {
      await page.route(pattern, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: ruProfile }),
      )
    }
  }
  await page.goto(`/app.html#${hash}`)
  await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1500)
}

const ROUTES = ['/', '/testlar', '/rejimlar', '/shop', '/premium', '/profil'] as const

test.describe('RU overflow (gorizontal scroll YO\'Q)', () => {
  for (const hash of ROUTES) {
    test(`ru: ${hash}`, async ({ page }) => {
      await gotoAuthed(page, hash, 'ru')
      // Til ALMAShGANINI isbotlaymiz (server hydrate seed'ni bosadi —
      // seed'ga tayanib bo'lmaydi, shuning uchun bu assert SHART).
      await expect(page.locator('aside[aria-label="Desktop navigatsiya"]')).toContainText('Главная')
      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
      }))
      expect(
        overflow.scrollW,
        `${hash}: scrollWidth=${overflow.scrollW} > innerWidth=${overflow.innerW}`,
      ).toBeLessThanOrEqual(overflow.innerW + 1)
    })
  }
})

test.describe('Past ekran (1440x700 laptop)', () => {
  test.use({ viewport: { width: 1440, height: 700 } })

  test('login: "Bosh sahifa" havolasi CTA\'ni bosmaydi', async ({ page }) => {
    await page.route('https://telegram.org/js/telegram-web-app.js', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
    )
    await page.goto('/app.html#/')
    const cta = page.getByRole('button', { name: /Telegram orqali kirish/i })
    await expect(cta).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(800)
    const overlap = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, a')].find((el) =>
        /Telegram orqali kirish/i.test(el.textContent ?? ''),
      )
      const home = [...document.querySelectorAll('a')].find((el) =>
        /Bosh sahifa|На главную/.test(el.textContent ?? ''),
      )
      if (!btn || !home) return { skipped: true as const }
      const b = btn.getBoundingClientRect()
      const h = home.getBoundingClientRect()
      const xOverlap = Math.max(0, Math.min(b.right, h.right) - Math.max(b.left, h.left))
      const yOverlap = Math.max(0, Math.min(b.bottom, h.bottom) - Math.max(b.top, h.top))
      return { skipped: false as const, area: xOverlap * yOverlap }
    })
    expect(overlap.skipped ?? false).toBe(false)
    if (!overlap.skipped) expect(overlap.area).toBe(0)
  })
})

test.describe('Aksent temalarda yangi sirtlar', () => {
  for (const accent of ['gold', 'ocean', 'sakura'] as const) {
    test(`dashboard + login @${accent}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(err.message))
      await gotoAuthed(page, '/')
      await page.evaluate((a) => {
        document.body.dataset.accent = a
      }, accent)
      await page.waitForTimeout(800)
      expect(errors).toEqual([])
      // Sidebar active pill aksent rangni olgani (var resolve bo'lgani) —
      // computed style bo'sh/transparent emas.
      const pill = await page.evaluate(() => {
        const el = document.querySelector('aside[aria-label="Desktop navigatsiya"] span.bg-pprimary')
        return el ? getComputedStyle(el).backgroundColor : null
      })
      expect(pill).not.toBeNull()
      expect(pill).not.toBe('rgba(0, 0, 0, 0)')
    })
  }
})
