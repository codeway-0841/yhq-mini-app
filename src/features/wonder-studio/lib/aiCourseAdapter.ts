/**
 * Adapter between KIVVI backend AI Courses (`/api/ai-courses`)
 * and Wonder Studio 1:1 format (`WonderCourse`).
 */

import type {
  AiCoursePayloadPublic,
  AiCourseSectionPublic,
  AiCourseLessonPublic,
  AiCoursePage,
} from '../../../../shared/ai-courses'
import type {
  WonderCourse,
  WonderSection,
  WonderLessonNode,
  WonderLessonPage,
  WonderLessonQuiz,
  RefractorTopic,
  PodcastEpisode,
  CanvasCard,
} from '../types'

/**
 * Transforms a backend AiCourse into a full WonderCourse.
 */
export function convertAiCourseToWonderCourse(
  remote: AiCoursePayloadPublic & {
    id: number
    title: string
    topic: string
    inputKind: string
    lessonLength: string
    language: string
    completedLessonIds?: string[]
  },
): WonderCourse {
  const completedSet = new Set(remote.completedLessonIds || [])
  const courseId = `ai-${remote.id}`

  const sections: WonderSection[] = remote.sections.map((sec: AiCourseSectionPublic, secIdx: number) => {
    const lessons: WonderLessonNode[] = sec.lessons.map((lesson: AiCourseLessonPublic, lessonIdx: number) => {
      const isCompleted = completedSet.has(lesson.id)
      const isAvailable = isCompleted || (secIdx === 0 && lessonIdx === 0) || completedSet.size > 0

      // Map pages (text and visual diagrams)
      const pages: WonderLessonPage[] = lesson.pages.map((p: AiCoursePage, pIdx: number) => {
        if (p.kind === 'visual') {
          return {
            id: `p-${lesson.id}-${pIdx}`,
            title: p.heading,
            content: `Visual analysis of ${p.heading}: Compare and contrast the dynamic distributions below.`,
            keywords: [],
            visual: {
              type: p.style === 'pie-chart' ? 'chart' : p.style === 'cycle' ? 'cycle' : 'diagram',
              title: p.heading,
              items: p.items.map((it: { label: string; value: number }) => ({
                label: it.label,
                value: it.value,
                color: '#38BDF8',
                desc: `${it.label}: ${it.value}%`,
              })),
            },
          }
        }

        // Text page with keywords extraction
        const keywords = (lesson.knowledgeCards || []).slice(0, 2).map((kc: { title: string; body: string }) => ({
          word: kc.title,
          definition: kc.body,
        }))

        return {
          id: `p-${lesson.id}-${pIdx}`,
          title: p.heading,
          content: p.body,
          keywords,
        }
      })

      // Map practices into quiz
      let quiz: WonderLessonQuiz = {
        type: 'mcq',
        question: `How does ${lesson.title} apply in practice?`,
        options: [
          { id: 'opt1', text: 'By understanding the fundamental mental models and core mechanisms' },
          { id: 'opt2', text: 'By memorizing terminology without testing intuition' },
        ],
        correctOptionId: 'opt1',
        explanation: 'Active intuition and foundational reasoning produce the highest long-term retention.',
      }

      if (lesson.practices && lesson.practices.length > 0) {
        const first = lesson.practices[0]
        if (first.kind === 'mcq') {
          quiz = {
            type: 'mcq',
            question: first.prompt,
            options: first.options.map((o: { id: string; text: string }) => ({ id: o.id, text: o.text })),
            correctOptionId: first.options[0]?.id,
            explanation: `"${lesson.title}" bo'yicha asosiy tushuncha va mental model.`,
          }
        } else if (first.kind === 'cloze') {
          quiz = {
            type: 'cloze',
            question: first.prompt,
            clozeTemplate: first.template,
            clozeOptions: first.pool,
            clozeAnswer: (first as { blanks?: Array<{ answer?: string }> }).blanks?.[0]?.answer || first.pool?.[0] || '',
            explanation: 'Asosiy jumlani to\'ldirish faol eslashni shakllantiradi.',
          }
        } else if (first.kind === 'order') {
          quiz = {
            type: 'order',
            question: first.prompt,
            orderSteps: first.steps.map((st: { id: string; text: string }) => ({ id: st.id, text: st.text })),
            correctOrderIds: first.steps.map((st: { id: string }) => st.id),
            explanation: 'Mantiqiy qadamlarni to\'g\'ri tartiblash jarayon mexanikasini mustahkamlaydi.',
          }
        } else if (first.kind === 'flashcard') {
          quiz = {
            type: 'flashcard',
            question: first.prompt,
            flashcardPrompt: first.prompt,
            flashcardAnswer: first.answer,
            explanation: 'Kognitiv faol chaqirib olish (Active Recall) orqali uzoq muddatli xotira mustahkamlandi.',
          }
        }
      }

      return {
        id: lesson.id,
        title: lesson.title,
        durationMinutes: 4,
        xp: 45,
        coins: 2,
        tags: [remote.title, sec.title.replace(/^\d+\.\s*/, '')],
        status: isCompleted ? 'completed' : isAvailable ? 'available' : 'locked',
        tldr: lesson.tldr,
        hook: lesson.hook,
        meaning: lesson.meaning,
        objective: lesson.objective,
        likelyConfusion: lesson.likelyConfusion,
        pages: pages.length > 0 ? pages : [
          {
            id: `p-${lesson.id}-1`,
            title: lesson.title,
            content: lesson.tldr,
            keywords: [],
          },
        ],
        quiz,
        rawPractices: lesson.practices,
      }
    })

    const isSectionCompleted = lessons.every((l) => l.status === 'completed')

    return {
      id: sec.id,
      title: sec.title,
      description: `${lessons.filter((l) => l.status === 'completed').length}/${lessons.length} lessons · Core principles`,
      lessons,
      isCompleted: isSectionCompleted,
    }
  })

  // Synthesize 5-lens Refractor Topic
  const refractorTopics: RefractorTopic[] = [
    {
      id: `ref-${courseId}`,
      title: `${remote.title}: Foundational Principles vs Applied Intuition`,
      concept: `The core cognitive model governing ${remote.title}`,
      lenses: {
        competing: {
          viewA: {
            title: 'First Principles & Rigor',
            stance: `Mastering ${remote.title} requires analytical precision and fundamental axioms`,
            arguments: [
              'Builds unbreakable mental foundations',
              'Prevents superficial misconceptions',
              'Enables high-level deductive reasoning',
            ],
            advocate: 'Analytical purists & domain researchers',
          },
          viewB: {
            title: 'Empirical Heuristics & Fast Feedback',
            stance: `Intuitive rapid experimentation and hands-on trial yield faster real-world competence`,
            arguments: [
              'Accelerates experiential pattern matching',
              'Immediate error correction loops',
              'Reduces cognitive friction of pure theory',
            ],
            advocate: 'Pragmatists & rapid practitioners',
          },
          synthesis: `True mastery in ${remote.title} blends rigorous bottom-up first principles with rapid top-down intuition loops.`,
        },
        component: {
          columns: ['Component', 'Primary Role', 'Mechanism', 'Failure Impact'],
          rows: [
            {
              component: 'Foundational Scaffold',
              role: 'Core structure',
              mechanism: 'Axioms and verified definitions',
              failureImpact: 'Superficial understanding and confusion',
            },
            {
              component: 'Feedback Signal',
              role: 'Error detection',
              mechanism: 'Active testing and real-time validation',
              failureImpact: 'Illusion of competence',
            },
            {
              component: 'Synthesis Node',
              role: 'Integration',
              mechanism: 'Cross-topic mental chunks',
              failureImpact: 'Siloed, isolated facts without intuition',
            },
          ],
        },
        progression: {
          stages: [
            {
              step: 1,
              name: 'Orientation & First Principles',
              trigger: 'Encountering novel material',
              state: 'High cognitive friction',
              milestone: 'Grasping foundational vocabulary',
            },
            {
              step: 2,
              name: 'Deliberate Chunking',
              trigger: 'Focused practice on key concepts',
              state: 'Rapid pattern emergence',
              milestone: 'Effortless recall of basic units',
            },
            {
              step: 3,
              name: 'Fluency & Intuition',
              trigger: 'Handling edge cases & variations',
              state: 'Fluid associative synthesis',
              milestone: 'Ability to explain and teach simply',
            },
          ],
        },
        relationship: {
          nodes: [
            { id: 'n1', label: `${remote.title} Axioms`, group: 'core', importance: 1 },
            { id: 'n2', label: 'Mental Models', group: 'bridge', importance: 2 },
            { id: 'n3', label: 'Real-World Applications', group: 'output', importance: 3 },
          ],
          edges: [
            { from: 'n1', to: 'n2', label: 'structures', type: 'contains' },
            { from: 'n2', to: 'n3', label: 'guides', type: 'causes' },
          ],
        },
        system: {
          inputs: ['Curiosity', 'Focused Attention', 'Deliberate Practice'],
          feedbackLoops: [
            {
              type: 'positive',
              name: 'Competence-Dopamine Loop',
              description: 'Small conceptual breakthroughs release dopamine, reinforcing learning stamina.',
            },
            {
              type: 'negative',
              name: 'Cognitive Fatigue Balancing',
              description: 'Mental strain limits session duration, prompting diffuse consolidation during rest.',
            },
          ],
          equilibriumState: 'Effortless intuitive mastery and durable long-term retention',
          outputs: ['Actionable Insights', 'Deep Problem Solving', 'Creative Synthesis'],
        },
      },
    },
  ]

  // Synthesize 2-Host Podcast Episodes
  const podcastEpisodes: PodcastEpisode[] = [
    {
      id: `pod-${courseId}-1`,
      title: `Episode 1: Unlocking ${remote.title}`,
      duration: '5:45',
      durationSec: 345,
      hosts: {
        hostA: { name: 'Dr. Sarah Lin', role: 'Cognitive Specialist', avatar: '👩‍🔬' },
        hostB: { name: 'Alex', role: 'Inquisitive Learner', avatar: '🧑‍🎓' },
      },
      turns: [
        {
          id: 't1',
          speaker: 'hostB',
          text: `Dr. Lin, why does ${remote.title} seem so overwhelming to beginners at first glance?`,
          timestamp: 0,
        },
        {
          id: 't2',
          speaker: 'hostA',
          text: `It's primarily cognitive load! When you lack the basic mental scaffolds, your working memory tries to juggle raw facts without compression. Once you establish the core mental models, everything clicks.`,
          timestamp: 15,
        },
        {
          id: 't3',
          speaker: 'hostB',
          text: `So by breaking it down into bite-sized chunks, we turn cognitive friction into effortless momentum?`,
          timestamp: 32,
        },
        {
          id: 't4',
          speaker: 'hostA',
          text: `Precisely! In this section, we build those exact mental models so you can reason about ${remote.title} from first principles.`,
          timestamp: 46,
        },
      ],
    },
    {
      id: `pod-${courseId}-2`,
      title: `Episode 2: Deep Dynamics in ${remote.title}`,
      duration: '6:15',
      durationSec: 375,
      hosts: {
        hostA: { name: 'Dr. Sarah Lin', role: 'Cognitive Specialist', avatar: '👩‍🔬' },
        hostB: { name: 'Alex', role: 'Inquisitive Learner', avatar: '🧑‍🎓' },
      },
      turns: [
        {
          id: 't5',
          speaker: 'hostB',
          text: `What is the most common pitfall people run into when practicing ${remote.title}?`,
          timestamp: 0,
        },
        {
          id: 't6',
          speaker: 'hostA',
          text: `The illusion of competence! Glancing at a summary feels fluent, but true mastery requires testing your recall without looking at the notes.`,
          timestamp: 16,
        },
        {
          id: 't7',
          speaker: 'hostB',
          text: `Active retrieval beats passive rereading every single time.`,
          timestamp: 30,
        },
        {
          id: 't8',
          speaker: 'hostA',
          text: `Every single time. That's why the interactive quizzes at the end of each bite lesson are so critical.`,
          timestamp: 42,
        },
      ],
    },
  ]

  // Canvas Cards from knowledge cards
  const canvasCards: CanvasCard[] = []
  let cardIdx = 0
  for (const sec of remote.sections) {
    for (const lesson of sec.lessons) {
      for (const kc of lesson.knowledgeCards || []) {
        if (canvasCards.length < 6) {
          canvasCards.push({
            id: `card-${courseId}-${cardIdx}`,
            title: kc.title,
            content: kc.body,
            category: cardIdx % 2 === 0 ? 'core' : 'insight',
            color: cardIdx % 2 === 0 ? '#BAE6FD' : '#FEF3C7',
            x: 80 + (cardIdx % 3) * 160,
            y: 80 + Math.floor(cardIdx / 3) * 140,
          })
          cardIdx++
        }
      }
    }
  }

  if (canvasCards.length === 0) {
    canvasCards.push(
      {
        id: `card-${courseId}-1`,
        title: `Core Concept: ${remote.title}`,
        content: `First principles foundations of ${remote.title}. Break complex challenges down into basic axioms.`,
        category: 'core',
        color: '#BAE6FD',
        x: 100,
        y: 80,
      },
      {
        id: `card-${courseId}-2`,
        title: 'Feedback Loops',
        content: `Systemic relationships in ${remote.title} stabilize or amplify over time.`,
        category: 'insight',
        color: '#FEF3C7',
        x: 320,
        y: 90,
      },
    )
  }

  return {
    id: courseId,
    title: remote.title,
    description: remote.topic || `A comprehensive, cognitive-first course on ${remote.title}.`,
    subjectId: 'universal',
    badge: '✨',
    level: remote.lessonLength === 'deep' ? 'deep' : remote.lessonLength === 'short' ? 'beginner' : 'intermediate',
    estimatedMinutes: sections.length * 15,
    totalXp: sections.reduce((acc, s) => acc + s.lessons.length * 45, 0),
    author: 'KIVVI AI Studio',
    category: 'AI Generated',
    sections,
    refractorTopics,
    podcastEpisodes,
    canvasCards,
  }
}

