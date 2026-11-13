import { SUBJECT_CHAPTERS } from '../tickets'
import type { DarslikBlockMeta } from '../../content/darslik-rustili'

export interface BrilliantPathMeta {
  id: string
  shortTabUz: string
  shortTabRu: string
  eyebrowUz: string
  eyebrowRu: string
  titleUz: string
  titleRu: string
  descUz: string
  descRu: string
  pathImage: string
  isNew?: boolean
  categoryGroupUz?: string
  categoryGroupRu?: string
  kind?: 'curriculum' | 'practice'
}

/**
 * Brilliant.org /courses/ sahifasidan yuklab olingan 19 ta original 3D yo'nalish (Learning Path) ikonalari.
 */
export const BRILLIANT_PATH_IMAGES = [
  '/brilliant/courses/path-icon-01.png',
  '/brilliant/courses/path-icon-12.png',
  '/brilliant/courses/path-icon-02.png',
  '/brilliant/courses/path-icon-09.png',
  '/brilliant/courses/path-icon-13.png',
  '/brilliant/courses/path-icon-03.png',
  '/brilliant/courses/path-icon-04.png',
  '/brilliant/courses/path-icon-10.png',
  '/brilliant/courses/path-icon-05.png',
  '/brilliant/courses/path-icon-06.png',
  '/brilliant/courses/path-icon-11.png',
  '/brilliant/courses/path-icon-07.png',
  '/brilliant/courses/path-icon-08.png',
  '/brilliant/courses/path-icon-19.png',
  '/brilliant/courses/path-icon-14.png',
  '/brilliant/courses/path-icon-15.png',
  '/brilliant/courses/path-icon-16.png',
  '/brilliant/courses/path-icon-17.png',
  '/brilliant/courses/path-icon-18.png',
] as const

export type BrilliantSectionTone = 'blue' | 'orange' | 'amber' | 'purple'

const ORANGE_PATH_ICONS = new Set([
  'path-icon-12.png',
  'path-data.png',
])

const AMBER_PATH_ICONS = new Set([
  'path-icon-13.png',
  'path-science.png',
])

const PURPLE_PATH_ICONS = new Set([
  'path-icon-09.png',
  'path-icon-10.png',
  'path-icon-11.png',
  'path-icon-19.png',
  'path-cs.png',
  'path-python.png',
  'path-technology.png',
])

/** Path ikonasining haqiqiy rangiga mos aksent ohangini qaytaradi (ikonka ↔ chegara uyg'unligi) */
export function getBrilliantPathTone(pathImage: string): BrilliantSectionTone {
  const fileName = pathImage.split('/').pop() ?? ''
  if (ORANGE_PATH_ICONS.has(fileName)) return 'orange'
  if (AMBER_PATH_ICONS.has(fileName)) return 'amber'
  if (PURPLE_PATH_ICONS.has(fileName)) return 'purple'
  return 'blue'
}

/**
 * Brilliant.org /courses/ sahifasidan yuklab olingan BARCHA 68 ta unikal 3D bob/mavzu illyustratsiyalari.
 * Har bir mavzu kartasi o'zining unikal 3D illyustratsiyasiga ega bo'lishi uchun to'liq katalog.
 */
export const BRILLIANT_ALL_TOPIC_IMAGES: readonly string[] = Array.from(
  { length: 68 },
  (_, idx) => `/brilliant/courses/topic-${String(idx + 1).padStart(2, '0')}.png`,
)

