import { test, expect } from '@playwright/test'
import { injectTelegramWebApp } from './helpers/telegram'

test('dashboard floating menu opens, dismisses, and opens themes', async ({ page }) => {
  await injectTelegramWebApp(page)
  await page.route('**/api/coins/tasks', (route) => route.fulfill({ json: { ok: true, tasks: [] } }))
  await page.route('**/api/boss/state', (route) => route.fulfill({ status: 503, json: { error: 'Unavailable in menu fixture' } }))
  await page.goto('/app.html#/')
  const trigger = page.getByRole('button', { name: 'Menyu', exact: true })
  await expect(trigger).toBeVisible()
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Menyu', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Temalar' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Yutuqlar' })).toBeVisible()
  await page.screenshot({ path: `test-results/dashboard-menu-${test.info().project.name}.png` })
  await page.mouse.click(10, 100)
  await expect(dialog).toBeHidden()
  await trigger.click()
  await page.getByRole('button', { name: 'Temalar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('dialog').last()).toBeVisible()
})