/**
 * High-quality offline course generator for fallback when network is unavailable or limit reached.
 */
export function createLocalCourseFallback(topic: string, language: string = 'uz'): WonderCourse {
  const cleanTopic = topic.trim().slice(0, 100)
  const id = `local-${Date.now()}`

  const isUz = language === 'uz'

  const sec1Title = isUz ? `1. ${cleanTopic} Asoslari va Boshlang'ich Tushunchalar` : `1. Foundations of ${cleanTopic}`
  const sec2Title = isUz ? `2. Amaliy Mexanizmlar va Jarayonlar` : `2. Practical Mechanics & Systems`

  const l1Title = isUz ? `Birinchi Prinsiplar bilan Tanishuv` : `First Principles Introduction`
  const l2Title = isUz ? `Asosiy Mexanizmlar va Bog'lanishlar` : `Core Mechanics & Relationships`
  const l3Title = isUz ? `Amaliy Qo'llash va Tahlil` : `Practical Application & Analysis`
  const l4Title = isUz ? `Tizimli Fikrlar va Xulosa` : `System Dynamics & Conclusion`

  return {
    id,
    title: cleanTopic,
    description: isUz
      ? `${cleanTopic} bo'yicha Wondering uslubidagi chuqur mental modellar va kognitiv tushuntirishlar kursi.`
      : `Deep cognitive mental models and first-principles mastery course on ${cleanTopic}.`,
    subjectId: 'universal',
    badge: '✨',
    level: 'intermediate',
    estimatedMinutes: 30,
    totalXp: 180,
    author: 'KIVVI Cognitive Studio',
    category: 'Universal',
    sections: [
      {
        id: `${id}-s1`,
        title: sec1Title,
        description: isUz ? '0/2 darslar · Birinchi prinsiplar va asosiy atamalar' : '0/2 lessons · First principles & vocabulary',
        isCompleted: false,
        lessons: [
          {
            id: `${id}-l1`,
            title: l1Title,
            durationMinutes: 3,
            xp: 45,
            coins: 2,
            tags: [cleanTopic, 'Basics'],
            status: 'available',
            tldr: isUz
              ? `${cleanTopic} mavzusini tushunish barcha ortiqcha taxminlarni chetga surib, eng tub aksiomalardan boshlashni talab qiladi.`
              : `Mastering ${cleanTopic} starts by removing assumptions and reasoning upward from fundamental axioms.`,
            hook: isUz
              ? `Agar ${cleanTopic} mavzusida tub prinsiplar buzilsa, butun tizim qayerda to'xtab qoladi?`
              : `If the fundamental axioms of ${cleanTopic} break down, where does the entire system fail?`,
            meaning: isUz
              ? `Ushbu poydevor murakkablikni bartaraf etib, yuzaki yodlash o'rniga mustahkam intuitsiya quradi.`
              : `This foundation cuts through noise and establishes durable mental models over rote memorization.`,
            objective: isUz
              ? `${cleanTopic} tub aksiomalarini ajrata olish va ularga tayanib fikrlash.`
              : `Identify and reason from the core first principles of ${cleanTopic}.`,
            likelyConfusion: isUz
              ? `Ko'pchilik hamma qoidalarni birdek yodlash kerak deb o'ylaydi, aslida 2-3 ta tub tamoyilni tushunish yetarli.`
              : `Learners assume they must memorize dozens of disconnected rules rather than a few fundamental axioms.`,
            pages: [
              {
                id: 'p1',
                title: isUz ? 'Birinchi Prinsiplar' : 'First Principles',
                content: isUz
                  ? `${cleanTopic} bo'yicha chinakam bilimga ega bo'lish uchun avvalo uning [[fundamental aksiomalar|Boshqa dalil talab qilmaydigan eng asosiy haqiqatlar]]ini aniqlashimiz lozim. Bu usul chalkashliklardan xalos etib, mustahkam poydevor yaratadi.`
                  : `To truly understand ${cleanTopic}, we dissect it into [[fundamental axioms|Basic baseline truths that cannot be deduced any further]]. This cuts through noise and establishes durable intuition.`,
                keywords: [
                  {
                    word: isUz ? 'fundamental aksiomalar' : 'fundamental axioms',
                    definition: isUz ? 'Boshqa dalil talab qilmaydigan eng asosiy haqiqatlar.' : 'Baseline foundational truths that cannot be reduced further.',
                  },
                ],
                visual: {
                  type: 'diagram',
                  title: isUz ? 'O\'rganish Bosqichlari' : 'Mastery Flow',
                  items: [
                    { label: isUz ? 'Aksiomalar' : 'Axioms', value: 30, color: '#38BDF8', desc: '100% Core' },
                    { label: isUz ? 'Modellar' : 'Models', value: 65, color: '#3B82F6', desc: 'Intuition' },
                    { label: isUz ? 'Amaliyot' : 'Practice', value: 100, color: '#10B981', desc: 'Mastery' },
                  ],
                },
              },
            ],
            quiz: {
              type: 'mcq',
              question: isUz
                ? `${cleanTopic} mavzusini mukammal o'zlashtirishning kaliti nima?`
                : `What is the cornerstone to mastering ${cleanTopic}?`,
              options: [
                { id: 'a', text: isUz ? 'Tub birinchi prinsiplar va mental modellar asosida fikrlash' : 'Reasoning from foundational first principles and mental models' },
                { id: 'b', text: isUz ? 'Tushunmasdan faktlarni yodlash' : 'Passive rote memorization without testing intuition' },
              ],
              correctOptionId: 'a',
              explanation: isUz
                ? 'Birinchi prinsiplar bilan fikrlash uzoq muddatli xotira va teran tushunchani shakllantiradi.'
                : 'First-principles reasoning cuts through noise and builds durable intuition.',
            },
          },
          {
            id: `${id}-l2`,
            title: l2Title,
            durationMinutes: 4,
            xp: 45,
            coins: 2,
            tags: [cleanTopic, 'Mechanics'],
            status: 'locked',
            tldr: isUz
              ? `Tizimning ichki mexanizmlari va qayta aloqa zanjirlari uning barqarorligini ta'minlaydi.`
              : `Internal dynamics and feedback loops govern long-term system stability.`,
            hook: isUz
              ? `Qayta aloqa zanjiri buzilsa yoki muvozanat yo'qolsa, tizim qanday qilib kutilmagan zanjirli inqirozga uchraydi?`
              : `When feedback loops de-synchronize, how does a seemingly stable system experience sudden collapse?`,
            meaning: isUz
              ? `Tizimli fikrlash murakkab jarayonlardagi yashirin sabab-oqibat oqimini ko'rishga yordam beradi.`
              : `Systems thinking reveals the hidden balancing loops behind complex real-world phenomena.`,
            objective: isUz
              ? `Ijobiy va salbiy qayta aloqa halqalarini aniqlash va ularning barqarorlikka ta'sirini baholash.`
              : `Distinguish reinforcing vs balancing feedback loops and evaluate system stability.`,
            likelyConfusion: isUz
              ? `Ko'pchilik "ijobiy qayta aloqa" doim foydali deb o'ylaydi, ammo u nazoratsiz portlash yoki defitsit keltirib chiqarishi mumkin.`
              : `Learners conflate 'positive feedback' with good outcomes; in reality, reinforcing loops can trigger runaway cascades.`,
            pages: [
              {
                id: 'p1',
                title: isUz ? 'Qayta Aloqa Zanjiri' : 'Feedback Dynamics',
                content: isUz
                  ? `${cleanTopic} tizimida [[qayta aloqa halqasi|Chiqish signali kirish signaliga ta'sir o'tkazadigan zanjir]] katta ahamiyatga ega. Ijobiy halqa o'sishni tezlashtiradi, salbiy halqa esa muvozanatni saqlaydi.`
                  : `In ${cleanTopic}, [[feedback loops|Cycles where system outputs route back as inputs]] dictate outcomes. Reinforcing loops drive growth, while balancing loops ensure equilibrium.`,
                keywords: [
                  {
                    word: isUz ? 'qayta aloqa halqasi' : 'feedback loops',
                    definition: isUz ? 'Chiqish natijalari qaytadan kirish parametrlariga aylanuvchi jarayon.' : 'Cycles where outputs recirculate as inputs to regulate behavior.',
                  },
                ],
              },
            ],
            quiz: {
              type: 'mcq',
              question: isUz
                ? `Tizimda muvozanatni saqlashga qaysi mexanizm javob beradi?`
                : `Which dynamic maintains system equilibrium?`,
              options: [
                { id: 'a', text: isUz ? 'Salbiy (barqarorlashtiruvchi) qayta aloqa' : 'Negative (balancing) feedback loop' },
                { id: 'b', text: isUz ? 'Cheksiz tasodifiy o\'zgarishlar' : 'Unconstrained random drift' },
              ],
              correctOptionId: 'a',
              explanation: isUz ? 'Salbiy qayta aloqa og\'ishlarni bartaraf etib barqarorlikni tiklaydi.' : 'Balancing loops counteract deviations to sustain equilibrium.',
            },
          },
        ],
      },
      {
        id: `${id}-s2`,
        title: sec2Title,
        description: isUz ? '0/2 darslar · Amaliyot va chuqur integratsiya' : '0/2 lessons · Practice & deep integration',
        isCompleted: false,
        lessons: [
          {
            id: `${id}-l3`,
            title: l3Title,
            durationMinutes: 4,
            xp: 45,
            coins: 2,
            tags: [cleanTopic, 'Application'],
            status: 'locked',
            tldr: isUz
              ? `Nazariyani amaliyotda tekshirish xatolardan erta saboq olish va tushunchani mustahkamlash vositasidir.`
              : `Active trial and error transforms abstract theory into intuitive muscle memory.`,
            hook: isUz
              ? `Konspektni 5 marta qayta o'qish nega imtihonda deyarli yordam bermaydi?`
              : `Why does rereading a textbook 5 times produce virtually zero lasting retention?`,
            meaning: isUz
              ? `Faol eslash nazariyani uzoq muddatli xotiraga muhrlaydi va soxta bilish illyuziyasini yo'qotadi.`
              : `Active retrieval shatters the illusion of competence and wires durable neural pathways.`,
            objective: isUz
              ? `Faol eslash va qisqa oraliqlar bilan takrorlash orqali bilimlarni uzoq muddatga saqlash.`
              : `Apply active retrieval and spaced practice to achieve long-term mastery.`,
            likelyConfusion: isUz
              ? `O'quvchi matnni o'qiganda "men buni bilaman" deb o'ylaydi; ammo kitobsiz qayta eslashga kelganda xotirada bo'shliq yuzaga keladi.`
              : `Learners mistake recognition for recall, believing that understanding a text equals the ability to retrieve it from memory.`,
            pages: [
              {
                id: 'p1',
                title: isUz ? 'Faol Eslash' : 'Active Recall',
                content: isUz
                  ? `Faqat konspektni qayta o'qish emas, balki materialni yopib, o'z so'zlari bilan aytib berish ([[faol eslash|Xotiradan ma'lumotni mustaqil chiqarib olish jarayoni]]) tushunish tezligini 2 barobar oshiradi.`
                  : `Passive rereading creates illusions of competence. Mentally retrieving answers through [[active recall|The cognitive act of pulling memories without cues]] doubles retention.`,
                keywords: [
                  {
                    word: isUz ? 'faol eslash' : 'active recall',
                    definition: isUz ? 'Savollarga mustaqil javob topish orqali neyron yo\'llarini kuchaytirish.' : 'Retrieving information from long-term memory to strengthen neural tracks.',
                  },
                ],
              },
            ],
            quiz: {
              type: 'mcq',
              question: isUz
                ? `Uzoq muddatli eslab qolish uchun eng samarali o'rganish usuli qaysi?`
                : `What is the most effective retention technique?`,
              options: [
                { id: 'a', text: isUz ? 'Faol eslash va o\'z-o\'zini test qilish' : 'Active recall and self-testing' },
                { id: 'b', text: isUz ? 'Matnni qayta-qayta shunchaki ko\'zdan kechirish' : 'Passive repetitive rereading' },
              ],
              correctOptionId: 'a',
              explanation: isUz ? 'O\'zini sinash neyron sinapslarini mustahkamlaydi.' : 'Self-testing exercises the neural retrieval pathways directly.',
            },
          },
          {
            id: `${id}-l4`,
            title: l4Title,
            durationMinutes: 4,
            xp: 45,
            coins: 2,
            tags: [cleanTopic, 'Mastery'],
            status: 'locked',
            tldr: isUz
              ? `Turli sohalararo bog'lanishlar va yuqori darajadagi intuitiv qarorlar qabul qilish.`
              : `Synthesizing interdisciplinary mental models for effortless decision making.`,
            hook: isUz
              ? `Bir sohadagi bilim boshqa butunlay notanish vaziyatda qanday qilib kutilmagan yechim bo'lishi mumkin?`
              : `How can a principle from physics or biology solve an intractable software or business deadlock?`,
            meaning: isUz
              ? `Mental modellar panjarasi miyada tayyor intuitsiya va tahliliy kompas yaratadi.`
              : `A latticework of mental models builds agile intuition across unexpected problem domains.`,
            objective: isUz
              ? `Turli sohalararo bilimlarni birlashtirib, murakkab masalalarda to'g'ri qaror qabul qilish.`
              : `Synthesize models across domains to navigate ambiguous, complex challenges.`,
            likelyConfusion: isUz
              ? `Har bir fanni alohida qutiga solib o'rganish kerak degan stereotip mavjud; haqiqatda eng katta yutuqlar sohalar tutashuvida yuz beradi.`
              : `Treating knowledge as isolated silos rather than an interconnected cognitive web.`,
            pages: [
              {
                id: 'p1',
                title: isUz ? 'Mental Modellar Panjarasi' : 'Latticework of Mental Models',
                content: isUz
                  ? `Charlz Manger ta'biri bilan aytganda, bilimlar alohida faktlar emas, balki bir-biri bilan chirmashgan mustahkam panjara kabi bo'lishi kerak.`
                  : `Charlie Munger famously observed that true wisdom consists of a latticework of mental models across disciplines.`,
                keywords: [],
              },
            ],
            quiz: {
              type: 'mcq',
              question: isUz
                ? `Bilimlarni bir-biri bilan bog'lab o'rganishning asosiy foydasi nima?`
                : `What is the key benefit of a mental model latticework?`,
              options: [
                { id: 'a', text: isUz ? 'Kutilmagan muammolarda tez va to\'g\'ri yechim topish' : 'Navigating novel problems with swift, accurate intuition' },
                { id: 'b', text: isUz ? 'Har bir faktni alohida ajratib qo\'yish' : 'Keeping every concept isolated' },
              ],
              correctOptionId: 'a',
              explanation: isUz ? 'Mental modellar yangi vaziyatlarda yo\'l xaritasini beradi.' : 'Integrated models serve as high-resolution compasses for complex problems.',
            },
          },
        ],
      },
    ],
    refractorTopics: [
      {
        id: `ref-${id}`,
        title: `${cleanTopic}: Intuition vs Formalism`,
        concept: isUz ? `Tub mexanizmlar va amaliy modellar` : `Foundational dynamics of ${cleanTopic}`,
        lenses: {
          competing: {
            viewA: {
              title: isUz ? 'Tub Aksiomalar' : 'First Principles',
              stance: isUz ? 'Asosiy qonuniyatlardan kelib chiqib fikrlash' : 'Deduction strictly from baseline laws',
              arguments: [
                isUz ? 'Xatoliklar ehtimolini kamaytiradi' : 'Minimizes cognitive bias',
                isUz ? 'Poydevorni mustahkam qiladi' : 'Builds rock-solid foundation',
              ],
              advocate: 'Feynman & First Principles Thinkers',
            },
            viewB: {
              title: isUz ? 'Tezkor Sinov va Tajriba' : 'Fast Heuristics',
              stance: isUz ? 'Amaliyot orqali xatolarni tez tuzatish' : 'Iterative trial and real-world adaptation',
              arguments: [
                isUz ? 'Vaqtni tejaydi' : 'Saves analytical time',
                isUz ? 'Haqiqiy kontekstda tekshiriladi' : 'Tests directly against reality',
              ],
              advocate: 'Practitioners & Engineers',
            },
            synthesis: isUz
              ? 'Ikkala yondashuvni birlashtirish eng yuqori natijani beradi.'
              : 'Combining foundational rigor with rapid empirical feedback achieves mastery.',
          },
          component: {
            columns: ['Element', 'Vazifa', 'Mexanizm', 'Ta\'sir'],
            rows: [
              {
                component: 'Asos',
                role: 'Tushuncha',
                mechanism: 'Aksiomalar',
                failureImpact: 'Chalkashlik',
              },
              {
                component: 'Sinov',
                role: 'Tekshirish',
                mechanism: 'Faol eslash',
                failureImpact: 'Soxta bilim',
              },
            ],
          },
          progression: {
            stages: [
              {
                step: 1,
                name: 'Boshlang\'ich',
                trigger: 'Yangi ma\'lumot',
                state: 'Diqqat',
                milestone: 'Atamalarni bilish',
              },
              {
                step: 2,
                name: 'Amaliyot',
                trigger: 'Mashqlar',
                state: 'Tushunish',
                milestone: 'O\'z so\'zlari bilan aytish',
              },
            ],
          },
          relationship: {
            nodes: [
              { id: '1', label: cleanTopic, group: 'core', importance: 1 },
              { id: '2', label: 'Amaliyot', group: 'bridge', importance: 2 },
            ],
            edges: [{ from: '1', to: '2', label: 'qo\'llash', type: 'causes' }],
          },
          system: {
            inputs: ['Diqqat', 'Vaqt'],
            feedbackLoops: [
              {
                type: 'positive',
                name: 'O\'sish halqasi',
                description: 'Kichik yutuqlar yangi qiziqish uyg\'otadi.',
              },
            ],
            equilibriumState: 'Barqaror bilim',
            outputs: ['Mustaqil fikrlash'],
          },
        },
      },
    ],
    podcastEpisodes: [
      {
        id: `pod-${id}-1`,
        title: isUz ? `1-Qism: ${cleanTopic} olamiga kirish` : `Episode 1: Unlocking ${cleanTopic}`,
        duration: '5:10',
        durationSec: 310,
        hosts: {
          hostA: { name: 'Dr. Aziz', role: isUz ? 'Kognitiv Olim' : 'Scientist', avatar: '👨‍🔬' },
          hostB: { name: 'Madina', role: isUz ? 'Qiziquvchan O\'quvchi' : 'Curious Student', avatar: '👩‍🎓' },
        },
        turns: [
          {
            id: 't1',
            speaker: 'hostB',
            text: isUz
              ? `Assalomu alaykum, Dr. Aziz! Nega ko'pchilik "${cleanTopic}" mavzusini qiyin deb o'ylaydi?`
              : `Hello Dr. Aziz! Why does ${cleanTopic} feel so intimidating at first glance?`,
            timestamp: 0,
          },
          {
            id: 't2',
            speaker: 'hostA',
            text: isUz
              ? `Vaalaykum assalom! Chunki boshida miyada ushbu soha uchun tayyor mental modellar bo'lmaydi. Biz bosqichma-bosqich o'rgangach, qiyin tuyulgan tushunchalar oson va qiziqarli bo'lib qoladi!`
              : `Because we initially lack the mental scaffolding! Once we build the core mental models step by step, intimidation turns into pure fascination.`,
            timestamp: 16,
          },
          {
            id: 't3',
            speaker: 'hostB',
            text: isUz
              ? `Demak, sir faqat to'g'ri birinchi prinsiplar va faol mashqda ekanda?`
              : `So the secret is just solid first principles and active practice?`,
            timestamp: 32,
          },
          {
            id: 't4',
            speaker: 'hostA',
            text: isUz
              ? `Aynan shunday! Bugungi darslarimizda aynan shu poydevorni birgalikda quramiz.`
              : `Exactly! In these lessons, we lay that exact foundation together.`,
            timestamp: 44,
          },
        ],
      },
    ],
    canvasCards: [
      {
        id: `card-${id}-1`,
        title: isUz ? `Tub G'oya: ${cleanTopic}` : `Core: ${cleanTopic}`,
        content: isUz
          ? `${cleanTopic} bo'yicha birinchi prinsiplarga tayangan holda murakkab tizimlarni sodda bloklarga ajratish.`
          : `Deconstructing ${cleanTopic} into elemental building blocks using first principles.`,
        category: 'core',
        color: '#BAE6FD',
        x: 100,
        y: 80,
      },
      {
        id: `card-${id}-2`,
        title: isUz ? `Amaliy Xulosa` : `Key Takeaway`,
        content: isUz
          ? `Doimiy faol eslash va qisqa oraliqlar bilan takrorlash bilimlarni mustahkamlaydi.`
          : `Consistent active retrieval and spaced intervals transform insight into intuition.`,
        category: 'insight',
        color: '#FEF3C7',
        x: 320,
        y: 85,
      },
    ],
  }
}
