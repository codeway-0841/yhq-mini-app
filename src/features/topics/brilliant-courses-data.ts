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
    descUz: "Ogohlantiruvchi, imtiyoz, taqiqlovchi va buyuruvchi yo'l belgilarini vizual misollarda o'zlashtiring",
    descRu: 'Освойте предупреждающие, запрещающие и предписывающие дорожные знаки на наглядных примерах',
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
    descUz: "Tartibga solingan va solinmagan chorrahalardan o'tish algoritmlarini qadam-baqadam yeching",
    descRu: 'Пошагово разберите алгоритмы проезда регулируемых и нерегулируемых перекрёстков',
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
    descUz: "To'xtash va to'xtab turish ruxsat etilgan hamda taqiqlangan hududlarni xatosiz farqlang",
    descRu: 'Безошибочно определяйте зоны разрешённой и запрещённой остановки и стоянки',
    pathImage: '/brilliant/courses/path-icon-03.png',
    isNew: true,
    categoryGroupUz: "Yo'l harakati asoslari",
    categoryGroupRu: 'Основы дорожного движения',
  },
  4: {
    shortTabUz: 'Manyovr',
    shortTabRu: 'Манёвры',
    eyebrowUz: "4-BOSQICH · YO'NALISH VA QUVIB O'TISH",
    eyebrowRu: 'ЭТАП 4 · МАНЕВРИРОВАНИЕ И ОБГОН',
    descUz: "Burilish, qayrilib olish, quvib o'tish va harakat boshlash xavfsizligi qoidalarini mustahkamlang",
    descRu: 'Закрепите правила безопасного перестроения, разворота, обгона и начала движения',
    pathImage: '/brilliant/courses/path-icon-04.png',
    isNew: false,
    categoryGroupUz: 'Amaliy boshqaruv va manyovrlar',
    categoryGroupRu: 'Практическое вождение и манёвры',
  },
  5: {
    shortTabUz: 'Vaziyatlar',
    shortTabRu: 'Ситуации',
    eyebrowUz: '5-BOSQICH · MURAKKAB SHAROITLAR',
    eyebrowRu: 'ЭТАП 5 · ОСОБЫЕ УСЛОВИЯ',
    descUz: "Temir yo'l kesishmasi, avtomagistral, shatakka olish va yuk tashish holatlarini tahlil qiling",
    descRu: 'Разберите железнодорожные переезды, автомагистрали, буксировку и перевозку грузов',
    pathImage: '/brilliant/courses/path-icon-06.png',
    isNew: true,
    categoryGroupUz: 'Amaliy boshqaruv va manyovrlar',
    categoryGroupRu: 'Практическое вождение и манёвры',
  },
  6: {
    shortTabUz: 'Tezlik',
    shortTabRu: 'Скорость',
    eyebrowUz: '6-BOSQICH · DINAMIKA VA MASOFA',
    eyebrowRu: 'ЭТАП 6 · СКОРОСТЬ И ДИСТАНЦИЯ',
    descUz: "Aholi punktlarida va tashqarida tezlik chegaralari hamda xavfsiz oraliq masofani hisoblang",
    descRu: 'Рассчитывайте скоростные режимы и безопасную дистанцию в любых дорожных условиях',
    pathImage: '/brilliant/courses/path-icon-13.png',
    isNew: false,
    categoryGroupUz: 'Amaliy boshqaruv va manyovrlar',
    categoryGroupRu: 'Практическое вождение и манёвры',
  },
  7: {
    shortTabUz: 'Piyodalar',
    shortTabRu: 'Пешеходы',
    eyebrowUz: '7-BOSQICH · HAMMA ISHTIROKCHILAR',
    eyebrowRu: 'ЭТАП 7 · УЧАСТНИКИ ДВИЖЕНИЯ',
    descUz: "Piyodalar o'tish joylari, velosiped yo'laklari va jamoat transporti ustuvorligini o'rganing",
    descRu: 'Изучите приоритет пешеходов, велосипедистов и маршрутных транспортных средств',
    pathImage: '/brilliant/courses/path-icon-07.png',
    isNew: false,
    categoryGroupUz: 'Xavfsizlik va imtihon tayyorgarligi',
    categoryGroupRu: 'Безопасность и подготовка к экзамену',
  },
  8: {
    shortTabUz: 'Xavfsizlik',
    shortTabRu: 'Безопасность',
    eyebrowUz: '8-BOSQICH · YAKUNIY TAYYORGARLIK',
    eyebrowRu: 'ЭТАП 8 · ИТОГОВАЯ ПОДГОТОВКА',
    descUz: "Texnik nosozliklar, birinchi tibbiy yordam va haydovchi majburiyatlari bo'yicha yakuniy modul",
    descRu: 'Технические неисправности, первая помощь и обязанности водителя перед экзаменом',
    pathImage: '/brilliant/courses/path-icon-11.png',
    isNew: true,
    categoryGroupUz: 'Xavfsizlik va imtihon tayyorgarligi',
    categoryGroupRu: 'Безопасность и подготовка к экзамену',
  },
}

