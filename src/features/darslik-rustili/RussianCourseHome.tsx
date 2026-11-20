import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RUSSIAN_SUBJECT_ID } from '../../../shared/subjects'
import { DARSLIK_BLOCKS, getBlockOutline } from '../../content/darslik-rustili'
import { getTelegramWebApp, syncTelegramTheme } from '../../platform/telegram'
import { COURSE_HOME_BACK_STATE, leaveCourseMap } from '../../shared/lib/navigation'
import { scrollPageToTop } from '../../shared/lib/page-scroll'
import { useAppStore } from '../../shared/store/useAppStore'
import { BrilliantCourseHome, type BrilliantCourseLevel } from '../lessons'
import { sectionKey } from './progress'
import { useDarslikMastery } from './useDarslikMastery'
import CourseMapPage from './CourseMapPage'
import './russian-course-home.css'

const LOWER_CYR_CONJUNCTIONS = new Set(['и', 'в', 'с', 'к', 'о', 'у', 'а', 'на', 'по', 'из', 'от', 'до', 'не'])

/** Katta harflarda (CAPS) yoki aralash yozilgan ruscha sarlavhalarni Brilliant uslubida o'qishli qilib formatlaydi. */
function formatSectionTitle(raw: string): string {
  const trimmed = raw.trim()
  if (!/[А-ЯЁ]{2,}/.test(trimmed)) return trimmed
  const words = trimmed.toLowerCase().split(/\s+/)
  const formatted = words.map((word, idx) => {
    const clean = word.replace(/[^а-яё]/g, '')
    if (idx > 0 && clean.length === 1 && !LOWER_CYR_CONJUNCTIONS.has(clean)) {
      return word.toUpperCase()
    }
    return word
  }).join(' ')
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

/**
 * Rus tili kursi bosh sahifasi — umumiy `BrilliantCourseHome` ustidagi yupqa adapter
 * (karusel, 5-nuqta, progress kartasi, Boshlash tugmasi va ishga tushirish animatsiyasi
 * barcha fanlar uchun bitta joyda yashaydi). Bu yerda faqat Rus tili ma'lumotlari
 * (bloklar, mastery) va `?block=` xaritasiga o'tish qoladi.
 */
export default function RussianCourseHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const themeSetting = useAppStore((s) => s.settings.theme)
  const mastery = useDarslikMastery()
  const refreshMastery = mastery.refresh
  const wasMap = useRef(false)
  const [, setTick] = useState(0)
  // Xaritadan qaytganda karusel oxirgi ochilgan blokda turishi uchun eslab qolinadi.
  const [lastBlockId, setLastBlockId] = useState<number | null>(null)

  const searchParams = new URLSearchParams(location.search)
  const requestedBlock = Number(searchParams.get('block'))
  const requestedSectionRaw = searchParams.get('section')
  const requestedSection = requestedSectionRaw !== null && Number.isInteger(Number(requestedSectionRaw))
    ? Number(requestedSectionRaw)
    : undefined
  const mapBlock = DARSLIK_BLOCKS.find((block) => block.id === requestedBlock)

  const { levels, defaultLevelIndex } = useMemo(() => {
    const built: BrilliantCourseLevel[] = DARSLIK_BLOCKS.map((block) => {
      const outline = getBlockOutline(block.id)
      const firstIncomplete = outline.findIndex((_, idx) => !mastery.passed.has(sectionKey(block.id, idx)))
      return {
        id: block.id,
        titleUz: block.titleUz,
        titleRu: block.titleRu,
        levelLabelUz: `BOB ${block.id}`,
        levelLabelRu: `БЛОК ${block.id}`,
        items: outline.map((title, idx) => ({
          key: `${block.id}:${idx}`,
          title: formatSectionTitle(title),
          done: mastery.passed.has(sectionKey(block.id, idx)),
          current: idx === firstIncomplete,
        })),
      }
    })
    const currentIdx = built.findIndex((level) => level.items.some((item) => !item.done))
    const rememberedIdx = lastBlockId === null ? -1 : built.findIndex((level) => level.id === lastBlockId)
    const fallbackIdx = currentIdx >= 0 ? currentIdx : built.length - 1
    return { levels: built, defaultLevelIndex: rememberedIdx >= 0 ? rememberedIdx : fallbackIdx }
  }, [mastery.passed, lastBlockId])

  useEffect(() => {
    if (mapBlock) setLastBlockId(mapBlock.id)
    if (wasMap.current && !mapBlock) {
      scrollPageToTop()
      refreshMastery()
      setTick((n) => n + 1)
    }
    wasMap.current = Boolean(mapBlock)
  }, [mapBlock, refreshMastery])

  // Xarita ochiq: Telegram sarlavhasi/fonini kurs kanvasi bilan sinxron tutish
  // (bosh sahifada buni `BrilliantCourseHome` o'zi qiladi).
  useEffect(() => {
    if (!mapBlock) return
    const tg = getTelegramWebApp()
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    const prevMeta = metaTheme?.getAttribute('content')
    const updateTheme = () => {
      const background = document.body.dataset.theme === 'dark' ? '#141414' : '#ffffff'
      try {
        tg?.setHeaderColor?.(background)
        tg?.setBackgroundColor?.(background)
      } catch {}
      if (metaTheme) metaTheme.setAttribute('content', background)
      document.documentElement.style.backgroundColor = background
      document.body.style.backgroundColor = background
    }
    updateTheme()
    const themeObserver = new MutationObserver(updateTheme)
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })
    try { tg?.enableVerticalSwipes?.() } catch {}
    return () => {
      themeObserver.disconnect()
      syncTelegramTheme(document.body.dataset.theme === 'dark')
      if (metaTheme && prevMeta) metaTheme.setAttribute('content', prevMeta)
      document.documentElement.style.backgroundColor = ''
      document.body.style.backgroundColor = ''
    }
  }, [mapBlock, themeSetting])

  if (mapBlock) {
    return (
      <CourseMapPage
        key={`${mapBlock.id}:${requestedSection ?? ''}`}
        initialBlockId={mapBlock.id}
        initialSectionIdx={requestedSection}
        mastery={mastery}
        onBackHome={() => leaveCourseMap(navigate, location)}
      />
    )
  }

  return (
    <BrilliantCourseHome
      subjectId={RUSSIAN_SUBJECT_ID}
      levels={levels}
      completedCount={mastery.passed.size}
      loading={mastery.loading}
      defaultLevelIndex={defaultLevelIndex}
      testId="russian-course-home"
      dotsLabelUz="Boblar"
      dotsLabelRu="Блоки"
      titleButtonLabelUz="Bobni boshlash"
      titleButtonLabelRu="Начать блок"
      getDotLabel={(level, ru) => `${ru ? 'Блок' : 'Bob'} ${level.id}: ${ru ? level.titleRu : level.titleUz}`}
      onLaunchLevel={(level) => {
        const activeIdx = level.items.findIndex((item) => !item.done)
        const sectionQuery = activeIdx >= 0 ? `&section=${activeIdx}` : ''
        navigate({ pathname: location.pathname, search: `?block=${level.id}${sectionQuery}` }, { state: COURSE_HOME_BACK_STATE })
      }}
    />
  )
}
