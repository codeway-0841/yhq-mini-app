/**
 * Mavzular (Darslik) sahifasi — dars qulflash qoidasi (oldingisi tugamaguncha
 * keyingisi ochilmaydi), curated mapping'siz darslarning yashirilishi va
 * dars ochilganda testga uzatiladigan savol id'lari.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import TopicsPage from '../../../src/features/topics/TopicsPage'
import { parseOutlineTopicHeading } from '../../../src/features/topics/brilliant-courses-data'
import { config } from '../../../src/shared/config'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { DARSLIK_PROGRESS_MODULE_OFFSET } from '../../../src/content/darslik-rustili'
import { RUSADABIYOT_PROGRESS_MODULE_OFFSET } from '../../../src/content/darslik-rusadabiyot'
import { modules } from '../../../src/content/modules'
import lessonMap from '../../../src/content/lessonMap.yhq.json'

const MAP = lessonMap as Record<string, number[]>
/** Kamida 3 savoli bor (ya'ni ko'rinadigan) birinchi dars */
const firstVisible = Object.entries(MAP).find(([, ids]) => ids.length >= 3)!
const [firstModId, firstLessonIdx] = firstVisible[0].split(':').map(Number) as [number, number]

const UID = '12345'

beforeEach(() => {
  mockNavigate.mockReset()
  window.localStorage.clear()
  useSubjectStore.setState({ subjectId: 'yhq' })
  useLessonsStore.setState({ byUser: {} })
  useQuestionsStore.setState({
    topics: [],
    questions: [],
    loaded: false,
    loading: false,
    error: null,
    subjectId: 'yhq',
  })
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    user: { id: UID, firstName: 'Ali' } as never,
    wrongByTicket: {},
    solvedQuestions: [],
  })
})