/**
 * Rus tili darsligining har bir bloki (1..24) uchun qisqa mobil tab nomi va kategoriya guruhi.
 */
const RUSTILI_BLOCK_SHORT_TABS: Record<number, { uz: string; ru: string; isNew?: boolean }> = {
  1: { uz: 'Fonetika', ru: 'Фонетика', isNew: true },
  2: { uz: 'Leksika', ru: 'Лексика' },
  3: { uz: 'Ibora', ru: 'Фразеология', isNew: true },
  4: { uz: 'Morfemika', ru: 'Морфемика' },
  5: { uz: 'Morfologiya', ru: 'Морфология', isNew: true },
  6: { uz: 'Sintaksis', ru: 'Синтаксис' },
  7: { uz: 'Punktuatsiya', ru: 'Пунктуация', isNew: true },
  8: { uz: 'Orfografiya', ru: 'Орфография' },
  9: { uz: 'Grafika', ru: 'Графика' },
  10: { uz: 'Orfoepiya', ru: 'Орфоэпия', isNew: true },
  11: { uz: 'Stilistika', ru: 'Стилистика' },
  12: { uz: "Me'yorlar", ru: 'Нормы речи' },
  13: { uz: 'Nutq va matn', ru: 'Речеведение' },
  14: { uz: 'Matn tahlili', ru: 'Текст', isNew: true },
  15: { uz: 'Nutq madaniyati', ru: 'Культура речи' },
  16: { uz: 'Semantika+', ru: 'Семантика+', isNew: true },
  17: { uz: 'Ibora+', ru: 'Фразеология+' },
  18: { uz: "Lug'atlar", ru: 'Словари' },
  19: { uz: 'Fonologiya+', ru: 'Фонология+' },
  20: { uz: 'Paronimlar+', ru: 'Паронимы+', isNew: true },
  21: { uz: "So'z yasalishi+", ru: 'Морфемика+' },
  22: { uz: 'Morfologiya+', ru: 'Морфология+' },
  23: { uz: 'Sintaksis+', ru: 'Синтаксис+', isNew: true },
  24: { uz: 'Punktuatsiya+', ru: 'Пунктуация+' },
}

export function getDarslikBlockPathMeta(
  block: DarslikBlockMeta,
  blockIdx: number,
  topicCount: number,
  minutes = 15,
): BrilliantPathMeta {
  const shortTab = RUSTILI_BLOCK_SHORT_TABS[block.id] ?? {
    uz: `${block.id}-blok`,
    ru: `Блок ${block.id}`,
  }

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
    shortTabUz: shortTab.uz,
    shortTabRu: shortTab.ru,
    eyebrowUz: `${block.id}-BLOK · ${topicCount} TA MAVZU · ~${minutes} DAQ`,
    eyebrowRu: `БЛОК ${block.id} · ${topicCount} ТЕМ · ~${minutes} МИН`,
    titleUz: block.titleUz,
    titleRu: block.titleRu,
    descUz: block.summaryUz,
    descRu: block.summaryRu,
    pathImage: BRILLIANT_PATH_IMAGES[blockIdx % BRILLIANT_PATH_IMAGES.length],
    isNew: shortTab.isNew,
    categoryGroupUz,
    categoryGroupRu,
    kind: 'curriculum',
  }
}

const RUSADABIYOT_SHORT_TABS: Record<number, { uz: string; ru: string; isNew?: boolean }> = {
  1: { uz: 'Nazariya', ru: 'Теория', isNew: true },
  2: { uz: 'XI–XVII asr', ru: 'XI–XVII вв.' },
  3: { uz: 'XVIII asr', ru: 'XVIII век' },
  4: { uz: 'Oltin davr', ru: 'Золотой век', isNew: true },
  5: { uz: 'Realizm', ru: 'Реализм', isNew: true },
  6: { uz: 'Kumush davr', ru: 'Серебряный век' },
  7: { uz: '1920–30-yillar', ru: '1920–30-е гг.' },
  8: { uz: 'Urush nasri', ru: 'Военная проза', isNew: true },
  9: { uz: 'XX–XXI asr', ru: 'XX–XXI вв.' },
}

