/**
 * Do'kon segment navigatsiyasi (v2 redesign, Faza 2) — sticky tab strip +
 * scroll-spy.
 *
 * Muammo (eski holat): 20 ta tema + 7 ramka + merch + tarix — bitta uzun
 * skroll; "menga kerakli narsa qayerda?" savoliga javob yo'q edi.
 *
 * Yechim: `PageHeader` ICHIDA (header allaqachon sticky — alohida sticky
 * element yaratmaymiz, qoida 13 buzilmaydi) segment strip:
 *  - Bosilsa — bo'limga silliq scroll (strip balandligi hisobga olinadi).
 *  - Skrollda — ko'rinib turgan bo'lim avtomatik ajratiladi (scroll-spy).
 *
 * Active holat AKSENT bilan berilmaydi (design-system: aksent faqat asosiy
 * amal uchun) — SIRT (`bg-pcard`) + matn rangi bilan, xuddi `Tabs` primitivi.
 *
 * Scroll-spy anchor'i — strip'ning pastki chegarasi: bo'lim "aktiv" bo'lishi
 * uchun sticky header ostidan chiqishi kerak, viewport tepasiga tegishi emas.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../shared/lib/cn'
import { addPageScrollListener, pageScrollOffsetOf, scrollPageTo } from '../../shared/lib/page-scroll'

export interface ShopTab {
  id: string
  label: string
}

interface ShopTabsProps {
  tabs: ShopTab[]
  /** Anchor'lar shu konteyner ichida qidiriladi */
  containerRef: React.RefObject<HTMLElement | null>
}

export default function ShopTabs({ tabs, containerRef }: ShopTabsProps) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? '')
  const stripRef = useRef<HTMLElement>(null)
  // Tabga bosilganda scroll-spy bir zumda boshqa bo'limni "aktiv" qilib
  // qo'ymasin — silliq scroll tugaguncha qulf.
  const lockRef = useRef(false)
  const lockTimer = useRef<number | null>(null)

  const sectionOf = useCallback((id: string): HTMLElement | null => {
    const root = containerRef.current
    if (!root) return null
    const el = root.querySelector(`#${CSS.escape(id)}`)
    return el instanceof HTMLElement ? el : null
  }, [containerRef])

  // ── Scroll-spy: strip ostidan o'tgan OXIRGI bo'lim aktiv ──────────────────
  useEffect(() => {
    const update = () => {
      if (lockRef.current) return
      const strip = stripRef.current
      if (!strip) return
      const line = strip.getBoundingClientRect().bottom
      let current = ''
      for (const tab of tabs) {
        const el = sectionOf(tab.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= line + 8) current = tab.id
      }
      setActive((prev) => {
        const next = current || prev
        return next === prev ? prev : next
      })
    }
    update()
    return addPageScrollListener(update)
  }, [tabs, sectionOf])

  useEffect(() => () => { if (lockTimer.current !== null) window.clearTimeout(lockTimer.current) }, [])

  const go = (id: string) => {
    setActive(id)
    const el = sectionOf(id)
    if (!el) return
    lockRef.current = true
    if (lockTimer.current !== null) window.clearTimeout(lockTimer.current)
    lockTimer.current = window.setTimeout(() => { lockRef.current = false }, 900)
    // Strip pastida 16px nafas. Header sticky bo'lgani uchun offset =
    // faqat strip balandligi; header balandligini o'lchash SHART EMAS
    // (u kapsula animatsiyasi bilan o'zgaradi — o'lchov ishonchsiz bo'lardi,
    // birinchi urinishda aynan shu xato bo'lgan: sarlavha divider ostidan
    // "qanab" ko'ringan edi).
    const stripH = stripRef.current?.getBoundingClientRect().height ?? 0
    scrollPageTo(pageScrollOffsetOf(el, -stripH - 16), 'smooth')
  }

  return (
    /*
     * ⚠️ IKKI TUZOQ (ikkalasi ham skrinshot bilan tasdiqlangan):
     * 1) Sticky elementning O'ZIDA `overflow-x-auto` bo'lsa, u O'ZI scrollport
     *    bo'lib qoladi va `sticky` ishlamaydi (strip kontent bilan birga
     *    scroll bo'lib ketadi) → scroll FAQAT ichki div'da, sticky tashqi nav'da.
     * 2) Strip `PageHeader`DAN KEYIN biroti sibling bo'lsa, header (z-30)
     *    uni qoplaydi — header elementi o'z `children`i bilan BIRGA baland
     *    (150px), strip esa ~97px da boshlanadi. Shuning uchun strip header
     *    ICHIDA turadi (header baribir sticky) — qoplash muammosi yo'qoladi.
     */
    <nav ref={stripRef} aria-label="Do'kon bo'limlari" className="bg-pcanvas">
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: 'none' }}>
        {tabs.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => go(tab.id)}
              className={cn(
                'flex h-9 flex-none items-center rounded-full px-3.5 text-[12.5px] font-semibold',
                'transition-[background-color,color] duration-150 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
                isActive ? 'bg-pcard text-pfg shadow-2xs' : 'text-pmuted hover:text-pfg',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
