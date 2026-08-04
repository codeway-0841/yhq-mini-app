import 'dotenv/config'
import { db } from './db/connection'
import { topics, questions } from './schema'
import data from '../300_savol_javob_rasmlar/300_savol_javob.json' assert { type: 'json' }

interface RawQuestion {
  id: number
  question_uz: string
  question_ru: string
  options_uz: Record<string, string>
  options_ru: Record<string, string>
  correct_answer: string
  image: string | null
}

const TOPIC_DEFS = [
  {
    slug: 'chorrahalar',
    nameUz: 'Chorrahalar va ustuvorlik',
    nameRu: 'Перекрёстки и приоритет',
    kwUz: ['chorrah', 'kesib o\'t', 'ustuvorlik', 'asosiy yo\'l', 'tartibga solinmagan', 'tartibga solingan', 'birinchi bo\'lib', 'ikkinchi bo\'lib', 'uchinchi bo\'lib', 'oxirgi bo\'lib', 'nechanchi bo\'lib'],
    kwRu: ['перекрёсток', 'перекресток', 'проедет перекресток', 'главная дорога', 'приоритет', 'регулируемый', 'нерегулируемый'],
  },
  {
    slug: 'yol-belgilari',
    nameUz: 'Yo\'l belgilari',
    nameRu: 'Дорожные знаки',
    kwUz: ['yo\'l belgi', 'ko\'rsatilgan belgi', 'qo\'shimcha-axborot', 'tablichka', 'belgi talabi', 'belgilar'],
    kwRu: ['дорожный знак', 'знаки', 'табличка', 'требования каких знак'],
  },
  {
    slug: 'yol-chiziqlari',
    nameUz: 'Yo\'l chiziqlari va belgilash',
    nameRu: 'Дорожная разметка',
    kwUz: ['chiziq', 'yo\'l chiziqlari', 'ajratuvchi chiziq', 'belgilash', 'uchburchak shaklidagi chiziq', 'qatnov qismi yo\'l chiziqlari'],
    kwRu: ['разметка', 'линия разметки', 'разделительная', 'треугольник', 'полосы движения'],
  },
  {
    slug: 'tezlik',
    nameUz: 'Tezlik tartibga solish',
    nameRu: 'Скоростной режим',
    kwUz: ['tezlik', 'km/soat', 'tezligi soatiga', 'maksimal tezlik', 'ruxsat etilgan tezlik', 'tezlikda harakat'],
    kwRu: ['скорость', 'км/ч', 'скоростн', 'максимальн', 'разрешенная скорост'],
  },
  {
    slug: 'toxtatish-va-turish',
    nameUz: 'To\'xtatish va to\'xtab turish',
    nameRu: 'Остановка и стоянка',
    kwUz: ['to\'xtash', 'to\'xtab turish', 'to\'xtalish', 'to\'xtatish taqiqlanadi', 'maydoncha', 'piyodalar o\'tish joyi oldida'],
    kwRu: ['остановк', 'стоянк', 'стоять запрещ', 'площадк'],
  },
  {
    slug: 'quvib-otish',
    nameUz: 'Quvib o\'tish va o\'tib ketish',
    nameRu: 'Обгон и опережение',
    kwUz: ['quvib o\'t', 'qayta qurilish', 'bo\'lakni o\'zgartirish', 'quvib o\'tishga', 'quvib o\'tish taqiqlanadi'],
    kwRu: ['обгон', 'обогнать', 'перестро', 'опережение', 'обгон запрещ'],
  },
  {
    slug: 'temir-yol',
    nameUz: 'Temir yo\'l kesishmalari',
    nameRu: 'Железнодорожные переезды',
    kwUz: ['temir yo\'l', 'shlagbaum', 'рельс'],
    kwRu: ['железнодорожн', 'переезд', 'шлагбаум'],
  },
  {
    slug: 'piyodalar',
    nameUz: 'Piyodalar va velosipedchilar',
    nameRu: 'Пешеходы и велосипедисты',
    kwUz: ['piyoda', 'velosip', 'bolalar guruh', 'trotuar', 'piyodalar o\'tish', 'yashash hududi'],
    kwRu: ['пешеход', 'велосипед', 'дети', 'тротуар', 'пешеходный переход', 'жилой зон'],
  },
  {
    slug: 'yoritish',
    nameUz: 'Yoritish vositalari',
    nameRu: 'Световые приборы',
    kwUz: ['chiroq', 'fara', 'yoritish', 'gabarit chiroq', 'tumanli', 'old chiroq', 'orqa chiroq'],
    kwRu: ['фар', 'огни', 'освещен', 'световой', 'туман', 'габаритн', 'фарах'],
  },
  {
    slug: 'yolovchi-tashish',
    nameUz: 'Yo\'lovchi tashish',
    nameRu: 'Перевозка пассажиров',
    kwUz: ['yo\'lovchi tash', 'yo\'nalishli transport', 'marshrutli', 'avtobus bekat'],
    kwRu: ['перевозк пассажир', 'маршрутн транспорт', 'маршрутных транспортн'],
  },
  {
    slug: 'yuk-tashish',
    nameUz: 'Yuk tashish',
    nameRu: 'Перевозка грузов',
    kwUz: ['yuk tash', 'yuk avtomobil', 'tormoz yo\'li tormoz tizimiga ega bo\'lmagan tirkama', 'yuk ortish', 'ortiq yuk'],
    kwRu: ['перевозк груз', 'перевозки грузов', 'прицеп', 'грузовых автомобил'],
  },
  {
    slug: 'shatakka-olish',
    nameUz: 'Shatakka olish',
    nameRu: 'Буксировка',
    kwUz: ['shatak', 'egiluvchan ulagich', 'qattiq ulagich'],
    kwRu: ['буксировк', 'буксир', 'сцепк', 'гибкой сцепке'],
  },
  {
    slug: 'birinchi-tibbiy-yordam',
    nameUz: 'Birinchi tibbiy yordam',
    nameRu: 'Первая медицинская помощь',
    kwUz: ['tibbiy yordam', 'reanimatsiya', 'sinish', 'jabrlanuvchi', 'aptechka', 'yurak-o\'pka', 'tibbiyot qutich', 'bog\'lash', 'nafas'],
    kwRu: ['первая помощ', 'реанимаци', 'перелом', 'пострадавш', 'аптечк', 'сердечно-лёгочн', 'дыхан'],
  },
  {
    slug: 'texnik-holat',
    nameUz: 'Texnik holat va jihozlar',
    nameRu: 'Техническое состояние',
    kwUz: ['nosoz tormoz', 'texnik tavsifnoma', 'o\'t o\'chirgich', 'ogohlantiruvchi qurilma', 'tirgak', 'jihozlanmagan'],
    kwRu: ['технич характеристик', 'тормоз', 'неисправн', 'огнетушител', 'знак аварийн', 'противооткатн'],
  },
  {
    slug: 'avtomagistral',
    nameUz: 'Avtomagistral',
    nameRu: 'Автомагистраль',
    kwUz: ['avtomagistral'],
    kwRu: ['автомагистрал'],
  },
  {
    slug: 'manyovr',
    nameUz: 'Manyovrlar (burilish, orqaga yurish)',
    nameRu: 'Манёвры (поворот, разворот)',
    kwUz: ['burilish', 'orqaga yurish', 'manyovr', 'o\'ng buril', 'chap buril', 'qaytish'],
    kwRu: ['поворот', 'разворот', 'манёвр', 'задни', 'развернуть'],
  },
  {
    slug: 'signallar',
    nameUz: 'Signal va ko\'rsatkichlar',
    nameRu: 'Сигналы и указатели',
    kwUz: ['tovushli signal', 'ko\'rsatkich signal', 'ishorat', 'signal ber'],
    kwRu: ['звуковой сигнал', 'указатель поворота', 'жест регулировщик'],
  },
  {
    slug: 'haydovchi-majburiyatlari',
    nameUz: 'Haydovchi majburiyatlari',
    nameRu: 'Обязанности водителя',
    kwUz: ['haydovchi majburiyat', 'guvohnoma', 'hujjat taqdim', 'ruxsat etilmaydi haydovch'],
    kwRu: ['обязанност водител', 'удостоверен', 'документ', 'водитель обязан'],
  },
  {
    slug: 'sirpanchiq-yol',
    nameUz: 'Sirpanchiq yo\'l va qiyin sharoit',
    nameRu: 'Скользкая дорога и сложные условия',
    kwUz: ['sirpanchiq', 'muzlab', 'qor', 'yomg\'ir', 'ko\'rinish yomonlashganda'],
    kwRu: ['скользк', 'гололед', 'снег', 'дождь', 'видимост'],
  },
]