export function getRusadabiyotBlockPathMeta(
  block: DarslikBlockMeta,
  blockIdx: number,
  topicCount: number,
  minutes = 45,
): BrilliantPathMeta {
  const shortTab = RUSADABIYOT_SHORT_TABS[block.id] ?? {
    uz: `${block.id}-davr`,
    ru: `Эпоха ${block.id}`,
  }

  let categoryGroupUz = 'Adabiyot nazariyasi va klassik davrlar (XI–XIX asrlar)'
  let categoryGroupRu = 'Теория литературы и классические эпохи (XI–XIX века)'
  if (block.id >= 6) {
    categoryGroupUz = 'Kumush davr, XX asr va zamonaviy rus adabiyoti'
    categoryGroupRu = 'Серебряный век, XX век и современная литература'
  }

  return {
    id: `lit-block-${block.id}`,
    shortTabUz: shortTab.uz,
    shortTabRu: shortTab.ru,
    eyebrowUz: `${block.id}-DAVR · ${topicCount} TA MAVZU · ~${minutes} DAQ`,
    eyebrowRu: `ЭПОХА ${block.id} · ${topicCount} ТЕМ · ~${minutes} МИН`,
    titleUz: block.titleUz,
    titleRu: block.titleRu,
    descUz: block.summaryUz,
    descRu: block.summaryRu,
    pathImage: BRILLIANT_PATH_IMAGES[(blockIdx + 3) % BRILLIANT_PATH_IMAGES.length],
    isNew: shortTab.isNew,
    categoryGroupUz,
    categoryGroupRu,
    kind: 'curriculum',
  }
}

