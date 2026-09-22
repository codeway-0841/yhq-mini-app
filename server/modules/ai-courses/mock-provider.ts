/**
 * AI Kurslar MOCK provider — deterministik outline generatori.
 *
 * MVP: real Gemini o'rniga mavzudan deterministik kurs quradi (bir xil
 * mavzu = bir xil kurs — testlar stabil, narx nol). Interfeys real
 * provider bilan bir xil (`buildCourseOutline(input): AiCoursePayload`),
 * shuning uchun almashtirish faqat shu fayl + router'dagi 1 qator.
 *
 * Kontent 2 tilda (uz/ru), 3 section × 3 dars. Har dars:
 * TLDR + 3 sahifa (matn, vizual, matn) + 3 mashq (mcq, cloze, flashcard —
 * 4-darslarda order bilan almashadi) + 2 bilim kartasi.
 */

import {
  AI_COURSE_MOCK_SECTIONS,
  AI_COURSE_MOCK_LESSONS_PER_SECTION,
  AiCoursePayloadSchema,
  cleanTopicForTitle,
  type AiCourseCreateInput,
  type AiCoursePayload,
  type AiCoursePractice,
} from '../../../shared/ai-courses'

type Lang = 'uz' | 'ru'

/** djb2 — kichik deterministik hash (seed) */
function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