describe('TopicsPage', () => {
  it('modullar ro\'yxati chiziladi', () => {
    render(<TopicsPage />)

    const visibleMods = modules.filter((m) =>
      Object.keys(MAP).some((k) => k.startsWith(`${m.id}:`) && MAP[k]!.length >= 3))
    expect(visibleMods.length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(visibleMods.length)
  })

  it('birinchi dars ochiq, keyingisi QULFLANGAN (oldingisi tugamagan)', () => {
    render(<TopicsPage />)

    const lessons = screen.getAllByRole('button').filter((b) => /-DARS/.test(b.textContent ?? ''))
    expect(lessons.length).toBeGreaterThan(1)
    expect(lessons[0]).not.toBeDisabled()
    expect(lessons[1]).toBeDisabled()
  })

  it('oldingi dars tugagach keyingisi ochiladi', () => {
    useLessonsStore.setState({ byUser: { [UID]: { [firstModId]: [firstLessonIdx] } } })
    render(<TopicsPage />)

    const lessons = screen.getAllByRole('button').filter((b) => /-DARS/.test(b.textContent ?? ''))
    expect(lessons[1]).not.toBeDisabled()
  })

  it('dars bosilganda curated savol id\'lari bilan test ochiladi', () => {
    render(<TopicsPage />)

    const firstLesson = screen.getAllByRole('button').find((b) => /-DARS/.test(b.textContent ?? ''))!
    fireEvent.click(firstLesson)

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const [path, opts] = mockNavigate.mock.calls[0]!
    expect(path).toBe('/test/1')
    expect(opts.state.questionIds.length).toBeGreaterThanOrEqual(3)
    expect(opts.state.title).toMatch(/-dars:/)
  })

  it('qulflangan dars bosilsa hech qayerga o\'tmaydi', () => {
    render(<TopicsPage />)

    const locked = screen.getAllByRole('button')
      .filter((b) => /-DARS/.test(b.textContent ?? ''))
      .find((b) => (b as HTMLButtonElement).disabled)!
    fireEvent.click(locked)

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('TopicsPage v2 (server selectors)', () => {
  beforeEach(() => {
    ;(config as { testSessionsV2Enabled: boolean }).testSessionsV2Enabled = true
  })

  afterEach(() => {
    ;(config as { testSessionsV2Enabled: boolean }).testSessionsV2Enabled = false
  })

  it('dars bosilganda server lesson selector bilan ochiladi (master ID YO\'Q)', () => {
    render(<TopicsPage />)

    const firstLesson = screen.getAllByRole('button').find((b) => /-DARS/.test(b.textContent ?? ''))!
    fireEvent.click(firstLesson)

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const [path, opts] = mockNavigate.mock.calls[0]!
    expect(path).toBe('/test/1')
    expect(opts.state).toEqual({
      mode: 'lesson',
      serverSelector: { type: 'lesson', moduleId: firstModId, lessonIndex: firstLessonIdx },
      title: expect.stringMatching(/-dars:/),
    })
    expect(opts.state).not.toHaveProperty('questionIds')
  })
})

describe('TopicsPage Brilliant parity & multi-subject routing', () => {
  it('YHQda soxta 15% progress yo\'q, pin tugmasi ishlaydi va tab divider faqat guruhlar orasida chiqadi', () => {
    const { container } = render(<TopicsPage />)

    // 0% bo'lgan kartalarda bo'sh progress chizig'i chizilmaydi
    expect(container.querySelectorAll('.br-card-progress-track').length).toBe(0)

    // Pin tugmasi interactive (birinchi tugallanmagan bo'lim default pinned)
    const pinButtons = screen.getAllByRole('button', { name: /mahkamlash|mahkamlanganlardan/i })
    expect(pinButtons.length).toBeGreaterThan(1)
    expect(pinButtons[0]).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(pinButtons[1]!)
    expect(pinButtons[1]).toHaveAttribute('aria-pressed', 'true')
    expect(pinButtons[0]).toHaveAttribute('aria-pressed', 'false')
    expect(window.localStorage.getItem('kivvi-pinned-path:yhq')).toBe('2')

    // Tab dividerlari har bir tab orasida emas, faqat kategoriya guruhlari orasida
    const tabs = container.querySelectorAll('.br-path-tab')
    const dividers = container.querySelectorAll('.br-path-tab-divider')
    expect(tabs.length).toBeGreaterThan(4)
    expect(dividers.length).toBeGreaterThan(0)
    expect(dividers.length).toBeLessThan(tabs.length - 1)
  })

  it('rus tili: inglizcha GRADES/GR o\'rniga o\'zbekcha yorliqlar chiqadi va darslik xaritasiga yo\'naltiradi', () => {
    useSubjectStore.setState({ subjectId: 'rustili' })
    const { container } = render(<TopicsPage />)

    expect(container.textContent).not.toMatch(/\bGRADES\b/)
    expect(container.textContent).not.toMatch(/\bGR \d+\b/)
    expect(container.textContent).toMatch(/1-BLOK/)
    expect(container.querySelectorAll('.br-card-progress-track').length).toBe(0)
    expect(container.querySelector('.br-sticky-top-glow')).toHaveAttribute('data-tone', 'blue')

    const firstCard = container.querySelector('.br-topic-card') as HTMLButtonElement
    fireEvent.click(firstCard)
    expect(mockNavigate).toHaveBeenCalledWith('/darslik/rus-tili?block=1&section=0')
  })

  it('rus tili: faol boshlangan blokda o\'qilgan (35%) va keyingi (5px nuqta) progress chizig\'i chiqadi', () => {
    useSubjectStore.setState({ subjectId: 'rustili' })
    const modId = DARSLIK_PROGRESS_MODULE_OFFSET + 1
    useLessonsStore.setState({
      byUser: { [UID]: { [modId]: [0] } },
      readByUser: { [UID]: { [modId]: [1] } },
    })

    const { container } = render(<TopicsPage />)
    const firstBlock = container.querySelector('#br-path-darslik-block-1')!
    const tracks = firstBlock.querySelectorAll('.br-card-progress-track')
    const bars = firstBlock.querySelectorAll('.br-card-progress-bar')

    // 1-blokda barcha mavzularda track ko'rinadi (tugallangan 100%, o'qilgan 35%, keyingilarida 5px nuqta)
    expect(tracks.length).toBeGreaterThan(2)
    expect((bars[0] as HTMLElement).style.width).toBe('100%')
    expect((bars[1] as HTMLElement).style.width).toBe('35%')
    expect((bars[2] as HTMLElement).style.width).toBe('5px')
  })

  it('rus adabiyot: real store mastery bilan ishlaydi va &section= bilan xaritasiga o\'tadi', () => {
    useSubjectStore.setState({ subjectId: 'rusadabiyot' })
    useLessonsStore.setState({
      byUser: {
        [UID]: {
          [RUSADABIYOT_PROGRESS_MODULE_OFFSET + 1]: [0],
        },
      },
    })

    const { container } = render(<TopicsPage />)

    expect(container.textContent).not.toMatch(/\bERA \d+\b/)
    expect(container.textContent).toMatch(/1-DAVR/)

    // Faqat 1-davr tugallangan — uning kartalarida yashil progress bar ko'rinadi
    const firstSectionTracks = container
      .querySelector('#br-path-lit-block-1')!
      .querySelectorAll('.br-card-progress-track')
    const secondSectionTracks = container
      .querySelector('#br-path-lit-block-2')!
      .querySelectorAll('.br-card-progress-track')
    expect(firstSectionTracks.length).toBeGreaterThan(0)
    expect(secondSectionTracks.length).toBe(0)

    const firstCard = container.querySelector('.br-topic-card') as HTMLButtonElement
    fireEvent.click(firstCard)
    expect(mockNavigate).toHaveBeenCalledWith('/darslik/rus-adabiyot?block=1&section=0')
  })

  it('fizika: kartalar /test/1 ga emas, /darslik?block=&section= (BrilliantCourseMap) ga ochiladi', () => {
    useSubjectStore.setState({ subjectId: 'fizika' })
    useQuestionsStore.setState({
      subjectId: 'fizika',
      loaded: true,
      loading: false,
      topics: [
        { id: 101, subjectId: 'fizika', slug: '01-kinematika', nameUz: 'Kinematika', nameRu: 'Кинематика', questionCount: 10 },
        { id: 102, subjectId: 'fizika', slug: '02-nyuton', nameUz: 'Nyuton qonunlari', nameRu: 'Законы Ньютона', questionCount: 8 },
      ],
      questions: [
        { id: 1, subjectId: 'fizika', topicId: 101, text: 'Q1', options: ['a', 'b'], correctIndex: 0 },
        { id: 2, subjectId: 'fizika', topicId: 101, text: 'Q2', options: ['a', 'b'], correctIndex: 0 },
        { id: 3, subjectId: 'fizika', topicId: 102, text: 'Q3', options: ['a', 'b'], correctIndex: 0 },
      ] as never,
    })
    useAppStore.setState({
      solvedQuestions: ['fizika:1'],
    })

    const { container } = render(<TopicsPage />)

    expect(container.textContent).not.toMatch(/GRADES 7–9/)
    expect(container.textContent).not.toMatch(/\bGR \d+\b/)
    expect(container.textContent).toMatch(/1-YO'NALISH/)
    expect(container.textContent).toMatch(/1-MAVZU/)

    // 1 ta mavzuda real progress bor -> faqat 1 ta progress bar ko'rinadi
    expect(container.querySelectorAll('.br-card-progress-track').length).toBe(1)

    // Har xil seksiyalar ikonka rangiga mos Brilliant ohanglaridan foydalanadi (blue, orange, ...)
    const sectionElList = container.querySelectorAll('.br-path-section')
    expect(sectionElList[0]).toHaveAttribute('data-tone', 'blue')
    if (sectionElList[1]) {
      expect(sectionElList[1]).toHaveAttribute('data-tone', 'orange')
    }

    const firstCard = container.querySelector('.br-topic-card') as HTMLButtonElement
    fireEvent.click(firstCard)
    expect(mockNavigate).toHaveBeenCalledWith('/darslik?block=1&section=0')
  })

  it('kirillcha ALL CAPS sarlavhalar (Ь И Ъ, «ПЕЧЬ», Е/Ё/Ю/Я, НЕ/НИ) to\'g\'ri formatlanadi va ixcham matn chiqadi', () => {
    expect(parseOutlineTopicHeading('Ь И Ъ', 1, 6, 'uz').cleanTitle).toBe('Ь и Ъ')
    expect(parseOutlineTopicHeading('БУКВЫ Е, Ё, Ю, Я', 1, 7, 'uz').cleanTitle).toBe('Буквы Е, Ё, Ю, Я')
    expect(parseOutlineTopicHeading('«ПЕЧЬ»', 5, 0, 'uz').cleanTitle).toBe('«Печь»')
    expect(parseOutlineTopicHeading('«ТРИ»', 5, 1, 'uz').cleanTitle).toBe('«Три»')
    expect(parseOutlineTopicHeading('НЕ С ГЛАГОЛАМИ', 8, 23, 'uz').cleanTitle).toBe('НЕ с глаголами')
    expect(parseOutlineTopicHeading('Н И НН В ПРИЛАГАТЕЛЬНЫХ', 8, 36, 'uz').cleanTitle).toBe('Н и НН в прилагательных')
    expect(parseOutlineTopicHeading('ДЕФИС И ТИРЕ — НЕ ОДНО И ТО ЖЕ', 8, 52, 'uz').cleanTitle).toBe('Дефис и тире — не одно и то же')

    useSubjectStore.setState({ subjectId: 'rustili' })
    const { container } = render(<TopicsPage />)
    expect(container.textContent).toMatch(/1-BLOK · 12 MAVZU/)
    expect(container.textContent).toMatch(/Fonetika va orfoepiya/)
    expect(container.textContent).toMatch(/Ь и Ъ/)
    expect(container.textContent).not.toMatch(/1\.7-MAVZU\s+Ь И Ъ/)
  })
})