/** YHQ 8 ta moduli uchun Brilliant Learning Path metama'lumotlari */
export const YHQ_BRILLIANT_PATHS: Record<number, {
  shortTabUz: string
  shortTabRu: string
  eyebrowUz: string
  eyebrowRu: string
  descUz: string
  descRu: string
  pathImage: string
  isNew?: boolean
  categoryGroupUz: string
  categoryGroupRu: string
}> = {
  1: {
    shortTabUz: 'Belgilar',
    shortTabRu: 'Знаки',
    eyebrowUz: '1-BOSQICH · ASOSIY BAZA',
    eyebrowRu: 'ЭТАП 1 · БАЗОВЫЙ УРОВЕНЬ',
    descUz: "Ogohlantiruvchi, imtiyoz va taqiqlovchi yo'l belgilarini vizual o'rganing",
    descRu: 'Освойте дорожные знаки приоритета, запрета и предписания наглядно',
    pathImage: '/brilliant/courses/path-icon-01.png',
    isNew: true,
    categoryGroupUz: "Yo'l harakati asoslari",
    categoryGroupRu: 'Основы дорожного движения',
  },
  2: {
    shortTabUz: 'Chorraha',
    shortTabRu: 'Перекрёстки',
    eyebrowUz: '2-BOSQICH · HARAKAT NAVBATI',
    eyebrowRu: 'ЭТАП 2 · ОЧЕРЕДНОСТЬ ПРОЕЗДА',
    descUz: "Tartibga solingan va solinmagan chorrahalardan o'tish navbatini yeching",
    descRu: 'Разберите алгоритмы проезда регулируемых и нерегулируемых перекрёстков',
    pathImage: '/brilliant/courses/path-icon-02.png',
    isNew: false,
    categoryGroupUz: "Yo'l harakati asoslari",
    categoryGroupRu: 'Основы дорожного движения',
  },
  3: {
    shortTabUz: "To'xtash",
    shortTabRu: 'Стоянка',
    eyebrowUz: '3-BOSQICH · JOYLASHUV QOIDALARI',
    eyebrowRu: 'ЭТАП 3 · ПРАВИЛА ОСТАНОВКИ',
    descUz: "To'xtash va to'xtab turish ruxsat etilgan hamda taqiqlangan joylar",
    descRu: 'Определяйте зоны разрешённой и запрещённой остановки и стоянки',
    pathImage: '/brilliant/courses/path-icon-03.png',
    isNew: true,
    categoryGroupUz: "Yo'l harakati asoslari",
    categoryGroupRu: 'Основы дорожного движения',
  },
  4: {
    shortTabUz: 'Manyovr',
    shortTabRu: 'Манёвры',
    eyebrowUz: "4-BOSQICH · QUVIB O'TISH",
    eyebrowRu: 'ЭТАП 4 · МАНЕВРИРОВАНИЕ',
    descUz: "Burilish, qayrilib olish va quvib o'tish xavfsizligi qoidalari",
    descRu: 'Правила безопасного перестроения, разворота, обгона и старта',
    pathImage: '/brilliant/courses/path-icon-04.png',
    isNew: false,
    categoryGroupUz: 'Amaliy boshqaruv va manyovrlar',
    categoryGroupRu: 'Практическое вождение и манёвры',
  },
  5: {
    shortTabUz: 'Vaziyatlar',
    shortTabRu: 'Ситуации',
    eyebrowUz: '5-BOSQICH · MAXSUS HOLATLAR',
    eyebrowRu: 'ЭТАП 5 · ОСОБЫЕ УСЛОВИЯ',
    descUz: "Temir yo'l kesishmasi, avtomagistral va yuk tashish qoidalari",
    descRu: 'Железнодорожные переезды, магистрали, буксировка и перевозка грузов',
    pathImage: '/brilliant/courses/path-icon-06.png',
    isNew: true,
    categoryGroupUz: 'Amaliy boshqaruv va manyovrlar',
    categoryGroupRu: 'Практическое вождение и манёвры',
  },
  6: {
    shortTabUz: 'Tezlik',
    shortTabRu: 'Скорость',
    eyebrowUz: '6-BOSQICH · TEZLIK VA MASOFA',
    eyebrowRu: 'ЭТАП 6 · СКОРОСТЬ И ДИСТАНЦИЯ',
    descUz: "Tezlik chegaralari va xavfsiz oraliq masofani to'g'ri hisoblang",
    descRu: 'Рассчитывайте скоростные режимы и безопасную дистанцию в пути',
    pathImage: '/brilliant/courses/path-icon-13.png',
    isNew: false,
    categoryGroupUz: 'Amaliy boshqaruv va manyovrlar',
    categoryGroupRu: 'Практическое вождение и манёвры',
  },
  7: {
    shortTabUz: 'Piyodalar',
    shortTabRu: 'Пешеходы',
    eyebrowUz: '7-BOSQICH · ISHTIROKCHILAR',
    eyebrowRu: 'ЭТАП 7 · УЧАСТНИКИ ДВИЖЕНИЯ',
    descUz: "Piyodalar, velosipedlar va jamoat transporti ustuvorlik qoidalari",
    descRu: 'Приоритет пешеходов, велосипедистов и маршрутного транспорта',
    pathImage: '/brilliant/courses/path-icon-07.png',
    isNew: false,
    categoryGroupUz: 'Xavfsizlik va imtihon tayyorgarligi',
    categoryGroupRu: 'Безопасность и подготовка к экзамену',
  },
  8: {
    shortTabUz: 'Xavfsizlik',
    shortTabRu: 'Безопасность',
    eyebrowUz: '8-BOSQICH · YAKUNIY MODUL',
    eyebrowRu: 'ЭТАП 8 · ИТОГОВЫЙ МОДУЛЬ',
    descUz: "Texnik nosozliklar, birinchi yordam va haydovchi majburiyatlari",
    descRu: 'Технические неисправности, первая помощь и обязанности водителя',
    pathImage: '/brilliant/courses/path-icon-11.png',
    isNew: true,
    categoryGroupUz: 'Xavfsizlik va imtihon tayyorgarligi',
    categoryGroupRu: 'Безопасность и подготовка к экзамену',
  },
}

