import { test, expect } from '@playwright/test'

// Isolated real component, no account/server dependency. CDP sends trusted touch
// input so Chromium's scroll arbitration (absent in jsdom) participates.
test.use({ hasTouch: true })

test('sheet touch drag, native scroll, and first tap after cancel', async ({ page, context }) => {
  await page.route('**/gesture-fixture.html', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="/src/index.css"><div id="fixture"></div>
      <script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        const { default: React } = await import('/node_modules/.vite/deps/react.js');
        const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { default: DialogOverlay } = await import('/src/shared/components/DialogOverlay.tsx');
        window.closedCount = 0; window.tapCount = 0;
        ReactDOM.createRoot(document.getElementById('fixture')).render(React.createElement(DialogOverlay,
          { swipeToDismiss: true, onClose: () => window.closedCount++ },
          React.createElement('div', { id: 'scroll', style: { height: '300px', overflowY: 'auto', width: '100%', background: 'white' } },
            React.createElement('button', { id: 'tap', onClick: () => window.tapCount++, style: { height: '50px', width: '100%' } }, 'Tap'),
            React.createElement('div', { style: { height: '1000px' } }, 'Scrollable text'))));
      </script>`,
  }))
  await page.goto('/gesture-fixture.html')
  const scroll = page.locator('#scroll')
  await expect(scroll).toBeVisible()
  const box = (await scroll.boundingBox())!
  const x = box.x + 100
  const y = box.y + 90
  const cdp = await context.newCDPSession(page)
  const send = (type: string, at: number) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y: at }],
  })
  await send('touchStart', y)
  await send('touchMove', y + 35)
  await expect.poll(() => scroll.evaluate(el => el.parentElement!.style.transform)).toContain('35px')
  await send('touchCancel', y + 35)
  await expect.poll(() => scroll.evaluate(el => el.parentElement!.style.transform)).toBe('translate3d(0px, 0px, 0px)')
  await page.locator('#tap').tap()
  await expect.poll(() => page.evaluate(() => (window as unknown as { tapCount: number }).tapCount)).toBe(1)
  // Upward finger motion must scroll the content, not pull the sheet.
  await send('touchStart', y + 100)
  for (const distance of [25, 50, 80, 110]) await send('touchMove', y + 100 - distance)
  await send('touchEnd', y)
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => (window as unknown as { closedCount: number }).closedCount)).toBe(0)
  await expect.poll(async () => {
    const before = await scroll.evaluate(el => el.scrollTop)
    await page.waitForTimeout(100)
    return (await scroll.evaluate(el => el.scrollTop)) === before
  }).toBe(true)
  await scroll.evaluate(el => { el.scrollTop = 0 })
  await send('touchStart', y)
  for (const distance of [25, 50, 90, 120]) await send('touchMove', y + distance)
  await send('touchEnd', y + 120)
  await expect.poll(() => page.evaluate(() => (window as unknown as { closedCount: number }).closedCount)).toBe(1)
})