function detectTopicSlug(q: RawQuestion): string {
  const textUz = (q.question_uz + ' ' + Object.values(q.options_uz).join(' ')).toLowerCase()
  const textRu = (q.question_ru + ' ' + Object.values(q.options_ru).join(' ')).toLowerCase()

  for (const topic of TOPIC_DEFS) {
    if (
      topic.kwUz.some(kw => textUz.includes(kw.toLowerCase())) ||
      topic.kwRu.some(kw => textRu.includes(kw.toLowerCase()))
    ) {
      return topic.slug
    }
  }
  return 'umumiy'
}

const raw = data as RawQuestion[]

// Insert topics
const allTopicDefs = [
  ...TOPIC_DEFS,
  { slug: 'umumiy', nameUz: 'Umumiy', nameRu: 'Общие' },
]

await db
  .insert(topics)
  .values(allTopicDefs.map(t => ({ nameUz: t.nameUz, nameRu: t.nameRu, slug: t.slug })))
  .onConflictDoNothing()

const allTopics = await db.select().from(topics)
const slugToId = Object.fromEntries(allTopics.map(t => [t.slug, t.id]))

// Stats
const topicCounts: Record<string, number> = {}

// ── Sanitetsiya: noto'g'ri savollar (to'g'ri javob variantlar orasida yo'q,
//    yoki UZ/RU variant kalitlari mos kelmasa) seed'ga KIRITILMAYDI ──
//    Bunday savollar ilovada JAVOBSIZ bo'lib qolardi (xatoni tuzatib ham bo'lmas).
const invalid: number[] = []
const rows = raw.flatMap(q => {
  const uzKeys = Object.keys(q.options_uz ?? {})
  const ruKeys = Object.keys(q.options_ru ?? {})
  const bad =
    uzKeys.length === 0 ||
    !uzKeys.includes(q.correct_answer) ||
    uzKeys.length !== ruKeys.length ||
    !uzKeys.every((k) => ruKeys.includes(k))
  if (bad) {
    invalid.push(q.id)
    return []                                        // SKIP — DB'ga kiritilmaydi
  }
  const slug = detectTopicSlug(q)
  topicCounts[slug] = (topicCounts[slug] ?? 0) + 1
  return [{
    id:            q.id,
    questionUz:    q.question_uz,
    questionRu:    q.question_ru,
    optionsUz:     q.options_uz,
    optionsRu:     q.options_ru,
    correctAnswer: q.correct_answer,
    image:         q.image ?? null,
    topicId:       slugToId[slug] ?? null,
  }]
})

if (invalid.length > 0) {
  console.warn(`⚠️  ${invalid.length} ta buzilgan savol O'TKAZIB YUBORILDI: ${invalid.join(', ')}`)
}

if (rows.length > 0) await db.insert(questions).values(rows).onConflictDoNothing()

console.log(`Seeded ${rows.length} questions into ${Object.keys(topicCounts).length} topics:`)
Object.entries(topicCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([slug, count]) => console.log(`  ${slug}: ${count}`))

process.exit(0)