interface ConciseBlockMeta {
  tabUz: string
  tabRu: string
  titleUz: string
  titleRu: string
  descUz: string
  descRu: string
  isNew?: boolean
}

/**
 * Rus tili darsligi bloklari (1..24) uchun Brilliant uslubidagi ixcham tab,
 * 1 qatorli sarlavha va 2 qatorli tavsiflar.
 */
const RUSTILI_BLOCK_META: Record<number, ConciseBlockMeta> = {
  1: {
    tabUz: 'Fonetika',
    tabRu: 'Фонетика',
    titleUz: 'Fonetika va orfoepiya',
    titleRu: 'Фонетика и орфоэпия',
    descUz: "Tovush va harf, unli-undoshlar, bo'g'in, urg'u va fonetik tahlil.",
    descRu: 'Звуки и буквы, слоги, ударение и фонетический разбор.',
    isNew: true,
  },
  2: {
    tabUz: 'Leksika',
    tabRu: 'Лексика',
    titleUz: 'Leksikologiya',
    titleRu: 'Лексикология',
    descUz: "So'z ma'nosi, sinonim, antonim, omonim, paronim va leksik me'yorlar.",
    descRu: 'Значение слова, синонимы, антонимы, омонимы и паронимы.',
  },
  3: {
    tabUz: 'Ibora',
    tabRu: 'Фраземы',
    titleUz: 'Frazeologiya',
    titleRu: 'Фразеология',
    descUz: "Turg'un iboralar, ularning turlari, ma'nosi va kelib chiqishi.",
    descRu: 'Устойчивые выражения, типы фразеологизмов и их значение.',
    isNew: true,
  },
  4: {
    tabUz: 'Morfemika',
    tabRu: 'Морфемика',
    titleUz: 'Morfemika va tarkib',
    titleRu: 'Морфемика и состав',
    descUz: "Morfemalar, so'z tarkibi va so'z yasash algoritmlari.",
    descRu: 'Морфемы, состав слова и способы словообразования.',
  },
  5: {
    tabUz: 'Morfologiya',
    tabRu: 'Части речи',
    titleUz: 'Morfologiya',
    titleRu: 'Морфология',
    descUz: "So'z turkumlari, razryadlari, shakllari va qiyin holatlar.",
    descRu: 'Все части речи: признаки, разряды и сложные случаи.',
    isNew: true,
  },
  6: {
    tabUz: 'Sintaksis',
    tabRu: 'Синтаксис',
    titleUz: 'Sintaksis asoslari',
    titleRu: 'Основы синтаксиса',
    descUz: "So'z birikmasi, gap bo'laklari, sodda va qo'shma gap turlari.",
    descRu: 'Словосочетание, члены и виды сложного предложения.',
  },
  7: {
    tabUz: 'Tinish',
    tabRu: 'Пунктуация',
    titleUz: 'Punktuatsiya',
    titleRu: 'Пунктуация',
    descUz: "Vergul, tire, ikki nuqta va qo'shtirnoq qo'yish qoidalari.",
    descRu: 'Запятая, тире, двоеточие и сложные правила расстановки.',
    isNew: true,
  },
  8: {
    tabUz: 'Orfografiya',
    tabRu: 'Орфография',
    titleUz: 'Orfografiya',
    titleRu: 'Орфография',
    descUz: "Ildiz, prefiks, Н/НН, НЕ/НИ va qo'shib-ajratib yozish.",
    descRu: 'Корни, приставки, Н/НН, НЕ/НИ и слитное написание.',
  },
  9: {
    tabUz: 'Grafika',
    tabRu: 'Графика',
    titleUz: 'Fonetika va grafika',
    titleRu: 'Фонетика и графика',
    descUz: 'Tovushlar tizimi, transkripsiya va fonetik jarayonlar.',
    descRu: 'Система звуков, транскрипция и фонетический анализ.',
  },
  10: {
    tabUz: 'Orfoepiya',
    tabRu: 'Орфоэпия',
    titleUz: "Talaffuz va urg'u",
    titleRu: 'Орфоэпия и ударение',
    descUz: "Adabiy talaffuz me'yorlari va imtihondagi urg'u tuzoqlari.",
    descRu: 'Нормы произношения и частые ловушки ударения.',
    isNew: true,
  },
  11: {
    tabUz: 'Stilistika',
    tabRu: 'Стилистика',
    titleUz: 'Stilistika',
    titleRu: 'Стилистика',
    descUz: 'Funksional uslublar, troplar, figuralar va uslubiy xatolar.',
    descRu: 'Функциональные стили, тропы и стилистические фигуры.',
  },
  12: {
    tabUz: "Me'yorlar",
    tabRu: 'Нормы речи',
    titleUz: "Nutq me'yorlari",
    titleRu: 'Нормы речи',
    descUz: "Leksik, morfologik va sintaktik me'yorlar hamda 20 test.",
    descRu: 'Лексические, морфологические и синтаксические нормы.',
  },
  13: {
    tabUz: 'Nutq va matn',
    tabRu: 'Речеведение',
    titleUz: 'Nutq va matn',
    titleRu: 'Речеведение и текст',
    descUz: "Matn mavzusi, asosiy fikri, nutq turlari va bog'lanish.",
    descRu: 'Тема, основная мысль, типы речи и связь предложений.',
  },
  14: {
    tabUz: 'Matn tahlili',
    tabRu: 'Текст',
    titleUz: 'Matn lingvistikasi',
    titleRu: 'Лингвистика текста',
    descUz: 'Kogeziya, kogerentlik, anafora, tema-rema va tahlil.',
    descRu: 'Когезия, когерентность, тема-рема и разбор текста.',
    isNew: true,
  },
  15: {
    tabUz: 'Madaniyat',
    tabRu: 'Культура',
    titleUz: 'Nutq madaniyati',
    titleRu: 'Культура речи',
    descUz: 'Nutq xatolari, pleyonazm, tavtologiya va matn tahriri.',
    descRu: 'Речевые ошибки, плеоназм, тавтология и правка текста.',
  },
  16: {
    tabUz: 'Semantika+',
    tabRu: 'Семантика+',
    titleUz: 'Leksik semantika+',
    titleRu: 'Семантика слова+',
    descUz: "Ko'p ma'nolilik, omonimiya, paronim va kontekst tahlili.",
    descRu: 'Многозначность, омонимы, паронимы и анализ контекста.',
    isNew: true,
  },
  17: {
    tabUz: 'Ibora+',
    tabRu: 'Фраземы+',
    titleUz: 'Frazeologiya+',
    titleRu: 'Фразеология+',
    descUz: 'Murakkab iboralar, kelib chiqishi va nutqiy xatolar.',
    descRu: 'Типы фразеологизмов, синонимы и разбор ошибок.',
  },
  18: {
    tabUz: "Lug'atlar",
    tabRu: 'Словари',
    titleUz: "Rus tili lug'atlari",
    titleRu: 'Словари языка',
    descUz: "Izohli, orfoepik va frazeologik lug'atlar bilan ishlash.",
    descRu: 'Толковые и фразеологические словари, работа со статьёй.',
  },
  19: {
    tabUz: 'Fonologiya+',
    tabRu: 'Фонология+',
    titleUz: 'Chuqur fonologiya',
    titleRu: 'Фонология+',
    descUz: 'Fonema, kuchli-kuchsiz pozitsiya, reduksiya va transkripsiya.',
    descRu: 'Сильные и слабые позиции звуков, редукция, транскрипция.',
  },
  20: {
    tabUz: 'Paronim+',
    tabRu: 'Паронимы+',
    titleUz: "Leksik me'yorlar+",
    titleRu: 'Лексические нормы+',
    descUz: 'Paronimlar, pleyonazm, tavtologiya va jumlani tahrirlash.',
    descRu: 'Паронимы, лексическая сочетаемость и правка ошибок.',
    isNew: true,
  },
  21: {
    tabUz: 'Morfema+',
    tabRu: 'Морфемы+',
    titleUz: "So'z yasalishi+",
    titleRu: 'Словообразование+',
    descUz: "Morfemik va so'z yasalishi tahlili, zanjirlar va qiyin holatlar.",
    descRu: 'Морфемный и словообразовательный разбор на экзамене.',
  },
  22: {
    tabUz: 'Shakl+',
    tabRu: 'Формы+',
    titleUz: 'Murakkab morfologiya',
    titleRu: 'Сложная морфология',
    descUz: "Sifatdosh, ravishdosh va o'xshash shakllarni farqlash.",
    descRu: 'Причастия, деепричастия и омонимичные части речи.',
  },
  23: {
    tabUz: 'Sintaksis+',
    tabRu: 'Синтаксис+',
    titleUz: 'Murakkab sintaksis',
    titleRu: 'Сложный синтаксис',
    descUz: "Bir bosh bo'lakli gaplar, asoslar va murakkab gap turlari.",
    descRu: 'Односоставные предложения, основы и типы сложной связи.',
    isNew: true,
  },
  24: {
    tabUz: 'Tinish+',
    tabRu: 'Знаки+',
    titleUz: 'Murakkab punktuatsiya',
    titleRu: 'Сложные знаки',
    descUz: "Ajratilgan bo'laklar, kirish so'zlar, tire va ikki nuqta.",
    descRu: 'Обособленные члены, вводные слова, тире и двоеточие.',
  },
}

