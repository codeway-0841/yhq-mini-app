import 'dotenv/config'
// Prod xavfsizligi (audit B3): seed kontentni UPSERT qiladi (prod'dagi
// correctAnswer'larni lokaldagi eski JSON bilan qayta yozishi mumkin) —
// prod DB'da FAQAT aniq --yes bayrog'i bilan ishlaydi.
if (process.env.NODE_ENV === 'production' && !process.argv.includes('--yes')) {
  console.error("DIQQAT: NODE_ENV=production — seed prod DB'ga YOZADI. Davom etish uchun: --yes")
  process.exit(1)
}
import { sql } from 'drizzle-orm'
import { db } from './db/connection'
import { questionBanks, topics, questions, questionExplanations } from './schema'
import lotinData from '../content/yhq/savollar_lotin.json' assert { type: 'json' }
import rusData from '../content/yhq/savollar_rus.json' assert { type: 'json' }

interface YhqQuestion {
  id: number
  ticket_id: number
  sort: number
  question: string
  photo: string
  answers: string[]
  correct: number
  description: string
  extra?: { msg?: number }
}

const TOPIC_DEFS = [
  {
    slug: 'chorrahalar',
    nameUz: 'Chorrahalar va ustuvorlik',
    nameRu: 'Перекрёстки и приоритет',
    kwUz: ['chorrah', 'kesib o\'t', 'ustuvorlik', 'asosiy yo\'l', 'tartibga solinmagan', 'tartibga solingan', 'birinchi bo\'lib', 'ikkinchi bo\'lib', 'uchinchi bo\'lib', 'oxirgi bo\'lib', 'nechanchi bo\'lib', 'harakatlanish ketma-ketligi'],
    kwRu: ['перекрёсток', 'перекресток', 'проедет перекресток', 'главная дорога', 'приоритет', 'регулируемый', 'нерегулируемый', 'очередность проезда'],
  },
  {
    slug: 'yol-belgilari',
    nameUz: 'Yo\'l belgilari',
    nameRu: 'Дорожные знаки',
    kwUz: ['yo\'l belgi', 'ko\'rsatilgan belgi', 'qo\'shimcha-axborot', 'tablichka', 'belgi talabi', 'belgilar', 'ushbu belgi', 'qaysi belgi', 'belgisi nimani', 'belgisi qaysi'],
    kwRu: ['дорожный знак', 'знаки', 'табличка', 'требования каких знак', 'какой знак', 'данный знак', 'этот знак', 'знак информирует'],
  },
  {
    slug: 'yol-chiziqlari',
    nameUz: 'Yo\'l chiziqlari va belgilash',
    nameRu: 'Дорожная разметка',
    kwUz: ['chiziq', 'yo\'l chiziqlari', 'ajratuvchi chiziq', 'belgilash', 'uchburchak shaklidagi chiziq', 'qatnov qismi yo\'l chiziqlari', 'uziq-uziq chiziq', 'yotiq chiziq', 'tik chiziq'],
    kwRu: ['разметка', 'линия разметки', 'разделительная', 'треугольник', 'полосы движения', 'горизонтальная разметка', 'вертикальная разметка', 'прерывистая линия'],
  },
  {
    slug: 'tezlik',
    nameUz: 'Tezlik tartibga solish',
    nameRu: 'Скоростной режим',
    kwUz: ['tezlik', 'km/soat', 'tezligi soatiga', 'maksimal tezlik', 'ruxsat etilgan tezlik', 'tezlikda harakat', 'yuqori tezlik'],
    kwRu: ['скорость', 'км/ч', 'скоростн', 'максимальн', 'разрешенная скорост', 'предельная скорость'],
  },
  {
    slug: 'toxtatish-va-turish',
    nameUz: 'To\'xtatish va to\'xtab turish',
    nameRu: 'Остановка и стоянка',
    kwUz: ['to\'xtash', 'to\'xtab turish', 'to\'xtalish', 'to\'xtatish taqiqlanadi', 'maydoncha', 'piyodalar o\'tish joyi oldida', 'to\'xtashga ruxsat'],
    kwRu: ['остановк', 'стоянк', 'стоять запрещ', 'площадк', 'остановка разрешена', 'стоянка разрешена'],
  },
  {
    slug: 'quvib-otish',
    nameUz: 'Quvib o\'tish va o\'tib ketish',
    nameRu: 'Обгон и опережение',
    kwUz: ['quvib o\'t', 'qayta qurilish', 'bo\'lakni o\'zgartirish', 'quvib o\'tishga', 'quvib o\'tish taqiqlanadi', 'o\'tib ketish'],
    kwRu: ['обгон', 'обогнать', 'перестро', 'опережение', 'обгон запрещ'],
  },
  {
    slug: 'temir-yol',
    nameUz: 'Temir yo\'l kesishmalari',
    nameRu: 'Железнодорожные переезды',
    kwUz: ['temir yo\'l', 'shlagbaum', 'rels', 'pereyezd'],
    kwRu: ['железнодорожн', 'переезд', 'шлагбаум', 'рельс'],
  },
  {
    slug: 'piyodalar',
    nameUz: 'Piyodalar va velosipedchilar',
    nameRu: 'Пешеходы и велосипедисты',
    kwUz: ['piyoda', 'velosip', 'bolalar guruh', 'trotuar', 'piyodalar o\'tish', 'yashash hududi', 'samokat', 'individual harakatlanish'],
    kwRu: ['пешеход', 'велосипед', 'дети', 'тротуар', 'пешеходный переход', 'жилой зон', 'самокат', 'средств индивидуальной'],
  },
  {
    slug: 'yoritish',
    nameUz: 'Yoritish vositalari',
    nameRu: 'Световые приборы',
    kwUz: ['chiroq', 'fara', 'yoritish', 'gabarit chiroq', 'tumanli', 'old chiroq', 'orqa chiroq', 'avariya ishorati', 'kunduzgi chiroq'],
    kwRu: ['фар', 'огни', 'освещен', 'световой', 'туман', 'габаритн', 'фарах', 'аварийная сигнализация', 'дневные ходовые'],
  },
  {
    slug: 'yolovchi-tashish',
    nameUz: 'Yo\'lovchi tashish',
    nameRu: 'Перевозка пассажиров',
    kwUz: ['yo\'lovchi tash', 'yo\'nalishli transport', 'marshrutli', 'avtobus bekat', 'yo\'lovchi'],
    kwRu: ['перевозк пассажир', 'маршрутн транспорт', 'маршрутных транспортн', 'пассажир'],
  },
  {
    slug: 'yuk-tashish',
    nameUz: 'Yuk tashish',
    nameRu: 'Перевозка грузов',
    kwUz: ['yuk tash', 'yuk avtomobil', 'tirkama', 'yuk ortish', 'ortiq yuk', 'og\'ir yuk'],
    kwRu: ['перевозк груз', 'перевозки грузов', 'прицеп', 'грузовых автомобил', 'груз'],
  },
  {
    slug: 'shatakka-olish',
    nameUz: 'Shatakka olish',
    nameRu: 'Буксировка',
    kwUz: ['shatak', 'egiluvchan ulagich', 'qattiq ulagich', 'shatakka olish'],
    kwRu: ['буксировк', 'буксир', 'сцепк', 'гибкой сцепке', 'жесткой сцепке'],
  },
  {
    slug: 'birinchi-tibbiy-yordam',
    nameUz: 'Birinchi tibbiy yordam',
    nameRu: 'Первая медицинская помощь',
    kwUz: ['tibbiy yordam', 'reanimatsiya', 'sinish', 'jabrlanuvchi', 'aptechka', 'yurak-o\'pka', 'tibbiyot qutich', 'bog\'lash', 'nafas', 'qon ketish', 'travma', 'jarohat'],
    kwRu: ['первая помощ', 'реанимаци', 'перелом', 'пострадавш', 'аптечк', 'сердечно-лёгочн', 'дыхан', 'кровотечен', 'травм'],
  },
  {
    slug: 'texnik-holat',
    nameUz: 'Texnik holat va jihozlar',
    nameRu: 'Техническое состояние',
    kwUz: ['nosoz tormoz', 'texnik tavsifnoma', 'o\'t o\'chirgich', 'ogohlantiruvchi qurilma', 'tirgak', 'jihozlanmagan', 'nosozlik', 'protektor', 'rul boshqaruvi', 'shina'],
    kwRu: ['технич характеристик', 'тормоз', 'неисправн', 'огнетушител', 'знак аварийн', 'противооткатн', 'протектор', 'рулевое управлен', 'шин'],
  },
  {
    slug: 'avtomagistral',
    nameUz: 'Avtomagistral',
    nameRu: 'Автомагистраль',
    kwUz: ['avtomagistral', 'avtomagistralda'],
    kwRu: ['автомагистрал', 'на автомагистрали'],
  },
  {
    slug: 'manyovr',
    nameUz: 'Manyovrlar (burilish, orqaga yurish)',
    nameRu: 'Манёвры (поворот, разворот)',
    kwUz: ['burilish', 'orqaga yurish', 'manyovr', 'o\'ng buril', 'chap buril', 'qaytish', 'orqaga harakatlanish'],
    kwRu: ['поворот', 'разворот', 'манёвр', 'задни', 'развернуть', 'движение задним ходом'],
  },
  {
    slug: 'signallar',
    nameUz: 'Signal va ko\'rsatkichlar',
    nameRu: 'Сигналы и указатели',
    kwUz: ['tovushli signal', 'ko\'rsatkich signal', 'ishorat', 'signal ber', 'tartibga soluvchi', 'svetofor'],
    kwRu: ['звуковой сигнал', 'указатель поворота', 'жест регулировщик', 'регулировщик', 'светофор'],
  },
  {
    slug: 'haydovchi-majburiyatlari',
    nameUz: 'Haydovchi majburiyatlari',
    nameRu: 'Обязанности водителя',
    kwUz: ['haydovchi majburiyat', 'guvohnoma', 'hujjat taqdim', 'ruxsat etilmaydi haydovch', 'haydovchi quyidagilarga majbur'],
    kwRu: ['обязанност водител', 'удостоверен', 'документ', 'водитель обязан'],
  },
  {
    slug: 'sirpanchiq-yol',
    nameUz: 'Sirpanchiq yo\'l va qiyin sharoit',
    nameRu: 'Скользкая дорога и сложные условия',
    kwUz: ['sirpanchiq', 'muzlab', 'qor', 'yomg\'ir', 'ko\'rinish yomonlashganda', 'tuman', 'muzlama'],
    kwRu: ['скользк', 'гололед', 'снег', 'дождь', 'видимост', 'туман', 'гололедица'],
  },
]

