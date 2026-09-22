import { describe, it, expect, beforeEach } from 'vitest'
import { useWonderStore } from '../../../src/features/wonder-studio/store/useWonderStore'
import { DEFAULT_WONDER_COURSES } from '../../../src/features/wonder-studio/data/defaultCourses'
import { convertAiCourseToWonderCourse, createLocalCourseFallback } from '../../../src/features/wonder-studio/lib/aiCourseAdapter'
import { generateAnkiTsv, generateCourseMarkdownConspectus } from '../../../src/features/wonder-studio/lib/exportUtils'

beforeEach(() => {
  useWonderStore.setState({
    activeCourseId: 'yhq-extremal',
    activeTab: 'path',
    completedLessonIds: [],
    customCourses: [],
    fsrsCards: {},
    canvasCardsMap: {},
    wonderStreak: 1,
  })
})

describe('Wonder Studio Feature Tests', () => {
  it('default courses to\'g\'ri strukturalangan (darslar, refractor, podcast)', () => {
    expect(DEFAULT_WONDER_COURSES.length).toBeGreaterThanOrEqual(3)

    const yhqCourse = DEFAULT_WONDER_COURSES.find((c) => c.id === 'yhq-extremal')
    expect(yhqCourse).toBeDefined()
    expect(yhqCourse?.sections.length).toBeGreaterThan(0)
    expect(yhqCourse?.refractorTopics.length).toBeGreaterThan(0)
    expect(yhqCourse?.podcastEpisodes.length).toBeGreaterThan(0)
    expect(yhqCourse?.canvasCards.length).toBeGreaterThan(0)

    // Check refractor lenses (5 lenses present)
    const refractor = yhqCourse?.refractorTopics[0]
    expect(refractor?.lenses.competing).toBeDefined()
    expect(refractor?.lenses.component).toBeDefined()
    expect(refractor?.lenses.progression).toBeDefined()
    expect(refractor?.lenses.relationship).toBeDefined()
    expect(refractor?.lenses.system).toBeDefined()
  })

  it('useWonderStore tab va kursni almashtiradi', () => {
    const store = useWonderStore.getState()
    expect(store.activeTab).toBe('path')
    expect(store.activeCourseId).toBe('yhq-extremal')

    store.setActiveTab('refractor')
    expect(useWonderStore.getState().activeTab).toBe('refractor')

    store.setActiveCourse('fizika-kvant')
    expect(useWonderStore.getState().activeCourseId).toBe('fizika-kvant')
  })

  it('darsni FSRS baholash bilan yakunlash mukofot beradi va xotira kartasini hisoblaydi', () => {
    const store = useWonderStore.getState()
    const result = store.completeLesson('yhq-l1', 'good', 40, 3)

    expect(result.isFirstCompletion).toBe(true)
    expect(result.xpEarned).toBe(40)
    expect(result.coinsEarned).toBe(3)

    const updatedState = useWonderStore.getState()
    expect(updatedState.completedLessonIds).toContain('yhq-l1')

    const fsrsCard = updatedState.fsrsCards['yhq-l1']
    expect(fsrsCard).toBeDefined()
    expect(fsrsCard.reps).toBe(1)
    expect(fsrsCard.stability).toBeGreaterThan(1.0)
    expect(fsrsCard.due).toBeGreaterThan(Date.now())
  })

  it('takroriy dars yakunlashda tanga qayta berilmaydi (anti-farm)', () => {
    const store = useWonderStore.getState()
    store.completeLesson('yhq-l1', 'good', 40, 3)

    const secondRun = store.completeLesson('yhq-l1', 'easy', 40, 3)
    expect(secondRun.isFirstCompletion).toBe(false)
    expect(secondRun.coinsEarned).toBe(0)
    expect(secondRun.xpEarned).toBe(16) // 40% repeat XP
  })

  it('canvas maydoniga fikr qo\'shish va o\'chirish ishlaydi', () => {
    const store = useWonderStore.getState()
    store.addCanvasCard('yhq-extremal', {
      title: 'Yangi sinov kartasi',
      content: 'Bu test kartasi',
      category: 'insight',
      x: 150,
      y: 150,
    })

    const cards = useWonderStore.getState().canvasCardsMap['yhq-extremal']
    expect(cards).toHaveLength(1)
    expect(cards[0].title).toBe('Yangi sinov kartasi')

    store.deleteCanvasCard('yhq-extremal', cards[0].id)
    expect(useWonderStore.getState().canvasCardsMap['yhq-extremal']).toHaveLength(0)
  })

  it('Learning How to Learn kursi Wondering standartida to\'liq mavjud', () => {
    const lhtl = DEFAULT_WONDER_COURSES.find((c) => c.id === 'learning-how-to-learn')
    expect(lhtl).toBeDefined()
    expect(lhtl?.title).toBe('Learning How to Learn')
    expect(lhtl?.sections.length).toBeGreaterThanOrEqual(4)
    expect(lhtl?.refractorTopics.length).toBeGreaterThanOrEqual(1)
    expect(lhtl?.podcastEpisodes.length).toBeGreaterThanOrEqual(3)
  })

  it('Wondering 5-talik asosiy navigatsiyasi va modallari ishlaydi', () => {
    const store = useWonderStore.getState()
    expect(store.currentNav).toBe('home')

    store.setCurrentNav('create')
    expect(useWonderStore.getState().currentNav).toBe('create')

    store.setCurrentNav('canvas')
    expect(useWonderStore.getState().currentNav).toBe('canvas')

    store.setCurrentNav('courses')
    expect(useWonderStore.getState().currentNav).toBe('courses')

    store.setCurrentNav('profile')
    expect(useWonderStore.getState().currentNav).toBe('profile')

    store.setCurrentNav('settings')
    expect(useWonderStore.getState().currentNav).toBe('settings')

    // Modals
    store.setOpenPodcastModal(true)
    expect(useWonderStore.getState().openPodcastModal).toBe(true)

    store.setOpenLearningMapModal(true)
    expect(useWonderStore.getState().openLearningMapModal).toBe(true)

    store.setOpenUpgradeModal(true)
    expect(useWonderStore.getState().openUpgradeModal).toBe(true)

    // Facts about you
    store.setFactsAboutYou('Visual learner interested in deep intuition')
    expect(useWonderStore.getState().factsAboutYou).toBe('Visual learner interested in deep intuition')
  })

  it('Wondering haqiqiy 16 ta kursi va 3D muqovalari katalogda to\'liq mavjud', () => {
    // 16 scraped courses + original default courses
    expect(DEFAULT_WONDER_COURSES.length).toBeGreaterThanOrEqual(19)

    const catalogCourseIds = [
      'how-to-design-whatsapp',
      'the-art-of-meaningful',
      'architecture-patterns-and-trade',
      'everyday-design-fundamentals-5349d3c629bce3acfc6cd7af',
      'cdn-for-engineers-beyond',
      'asking-good-questions-as',
      'ai-software-engineering-for',
      'enterprise-llm-architecture-and',
      'the-mom-test-for',
      'solve-the-rubiks-cube',
      'securing-software-development-lifecycles',
      'penetration-testing-for-azure',
      'beginner-long-term-investing',
      'cognitive-psychology-for-daily',
      'the-creative-technologist-playbook',
      'llm-fundamentals-dd100aabe0be6e58837f4b31',
    ]

    expect(catalogCourseIds).toHaveLength(16)

    for (const courseId of catalogCourseIds) {
      const course = DEFAULT_WONDER_COURSES.find((c) => c.id === courseId)
      expect(course).toBeDefined()
      expect(course?.title.length).toBeGreaterThan(0)
      expect(course?.localCoverImage).toMatch(/^\/courses\/covers\/.*\.png$/)
      expect(course?.author).toBeDefined()
      expect(course?.category).toBeDefined()
      expect(course?.sections.length).toBeGreaterThan(0)
    }
  })

  it('AI Companion Tutor va Study Notes drawer holatlari to\'g\'ri boshqariladi', () => {
    const store = useWonderStore.getState()
    expect(store.isChatOpen).toBe(false)
    expect(store.isNotesDrawerOpen).toBe(false)

    store.toggleChat()
    expect(useWonderStore.getState().isChatOpen).toBe(true)
    store.setChatOpen(false)
    expect(useWonderStore.getState().isChatOpen).toBe(false)

    store.toggleNotesDrawer()
    expect(useWonderStore.getState().isNotesDrawerOpen).toBe(true)
    store.setNotesDrawerOpen(false)
    expect(useWonderStore.getState().isNotesDrawerOpen).toBe(false)

    // Notes
    store.addLessonNote('lesson-1', 'First insight note')
    store.addLessonNote('lesson-1', 'Second note')
    expect(useWonderStore.getState().lessonNotes['lesson-1']).toEqual([
      'First insight note',
      'Second note',
    ])

    store.deleteLessonNote('lesson-1', 0)
    expect(useWonderStore.getState().lessonNotes['lesson-1']).toEqual([
      'Second note',
    ])

    // Enrollment
    store.enrollCourse('how-to-design-whatsapp')
    expect(useWonderStore.getState().enrolledCourseIds).toContain('how-to-design-whatsapp')
    store.unenrollCourse('how-to-design-whatsapp')
    expect(useWonderStore.getState().enrolledCourseIds).not.toContain('how-to-design-whatsapp')
  })

  it('Quick Exercise retrieval practice va streak celebration to\'g\'ri ishlaydi', () => {
    const lhtl = DEFAULT_WONDER_COURSES.find((c) => c.id === 'learning-how-to-learn')
    expect(lhtl).toBeDefined()

    // Barcha savollarni to'plash (Quick Exercise mantiqi)
    const questions = lhtl!.sections.flatMap((s) => s.lessons).filter((l) => !!l.quiz)
    expect(questions.length).toBeGreaterThanOrEqual(4)

    const store = useWonderStore.getState()
    const initialStreak = store.wonderStreak

    // Savolga javob berish va FSRS kartasini yangilash
    const q1 = questions[0]
    const result = store.completeLesson(q1.id, 'good', 15, 0)
    expect(result.xpEarned).toBe(15)

    const updated = useWonderStore.getState()
    expect(updated.fsrsCards[q1.id]).toBeDefined()
    expect(updated.fsrsCards[q1.id].reps).toBe(1)
    expect(updated.fsrsCards[q1.id].stability).toBeGreaterThanOrEqual(2.0)
    expect(updated.wonderStreak).toBeGreaterThanOrEqual(initialStreak)
  })

  it('zigzag path offset formulasi 1:1 Wondering bundle spetsifikatsiyasiga mos', () => {
    const BLOCK_X_OFFSET = 30
    const ZIGZAG_CENTER_OFFSET = -50
    const ZIGZAG_CYCLE = 4

    const getBlockZigzagOffset = (index: number) => {
      const mod = index % ZIGZAG_CYCLE
      return mod === 0 ? -BLOCK_X_OFFSET : mod === 1 ? 0 : mod === 2 ? BLOCK_X_OFFSET : 0
    }

    // Node 0: chapga burilish (-30)
    expect(getBlockZigzagOffset(0)).toBe(-30)
    expect(ZIGZAG_CENTER_OFFSET + getBlockZigzagOffset(0)).toBe(-80)

    // Node 1: markaz (0)
    expect(getBlockZigzagOffset(1)).toBe(0)
    expect(ZIGZAG_CENTER_OFFSET + getBlockZigzagOffset(1)).toBe(-50)

    // Node 2: o'ngga burilish (+30)
    expect(getBlockZigzagOffset(2)).toBe(30)
    expect(ZIGZAG_CENTER_OFFSET + getBlockZigzagOffset(2)).toBe(-20)

    // Node 3: markazga qaytish (0)
    expect(getBlockZigzagOffset(3)).toBe(0)
    expect(ZIGZAG_CENTER_OFFSET + getBlockZigzagOffset(3)).toBe(-50)

    // Node 4 (Section Review): chapga burilish (-30)
    expect(getBlockZigzagOffset(4)).toBe(-30)

    // Node 5 (Live Challenge): markaz (0)
    expect(getBlockZigzagOffset(5)).toBe(0)
  })

  it('aiCourseAdapter backend kursini 1:1 WonderCourse formatiga konvertatsiya qiladi', () => {
    const mockBackendCourse = {
      id: 42,
      title: 'Kvant Kompyuterlar Asoslari',
      topic: 'Kvant hisoblash va kubitlar fizikasi',
      inputKind: 'topic',
      lessonLength: 'standard',
      language: 'uz',
      completedLessonIds: ['q1'],
      version: 1 as const,
      sections: [
        {
          id: 's1',
          ord: 0,
          title: '1. Kubitlar va Superpozitsiya',
          lessons: [
            {
              id: 'q1',
              ord: 0,
              title: 'Superpozitsiya holati',
              tldr: 'Kubit bir vaqtning o\'zida 0 va 1 holatida bo\'lishi mumkin.',
              pages: [
                {
                  kind: 'text' as const,
                  heading: 'Kubit tabiati',
                  body: 'Klassik bitdan farqli ravishda kubit Blox sferasida joylashadi.',
                },
                {
                  kind: 'visual' as const,
                  style: 'pie-chart' as const,
                  heading: 'Ehtimollik taqsimoti',
                  items: [
                    { label: '|0> holat', value: 50 },
                    { label: '|1> holat', value: 50 },
                  ],
                },
              ],
              practices: [
                {
                  id: 'pr1',
                  kind: 'mcq' as const,
                  prompt: 'Superpozitsiya nima?',
                  options: [
                    { id: 'optA', text: 'Kvant holatlarining chiziqli kombinatsiyasi' },
                    { id: 'optB', text: 'Faqat nol holati' },
                  ],
                },
              ],
              knowledgeCards: [
                { id: 'kc1', title: 'Blox sferasi', body: 'Kubit holatini ifodalovchi geometrik model.' },
              ],
            },
          ],
        },
      ],
    }

    const converted = convertAiCourseToWonderCourse(mockBackendCourse)
    expect(converted.id).toBe('ai-42')
    expect(converted.title).toBe('Kvant Kompyuterlar Asoslari')
    expect(converted.sections).toHaveLength(1)
    expect(converted.sections[0].lessons).toHaveLength(1)

    const lesson = converted.sections[0].lessons[0]
    expect(lesson.status).toBe('completed')
    expect(lesson.pages).toHaveLength(2)
    expect(lesson.pages[1].visual).toBeDefined()
    expect(lesson.pages[1].visual?.type).toBe('chart')
    expect(lesson.quiz.type).toBe('mcq')
    expect(lesson.quiz.question).toBe('Superpozitsiya nima?')

    // Check refractor and podcast generation
    expect(converted.refractorTopics).toHaveLength(1)
    expect(converted.refractorTopics[0].lenses.competing).toBeDefined()
    expect(converted.podcastEpisodes).toHaveLength(2)
    expect(converted.podcastEpisodes[0].hosts.hostA.name).toBeDefined()
    expect(converted.podcastEpisodes[0].turns.length).toBeGreaterThan(0)
    expect(converted.canvasCards.length).toBeGreaterThan(0)
  })

  it('createLocalCourseFallback tarmoq yo\'qligida to\'liq boyitilgan zaxira kurs yaratadi', () => {
    const localCourseUz = createLocalCourseFallback('Neyron Tarmoqlari', 'uz')
    expect(localCourseUz.id.startsWith('local-')).toBe(true)
    expect(localCourseUz.title).toBe('Neyron Tarmoqlari')
    expect(localCourseUz.sections.length).toBeGreaterThanOrEqual(2)
    expect(localCourseUz.sections[0].lessons[0].status).toBe('available')
    expect(localCourseUz.sections[0].lessons[1].status).toBe('locked')
    expect(localCourseUz.podcastEpisodes.length).toBeGreaterThan(0)
    expect(localCourseUz.refractorTopics.length).toBeGreaterThan(0)
    expect(localCourseUz.canvasCards.length).toBeGreaterThan(0)

    const localCourseRu = createLocalCourseFallback('Machine Learning', 'ru')
    expect(localCourseRu.title).toBe('Machine Learning')
    expect(localCourseRu.sections.length).toBeGreaterThanOrEqual(2)
  })

  it('enrollCourse va unenrollCourse shaxsiy kurslar ro\'yxatini boshqaradi', () => {
    const store = useWonderStore.getState()
    expect(store.enrolledCourseIds).toContain('learning-how-to-learn')

    // Enroll another catalog course
    store.enrollCourse('how-to-design-whatsapp')
    expect(useWonderStore.getState().enrolledCourseIds).toContain('how-to-design-whatsapp')

    // Unenroll course
    store.unenrollCourse('how-to-design-whatsapp')
    expect(useWonderStore.getState().enrolledCourseIds).not.toContain('how-to-design-whatsapp')
  })

  it('barcha DEFAULT_WONDER_COURSES darslari to\'g\'ri sarlavha va sahifalarga ega', () => {
    for (const c of DEFAULT_WONDER_COURSES) {
      expect(c.title).toBeTruthy()
      expect(c.sections.length).toBeGreaterThan(0)
      for (const s of c.sections) {
        expect(s.title).toBeTruthy()
        expect(s.lessons.length).toBeGreaterThan(0)
        for (const l of s.lessons) {
          expect(l.id).toBeTruthy()
          expect(l.title).toBeTruthy()
          expect(l.pages.length).toBeGreaterThan(0)
          expect(l.tldr).toBeDefined()
        }
      }
    }
  })

  it('kurs yaratish zaxira mexanizmi to\'liq 5-bosqichli Wondering talablariga mos keladi', () => {
    const course = createLocalCourseFallback('Kvant Mexanikasi', 'uz')
    expect(course.title).toBe('Kvant Mexanikasi')
    expect(course.sections.length).toBeGreaterThanOrEqual(2)
    const firstLesson = course.sections[0].lessons[0]
    expect(firstLesson.tldr).toBeTruthy()
    expect(firstLesson.durationMinutes).toBeGreaterThan(0)
    expect(firstLesson.xp).toBeGreaterThan(0)
    expect(firstLesson.quiz).toBeDefined()
  })

  it('convertAiCourseToWonderCourse rawPractices maydonini saqlaydi', () => {
    const mockPayload = {
      id: 999,
      title: 'AI Test Course',
      topic: 'Test Topic',
      inputKind: 'topic',
      lessonLength: 'standard',
      language: 'uz',
      sections: [
        {
          id: 'sec1',
          ord: 0,
          title: 'Section 1',
          lessons: [
            {
              id: 'les1',
              ord: 0,
              title: 'Lesson 1',
              tldr: 'TLDR 1',
              pages: [{ kind: 'text' as const, heading: 'H1', body: 'Body 1' }],
              practices: [
                {
                  id: 'p1',
                  kind: 'mcq' as const,
                  prompt: 'MCQ prompt',
                  options: [{ id: 'opt1', text: 'Opt 1' }, { id: 'opt2', text: 'Opt 2' }],
                },
              ],
            },
          ],
        },
      ],
    }

    const converted = convertAiCourseToWonderCourse(mockPayload)
    expect(converted.sections[0].lessons[0].rawPractices).toBeDefined()
    expect(converted.sections[0].lessons[0].rawPractices?.length).toBe(1)
    expect(converted.sections[0].lessons[0].rawPractices?.[0].kind).toBe('mcq')
  })

  it('completeLesson javoblar va rawPractices qabul qiladi', () => {
    const store = useWonderStore.getState()
    const rawPractices = [
      {
        id: 'p_mcq_1',
        kind: 'mcq' as const,
        prompt: 'Prompt',
        options: [{ id: 'o1', text: 'O1' }],
      },
      {
        id: 'p_flash_1',
        kind: 'flashcard' as const,
        front: 'Front',
        back: 'Back',
      },
    ]

    const result = store.completeLesson(
      'les-test-1',
      'good',
      50,
      2,
      {
        flashcard: { p_flash_1: 'known' },
        mcq: { p_mcq_1: 'o1' },
        cloze: {},
        order: {},
      },
      rawPractices,
    )

    expect(result.isFirstCompletion).toBe(true)
    expect(result.xpEarned).toBe(50)
    expect(result.coinsEarned).toBe(2)
    expect(useWonderStore.getState().completedLessonIds).toContain('les-test-1')
  })

  it('barcha kurslarning refractorTopics barcha 5 ta linzani to\'liq o\'z ichiga oladi', () => {
    for (const course of DEFAULT_WONDER_COURSES) {
      expect(course.refractorTopics).toBeDefined()
      expect(course.refractorTopics.length).toBeGreaterThanOrEqual(1)

      for (const topic of course.refractorTopics) {
        expect(topic.title).toBeTruthy()
        expect(topic.lenses.competing).toBeDefined()
        expect(topic.lenses.competing.viewA.title).toBeTruthy()
        expect(topic.lenses.competing.viewA.arguments.length).toBeGreaterThan(0)
        expect(topic.lenses.competing.viewB.title).toBeTruthy()
        expect(topic.lenses.competing.viewB.arguments.length).toBeGreaterThan(0)
        expect(topic.lenses.competing.synthesis).toBeTruthy()

        expect(topic.lenses.component.columns.length).toBeGreaterThanOrEqual(3)
        expect(topic.lenses.component.rows.length).toBeGreaterThanOrEqual(2)

        expect(topic.lenses.progression.stages.length).toBeGreaterThanOrEqual(2)
        expect(topic.lenses.relationship.nodes.length).toBeGreaterThanOrEqual(3)
        expect(topic.lenses.relationship.edges.length).toBeGreaterThanOrEqual(2)

        expect(topic.lenses.system.inputs.length).toBeGreaterThan(0)
        expect(topic.lenses.system.feedbackLoops.length).toBeGreaterThan(0)
        expect(topic.lenses.system.equilibriumState).toBeTruthy()
        expect(topic.lenses.system.outputs.length).toBeGreaterThan(0)
      }
    }
  })

  it('kursga yozilish va o\'chirish (enroll/unenroll) to\'g\'ri ishlaydi', () => {
    const store = useWonderStore.getState()
    store.enrollCourse('test-enroll-course')
    expect(useWonderStore.getState().enrolledCourseIds).toContain('test-enroll-course')

    store.unenrollCourse('test-enroll-course')
    expect(useWonderStore.getState().enrolledCourseIds).not.toContain('test-enroll-course')
  })

  it('custom kursni qayta nomlash (renameCourse) va butunlay o\'chirish (deleteCourse) ishlaydi', () => {
    const store = useWonderStore.getState()
    const mockCourse = {
      id: 'custom-test-101',
      title: 'Dastlabki Kurs Nomi',
      description: 'Sinov kursi',
      durationHours: 1,
      level: 'Boshlang\'ich' as const,
      category: 'Science',
      tags: ['test'],
      sections: [],
      refractorTopics: [],
      podcastEpisodes: [],
      canvasCards: [],
    }

    store.addCustomCourse(mockCourse)
    expect(useWonderStore.getState().customCourses.find((c) => c.id === 'custom-test-101')).toBeDefined()
    expect(useWonderStore.getState().activeCourseId).toBe('custom-test-101')

    // Rename course
    store.renameCourse('custom-test-101', 'Yangilangan Mukammal Nom')
    const renamed = useWonderStore.getState().customCourses.find((c) => c.id === 'custom-test-101')
    expect(renamed?.title).toBe('Yangilangan Mukammal Nom')

    // Delete course
    store.deleteCourse('custom-test-101')
    expect(useWonderStore.getState().customCourses.find((c) => c.id === 'custom-test-101')).toBeUndefined()
    expect(useWonderStore.getState().enrolledCourseIds).not.toContain('custom-test-101')
    expect(useWonderStore.getState().activeCourseId).not.toBe('custom-test-101')
  })

  it('kurs ichidagi order va flashcard interaktiv mashqlari to\'liq aniqlangan', () => {
    const lhtl = DEFAULT_WONDER_COURSES.find((c) => c.id === 'learning-how-to-learn')
    expect(lhtl).toBeDefined()

    const allQuizzes = lhtl!.sections.flatMap((s) => s.lessons.map((l) => l.quiz))
    const orderQuiz = allQuizzes.find((q) => q.type === 'order')
    const flashcardQuiz = allQuizzes.find((q) => q.type === 'flashcard')

    expect(orderQuiz).toBeDefined()
    expect(orderQuiz?.orderSteps).toBeDefined()
    expect(orderQuiz?.orderSteps?.length).toBeGreaterThanOrEqual(3)
    expect(orderQuiz?.correctOrderIds).toBeDefined()

    expect(flashcardQuiz).toBeDefined()
    expect(flashcardQuiz?.flashcardPrompt).toBeTruthy()
    expect(flashcardQuiz?.flashcardAnswer).toBeTruthy()
  })

  it('order va flashcard javoblarini FSRS bilan qabul qilish va saqlash ishlaydi', () => {
    const store = useWonderStore.getState()
    const userAnswers = {
      order: { 'order-1': ['step-1', 'step-2', 'step-3'] },
      flashcard: { 'flash-1': 'known' as const },
      mcq: {},
      cloze: {},
    }

    const result = store.completeLesson('lhtl-9', 'good', 30, 2, userAnswers)
    expect(result.xpEarned).toBe(30)
    expect(result.coinsEarned).toBe(2)

    const card = useWonderStore.getState().fsrsCards['lhtl-9']
    expect(card).toBeDefined()
    expect(card.reps).toBe(1)
    expect(card.stability).toBeGreaterThan(1.0)
  })

  it('Anki TSV eksporti kurs tushunchalari va savollarini to\'g\'ri formatlaydi', () => {
    const course = DEFAULT_WONDER_COURSES.find((c) => c.id === 'yhq-extremal')!
    expect(course).toBeDefined()

    const tsv = generateAnkiTsv(course)
    expect(tsv).toBeTruthy()
    const lines = tsv.split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)

    // Verify TSV structure: Front \t Back \t Tag
    for (const line of lines) {
      const parts = line.split('\t')
      expect(parts.length).toBe(3)
      expect(parts[0].length).toBeGreaterThan(0)
      expect(parts[1].length).toBeGreaterThan(0)
      expect(parts[2]).toMatch(/^Wondering::/)
    }
  })

  it('Kurs konspekti (Markdown) to\'liq strukturani va shaxsiy qaydlarni shakllantiradi', () => {
    const course = DEFAULT_WONDER_COURSES.find((c) => c.id === 'yhq-extremal')!
    const mockNotes = {
      'yhq-l1': ['Birinchi qoida: har doim diqqat markazida bo\'ling', 'Favqulodda tormozlash usuli'],
    }

    const markdown = generateCourseMarkdownConspectus(course, mockNotes)
    expect(markdown).toContain(`# ${course.title}`)
    expect(markdown).toContain(`## 1-Bo'lim:`)
    expect(markdown).toContain(`#### 📝 Shaxsiy Qaydlar:`)
    expect(markdown).toContain(`- Birinchi qoida: har doim diqqat markazida bo'ling`)
  })

  it('Live Challenge (Boss Assessment) bo\'lim savollarini jamlaydi va ballarni hisoblaydi', () => {
    const course = DEFAULT_WONDER_COURSES.find((c) => c.id === 'learning-how-to-learn')!
    const firstSection = course.sections[0]
    expect(firstSection).toBeDefined()

    // Aggregate questions from lessons
    const sectionQuestions = firstSection.lessons
      .filter((l) => Boolean(l.quiz))
      .map((l) => ({
        lessonId: l.id,
        lessonTitle: l.title,
        quiz: l.quiz,
        likelyConfusion: l.likelyConfusion,
      }))

    expect(sectionQuestions.length).toBeGreaterThanOrEqual(1)

    // Combo multiplier logic test
    const getMultiplier = (combo: number) => {
      if (combo >= 4) return 3
      if (combo >= 2) return 2
      return 1
    }

    expect(getMultiplier(0)).toBe(1)
    expect(getMultiplier(1)).toBe(1)
    expect(getMultiplier(2)).toBe(2)
    expect(getMultiplier(3)).toBe(2)
    expect(getMultiplier(4)).toBe(3)
    expect(getMultiplier(10)).toBe(3)
  })
})