export function getDarslikBlockPathMeta(
  block: DarslikBlockMeta,
  blockIdx: number,
  topicCount: number,
  _minutes = 15,
): BrilliantPathMeta {
  const custom = RUSTILI_BLOCK_META[block.id]

  let categoryGroupUz = 'Fonetika, leksika va so‘z tarkibi'
  let categoryGroupRu = 'Фонетика, лексика и словообразование'
  if (block.id >= 5 && block.id <= 8) {
    categoryGroupUz = 'Grammatika, orfografiya va punktuatsiya'
    categoryGroupRu = 'Грамматика, орфография и пунктуация'
  } else if (block.id >= 9 && block.id <= 15) {
    categoryGroupUz = 'Orfoepiya, stilistika, nutq madaniyati va matn'
    categoryGroupRu = 'Орфоэпия, стилистика, культура речи и текст'
  } else if (block.id >= 16) {
    categoryGroupUz = 'Attestatsiya va Milliy sertifikat: Yuqori murakkablik'
    categoryGroupRu = 'Аттестация и Сертификат: Повышенная сложность'
  }

  return {
    id: `darslik-block-${block.id}`,
    shortTabUz: custom?.tabUz ?? `${block.id}-blok`,
    shortTabRu: custom?.tabRu ?? `Блок ${block.id}`,
    eyebrowUz: `${block.id}-BLOK · ${topicCount} MAVZU`,
    eyebrowRu: `БЛОК ${block.id} · ${topicCount} ТЕМ`,
    titleUz: custom?.titleUz ?? block.titleUz,
    titleRu: custom?.titleRu ?? block.titleRu,
    descUz: custom?.descUz ?? block.summaryUz,
    descRu: custom?.descRu ?? block.summaryRu,
    pathImage: BRILLIANT_PATH_IMAGES[blockIdx % BRILLIANT_PATH_IMAGES.length],
    isNew: custom?.isNew,
    categoryGroupUz,
    categoryGroupRu,
    kind: 'curriculum',
  }
}

