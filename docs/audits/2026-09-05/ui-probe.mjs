/* eslint-disable */
// Run from project root: node --import tsx docs/audits/2026-09-05/ui-probe.mjs
// Requires axe-core in %TEMP%/kivvi-audit-tools/node_modules and local Vite :5173.
import { chromium } from '@playwright/test'
import { injectTelegramWebApp, mockProfile } from '../../../tests/e2e/helpers/telegram.ts'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const out = fileURLToPath(new URL('.', import.meta.url))
const browser = await chromium.launch({ headless: true })
const results = []
const cases = [
  ['landing', '/', 390, 'light'],
  ['login', '/app.html', 390, 'dark'],
  ['dashboard', '/app.html#/', 390, 'dark'],
  ['dashboard-light', '/app.html#/', 390, 'light'],
  ['tickets', '/app.html#/biletlar', 320, 'dark'],
  ['profile', '/app.html#/profil', 390, 'dark'],
  ['premium', '/app.html#/premium', 390, 'dark'],
  ['dashboard-desktop', '/app.html#/', 1440, 'light'],
]
try {
  for (const [name, route, width, theme] of cases) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    // tsx's keepNames transform inserts __name into serialized fixture functions.
    // The shim belongs to this harness, not the product.
    await page.addInitScript('window.__name = (fn) => fn')
    if (name !== 'landing' && name !== 'login') {
      await injectTelegramWebApp(page, {}, { onboarded: true })
      await page.route('**/api/init', r => r.fulfill({ json: { ...mockProfile, settings: { ...mockProfile.settings, theme } } }))
      await page.route('**/api/coins/tasks', r => r.fulfill({ json: { ok: true, tasks: [] } }))
      await page.route('**/api/boss/state', r => r.fulfill({ status: 503, json: { error: 'audit fixture' } }))
    }
    await page.goto('http://127.0.0.1:5173' + route)
    await page.waitForTimeout(1800)
    if (name !== 'landing' && name !== 'login') {
      await page.evaluate(async (selectedTheme) => {
        const { useAppStore } = await import('/src/shared/store/useAppStore.ts')
        useAppStore.setState(state => ({ settings: { ...state.settings, theme: selectedTheme } }))
      }, theme)
      await page.waitForTimeout(150)
    }
    await page.addScriptTag({ path: process.env.TEMP + '/kivvi-audit-tools/node_modules/axe-core/axe.min.js' })
    const audit = await page.evaluate(async () => await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    }))
    const layout = await page.evaluate(() => ({
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      actualTheme: document.body.dataset.theme,
      headings: [...document.querySelectorAll('h1,h2')].map(e => e.textContent),
      smallTargets: [...document.querySelectorAll('button,a,input')].filter(e => {
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24)
      }).map(e => ({ text: (e.textContent || e.getAttribute('aria-label') || '').slice(0, 60),
        w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })).slice(0, 12),
    }))
    await page.screenshot({ path: out + 'screenshots/' + name + '.png', fullPage: true })
    const result = { name, route, width, theme, layout, errors, violations: audit.violations.map(v => ({
      id: v.id, impact: v.impact, helpUrl: v.helpUrl,
      nodes: v.nodes.map(n => ({ html: n.html, target: n.target, summary: n.failureSummary })),
    })) }
    results.push(result)
    console.log(JSON.stringify({ name, layout, errors, violations: result.violations.map(v => ({ id: v.id, count: v.nodes.length, first: v.nodes[0] })) }))
    await page.close()
  }
} finally {
  await browser.close()
  fs.writeFileSync(out + 'ui-audit.json', JSON.stringify(results, null, 2))
}