const T = {
  uz: {
    sections: ['Mustahkam asos', 'Amaliy ko‘nikma', 'Chuqur mahorat'],
    sectionGoal: [
      'mavzuning eng muhim tushunchalarini sodda tilda o‘zlashtirasiz',
      'bilimni mashqlar orqali mustahkamlab, xatolarni to‘g‘rilaysiz',
      'mavzuni mustaqil qo‘llay oladigan darajaga chiqasiz',
    ],
    lessonKinds: ['Birinchi prinsiplar', 'Asosiy mexanizmlar', 'Amaliy sinov va xulosa'],
    hook: (topic: string, kind: string) =>
      `${topic} tizimida «${kind}» tamoyili buzilsa, butun jarayon qayerda to‘xtab qoladi?`,
    meaning: (topic: string, _kind: string) =>
      `Ushbu qadam ${topic} bo‘yicha nazariya va real amaliyot o‘rtasidagi ko‘prikdir. Uning yordamida ortiqcha kognitiv yuklamasiz to‘g‘ri qaror qabul qilish osonlashadi.`,
    objective: (topic: string, kind: string) =>
      `${topic} doirasida «${kind}» tamoyilini tushunib, mustaqil amaliyotda to‘g‘ri qo‘llash.`,
    likelyConfusion: (topic: string, _kind: string) =>
      `Ko‘pchilik ${topic} ni shunchaki quruq faktlarni yodlash deb o‘ylaydi, ammo aslida tub prinsiplarni tushunish kifoya.`,
    tldr: (topic: string, kind: string) =>
      `${topic} bo‘yicha «${kind}» darsi: eng muhim 3 g‘oyani 3 daqiqada o‘zlashtirasiz, keyin mashqlarda sinaysiz.`,
    page1Heading: 'Nega bu muhim?',
    page1: (topic: string) =>
      `**Birinchi prinsiplar** — ${topic} bo‘yicha murakkablikni chetga surib, eng tub [[fundamental aksiomalar|Boshqa dalil talab qilmaydigan eng asosiy haqiqatlar]]dan boshlash lozim.\n\n` +
      `**Kognitiv tejamkorlik** — Miya butun tizimni birdaniga emas, kichik mantiqiy bo‘laklarda o‘zlashtiradi. Asosiy ziddiyatlarni anglab yetish orqali chalkashliklardan saqlanasiz.`,
    visualHeading: 'O‘zlashtirish balansi',
    visualItems: [
      { label: 'Kichik bo‘lak', value: 85 },
      { label: 'Takrorlash', value: 70 },
      { label: 'Amaliyot', value: 60 },
      { label: 'Dam olish', value: 40 },
    ],
    page3Heading: 'Amaliy qo‘llash',
    page3: (topic: string) =>
      `**Faol sinov** — Nazariyani o‘qib bo‘lgach, darhol [[faol eslash|Kitobga qaramasdan ma'lumotni xotiradan qayta chaqirib olish usuli]] orqali o‘z bilimingizni sinab ko‘ring.\n\n` +
      `**Xatolar tahlili** — Dars davomidagi har bir noaniqlik ${topic} mavzusini yanada mustahkam egallashingiz uchun signaldir.`,
    mcqPrompt: (topic: string) => `${topic} ni samarali o‘rganish uchun qaysi usul eng to‘g‘ri?`,
    mcqOptions: ['Hammasini bir kunda yodlash', 'Kichik bo‘laklarda + takrorlash', 'Faqat videoko‘rish', 'Imtihon kuni o‘qish'],
    clozePrompt: 'Jumlani to‘ldiring',
    clozeTemplate: 'Mustahkam bilim {{c1}} orqali quriladi va {{c2}} bilan saqlanadi.',
    clozeBlanks: [{ id: 'c1', answer: 'kichik qadamlar' }, { id: 'c2', answer: 'takrorlash' }],
    clozePool: ['takrorlash', 'kichik qadamlar', 'shoshilish', 'yodlash'],
    orderPrompt: 'Samarali o‘rganish bosqichlarini tartiblang',
    orderSteps: ['Maqsadni aniqlang', 'Kichik bo‘lakka bo‘ling', 'Mashq qiling', 'Takrorlang'],
    flashPrompt: 'Bugungi asosiy g‘oya nima?',
    flashAnswer: 'Kichik qadamlar + takrorlash = mustahkam bilim.',
    cards: [
      { title: 'Oltin qoida', body: 'Har kuni ozgina — lekin har kuni. Davomiylik intensivlikdan kuchli.' },
      { title: 'Xato — dars', body: 'Xato qilgan joyingizni yozib oling: u keyingi takrorlash ro‘yxatining boshi.' },
    ],
    outcomes: [
      '{topic} asosiy tushunchalarini tushunasiz',
      'Bilimni mashqlar orqali mustahkamlaysiz',
      'Xatolarni topib to‘g‘rilashni o‘rganasiz',
      'Mavzuni mustaqil qo‘llay olasiz',
    ],
  },
  ru: {
    sections: ['Прочная основа', 'Практический навык', 'Глубокое мастерство'],
    sectionGoal: [
      'освоите ключевые понятия темы простым языком',
      'закрепите знания упражнениями и разберёте ошибки',
      'выйдете на уровень самостоятельного применения темы',
    ],
    lessonKinds: ['Первые принципы', 'Базовые механизмы', 'Практика и синтез'],
    hook: (topic: string, kind: string) =>
      `Если в теме «${topic}» нарушить принцип «${kind}», в каком месте откажет вся система?`,
    meaning: (topic: string, _kind: string) =>
      `Этот шаг соединяет теорию с практикой в теме ${topic}. С ним вы учитесь принимать взвешенные решения без перегрузки.`,
    objective: (topic: string, kind: string) =>
      `Понять принцип «${kind}» в контексте ${topic} и научиться применять его на практике.`,
    likelyConfusion: (topic: string, _kind: string) =>
      `Многие считают, что ${topic} требует механического заучивания, забывая про базовые ментальные модели.`,
    tldr: (topic: string, kind: string) =>
      `Урок «${kind}» по теме ${topic}: 3 главные идеи за 3 минуты, затем проверка упражнениями.`,
    page1Heading: 'Почему это важно?',
    page1: (topic: string) =>
      `**Первые принципы** — Освоение темы ${topic} начинается с отсечения шума и выделения [[базовых аксиом|Исходные положения, не требующие доказательств]].\n\n` +
      `**Когнитивный баланс** — Мозг усваивает систему небольшими частями, понимая компромиссы и реальные ограничения.`,
    visualHeading: 'Рецепт усвоения',
    visualItems: [
      { label: 'Малые шаги', value: 85 },
      { label: 'Повторение', value: 70 },
      { label: 'Практика', value: 60 },
      { label: 'Отдых', value: 40 },
    ],
    page3Heading: 'Практическое применение',
    page3: (topic: string) =>
      `**Активное воспоминание** — Проверив понимание через [[активное извлечение|Воспроизведение материала по памяти без подсказок]], вы закрепляете нейронные связи.\n\n` +
      `**Разбор ошибок** — Любая неточность при изучении темы ${topic} указывает на точку будущего роста.`,
    mcqPrompt: (topic: string) => `Какой способ эффективнее для изучения темы ${topic}?`,
    mcqOptions: ['Выучить всё за день', 'Малые шаги + повторение', 'Только смотреть видео', 'Учить в день экзамена'],
    clozePrompt: 'Заполните пропуски',
    clozeTemplate: 'Прочные знания строятся {{c1}} и сохраняются {{c2}}.',
    clozeBlanks: [{ id: 'c1', answer: 'малыми шагами' }, { id: 'c2', answer: 'повторением' }],
    clozePool: ['повторением', 'малыми шагами', 'спешкой', 'зубрёжкой'],
    orderPrompt: 'Расставьте этапы эффективного обучения по порядку',
    orderSteps: ['Определите цель', 'Разбейте на шаги', 'Практикуйтесь', 'Повторяйте'],
    flashPrompt: 'Главная идея сегодняшнего урока?',
    flashAnswer: 'Малые шаги + повторение = прочные знания.',
    cards: [
      { title: 'Золотое правило', body: 'Каждый день понемногу — но каждый день. Регулярность сильнее интенсивности.' },
      { title: 'Ошибка — урок', body: 'Запишите место ошибки: это начало списка для следующего повторения.' },
    ],
    outcomes: [
      'Поймёте ключевые понятия темы {topic}',
      'Закрепите знания упражнениями',
      'Научитесь находить и исправлять ошибки',
      'Сможете применять тему самостоятельно',
    ],
  },
} satisfies Record<Lang, unknown>