const RUSADABIYOT_BLOCK_META: Record<number, ConciseBlockMeta> = {
  1: {
    tabUz: 'Nazariya',
    tabRu: 'Теория',
    titleUz: 'Adabiyot nazariyasi',
    titleRu: 'Теория литературы',
    descUz: 'Adabiy turlar, janrlar, oqimlar va badiiy tasvir vositalari.',
    descRu: 'Литературные роды, жанры, направления и тропы.',
    isNew: true,
  },
  2: {
    tabUz: 'XI–XVII asr',
    tabRu: 'XI–XVII вв.',
    titleUz: 'Qadimgi rus adabiyoti',
    titleRu: 'Древняя литература',
    descUz: "XI–XVII asr qo'lyozmalari, «Igor polki» va jangnoma qissalar.",
    descRu: 'Летописи XI–XVII веков, «Слово о полку Игореве» и повести.',
  },
  3: {
    tabUz: 'XVIII asr',
    tabRu: 'XVIII век',
    titleUz: 'XVIII asr klassitsizmi',
    titleRu: 'Литература XVIII века',
    descUz: 'Lomonosov islohoti, klassitsizm, Fonvizin va Radishchev.',
    descRu: 'Реформа стиха, классицизм, Фонвизин и Радищев.',
  },
  4: {
    tabUz: 'Oltin davr',
    tabRu: 'Золотой век',
    titleUz: 'Oltin davr klassikasi',
    titleRu: 'Золотой век классики',
    descUz: 'Jukovskiy, Griboyedov, Pushkin, Lermontov va Gogol ijodi.',
    descRu: 'Жуковский, Грибоедов, Пушкин, Лермонтов и Гоголь.',
    isNew: true,
  },
  5: {
    tabUz: 'Realizm',
    tabRu: 'Реализм',
    titleUz: 'XIX asr realizmi',
    titleRu: 'Реализм XIX века',
    descUz: 'Turgenev, Goncharov, Dostoyevskiy, Tolstoy va Chexov.',
    descRu: 'Тургенев, Гончаров, Достоевский, Толстой и Чехов.',
    isNew: true,
  },
  6: {
    tabUz: 'Kumush',
    tabRu: 'Серебро',
    titleUz: 'Kumush davr',
    titleRu: 'Серебряный век',
    descUz: 'Simvolizm, akmeizm, futurizm, Blok, Yesenin va Bunin.',
    descRu: 'Символизм, акмеизм, футуризм, Блок, Есенин и Бунин.',
  },
  7: {
    tabUz: '1920–30',
    tabRu: '1920–30',
    titleUz: '1920–30-yillar nasri',
    titleRu: 'Проза 1920–30-х',
    descUz: 'Bulgakov, Platonov, Zamyatin, Sholoxov va Nabokov.',
    descRu: 'Булгаков, Платонов, Замятин, Шолохов и Набоков.',
  },
  8: {
    tabUz: 'Urush nasri',
    tabRu: 'Война',
    titleUz: 'Urush davri adabiyoti',
    titleRu: 'Военная проза',
    descUz: 'Tvardovskiy, Simonov, Fadeyev va leytenantlik nasri.',
    descRu: 'Твардовский, Симонов, Фадеев и лейтенантская проза.',
    isNew: true,
  },
  9: {
    tabUz: 'Zamonaviy',
    tabRu: 'XX–XXI вв.',
    titleUz: 'Zamonaviy adabiyot',
    titleRu: 'Современная проза',
    descUz: 'Soljenitsin, Rasputin, Shukshin, Vampilov va Dovlatov.',
    descRu: 'Солженицын, Распутин, Шукшин, Вампилов и Довлатов.',
  },
}

