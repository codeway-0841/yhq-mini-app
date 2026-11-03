import {
  RUSADABIYOT_BLOCKS,
  loadRusadabiyotBlock,
} from '../../content/darslik-rusadabiyot'
import {
  parseMarkdown,
  extractSectionBlocks,
  type MdBlock,
  type QuizQuestion,
} from '../darslik-rustili/markdown'

export interface BrilliantSlideIntro {
  type: 'intro'
  title: string
  subtitle?: string
  text: string
  badge?: string
  authorImg?: string
  authorName?: string
  authorYears?: string
}

export interface BrilliantSlideVisual {
  type: 'visual'
  title?: string
  image: string
  imageAlt?: string
  caption: string
  text: string
  bullets?: string[]
}

export interface BrilliantSlideQuiz {
  type: 'quiz'
  image?: string
  imageCaption?: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface BrilliantSlideTrap {
  type: 'trap'
  title: string
  trapText: string
  solutionText: string
}

export interface BrilliantSlideMatch {
  type: 'match'
  title: string
  prompt: string
  pairs: { left: string; right: string }[]
}

export type BrilliantSlide =
  | BrilliantSlideIntro
  | BrilliantSlideVisual
  | BrilliantSlideQuiz
  | BrilliantSlideTrap
  | BrilliantSlideMatch

export interface BrilliantLesson {
  id: string
  blockId: number
  topicIndex: number
  title: string
  titleUz: string
  eraTitle: string
  eraIcon: string
  estimatedMinutes: number
  slides: BrilliantSlide[]
}

/**
  * Har bir muallif nomi uchun portret xaritasi.
  */
export const AUTHOR_PORTRAITS: Record<string, string> = {
  пушкин: '/images/authors/pushkin.jpg',
  лермонтов: '/images/authors/lermontov.jpg',
  гоголь: '/images/authors/gogol.jpg',
  толстой: '/images/authors/tolstoy.jpg',
  достоевский: '/images/authors/dostoevsky.jpg',
  чехов: '/images/authors/chekhov.jpg',
  тургенев: '/images/authors/turgenev.jpg',
  фонвизин: '/images/authors/fonvizin.jpg',
  ломоносов: '/images/authors/lomonosov.jpg',
  державин: '/images/authors/derzhavin.jpg',
  карамзин: '/images/authors/karamzin.jpg',
  жуковский: '/images/authors/zhukovsky.jpg',
  грибоедов: '/images/authors/griboyedov.jpg',
  блок: '/images/authors/blok.jpg',
  ахматова: '/images/authors/akhmatova.jpg',
  маяковский: '/images/authors/mayakovsky.jpg',
  есенин: '/images/authors/esenin.jpg',
  цветаева: '/images/authors/tsvetaeva.jpg',
  горький: '/images/authors/gorky.jpg',
  бунин: '/images/authors/bunin.jpg',
  мандельштам: '/images/authors/mandelshtam.jpg',
  булгаков: '/images/authors/bulgakov.jpg',
  шолохов: '/images/authors/sholokhov.jpg',
  пастернак: '/images/authors/pasternak.jpg',
  платонов: '/images/authors/platonov.jpg',
  солженицын: '/images/authors/solzhenitsyn.jpg',
  некрасов: '/images/authors/nekrasov.jpg',
  островский: '/images/authors/ostrovsky.jpg',
  гончаров: '/images/authors/goncharov.jpg',
  тютчев: '/images/authors/tyutchev.jpg',
  фет: '/images/authors/fet.jpg',
  домострой: '/images/authors/domostroy.jpg',
  слово: '/images/authors/slovo-o-polku.jpg',
}

export function findAuthorPortrait(text: string): { name: string; img: string } | null {
  const lower = text.toLowerCase()
  for (const [key, img] of Object.entries(AUTHOR_PORTRAITS)) {
    if (lower.includes(key)) {
      const capName = key.charAt(0).toUpperCase() + key.slice(1)
      return { name: capName, img }
    }
  }
  return null
}

/**
 * 1-blok: "Теория литературы и литературные направления" uchun maxsus
 * Brilliant formatidagi boyitilgan namunaviy darslar to'plami.
 */
export const CURATED_BRILLIANT_LESSONS: Record<string, BrilliantLesson> = {
  // 1-blok, 1-mavzu: Основные литературные направления (Классицизм, Сентиментализм, Романтизм, Реализм)
  '1:1': {
    id: 'rusadabiyot-1-1',
    blockId: 1,
    topicIndex: 1,
    title: 'Основные литературные направления',
    titleUz: 'Asosiy adabiy yo‘nalishlar: Klassitsizm, Romantizm, Realizm',
    eraTitle: 'Теория литературы',
    eraIcon: '📐',
    estimatedMinutes: 4,
    slides: [
      {
        type: 'intro',
        title: 'Что такое литературное направление?',
        subtitle: 'Основа анализа любого художественного произведения',
        badge: 'ТЕОРИЯ ЛИТЕРАТУРЫ',
        text: 'Литературное направление — это **общность писателей**, объединённых сходными взглядами на мир, пониманием человека и общими художественными принципами.\n\nКаждая эпоха рождала своё направление: в XVIII веке царил **классицизм**, на смену ему пришёл чувствительный **сентиментализм**, затем бунтующий **романтизм**, а в XIX веке расцвёл глубокий психологический **реализм**.',
      },
      {
        type: 'visual',
        title: 'Классицизм: Триумф Разума и Долга',
        image: '/images/authors/lomonosov.jpg',
        imageAlt: 'М. В. Ломоносов',
        caption: 'М. В. Ломоносов — великий учёный и поэт, создатель русской теории классицизма и «Теории трёх штилей».',
        text: 'В классицизме **разум и государственный долг** ставятся выше личных чувств. Герой обязан пожертвовать страстью ради долга.\n\nВ драматургии классицизма действовало строгое **«правило трёх единств»**:',
        bullets: [
          'Единство времени: действие укладывается в одни сутки (24 часа).',
          'Единство места: все события происходят в одном пространстве (в одном доме, комнате).',
          'Единство действия: одна сюжетная линия, без побочных ответвлений.',
        ],
      },
      {
        type: 'quiz',
        image: '/images/authors/fonvizin.jpg',
        imageCaption: 'Д. И. Фонвизин — автор бессмертной комедии классицизма «Недоросль».',
        question: 'Какое из перечисленных правил является главным требованием драматургии классицизма?',
        options: [
          'Правило трёх единств: времени, места и действия',
          'Полная свобода композиции и смешение стилей',
          'Исключительный герой в таинственных обстоятельствах',
          'Изображение подсознания и мистических снов',
        ],
        correctIndex: 0,
        explanation: 'Именно правило трёх единств (время, место, действие) было обязательным каноном классицизма. Герои говорят высоким стилем, а действие происходит в одни сутки в одном месте.',
      },
      {
        type: 'visual',
        title: 'Романтизм: Бунт и Двоемирие',
        image: '/images/authors/lermontov.jpg',
        imageAlt: 'М. Ю. Лермонтов',
        caption: 'М. Ю. Лермонтов — ярчайший представитель русского романтизма (поэмы «Мцыри», «Демон»).',
        text: 'Романтизм отверг холодный культ разума. Главная идея романтизма — **конфликт гордой личности с окружающим миром**.\n\nХарактерные черты романтизма:',
        bullets: [
          'Исключительный герой в исключительных обстоятельствах (бунтарь, одиночка, изгнанник).',
          'Двоемирие: трагический разрыв между идеальной мечтой и серой реальностью.',
          'Бурные стихии природы (горы, гроза, море), отражающие душевную бурю героя.',
        ],
      },
      {
        type: 'trap',
        title: '⚠️ Экзаменационная ловушка аттестации',
        trapText: 'В тестах часто спрашивают: «Какое направление утверждает типичные характеры в типичных обстоятельствах?» Многие путают романтизм и реализм.',
        solutionText: 'Запомните: исключительный герой в исключительных обстоятельствах — это РОМАНТИЗМ. А типичные характеры в типичных обстоятельствах — это РЕАЛИЗМ (Пушкин, Толстой, Чехов)!',
      },
      {
        type: 'quiz',
        image: '/images/authors/pushkin.jpg',
        imageCaption: 'А. С. Пушкин в зрелый период преодолел романтизм и создал основы русского реализма.',
        question: 'К какому направлению относится знаменитая формула: «Типичные характеры в типичных обстоятельствах»?',
        options: [
          'Реализм',
          'Классицизм',
          'Сентиментализм',
          'Футуризм',
        ],
        correctIndex: 0,
        explanation: 'Это классическая формула РЕАЛИЗМА. Реализм стремится к жизненной достоверности и показывает, как общество и социальная среда формируют характер человека.',
      },
    ],
  },

  // 1-blok, 2-mavzu: Течения модернизма (Символизм, Акмеизм, Футуризм)
  '1:2': {
    id: 'rusadabiyot-1-2',
    blockId: 1,
    topicIndex: 2,
    title: 'Течения модернизма: как не перепутать',
    titleUz: 'Modernizm oqimlari: Simvolizm, Akmeizm va Futurizm',
    eraTitle: 'Серебряный век',
    eraIcon: '🌙',
    estimatedMinutes: 5,
    slides: [
      {
        type: 'intro',
        title: 'Модернизм начала XX века',
        subtitle: 'Эпоха смелых экспериментов и Серебряного века',
        badge: 'СЕРЕБРЯНЫЙ ВЕК',
        text: 'На рубеже XIX и XX веков классический реализм уступил место **модернизму** — поиску принципиально новых форм отражения душевного мира человека.\n\nВ русской поэзии Серебряного века модернизм разделился на **три главных течения**: символизм, акмеизм и футуризм. В тестах их путать нельзя ни в коем случае!',
      },
      {
        type: 'visual',
        title: '1. Символизм: Тайна и Непознаваемое',
        image: '/images/authors/blok.jpg',
        imageAlt: 'Александр Блок',
        caption: 'Александр Блок — главный поэт русского символизма (стихотворение «Незнакомка», цикл «Стихи о Прекрасной Даме»).',
        text: 'Для символистов видимый мир — лишь слабая тень высшего, духовного мира. Слово должно быть не описанием, а **многозначным символом**.\n\nКлючи символизма:',
        bullets: [
          'Тайна, мистика, второй скрытый смысл за каждым образом.',
          'Музыкальность стиха: звук важнее предметного значения слова.',
          'Представители: А. Блок, В. Брюсов, К. Бальмонт, А. Белый.',
        ],
      },
      {
        type: 'visual',
        title: '2. Акмеизм: Возвращение к Земле и Вещам',
        image: '/images/authors/akhmatova.jpg',
        imageAlt: 'Анна Ахматова',
        caption: 'Анна Ахматова и Николай Гумилёв — основатели акмеизма («Цех поэтов»).',
        text: 'Акмеисты взбунтовались против туманной мистики символистов. Они провозгласили: **«Хватит тумана, вернём словам их точный вес и земную красоту!»**\n\nКлючи акмеизма:',
        bullets: [
          'Ясность, точность, предметность художественного образа.',
          'Любовь к осязаемым вещам, конкретным деталям и честному слову.',
          'Представители: Н. Гумилёв, А. Ахматова, О. Мандельштам.',
        ],
      },
      {
        type: 'quiz',
        image: '/images/authors/blok.jpg',
        imageCaption: '«Дыша духами и туманами, она садится у окна...»',
        question: 'Какое литературное течение провозгласило символ главным средством постижения тайны бытия?',
        options: [
          'Символизм',
          'Акмеизм',
          'Футуризм',
          'Классицизм',
        ],
        correctIndex: 0,
        explanation: 'Символизм! Символисты утверждали, что за видимой реальностью скрывается непознаваемый духовный мир, а символ — единственный мост к нему.',
      },
      {
        type: 'visual',
        title: '3. Футуризм: Бунт и Искусство Будущего',
        image: '/images/authors/mayakovsky.jpg',
        imageAlt: 'Владимир Маяковский',
        caption: 'Владимир Маяковский — вождь футуристов («Пощёчина общественному вкусу», лесенка, неологизмы).',
        text: 'Футуристы призвали «сбросить классиков с парохода современности». Они хотели сокрушить старый язык и создать **язык будущего**.\n\nКлючи футуризма:',
        bullets: [
          'Словотворчество: изобретение новых слов (неологизмов).',
          'Резкая городская лексика, энергия митингов, разрушение традиционной рифмы и ритма.',
          'Представители: В. Маяковский, В. Хлебников, Д. Бурлюк.',
        ],
      },
      {
        type: 'quiz',
        image: '/images/authors/akhmatova.jpg',
        imageCaption: '«Я научилась просто, мудро жить...»',
        question: 'К какому течению относились Анна Ахматова и Николай Гумилёв, выступавшие за точность и предметность слова?',
        options: [
          'Акмеизм',
          'Символизм',
          'Футуризм',
          'Имажинизм',
        ],
        correctIndex: 0,
        explanation: 'Верно! Ахматова, Гумилёв и Мандельштам — ярчайшие акмеисты. Их лозунг — предметность, осязаемость и ясность поэтического слова.',
      },
    ],
  },
}

/**
 * Agar mavzu uchun oldindan tayyorlangan dars bo'lmasa,
 * blokning markdown manbasidan Brilliant slaydlarini dinamik quradi.
 */
export async function buildBrilliantLessonFromMarkdown(
  blockId: number,
  topicIndex: number,
  topicTitle: string,
): Promise<BrilliantLesson> {
  const cacheKey = `${blockId}:${topicIndex}`
  if (CURATED_BRILLIANT_LESSONS[cacheKey]) {
    return CURATED_BRILLIANT_LESSONS[cacheKey]
  }

  const blockMeta = RUSADABIYOT_BLOCKS.find((b) => b.id === blockId)
  const eraTitle = blockMeta?.titleRu ?? `Эпоха ${blockId}`
  const eraIcon = blockMeta?.icon ?? '📚'

  let blocks: MdBlock[] = []
  try {
    const raw = await loadRusadabiyotBlock(blockId)
    const allParsed = parseMarkdown(raw)
    blocks = extractSectionBlocks(allParsed, topicIndex)
  } catch (err) {
    console.warn('Failed to load markdown for brilliant lesson:', err)
  }

  const slides: BrilliantSlide[] = []

  // 1-slayd: Kirish (Intro)
  const introParagraphs = blocks
    .filter((b) => b.kind === 'paragraph')
    .slice(0, 2)
    .map((b) => (b as { lines: string[] }).lines.join('\n'))

  const firstIntroText = introParagraphs.join('\n\n') || `Изучаем тему: ${topicTitle}. Важнейшие понятия, исторический контекст и тестовые ловушки.`

  // Portret qidirish
  const portrait = findAuthorPortrait(topicTitle + ' ' + firstIntroText)

  slides.push({
    type: 'intro',
    title: topicTitle,
    subtitle: eraTitle,
    badge: `ЭПОХА ${blockId}`,
    text: firstIntroText,
    authorImg: portrait?.img,
    authorName: portrait?.name,
  })

  // Ro'yxatlar yoki jadvallar bo'lsa: Visual slayd yasash
  const lists = blocks.filter((b) => b.kind === 'list')
  if (lists.length > 0) {
    const firstList = lists[0] as { items: { text: string }[] }
    slides.push({
      type: 'visual',
      title: 'Ключевые признаки и правила',
      image: portrait?.img ?? '/brilliant/courses/path-icon-01.png',
      imageAlt: topicTitle,
      caption: portrait ? `Портрет автора: ${portrait.name}` : `Тематический разбор: ${topicTitle}`,
      text: 'Обратите внимание на главные характеристики, которые чаще всего встречаются в тестовых заданиях:',
      bullets: firstList.items.slice(0, 5).map((it) => it.text),
    })
  }

  // Quiz savollari bo'lsa: Quiz slaydlar yasash
  const quizBlocks = blocks.filter((b) => b.kind === 'quiz')
  const foundQuizzes: QuizQuestion[] = []
  for (const qb of quizBlocks) {
    if (qb.kind === 'quiz') foundQuizzes.push(...qb.questions)
  }

  if (foundQuizzes.length > 0) {
    // 1-2 ta eng yaxshi savolni interaktiv slaydga aylantiramiz
    for (const q of foundQuizzes.slice(0, 2)) {
      slides.push({
        type: 'quiz',
        image: portrait?.img,
        imageCaption: portrait ? `Контрольный вопрос по эпохе ${portrait.name}` : undefined,
        question: q.q,
        options: q.o,
        correctIndex: q.a,
        explanation: q.e ?? 'Правильный ответ подтверждён теорией русской литературы и академическим каноном.',
      })
    }
  } else {
    // Standart interaktiv tushunish savoli
    slides.push({
      type: 'quiz',
      image: portrait?.img,
      question: `Какова главная цель изучения темы «${topicTitle}»?`,
      options: [
        'Понять художественную систему эпохи и уметь узнавать её признаки в тестах',
        'Механически заучить даты без понимания смысла произведений',
        'Ограничиться чтением кратких содержаний',
        'Игнорировать исторический и культурный контекст',
      ],
      correctIndex: 0,
      explanation: 'Глубокий анализ художественного мира автора и понимание эпохи — ключ к успешной сдаче аттестации и экзаменов.',
    })
  }

  // Trap / Tavsiya slaydi
  slides.push({
    type: 'trap',
    title: '💡 Совет для аттестации',
    trapText: `При анализе темы «${topicTitle}» не путайте авторскую позицию с высказываниями его персонажей.`,
    solutionText: 'Всегда сопоставляйте произведение с его литературным направлением и эпохой, в которой жил автор.',
  })

  return {
    id: `rusadabiyot-${blockId}-${topicIndex}`,
    blockId,
    topicIndex,
    title: topicTitle,
    titleUz: blockMeta?.titleUz ?? topicTitle,
    eraTitle,
    eraIcon,
    estimatedMinutes: Math.max(3, Math.min(8, Math.round(slides.length * 1.5))),
    slides,
  }
}
