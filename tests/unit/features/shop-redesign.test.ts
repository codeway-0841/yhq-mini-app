/**
 * Do'kon v2 redesign REGRESSION testi (2026-10).
 *
 * Uchta "jimgina buziladigan" qoidani qulflaydi — ikkalasi ham haqiqiy
 * nosozlikdan keyin yozildi (skrinshot bilan tasdiqlangan):
 *
 * 1) STICKY + OVERFLOW TUZOG'I: sticky elementning o'zida `overflow-x-auto`
 *    bo'lsa, u o'zi scrollport bo'lib qoladi va `sticky` ishlamaydi — tab
 *    strip kontent bilan birga scroll bo'lib ketadi (tablar "yo'qoladi").
 *    → scroll FAQAT ichki div'da, sticky tashqi nav'da.
 *
 * 2) STICKY OVERLAP: header o'z `children`i bilan birga baland bo'ladi.
 *    Strip headerdan KEYIN sibling bo'lsa, header (z-30) uni QOPLAYDI
 *    (elementFromPoint: HEADER). → strip header ICHIDA turishi shart.
 *
 * 3) To'lov holatlari: aksent (bg-pprimary) faqat "bajariladigan amal"da;
 *    yetmaydigan buyum neytral + "yana N tanga kerak" izohi bilan.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

const SHOP_TABS = 'src/features/shop/ShopTabs.tsx'
const SHOP_PAGE = 'src/features/shop/ShopPage.tsx'
const PRICE_CHIP = 'src/features/shop/ShopPriceChip.tsx'
const THEME_CARD = 'src/features/shop/ShopThemeCard.tsx'
const HERO = 'src/features/shop/ShopHeroCarousel.tsx'

describe('Do\'kon v2 — tuzilma regressiyalari', () => {
  it('ShopTabs: scroll FAQAT ichki div\'da (sticky scrollport tuzog\'i)', () => {
    const src = read(SHOP_TABS)
    expect(src).toContain('overflow-x-auto')
    // Scrollport yaratadigan klasslar tashqi sticky elementda BO'LMASLIGI shart
    expect(src).not.toMatch(/className="sticky[^"]*overflow-x-auto/)
    expect(src).not.toMatch(/className="[^"]*overflow-(y-)?auto[^"]*sticky/)
    // Strip sticky emas (header sticky — u bilan birga yuradi)
    expect(src).not.toContain('sticky top-0')
  })

  it('ShopPage: tab strip PageHeader ICHIDA (sticky overlap oldini olish)', () => {
    const src = read(SHOP_PAGE)
    const headerStart = src.indexOf('<PageHeader')
    const headerEnd = src.indexOf('</PageHeader>')
    const tabsAt = src.indexOf('<ShopTabs')
    expect(headerStart).toBeGreaterThan(-1)
    expect(headerEnd).toBeGreaterThan(headerStart)
    expect(tabsAt).toBeGreaterThan(headerStart)
    expect(tabsAt).toBeLessThan(headerEnd)
  })

  it('ShopPage: dizayn-qoidaga mos grid (lg:grid-cols-3 + xl:grid-cols-4)', () => {
    const src = read(SHOP_PAGE)
    expect(src).toContain('lg:grid-cols-3')
    expect(src).toContain('xl:grid-cols-4')
    // --p-* var'da Tailwind opacity modifier ISHLAMAYDI (rgb triplet shart)
    expect(src).not.toContain('bg-pprimary/10')
    expect(src).not.toContain('bg-pprimary/15')
    // Scrollport yaratuvchi sinflar route-page'dan tashqarida taqiqlangan
    expect(src).not.toContain('overflow-y-auto')
    expect(src).not.toContain('overflow-hidden"')
  })

  it('narx ierarxiyasi: aksent faqat to\'lov imkoni bo\'lganda', () => {
    const src = read(PRICE_CHIP)
    // Imkon bor → aksent CTA; imkon yo'q → neytral sirt + Lock
    expect(src).toContain('bg-pprimary text-ponprimary')
    expect(src).toContain('bg-psurface text-pmuted')
    expect(src).toContain('Lock')
    // "Yetmaydi" izohi (i18n shabloni `{n}` bilan)
    expect(src).toContain('missingLabel')
    // Alpha — faqat rgb-triplet shaklida
    expect(src).toContain('rgb(var(--p-success-rgb)/0.14)')
  })

  it('tema kartasi mini-ilova preview ishlatadi (rang bloki EMAS)', () => {
    const card = read(THEME_CARD)
    const mini = read('src/features/shop/ThemeMiniApp.tsx')
    expect(card).toContain('<ThemeMiniApp')
    // Preview haqiqiy palitradan chiziladi (joriy tokenlardan EMAS —
    // aks holda barcha temalar bir xil ko'rinardi)
    expect(mini).toMatch(/const \{[^}]*\bbg\b[^}]*\bcard\b[^}]*\bcolor\b[^}]*\} = theme/)
    expect(mini).not.toContain('--p-primary')
  })

  it('hero karuseli: mobil karusel, desktop grid, bitta karta to\'liq kenglik', () => {
    const src = read(HERO)
    expect(src).toContain('snap-x')
    expect(src).toContain('lg:grid-cols-3')
    // Bitta karta 1/3 ustunda "osilib" qolmasligi uchun
    expect(src).toContain('single')
    expect(src).toContain('w-full')
  })

  it('stagger animatsiyasi mavjud klassga tayanadi (yangi keyframe emas)', () => {
    const src = read('src/features/shop/Stagger.tsx')
    expect(src).toContain('animate-sheetItemIn')
  })

  /**
   * 2026-10 (foydalanuvchi qarori): do'kondan HAMYON (tangalar tarixi) va
   * 1 KUNLIK PREMIUM olib tashlandi. Spin ikki joyda takrorlanardi (hero
   * vitrinasi + premium bloki) — pastdagi nusxa olib tashlandi, spin FAQAT
   * hero kartasi orqali ochiladi. Katalogdagi `premium-days-1` esa
   * `shared/shop-items.ts`da QOLADI (server trust boundary + integration
   * testlar unga tayanadi — faqat UI'dan olindi).
   */
  it('hamyon (tarix) va premium bo\'limlari UI\'dan olib tashlangan', () => {
    const src = read(SHOP_PAGE)
    expect(src).not.toContain('shop-wallet')
    expect(src).not.toContain('shop-premium')
    expect(src).not.toContain('getCoinHistory')
    expect(src).not.toContain('shopHistoryTitle')
    // Katalog elementi O'CHIRILMAGAN (server/testlar uchun kerak)
    const catalog = read('shared/shop-items.ts')
    expect(catalog).toContain("id: 'premium-days-1'")
  })

  it('spin FAQAT bitta joyda (hero) — takroriy qator yo\'q', () => {
    const src = read(SHOP_PAGE)
    // Hero kartasi spin holatini biladi
    expect(src).toContain('spunToday')
    expect(src).toContain('hero-spin')
    // Pastdagi takroriy "Omad g'ildiragi" qatori bo'lmasin: `spinTitle`
    // faqat hero kartasida uchraydi (eyebrow + title = 2 ta), premium
    // blokidagi uchinchi nusxa olib tashlangan
    const occurrences = src.split("tt('spinTitle')").length - 1
    expect(occurrences).toBe(2)
    // Spin qatorining o'ziga xos belgisi (`spinDesc` faqat hero'da)
    expect(src.split("tt('spinDesc')").length - 1).toBe(1)
  })

  it('tab ro\'yxati faqat mavjud bo\'limlarni ko\'rsatadi (o\'lik havola yo\'q)', () => {
    const src = read(SHOP_PAGE)
    const start = src.indexOf('const tabs = useMemo')
    const tabsBlock = src.slice(start, src.indexOf('], [tt])', start))
    expect(tabsBlock).toContain('shop-themes')
    expect(tabsBlock).toContain('shop-frames')
    expect(tabsBlock).toContain('shop-merch')
    expect(tabsBlock).not.toContain('shop-wallet')
    expect(tabsBlock).not.toContain('shop-premium')
    // Har bir tab anchor'i sahifada MAVJUD bo'lishi shart
    for (const id of ['shop-themes', 'shop-frames', 'shop-merch']) {
      expect(src).toContain(`id="${id}"`)
    }
  })
})