function pick<T>(arr: readonly T[], seed: number, salt: number): T {
  return arr[(seed + salt) % arr.length]
}

export function buildCourseOutline(input: AiCourseCreateInput): AiCoursePayload {
  const lang: Lang = input.language === 'ru' ? 'ru' : 'uz'
  const t = T[lang]
  const seed = hashStr(`${lang}:${input.topic.toLowerCase()}`)
  // Sarlavhalarda xom gap emas, tozalangan mavzu (uzun buyruq gaplar qisqaradi)
  const topic = cleanTopicForTitle(input.topic)

  const sections = []
  for (let s = 0; s < AI_COURSE_MOCK_SECTIONS; s++) {
    const lessons = []
    for (let l = 0; l < AI_COURSE_MOCK_LESSONS_PER_SECTION; l++) {
      const lessonId = `s${s + 1}-l${l + 1}`
      const kind = t.lessonKinds[l % t.lessonKinds.length]
      const mcqCorrect = (seed + s + l) % t.mcqOptions.length

      const practices: AiCoursePractice[] = [
        {
          kind: 'mcq',
          id: `${lessonId}-mcq`,
          prompt: t.mcqPrompt(topic),
          options: t.mcqOptions.map((text, i) => ({ id: `o${i + 1}`, text })),
          correctOptionId: `o${mcqCorrect + 1}`,
        },
        {
          kind: 'cloze',
          id: `${lessonId}-cloze`,
          prompt: t.clozePrompt,
          template: t.clozeTemplate,
          blanks: t.clozeBlanks.map((b) => ({ ...b })),
          pool: [...t.clozePool],
        },
        // Har 2-darsda flashcard o'rniga tartiblash (tiplar almashadi)
        ...((s + l) % 2 === 0
          ? [{
            kind: 'flashcard' as const,
            id: `${lessonId}-flash`,
            prompt: t.flashPrompt,
            answer: t.flashAnswer,
          }]
          : [{
            kind: 'order' as const,
            id: `${lessonId}-order`,
            prompt: t.orderPrompt,
            steps: t.orderSteps.map((text, i) => ({ id: `st${i + 1}`, text })),
          }]),
      ]

      lessons.push({
        id: lessonId,
        ord: l,
        // QISQA dars nomi (mavzu takrorlanmaydi — kurs sarlavhasida bor)
        title: kind,
        tldr: t.tldr(topic, kind),
        hook: t.hook(topic, kind),
        meaning: t.meaning(topic, kind),
        objective: t.objective(topic, kind),
        likelyConfusion: t.likelyConfusion(topic, kind),
        pages: [
          { kind: 'text' as const, heading: t.page1Heading, body: t.page1(topic) },
          {
            kind: 'visual' as const,
            style: pick(['bar-chart', 'pie-chart', 'cycle'] as const, seed, s * 3 + l),
            heading: t.visualHeading,
            items: t.visualItems.map((it) => ({ ...it })),
          },
          { kind: 'text' as const, heading: t.page3Heading, body: t.page3(topic) },
        ],
        practices,
        knowledgeCards: t.cards.map((c, i) => ({ id: `${lessonId}-k${i + 1}`, ...c })),
      })
    }
    sections.push({
      id: `sec-${s + 1}`,
      ord: s,
      // QISQA nom (Wondering pattern: "Foundations", mavzu takrorlanmaydi —
      // mavzu kurs sarlavhasi + matnlarda baribir bor)
      title: `${s + 1}. ${t.sections[s % t.sections.length]}`,
      goal: t.sectionGoal[s % t.sectionGoal.length],
      lessons,
    })
  }

  // Sxemada `goal` yo'q — tozalaymiz (ichki meta edi)
  const payload = {
    version: 1 as const,
    outcomes: t.outcomes.map((o) => o.replace('{topic}', topic)),
    sections: sections.map(({ goal: _g, ...s }) => s),
  }
  const parsed = AiCoursePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`mock outline sxemadan o'tmadi: ${parsed.error.issues[0]?.message}`)
  }
  return parsed.data
}