function detectTopicSlug(qUz: YhqQuestion, qRu: YhqQuestion): string {
  const textUz = (qUz.question + ' ' + (qUz.answers || []).join(' ')).toLowerCase()
  const textRu = (qRu.question + ' ' + (qRu.answers || []).join(' ')).toLowerCase()

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

async function main() {
  console.log('🚀 Starting YHQ Database Seed (1249 Questions & Explanations)...')

  // 1. Ensure question_banks entry exists
  await db
    .insert(questionBanks)
    .values({
      id: 'traffic_rules_db',
      name: "Yo'l harakati qoidalari",
    })
    .onConflictDoNothing()

  // 2. Insert or update topics
  const allTopicDefs = [
    ...TOPIC_DEFS,
    { slug: 'umumiy', nameUz: 'Umumiy qoidalar', nameRu: 'Общие правила' },
  ]

  for (const t of allTopicDefs) {
    await db
      .insert(topics)
      .values({
        nameUz: t.nameUz,
        nameRu: t.nameRu,
        slug: t.slug,
        bankId: 'traffic_rules_db',
      })
      .onConflictDoUpdate({
        target: topics.slug,
        set: { nameUz: t.nameUz, nameRu: t.nameRu, bankId: 'traffic_rules_db' },
      })
  }

  const allTopics = await db.select().from(topics)
  const slugToId = Object.fromEntries(allTopics.map(t => [t.slug, t.id]))

  // 3. Prepare Questions and Explanations
  const lotinQuestions = (lotinData as { questions: YhqQuestion[] }).questions
  const rusQuestions = (rusData as { questions: YhqQuestion[] }).questions

  const rusMap = new Map<number, YhqQuestion>()
  rusQuestions.forEach(q => rusMap.set(q.id, q))

  const questionRows: (typeof questions.$inferInsert)[] = []
  const explanationRows: (typeof questionExplanations.$inferInsert)[] = []
  const topicCounts: Record<string, number> = {}

  for (const qUz of lotinQuestions) {
    const qRu = rusMap.get(qUz.id) || qUz

    // Normalize Russian answers length if mismatched (e.g. Question 1128)
    const uzAnswers = [...qUz.answers]
    const ruAnswers = [...qRu.answers]
    while (ruAnswers.length < uzAnswers.length) {
      ruAnswers.push('Все указанные ответы верны')
    }

    // Map answers array to F1..Fn keys
    const optionsUz: Record<string, string> = {}
    const optionsRu: Record<string, string> = {}
    uzAnswers.forEach((ans, idx) => {
      const key = `F${idx + 1}`
      optionsUz[key] = ans
      optionsRu[key] = ruAnswers[idx] ?? ans
    })

    const correctAnswer = `F${qUz.correct}`
    const imagePath = qUz.photo && qUz.photo.trim() !== '' ? `images/yhq/${qUz.photo.trim()}` : null
    const slug = detectTopicSlug(qUz, qRu)
    topicCounts[slug] = (topicCounts[slug] || 0) + 1

    questionRows.push({
      id: qUz.id,
      bankId: 'traffic_rules_db',
      externalId: String(qUz.id),
      questionUz: qUz.question,
      questionRu: qRu.question || qUz.question,
      optionsUz,
      optionsRu,
      correctAnswer,
      image: imagePath,
      topicId: slugToId[slug] ?? null,
    })

    if ((qUz.description && qUz.description.trim() !== '') || (qRu.description && qRu.description.trim() !== '')) {
      explanationRows.push({
        questionId: qUz.id,
        explanationUz: qUz.description || '',
        explanationRu: qRu.description || qUz.description || '',
      })
    }
  }

  // 4. Batch upsert Questions (100 per batch)
  const BATCH_SIZE = 100
  console.log(`📦 Upserting ${questionRows.length} questions in batches of ${BATCH_SIZE}...`)
  for (let i = 0; i < questionRows.length; i += BATCH_SIZE) {
    const batch = questionRows.slice(i, i + BATCH_SIZE)
    await db
      .insert(questions)
      .values(batch)
      .onConflictDoUpdate({
        target: questions.id,
        set: {
          bankId: sql`EXCLUDED.bank_id`,
          externalId: sql`EXCLUDED.external_id`,
          questionUz: sql`EXCLUDED.question_uz`,
          questionRu: sql`EXCLUDED.question_ru`,
          optionsUz: sql`EXCLUDED.options_uz`,
          optionsRu: sql`EXCLUDED.options_ru`,
          correctAnswer: sql`EXCLUDED.correct_answer`,
          image: sql`EXCLUDED.image`,
          topicId: sql`EXCLUDED.topic_id`,
        },
      })
  }

  // 5. Batch upsert Explanations (100 per batch)
  console.log(`📝 Upserting ${explanationRows.length} explanations in batches of ${BATCH_SIZE}...`)
  for (let i = 0; i < explanationRows.length; i += BATCH_SIZE) {
    const batch = explanationRows.slice(i, i + BATCH_SIZE)
    await db
      .insert(questionExplanations)
      .values(batch)
      .onConflictDoUpdate({
        target: questionExplanations.questionId,
        set: {
          explanationUz: sql`EXCLUDED.explanation_uz`,
          explanationRu: sql`EXCLUDED.explanation_ru`,
          updatedAt: sql`NOW()`,
        },
      })
  }

  console.log(`\n✅ YHQ SEED COMPLETED SUCCESSFULLY!`)
  console.log(`   - Total Questions:    ${questionRows.length}`)
  console.log(`   - Total Explanations: ${explanationRows.length}`)
  console.log(`   - Topics Breakdown:`)
  Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([s, c]) => console.log(`     * ${s}: ${c}`))

  process.exit(0)
}

main().catch(err => {
  console.error('❌ YHQ Seed failed:', err)
  process.exit(1)
})
