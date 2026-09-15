/**
 * A11Y gate (axe-core, WCAG 2.0/2.1 A+AA).
 *
 * Professionallar chiqarishdan oldin avtomatik a11y skaner yurgizadi:
 * landmark'lar, kontrast, nomlangan kontrollar, heading tartibi.
 * Faqat serious+critical — minor/enhancement'lar alohida backlog'da.
 */
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { injectTelegramWebApp } from './helpers/telegram'

test.beforeEach(async ({ page: _page }, testInfo) => {
  void _page
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'faqat desktop-chrome loyihasida',
  )
})

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

test.describe('axe a11y', () => {
  test('login — serious/critical yo\'q', async ({ page }) => {
    await page.route('https://telegram.org/js/telegram-web-app.js', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
    )
    await page.goto('/app.html#/')
    await expect(
      page.getByRole('button', { name: /Telegram orqali kirish/i }),
    ).toBeVisible({ timeout: 20000 })
    const bad = await scan(page)
    expect(
      bad.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.html?.slice(0, 120)}`),
      JSON.stringify(bad, null, 1).slice(0, 3000),
    ).toEqual([])
  })

  test('dashboard — serious/critical yo\'q', async ({ page }) => {
    await injectTelegramWebApp(page, {}, { onboarded: true })
    await page.goto('/app.html#/')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1500)
    const bad = await scan(page)
    expect(
      bad.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.html?.slice(0, 120)}`),
      JSON.stringify(bad, null, 1).slice(0, 3000),
    ).toEqual([])
  })

  test('testlar — serious/critical yo\'q', async ({ page }) => {
    await injectTelegramWebApp(page, {}, { onboarded: true })
    await page.goto('/app.html#/testlar')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1500)
    const bad = await scan(page)
    expect(
      bad.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.html?.slice(0, 120)}`),
      JSON.stringify(bad, null, 1).slice(0, 3000),
    ).toEqual([])
  })
})
