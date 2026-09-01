/**
 * Safe-area CONSISTENCY testi (2026-09-01 APK/TG fullscreen incident).
 *
 * Muammo: APK edge-to-edge (targetSdk 36) va Telegram fullscreen'da WebView
 * tizim status bar + TG floating tugmalari ostiga chiziladi. `body` padding-top
 * (--safe-top-body) oddiy sahifalarni qoplaydi, lekin FIXED/STICKY TEPA
 * elementlar viewport'ga nisbatan joylashadi — ular alohida --safe-top
 * ishlatishi SHART. `.safe-top` class'i bir paytlar index.css'da YARATILMAY
 * qolgan edi (o'lik class) — ModesSheet/AchievementsScreen headerlari
 * status bar ostida qolib ketdi.
 *
 * Qoidalar:
 *  1. `fixed`/`sticky` bilan bir qatorda LITERAL `top-N` (top-0, top-4, ...)
 *     ishlatish TAQIQLANADI — `top-[var(--safe-top...)]` / `top-[calc(...safe-top...)]`
 *     ishlating (literal top-N env/TG inset'ni hisobga olmaydi).
 *  2. index.css'da `--safe-top`, `--safe-top-body` va `.safe-top` class'i
 *     MAVJUD bo'lishi shart (o'lik class regression himoyasi).
 *  3. PASTKI TOMON (2026-09-01 audit): `fixed` bilan LITERAL `bottom-N`
 *     (bottom-5, bottom-6, bottom-20...) TAQIQLANADI — TG fullscreen'da Android
 *     gesture bar / iPhone home indicator (34px) ostida qoladi;
 *     `bottom-[calc(<N>+var(--safe-bottom,0px))]` ishlating. index.css'da
 *     `--safe-bottom` = max(env, --tg-content-safe-area-inset-bottom) SHART
 *     (Android TG'da env()=0 qaytarishi mumkin — TG var zaxira).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../../src')

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(e.name)) yield p
  }
}

const violations: string[] = []

for (const f of walk(SRC)) {
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (!/\b(?:fixed|sticky)\b/.test(line)) return
    // Literal top-N utility (top-0, top-2, top-4...) — top-1/2 (fraction) va
    // top-[...] (arbitrary, safe-top'li) o'tib ketadi
    if (/\btop-\d+\b/.test(line) && !line.includes('safe-top')) {
      violations.push(`${path.relative(SRC, f)}:${i + 1}: ${line.trim().slice(0, 100)}`)
    }
    // Literal bottom-N FAQAT fixed'da taqiqlangan (sticky pastki element
    // scrollport'ga yopishadi — viewport inset'i tegmaydi); bottom-[...]
    // (arbitrary, safe-bottom'li) va -bottom-N (dekorativ absolute) o'tadi
    if (/\bfixed\b/.test(line) && /\bbottom-\d+\b/.test(line) && !line.includes('safe-bottom')) {
      violations.push(`BOTTOM: ${path.relative(SRC, f)}:${i + 1}: ${line.trim().slice(0, 100)}`)
    }
  })
}

describe('safe-area qoidalari (APK edge-to-edge + TG fullscreen)', () => {
  it('fixed/sticky tepa elementlarda literal top-N yo\'q (var(--safe-top) shart)', () => {
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('index.css\'da --safe-top tizimi MAVJUD (o\'lik .safe-top class regression)', () => {
    const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8')
    expect(css).toContain('--safe-top:')
    expect(css).toContain('--safe-top-body:')
    expect(css).toMatch(/\.safe-top\s*\{/)
    expect(css).toContain('body { padding-top: var(--safe-top-body')
  })

  it('index.css\'da --safe-bottom tizimi MAVJUD (env + TG var max — Android TG fullscreen)', () => {
    const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8')
    // max(env, --tg-content-safe-area-inset-bottom) — Android TG'da env()=0
    // qaytarishi mumkin, TG inject qilgan var zaxira bo'lishi SHART
    expect(css).toContain('--safe-bottom: max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px))')
    expect(css).toMatch(/\.safe-bottom\s*\{\s*padding-bottom:\s*var\(--safe-bottom/)
  })

  it('DialogOverlay bottom-sheet\'lar to\'liq tubiga (items-end) yopishadi', () => {
    const overlay = fs.readFileSync(path.join(SRC, 'shared/components/DialogOverlay.tsx'), 'utf8')
    expect(overlay).toContain("items-end")
  })

  /**
   * STICKY VIEWPORT GUARD (2026-09-01 Admin panel incident): haqiqiy scroll'ni
   * DOCUMENT bajaradi (html/body height:100% + kontent o'sadi). Layout
   * konteynerlarida overflow-y:auto/hidden bo'lsa, u scroll bo'lmasa ham
   * STICKY elementlar uchun scrollport (containing block) bo'lib qoladi —
   * sticky header viewport'ga yopishmay, kontent ustidan "suzadi" (tasdiq:
   * Playwright repro, stickyTop=-340). Ruxsat FAQAT overflow-x:clip
   * (clip scrollport yaratmaydi).
   */
  it('App.tsx Layout konteynerlari scrollport EMAS (sticky viewport\'ga ishlashi shart)', () => {
    const app = fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8')
    const layoutRoot = app.match(/<div className="relative flex flex-col min-h-screen[^"]*"/)?.[0] ?? ''
    expect(layoutRoot, 'Layout root topilmadi').not.toBe('')
    expect(layoutRoot).toContain('overflow-x-clip')
    expect(layoutRoot).not.toMatch(/overflow-hidden|overflow-y-auto|overflow-auto|overflow-scroll/)
    const routePage = app.match(/className="route-page relative z-10[^"]*"/)?.[0] ?? ''
    expect(routePage, 'route-page konteyneri topilmadi').not.toBe('')
    expect(routePage).not.toMatch(/overflow-y-auto|overflow-hidden|overflow-auto|overflow-scroll/)
  })

  it('usePullToRefresh DOCUMENT scroll\'ini o\'qiydi (.route-page scrollTop har doim 0)', () => {
    const ptr = fs.readFileSync(path.join(SRC, 'shared/hooks/usePullToRefresh.ts'), 'utf8')
    expect(ptr).toContain('window.scrollY')
    expect(ptr).not.toContain("querySelector('.route-page')")
  })

  it('--safe-top-body sof --safe-top qiymatini oladi (sun\'iy zolimalarsiz)', () => {
    const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8')
    // --safe-top-body: var(--safe-top, 0px) — ortiqcha sun'iy padding yo'q,
    // tepa bo'shliq faqat haqiqiy apparat/Telegram chrome inset'iga teng.
    expect(css).toContain('--safe-top-body: var(--safe-top, 0px)')
  })

  it('Custom scrollbar FAQAT desktop (touch\'da native auto-hide) — "scroll ko\'rinadi" regression', () => {
    const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8')
    // ::-webkit-scrollbar qoidalari @media (hover: hover) and (pointer: fine)
    // ICHIDA bo'lishi shart — touch WebView'da scrollbar har doim ko'rinardi
    const m = css.match(/@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?::-webkit-scrollbar/)
    expect(m, '::-webkit-scrollbar hover:hover media ichida emas!').not.toBeNull()
    expect(css).toMatch(/@media \(hover: none\), \(pointer: coarse\)\s*\{\s*\*\s*\{\s*scrollbar-width: none/)
  })
})