export function getRusadabiyotBlockPathMeta(
  block: DarslikBlockMeta,
  blockIdx: number,
  topicCount: number,
  _minutes = 45,
): BrilliantPathMeta {
  const custom = RUSADABIYOT_BLOCK_META[block.id]

  let categoryGroupUz = 'Adabiyot nazariyasi va klassik davrlar (XI–XIX asrlar)'
  let categoryGroupRu = 'Теория литературы и классические эпохи (XI–XIX века)'
  if (block.id >= 6) {
    categoryGroupUz = 'Kumush davr, XX asr va zamonaviy rus adabiyoti'
    categoryGroupRu = 'Серебряный век, XX век и современная литература'
  }

  return {
    id: `lit-block-${block.id}`,
    shortTabUz: custom?.tabUz ?? `${block.id}-davr`,
    shortTabRu: custom?.tabRu ?? `Эпоха ${block.id}`,
    eyebrowUz: `${block.id}-DAVR · ${topicCount} MAVZU`,
    eyebrowRu: `ЭПОХА ${block.id} · ${topicCount} ТЕМ`,
    titleUz: custom?.titleUz ?? block.titleUz,
    titleRu: custom?.titleRu ?? block.titleRu,
    descUz: custom?.descUz ?? block.summaryUz,
    descRu: custom?.descRu ?? block.summaryRu,
    pathImage: BRILLIANT_PATH_IMAGES[(blockIdx + 3) % BRILLIANT_PATH_IMAGES.length],
    isNew: custom?.isNew,
    categoryGroupUz,
    categoryGroupRu,
    kind: 'curriculum',
  }
}

function formatAllCapsRussianHeading(text: string): string {
  const letters = text.replace(/[^A-Za-zА-Яа-яЁё]/g, '')
  if (letters.length < 2 || letters !== letters.toUpperCase()) {
    return text
  }
  const lower = text.toLowerCase()
  const capitalized = lower.replace(/[a-zа-яё]/i, (ch) => ch.toUpperCase())
  return capitalized
    // Standart rus imlo va termin belgilari (kirillda \b ishlamaydi)
    .replace(/(?<![А-Яа-яЁё])(нн|ссп|спп|бсп|егэ|жи-ши|ча-ща|чу-щу|ц)(?![А-Яа-яЁё])/gi, (m) => m.toUpperCase())
    // Qisqa imlo qoidalari: "НЕ с ...", "НЕ и НИ", "НИ без НЕ", "Н и НН", "О и Е", "Ь и Ъ"
    .replace(/^Не(?=\s+(?:с|и|в|без)(?![А-Яа-яЁё]))/i, 'НЕ')
    .replace(/(?<=\s)(и|без)\s+(ни|не)(?![А-Яа-яЁё])/gi, (_m, prep: string, p: string) => `${prep} ${p.toUpperCase()}`)
    .replace(/(?<![А-Яа-яЁё])(н)(?=\s+и\s+НН|[?.,:\s]|$)/gi, 'Н')
    .replace(/([А-Яа-яЁё])(?=\s+и\s+([А-Яа-яЁё])(?![А-Яа-яЁё]))/gi, (_m, l: string) => l.toUpperCase())
    .replace(/(?<=\sи\s)([оеъь])(?![А-Яа-яЁё])/gi, (_m, l: string) => l.toUpperCase())
    .replace(/(?<=Буквы\s)([еёюя,\s]+)$/i, (list) => list.toUpperCase())
    .replace(/(?<=\sпосле\s)([ц])(?![А-Яа-яЁё])/gi, 'Ц')
    .replace(/(?<![A-Za-z])(xi|xvii|xviii|xix|xx|xxi)(?![A-Za-z])/gi, (m) => m.toUpperCase())
}

