/**
 * Grafik canvas — VISUAL REGRESSION (Playwright screenshot-compare).
 *
 * Math core unit testlar bilan qulflangan, lekin RENDERER (canvas chizmasi)
 * himoyasiz edi: sampling/rang/o'q/img regressiyasi faqat inson ko'zi bilan
 * ushlanardi. Bu spec qat'iy workspace seed qilib, canvas'ni "oltin namuna"
 * bilan solishtiradi.
 *
 * Determinizm: viewport/DPR qatiylashtirilgan, store `addInitScript` bilan
 * seed qilinadi (default ifoda emas), shriftlar `document.fonts.ready`gacha
 * kutiladi, test FAQAT desktop-chrome loyihasida ishlaydi (mobil DPR
 * farqlari baseline'ni keraksiz ikkilantiradi).
 *
 * Yangilash: npx playwright test tests/e2e/graph-visual.spec.ts --project=desktop-chrome --update-snapshots
 */
import { test, expect, type Page } from '@playwright/test'
import { injectTelegramWebApp } from './helpers/telegram'

const CANVAS = '[data-testid="graph-canvas"]'

// Mobil DPR farqlari baseline'ni ikkilantiradi; CI (Linux) uchun esa alohida
// baseline kerak — hali yaratilmagan. Lokal (win32) muhitda to'liq ishlaydi.
// CI'da yoqish: `npx playwright test tests/e2e/graph-visual.spec.ts --update-snapshots`
// bir marta CI'da ishlatib Linux baseline'larini commit qiling, keyin bu skip'ni olib tashlang.
test.skip(
  ({ isMobile }) => Boolean(isMobile) || Boolean(process.env.CI),
  'Visual regression: mobil DPR + Linux baseline talab qilinadi',
)

test.use({
  viewport: { width: 420, height: 900 },
  deviceScaleFactor: 1,
})

interface WorkspaceOptions {
  xVar?: string
  vars?: Record<string, number>
  analysis?: Partial<{
    derivative: boolean
    tangent: boolean
    x0: number
    integral: boolean
    a: number
    b: number
    rects: number
    markers: boolean
  }>
  viewport?: { cx: number; cy: number; unitsPerPx: number }
}

function graphWorkspace(expressions: string[], options: WorkspaceOptions = {}) {
  return {
    state: {
      expressions: expressions.map((expr, i) => ({
        id: `vis-${i}`,
        expr,
        colorIdx: i,
        visible: true,
      })),
      xVar: options.xVar ?? 'x',
      vars: options.vars ?? {},
      ranges: {},
      viewport: options.viewport ?? { cx: 0, cy: 0, unitsPerPx: 0.04 },
      analysis: {
        derivative: false,
        tangent: false,
        x0: 1,
        integral: false,
        a: 0,
        b: 1,
        rects: 10,
        markers: false,
        ...options.analysis,
      },
      recent: [],
      savedId: null,
      savedTitle: null,
    },
    version: 2,
  }
}

async function openGraph(page: Page, workspace: unknown) {
  await page.addInitScript((ws) => {
    try {
      localStorage.setItem('yhq-graph', JSON.stringify(ws))
    } catch { /* ignore */ }
  }, workspace)

  await page.goto('/app.html#/grafik')
  const canvas = page.locator(CANVAS)
  await expect(canvas).toBeVisible({ timeout: 15_000 })

  // Canvas o'lchami + shriftlar tayyor bo'lguncha kutish (chizma determinizmi)
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-testid="graph-canvas"]') as HTMLCanvasElement | null
    return !!c && c.width > 100 && c.height > 100
  })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)

  return canvas
}

test.describe('Grafik canvas visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramWebApp(page, {}, { onboarded: true })
  })

  test('sin(x) — asosiy chizma', async ({ page }) => {
    const canvas = await openGraph(page, graphWorkspace(['sin(x)']))
    await expect(canvas).toHaveScreenshot('graph-sin.png', { maxDiffPixelRatio: 0.01 })
  })

  test('tan(x) + 1/x — uzilish va asimptotalar', async ({ page }) => {
    const canvas = await openGraph(page, graphWorkspace(['tan(x)', '1/x']))
    await expect(canvas).toHaveScreenshot('graph-discontinuity.png', { maxDiffPixelRatio: 0.01 })
  })

  test('tahlil qatlami — hosila, urinma, integral, markerlar', async ({ page }) => {
    const canvas = await openGraph(page, graphWorkspace(['x^2 - 2'], {
      analysis: { derivative: true, tangent: true, x0: 1, integral: true, a: 0, b: 1.5, rects: 8, markers: true },
    }))
    await expect(canvas).toHaveScreenshot('graph-analysis.png', { maxDiffPixelRatio: 0.01 })
  })
})
