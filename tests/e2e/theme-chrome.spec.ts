import { test, expect } from '@playwright/test'
import { injectTelegramWebApp, mockProfile } from './helpers/telegram'

for (const width of [320, 390]) {
  test(`theme chrome stays aligned at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 740 })
    await injectTelegramWebApp(page)
    await page.route('**/api/coins/tasks', (route) => route.fulfill({ json: { tasks: [] } }))
    await page.route('**/api/boss/state', (route) => route.fulfill({ status: 503, json: { error: 'Test offline' } }))
    await page.route('**/api/init', (route) => route.fulfill({
      json: { ...mockProfile, settings: { ...mockProfile.settings, theme: 'light', noAnimation: false } },
    }))
    await page.addInitScript(() => {
      const saved = JSON.parse(localStorage.getItem('yhq-app-store')!)
      saved.state.settings.theme = 'light'
      saved.state.settings.noAnimation = false
      localStorage.setItem('yhq-app-store', JSON.stringify(saved))
    })
    await page.goto('/app.html#/')
    const toggle = page.locator('.theme-toggle-btn')
    await expect(toggle).toBeVisible({ timeout: 15000 })
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'light')
    await page.evaluate(() => document.fonts.ready)
    const before = await page.locator('header').boundingBox()
    for (const theme of ['dark', 'light']) {
      await toggle.click()
      await expect(page.locator('body')).toHaveAttribute('data-theme', theme)
      await page.waitForFunction(() => !document.documentElement.matches('.theme-to-dark, .theme-to-light'))
      const colors = await page.evaluate(() => ({
        root: getComputedStyle(document.documentElement).backgroundColor,
        header: getComputedStyle(document.querySelector('header')!).backgroundColor,
        canvas: getComputedStyle(document.body).getPropertyValue('--p-canvas').trim(),
        meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
      }))
      expect(colors.root).toBe(colors.header)
      expect(colors.meta).toBe(colors.canvas)
      const after = await page.locator('header').boundingBox()
      expect(after?.y).toBe(before?.y)
      expect(after?.height).toBe(before?.height)
      await page.screenshot({ path: testInfo.outputPath(`${theme}.png`) })
    }
  })
}