/**
 * Outline mavzu satridan (masalan "1.1. Предмет фонетики. Звук и буква" yoki "ЗВУКИ И БУКВЫ")
 * kod qismi ("1.1") va toza mavzu sarlavhasini ajratib beradi.
 */
export function parseOutlineTopicHeading(rawTitle: string, blockId: number, itemIdx: number, lang: 'uz' | 'ru') {
  const trimmed = rawTitle.trim()
  const numberedMatch = trimmed.match(/^(\d+(?:\.\d+)+)\.?\s+(.+)$/)
  if (numberedMatch) {
    const code = numberedMatch[1]
    return {
      shortCode: lang === 'ru' ? `ТЕМА ${code}` : `${code}-MAVZU`,
      fullEyebrow: lang === 'ru' ? `БЛОК ${blockId} · ТЕМА ${code}` : `${blockId}-BLOK · ${code}-MAVZU`,
      cleanTitle: formatAllCapsRussianHeading(numberedMatch[2]),
    }
  }
  const code = `${blockId}.${itemIdx + 1}`
  return {
    shortCode: lang === 'ru' ? `ТЕМА ${code}` : `${code}-MAVZU`,
    fullEyebrow: lang === 'ru' ? `БЛОК ${blockId} · ТЕМА ${itemIdx + 1}` : `${blockId}-BLOK · ${itemIdx + 1}-MAVZU`,
    cleanTitle: formatAllCapsRussianHeading(trimmed),
  }
}

/**
 * Mavzu tartib raqamiga qarab 68 ta unikal Brilliant 3D illyustratsiyasidan
 * ketma-ket takrorlanmaydigan rasmni qaytaradi.
 */
export function getBrilliantTopicImage(_title: string, index: number, _slug = ''): string {
  const safeIdx = Math.abs(index) % BRILLIANT_ALL_TOPIC_IMAGES.length
  return BRILLIANT_ALL_TOPIC_IMAGES[safeIdx]
}

/**
 * Fan bo'limi (ChapterDef) uchun Brilliant Learning Path sarlavhasi,
 * tavsifi, eyebrow va 3D ikonkasini qaytaradi (Amaliy testlar bo'limi uchun).
 * Eslatma: `titleUz`/`titleRu` aniq mavzu nomlari (masalan "Kinematika")
 * bilan ustma-ust tushib qolmasligi uchun boyitilgan kurs sarlavhasi ishlatiladi.
 */
