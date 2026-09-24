import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../../src')

function read(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), 'utf8')
}

describe('Desktop App Shell (production, sidebar + responsive container)', () => {
  it('DesktopSidebar mavjud va faqat desktop\'da ko\'rinadi (hidden lg:flex)', () => {
    const p = path.join(SRC, 'shared/components/DesktopSidebar.tsx')
    expect(fs.existsSync(p), 'DesktopSidebar.tsx topilmadi').toBe(true)
    const code = read('shared/components/DesktopSidebar.tsx')
    expect(code).toContain('hidden')
    expect(code).toContain('lg:flex')
    // shared/ qatlami features/'ga import qilmaydi (import-boundaries)
    expect(code).not.toMatch(/from ['"]\.\.\/\.\.\/features\//)
    expect(code).not.toMatch(/from ['"]@\/features\//)
  })

  it('DesktopSidebar sticky + safe-top (literal top-N yo\'q — safe-area qoidasi)', () => {
    const code = read('shared/components/DesktopSidebar.tsx')
    expect(code).toContain('sticky')
    expect(code).toContain('top-[var(--safe-top')
    for (const line of code.split('\n')) {
      if (/\bsticky\b/.test(line) && /\btop-\d+\b/.test(line) && !line.includes('safe-top')) {
        throw new Error(`literal top-N: ${line.trim().slice(0, 120)}`)
      }
    }
  })

  it('App.tsx Layout: sidebar + responsive container (safe-area regex prefixlari saqlangan)', () => {
    const app = read('App.tsx')
    expect(app).toContain('DesktopSidebar')
    expect(app).toContain('<DesktopSidebar />')
    // safe-area testi regex'lari uchun prefix shart:
    expect(app).toMatch(/<div className="relative flex flex-col min-h-screen[^"]*"/)
    expect(app).toMatch(/className="route-page relative z-10[^"]*"/)
    const layoutRoot = app.match(/<div className="relative flex flex-col min-h-screen[^"]*"/)?.[0] ?? ''
    expect(layoutRoot).toContain('overflow-x-clip')
    expect(layoutRoot).toContain('lg:flex-row')
    // Desktop fixed shell: root viewport'da qulflangan, scroll panel ichida
    expect(layoutRoot).toContain('lg:overflow-hidden')
    expect(layoutRoot).toContain('lg:h-[calc(100dvh')
    const routePage = app.match(/className="route-page relative z-10[^"]*"/)?.[0] ?? ''
    expect(routePage).toContain('px-0')
    // FULL-WIDTH shell (2026-09-24): route-page'da max-w cap YO'Q — tor sahifalar
    // o'z lg:max-w-2xl'iga ega, grid sahifalar kenglikni to'liq ishlatadi.
    expect(routePage).not.toMatch(/max-w-2xl|max-w-3xl|max-w-5xl|max-w-6xl/)
    expect(routePage).toContain('lg:min-w-0')
    // Wondering-uslub PANEL: desktop'da border+radius, padding YO'Q (PageHeader
    // -mx-4 full-bleed), overflow-hidden YO'Q (sticky scrollport qoidasi).
    expect(routePage).toContain('lg:my-2')
    expect(routePage).toContain('lg:mr-2')
    expect(routePage).toContain('lg:ml-2')
    expect(routePage).toContain('lg:rounded-2xl')
    expect(routePage).toContain('lg:border')
    expect(routePage).toContain('lg:border-pline')
    expect(routePage).toContain('lg:shadow-sm')
    expect(routePage).toContain('lg:bg-pcanvas')
    expect(routePage).toContain('lg:pb-0')
    expect(routePage).toContain('lg:min-h-0')
    expect(routePage).toContain('lg:overflow-y-auto')
    expect(routePage).toContain('lg:overscroll-contain')
    // Prefixsiz overflow (mobil) taqiqlangan — faqat lg: ruxsat
    expect(routePage).not.toMatch(/(^|[\s"'])overflow-(hidden|y-auto|auto)([\s"']|$)/)
  })

  it('DesktopSidebar collapse toggle + icon rail (Wondering uslubi)', () => {
    const code = read('shared/components/DesktopSidebar.tsx')
    // Toggle tugma: PanelLeft ikonlar, aria-expanded, store orqali
    expect(code).toMatch(/PanelLeft(Open|Close)/)
    expect(code).toContain('aria-expanded')
    expect(code).toContain('useSidebarStore')
    expect(code).toContain('sidebarCollapse')
    expect(code).toContain('sidebarExpand')
    // Icon rail: collapsed'da w-16, silliq width transition (wondering.app 1:1)
    expect(code).toContain('w-16')
    expect(code).toContain('transition-[width]')
    // shared/ qatlami features/'ga import qilmaydi (import-boundaries)
    expect(code).not.toMatch(/from ['"]\.\.\/\.\.\/features\//)
  })

  it('useSidebarStore: device-scoped persist (server sync YOQ, account switchda qoladi)', () => {
    const p = path.join(SRC, 'shared/store/useSidebarStore.ts')
    expect(fs.existsSync(p), 'useSidebarStore.ts topilmadi').toBe(true)
    const code = read('shared/store/useSidebarStore.ts')
    expect(code).toContain("name: 'yhq-sidebar'")
    expect(code).toContain('toggle')
    expect(code).toContain('collapsed')
    expect(code).not.toMatch(/syncSettingsRemote|patchSettings|api\./)
  })

  it('IosDock desktop\'da yashirin (lg:hidden), safe-bottom hack saqlangan', () => {
    const dock = read('shared/components/IosDock.tsx')
    expect(dock).toContain('lg:hidden')
    expect(dock).toContain('safe-bottom')
  })

  it('index.css: desktop media (route-page padding + grid helper)', () => {
    const css = read('index.css')
    expect(css).toContain('@media (min-width: 1024px)')
    expect(css).toContain(".route-page[data-tabroot='true']")
    expect(css).toContain('.desktop-grid-2')
    expect(css).toContain('::selection')
  })

  it('desktop grid: Testlar 2-ustun, Rejimlar 4/5-ustun (mobil o\'zgarmaydi)', () => {
    const testlar = read('features/testlar/TestlarPage.tsx')
    expect(testlar).toContain('lg:grid-cols-2')
    const modes = read('features/dashboard/ModesPage.tsx')
    expect(modes).toContain('lg:grid-cols-4')
    expect(modes).toContain('xl:grid-cols-5')
  })

  it('batch-3: Dashboard/Kutubxona/Biletlar grid, Duel tor ustun', () => {
    const guide = read('features/dashboard/components/LearningGuide.tsx')
    expect(guide).toContain('lg:grid-cols-4')
    const lib = read('features/library/LibraryPage.tsx')
    expect(lib).toContain('lg:grid-cols-5')
    expect(lib).toContain('xl:grid-cols-6')
    const bilets = read('features/tickets/Biletlar.tsx')
    expect(bilets).toContain('lg:grid-cols-5')
    expect(bilets).toContain('xl:grid-cols-6')
    const duel = read('features/octagon/OctagonPage.tsx')
    expect(duel).toContain('lg:max-w-5xl')
  })

  it('batch-4: Statistika/Xatolar/Mavzular/Belgilar/Flashcards/Streak/AI-test', () => {
    expect(read('features/stats/StatistikaPage.tsx')).toContain('lg:grid-cols-4')
    const xatolar = read('features/mistakes/XatolarPage.tsx')
    expect(xatolar).toContain('lg:grid-cols-2')
    expect(xatolar).not.toContain('bg-pdanger/15')
    expect(xatolar).not.toContain('bg-pwarning/15')
    const topics = read('features/topics/TopicsPage.tsx')
    expect(topics).toContain('lg:grid-cols-2')
    expect(topics).toContain('px-4 pb-8')
    const belgilar = read('features/signs/Belgilar.tsx')
    expect(belgilar).toContain('lg:grid-cols-5')
    expect(belgilar).toContain('xl:grid-cols-6')
    expect(belgilar).toContain('lg:grid-cols-3')
    expect(read('features/flashcards/FlashcardsPage.tsx')).toContain('lg:grid-cols-2')
    expect(read('features/streak/StreakPage.tsx')).toContain('lg:max-w-2xl')
    expect(read('features/ai-test/AiTestHub.tsx')).toContain('lg:grid-cols-2')
  })

  it('batch-5: Formulalar/Qidiruv/Speed/Adaptive desktop', () => {
    const formulas = read('features/formulas/FormulasPage.tsx')
    expect(formulas).toContain('sm:grid-cols-3')
    expect(formulas).toContain('xl:grid-cols-4')
    expect(read('features/search/SearchPage.tsx')).toContain('lg:grid-cols-2')
    const speed = read('features/speed/SpeedPage.tsx')
    expect(speed).toContain('lg:max-w-2xl')
    expect(speed).not.toContain('bg-pprimary/15')
    expect(speed).not.toContain('bg-pdanger/15')
    expect(read('features/adaptive/AdaptivePage.tsx')).toContain('lg:max-w-2xl')
  })

  it('batch-8: Admin keng kontent, Graph baland kanvas (NotFound/Sheet tayyor)', () => {
    expect(read('features/admin/AdminPage.tsx')).toContain('lg:max-w-2xl')
    const graph = read('features/graph/GraphPage.tsx')
    expect(graph).toContain('lg:h-[58vh]')
    expect(graph).toContain('lg:grid-cols-4')
  })

  it('batch-6: Onboarding 2-ustun + var-rang opacity fix (onboarding/login)', () => {
    const ob = read('features/onboarding/Onboarding.tsx')
    expect(ob).toContain('sm:grid-cols-2')
    expect(ob).not.toContain('bg-pprimary/10')
    expect(ob).not.toContain('bg-pprimary/15')
    const login = read('features/auth/LoginPage.tsx')
    expect(login).not.toContain('bg-pprimary/15')
    expect(login).not.toContain('border-pprimary/35')
    expect(login).not.toContain('bg-psurface/40')
  })

  it('batch-7: Login FULLSCREEN split + Onboarding motion', () => {
    const login = read('features/auth/LoginPage.tsx')
    expect(login).toContain('lg:max-w-none')
    expect(login).toContain('lg:grid-cols-2')
    expect(login).toContain('lg:min-h-[calc(100dvh-var(--safe-top-body,0px))]')
    const ob = read('features/onboarding/Onboarding.tsx')
    expect(ob).toContain('splash-float-safe')
    const css = read('index.css')
    expect(css).toContain('.splash-float-safe')
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)')
  })

  it('batch-2: Shop/Premium grid, Profil/Reyting tor markaziy ustun', () => {
    const shop = read('features/shop/ShopPage.tsx')
    expect(shop).toContain('lg:grid-cols-3')
    expect(shop).toContain('xl:grid-cols-4')
    const premium = read('features/premium/PremiumPage.tsx')
    expect(premium).toContain('lg:grid-cols-3')
    const profil = read('features/profile/Profil.tsx')
    expect(profil).toContain('lg:max-w-2xl')
    const leader = read('features/leaderboard/LeaderboardPage.tsx')
    expect(leader).toContain('lg:grid-cols-12')
    // --p-* var rangda Tailwind opacity modifier ishlamaydi (rgb triplet shart)
    expect(leader).not.toContain('bg-pprimary/20')
  })
})