function formatAllCapsRussianHeading(text: string): string {
  const letters = text.replace(/[^A-Za-zА-Яа-яЁё]/g, '')
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    const lower = text.toLowerCase()
    const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1)
    return capitalized.replace(/\b(нн|не|ни|ъ|ь)\b/gi, (m) => m.toUpperCase())
  }
  return text
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
      titleUz: 'Mexanika: Kinematika asoslari',
      titleRu: 'Механика: Основы кинематики',
      descUz: "Jismlar harakati, tezlik, tezlanish va trayektoriya qonuniyatlarini vizual masalalarda o'rganing",
      descRu: 'Изучите законы движения тел, скорости, ускорения и траектории на наглядных задачах',
      img: '/brilliant/courses/path-icon-01.png',
      isNew: true,
    },
    '02': {
      shortUz: 'Kuchlar',
      shortRu: 'Силы',
      titleUz: 'Kuchlar: Dinamika va Statika',
      titleRu: 'Силы: Динамика и статика',
      descUz: "Nyuton qonunlari, kuchlar muvozanati, ishqalanish va butun olam tortishish qonunini tahlil qiling",
      descRu: 'Разберите законы Ньютона, равновесие сил, трение и всемирное тяготение',
      img: '/brilliant/courses/path-icon-13.png',
    },
    '03': {
      shortUz: 'Impuls',
      shortRu: 'Импульс',
      titleUz: 'Impuls va Saqlanish qonunlari',
      titleRu: 'Импульс и законы сохранения',
      descUz: "Mexanik ish, quvvat, kinetik hamda potensial energiya saqlanishini amaliyotda qo'llang",
      descRu: 'Применяйте законы сохранения импульса, механической работы и энергии на практике',
      img: '/brilliant/courses/path-icon-02.png',
      isNew: true,
    },
    '04': {
      shortUz: 'Termodinamika',
      shortRu: 'Теплота',
      titleUz: 'Molekulyar fizika va Termodinamika',
      titleRu: 'Молекулярная физика и термодинамика',
      descUz: "Ideal gaz qonunlari, issiqlik dvigatellari va modda tuzilishining mikro-dunyosiga kiring",
      descRu: 'Погрузитесь в микромир вещества, законы идеального газа и начала термодинамики',
      img: '/brilliant/courses/path-icon-12.png',
    },
    '05': {
      shortUz: 'Zaryadlar',
      shortRu: 'Заряды',
      titleUz: 'Maydon nazariyasi: Elektrostatika',
      titleRu: 'Теория поля: Электростатика',
      descUz: "Elektr zaryadlari, Kulon qonuni, kuchlanganlik, potensial va kondensatorlar sig'imini hisoblang",
      descRu: 'Рассчитывайте взаимодействие зарядов, закон Кулона, потенциал и электроёмкость',
      img: '/brilliant/courses/path-icon-11.png',
      isNew: true,
    },
    '06': {
      shortUz: 'Zanjirlar',
      shortRu: 'Цепи тока',
      titleUz: "Elektr zanjirlari va O'zgarmas tok",
      titleRu: 'Электрические цепи и постоянный ток',
      descUz: "Om qonuni, ketma-ket va parallel ulash, tokning ishi va quvvatini sxemalarda yeching",
      descRu: 'Решайте схемы с законом Ома, последовательным и параллельным соединением проводников',
      img: '/brilliant/courses/path-icon-09.png',
    },
    '07': {
      shortUz: 'Maydon',
      shortRu: 'Магнетизм',
      titleUz: 'Elektromagnetizm va muhitda tok',
      titleRu: 'Электромагнетизм и ток в средах',
      descUz: "Magnit maydoni, Amper va Lorens kuchlari hamda elektromagnit induksiya hodisalarini o'zlashtiring",
      descRu: 'Освойте магнитное поле, силы Ампера и Лоренца и явление электромагнитной индукции',
      img: '/brilliant/courses/path-icon-04.png',
    },
    '08': {
      shortUz: "To'lqinlar",
      shortRu: 'Волны',
      titleUz: "Mexanik va elektromagnit to'lqinlar",
      titleRu: 'Механические и электромагнитные волны',
      descUz: "Mayatniklar, garmonik tebranishlar, rezonans va o'zgaruvchan tok qonunlarini o'rganing",
      descRu: 'Изучите маятники, гармонические колебания, резонанс и переменный электрический ток',
      img: '/brilliant/courses/path-icon-05.png',
    },
    '09': {
      shortUz: "Yorug'lik",
      shortRu: 'Свет',
      titleUz: "Yorug'lik fizikasi va Optika",
      titleRu: 'Физика света и оптика',
      descUz: "Yorug'likning qaytishi, sinishi, linzalar, interferensiya va difraksiya hodisalari",
      descRu: 'Отражение и преломление света, линзы, интерференция и дифракция волн',
      img: '/brilliant/courses/path-icon-08.png',
      isNew: true,
    },
    '10': {
      shortUz: 'Kvant',
      shortRu: 'Кванты',
      titleUz: 'Kvant, Atom va Yadro fizikasi',
      titleRu: 'Квантовая, атомная и ядерная физика',
      descUz: "Fotoeffekt, Bor postulatlari, radioaktivlik va yadro reaksiyalarining zamonaviy asoslari",
      descRu: 'Фотоэффект, постулаты Бора, радиоактивность и современные основы ядерных реакций',
      img: '/brilliant/courses/path-icon-10.png',
    },
    variants: {
      shortUz: 'Variantlar',
      shortRu: 'Варианты',
      titleUz: 'Kompleks imtihon variantlari',
      titleRu: 'Комплексные экзаменационные варианты',
      descUz: "Barcha bo'limlarni qamrab oluvchi aralash diagnostika va sertifikat darajasidagi testlar",
      descRu: 'Смешанные диагностические и сертификационные тесты по всем разделам курса',
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
    eyebrowUz: `AMALIY TESTLAR · ${topicCount} MAVZU`,
    eyebrowRu: `ПРАКТИЧЕСКИЕ ТЕСТЫ · ${topicCount} ТЕМ`,
    titleUz: `${labelUz} — Mavzulashtirilgan testlar`,
    titleRu: `${labelRu} — Тесты по темам`,
    descUz: `${labelUz} bo'limi bo'yicha bilimlarni mustahkamlash uchun savollar va amaliy testlar to'plami`,
    descRu: `Сборник проверочных вопросов и практических тестов для закрепления раздела «${labelRu}»`,
    pathImage,
    isNew: chapterIndex === 0,
    kind: 'practice',
  }
}

export function getSubjectChaptersList(subjectId: string) {
  return (SUBJECT_CHAPTERS[subjectId] ?? []).filter((c) => c.id !== 'all')
}