export function getSubjectChapterPathMeta(
  subjectId: string,
  chapterId: string,
  chapterIndex: number,
  labelUz: string,
  labelRu: string,
  topicCount: number,
): BrilliantPathMeta {
  const pathImage = BRILLIANT_PATH_IMAGES[chapterIndex % BRILLIANT_PATH_IMAGES.length]
  const stepNum = chapterIndex + 1

  const FIZIKA_META: Record<string, { shortUz: string; shortRu: string; titleUz: string; titleRu: string; descUz: string; descRu: string; img: string; isNew?: boolean }> = {
    '01': {
      shortUz: 'Mexanika',
      shortRu: 'Механика',
      titleUz: 'Kinematika asoslari',
      titleRu: 'Основы кинематики',
      descUz: "Harakat turlari, tezlik, tezlanish va trayektoriya qonunlari.",
      descRu: 'Законы движения, скорости, ускорения и траектории наглядно.',
      img: '/brilliant/courses/path-icon-01.png',
      isNew: true,
    },
    '02': {
      shortUz: 'Kuchlar',
      shortRu: 'Силы',
      titleUz: 'Dinamika va statika',
      titleRu: 'Динамика и статика',
      descUz: "Nyuton qonunlari, kuchlar muvozanati va ishqalanish kuchi.",
      descRu: 'Законы Ньютона, равновесие сил, трение и тяготение.',
      img: '/brilliant/courses/path-icon-13.png',
    },
    '03': {
      shortUz: 'Impuls',
      shortRu: 'Импульс',
      titleUz: 'Impuls va energiya',
      titleRu: 'Импульс и энергия',
      descUz: "Impuls, mexanik ish, quvvat va energiya saqlanish qonunlari.",
      descRu: 'Законы сохранения импульса, работы и энергии в задачах.',
      img: '/brilliant/courses/path-icon-02.png',
      isNew: true,
    },
    '04': {
      shortUz: 'Issiqlik',
      shortRu: 'Теплота',
      titleUz: 'Termodinamika',
      titleRu: 'Термодинамика',
      descUz: "Ideal gaz qonunlari, issiqlik mashinalari va modda tuzilishi.",
      descRu: 'Законы идеального газа, тепловые двигатели и молекулы.',
      img: '/brilliant/courses/path-icon-12.png',
    },
    '05': {
      shortUz: 'Zaryadlar',
      shortRu: 'Заряды',
      titleUz: 'Elektrostatika',
      titleRu: 'Электростатика',
      descUz: "Elektr zaryadlari, Kulon qonuni, potensial va kondensatorlar.",
      descRu: 'Взаимодействие зарядов, закон Кулона, потенциал и ёмкость.',
      img: '/brilliant/courses/path-icon-11.png',
      isNew: true,
    },
    '06': {
      shortUz: 'Zanjirlar',
      shortRu: 'Цепи тока',
      titleUz: "O'zgarmas tok",
      titleRu: 'Постоянный ток',
      descUz: "Om qonuni, zanjirlarni ulash, tok ishi va quvvatini yeching.",
      descRu: 'Закон Ома, схемы соединения проводников и мощность тока.',
      img: '/brilliant/courses/path-icon-09.png',
    },
    '07': {
      shortUz: 'Maydon',
      shortRu: 'Магнетизм',
      titleUz: 'Elektromagnetizm',
      titleRu: 'Электромагнетизм',
      descUz: "Magnit maydoni, Amper-Lorens kuchlari va induksiya hodisasi.",
      descRu: 'Магнитное поле, силы Ампера и Лоренца, индукция.',
      img: '/brilliant/courses/path-icon-04.png',
    },
    '08': {
      shortUz: "To'lqinlar",
      shortRu: 'Волны',
      titleUz: "Tebranish va to'lqin",
      titleRu: 'Колебания и волны',
      descUz: "Mayatniklar, garmonik tebranishlar, rezonans va to'lqinlar.",
      descRu: 'Маятники, гармонические колебания, резонанс и волны.',
      img: '/brilliant/courses/path-icon-05.png',
    },
    '09': {
      shortUz: "Yorug'lik",
      shortRu: 'Свет',
      titleUz: 'Optika asoslari',
      titleRu: 'Основы оптики',
      descUz: "Yorug'lik qaytishi, sinishi, linzalar va interferensiya.",
      descRu: 'Отражение, преломление света, линзы и дифракция волн.',
      img: '/brilliant/courses/path-icon-08.png',
      isNew: true,
    },
    '10': {
      shortUz: 'Kvant',
      shortRu: 'Кванты',
      titleUz: 'Kvant va yadro',
      titleRu: 'Кванты и ядро',
      descUz: "Fotoeffekt, Bor postulatlari, radioaktivlik va yadro fizikasi.",
      descRu: 'Фотоэффект, постулаты Бора, радиоактивность и ядро.',
      img: '/brilliant/courses/path-icon-10.png',
    },
    variants: {
      shortUz: 'Variantlar',
      shortRu: 'Варианты',
      titleUz: 'Imtihon variantlari',
      titleRu: 'Варианты экзамена',
      descUz: "Barcha bo'limlar bo'yicha diagnostika va sertifikat testlari.",
      descRu: 'Смешанные диагностические и сертификационные тесты курса.',
      img: '/brilliant/courses/path-icon-06.png',
    },
  }

  if (subjectId === 'fizika' && FIZIKA_META[chapterId]) {
    const m = FIZIKA_META[chapterId]
    return {
      id: `test-${chapterId}`,
      shortTabUz: m.shortUz,
      shortTabRu: m.shortRu,
      eyebrowUz: `${stepNum}-YO'NALISH · ${topicCount} MAVZU`,
      eyebrowRu: `КУРС ${stepNum} · ${topicCount} ТЕМ`,
      titleUz: m.titleUz,
      titleRu: m.titleRu,
      descUz: m.descUz,
      descRu: m.descRu,
      pathImage: m.img,
      isNew: m.isNew,
      kind: 'practice',
    }
  }

  return {
    id: `test-${chapterId}`,
    shortTabUz: labelUz,
    shortTabRu: labelRu,
    eyebrowUz: `${stepNum}-BO'LIM · ${topicCount} MAVZU`,
    eyebrowRu: `РАЗДЕЛ ${stepNum} · ${topicCount} ТЕМ`,
    titleUz: labelUz,
    titleRu: labelRu,
    descUz: `${labelUz} bo'limi bo'yicha mavzulashtirilgan savollar va mashqlar.`,
    descRu: `Тематические вопросы и практические задания по разделу «${labelRu}».`,
    pathImage,
    isNew: chapterIndex === 0,
    kind: 'practice',
  }
}

export function getSubjectChaptersList(subjectId: string) {
  return (SUBJECT_CHAPTERS[subjectId] ?? []).filter((c) => c.id !== 'all')
}
