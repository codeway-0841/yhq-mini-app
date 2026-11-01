/**
 * Rus tili darsligi — attestatsiya va milliy sertifikat uchun bloklar.
 *
 * Manba: har bir blok — to'liq o'quv konspekti (rus tilida), alohida `.md`
 * faylda. Fayllar `?raw` bilan LAZY yuklanadi: bloklar ro'yxati sahifasi
 * yengil qoladi, matn esa faqat o'quvchi ochilganda tarmoqdan keladi.
 *
 * `outline.json` — har bir blokning 1–2 darajali sarlavhalari (learning path
 * tugunlari). U `blocks/*.md` dan generatsiya qilinadi; desync'ni
 * tests/unit/content/darslik-rustili.test.ts ushlaydi.
 *
 * `src/content` — sof ma'lumot qatlami: bu fayl React yoki store import qilmaydi.
 */
import outlineData from './outline.json'

export interface DarslikBlockMeta {
  /** 1..15 — blok raqami (progress kaliti: DARSLIK_PROGRESS_MODULE_OFFSET + id) */
  id: number
  titleUz: string
  titleRu: string
  icon: string
  summaryUz: string
  summaryRu: string
}

/**
 * Progress modul id'lari to'qnashmasligi uchun ofset: YHQ darsligi 1..8
 * modul id'larini, interaktiv darslik 999'ni ishlatadi (yaqin kelajakda
 * kengaytirishda ham to'qnashuv bo'lmasin).
 */
export const DARSLIK_PROGRESS_MODULE_OFFSET = 100

export const DARSLIK_BLOCKS: readonly DarslikBlockMeta[] = [
  {
    id: 1,
    titleUz: 'Fonetika, grafika va orfoepiya',
    titleRu: 'Фонетика, графика и орфоэпия',
    icon: '🎧',
    summaryUz: "Tovush va harf, unli va undoshlar, yumshoqlik-qattiqlik, bo'g'in, urg'u, fonetik tahlil.",
    summaryRu: 'Звуки и буквы, гласные и согласные, твёрдость и мягкость, слог, ударение, фонетический разбор.',
  },
  {
    id: 2,
    titleUz: 'Leksikologiya',
    titleRu: 'Лексикология',
    icon: '📚',
    summaryUz: "So'zning lug'aviy ma'nosi, ko'p ma'nolilik, sinonim, antonim, omonim, paronim, leksik me'yorlar.",
    summaryRu: 'Лексическое значение, многозначность, синонимы, антонимы, омонимы, паронимы, лексические нормы.',
  },
  {
    id: 3,
    titleUz: 'Frazeologiya',
    titleRu: 'Фразеология',
    icon: '🧩',
    summaryUz: "Frazeologizmlar, ularning turlari, ma'nosi va kelib chiqish manbalari.",
    summaryRu: 'Фразеологизмы, их типы, значение и источники происхождения.',
  },
  {
    id: 4,
    titleUz: "Morfemika va so'z yasalishi",
    titleRu: 'Морфемика и словообразование',
    icon: '🧱',
    summaryUz: "Morfemalar, so'z tarkibi, so'z yasash usullari va tahlil algoritmlari.",
    summaryRu: 'Морфемы, состав слова, способы словообразования и алгоритмы разбора.',
  },
  {
    id: 5,
    titleUz: 'Morfologiya',
    titleRu: 'Морфология',
    icon: '🔤',
    summaryUz: "Barcha so'z turkumlari: belgilari, razryadlari, shakllari va qiyin holatlari.",
    summaryRu: 'Все части речи: признаки, разряды, формы и сложные случаи определения.',
  },
  {
    id: 6,
    titleUz: 'Sintaksis',
    titleRu: 'Синтаксис',
    icon: '🔗',
    summaryUz: "So'z birikmasi, gap bo'laklari, sodda va murakkab gaplar turlari.",
    summaryRu: 'Словосочетание, члены предложения, простое и сложное предложение.',
  },
  {
    id: 7,
    titleUz: 'Punktuatsiya',
    titleRu: 'Пунктуация',
    icon: '✍️',
    summaryUz: 'Tinish belgilari: vergul, tire, ikki nuqta, qo\'shtirnoq va eng qiyin holatlar.',
    summaryRu: 'Знаки препинания: запятая, тире, двоеточие, кавычки и самые сложные случаи.',
  },
  {
    id: 8,
    titleUz: 'Orfografiya',
    titleRu: 'Орфография',
    icon: '📝',
    summaryUz: "Ildiz, prefiks va suffikslar, Н/НН, НЕ/НИ, qo'shib va ajratib yozish qoidalari.",
    summaryRu: 'Корни, приставки и суффиксы, Н/НН, НЕ/НИ, слитное и раздельное написание.',
  },
  {
    id: 9,
    titleUz: 'Fonetika va grafika',
    titleRu: 'Фонетика и графика',
    icon: '🔊',
    summaryUz: 'Tovushlar tizimi, transkripsiya, fonetik jarayonlar va fonetik tahlil.',
    summaryRu: 'Система звуков, транскрипция, фонетические процессы и фонетический разбор.',
  },
  {
    id: 10,
    titleUz: 'Orfoepiya va aksentologiya',
    titleRu: 'Орфоэпия и акцентология',
    icon: '🎙️',
    summaryUz: "Talaffuz me'yorlari va urg'u — attestatsiyadagi eng ko'p uchraydigan tuzoqlar.",
    summaryRu: 'Нормы произношения и ударения — самые частые ловушки аттестации.',
  },
  {
    id: 11,
    titleUz: 'Stilistika',
    titleRu: 'Стилистика',
    icon: '🎨',
    summaryUz: 'Funksional uslublar, troplar, stilistik figuralar va uslubiy xatolar.',
    summaryRu: 'Функциональные стили, тропы, стилистические фигуры и стилистические ошибки.',
  },
  {
    id: 12,
    titleUz: 'Nutq madaniyati va til me’yorlari',
    titleRu: 'Культура речи и нормы русского языка',
    icon: '🗣️',
    summaryUz: "Leksik, morfologik va sintaktik me'yorlar, til variantlari va 20 test.",
    summaryRu: 'Лексические, морфологические и синтаксические нормы, варианты нормы и 20 тестов.',
  },
  {
    id: 13,
    titleUz: 'Nutqshunoslik va matn',
    titleRu: 'Речеведение и текст',
    icon: '📄',
    summaryUz: "Matn mavzusi, asosiy fikri, nutq turlari, kompozitsiya va bog'lanish usullari.",
    summaryRu: 'Тема и основная мысль, типы речи, композиция и средства связи предложений.',
  },
  {
    id: 14,
    titleUz: 'Matn lingvistikasi',
    titleRu: 'Лингвистика текста',
    icon: '📖',
    summaryUz: "Kogeziya va kogerentlik, anafora, epifora, tema-rema, matn tahlili.",
    summaryRu: 'Когезия и когерентность, анафора, эпифора, тема и рема, анализ текста.',
  },
  {
    id: 15,
    titleUz: 'Adabiy til me’yorlari va nutq madaniyati',
    titleRu: 'Культура речи и нормы литературного языка',
    icon: '🎓',
    summaryUz: "Nutq xatolari, pleyonazm, tavtologiya, paremiyalar va matnni tahrirlash.",
    summaryRu: 'Речевые ошибки, плеоназм, тавтология, паронимы и редактирование текста.',
  },
  {
    id: 16,
    titleUz: 'Leksik semantika va so‘zlarni qo‘llashdagi qiyin holatlar',
    titleRu: 'Лексическая семантика и трудные случаи употребления слов',
    icon: '🔍',
    summaryUz: "So'z ma'nosi, ko'p ma'nolilik, omonimiya, sinonim, antonim va paronimlar, kontekst tahlili.",
    summaryRu: 'Значение слова, многозначность, омонимы, синонимы, антонимы, паронимы и контекст.',
  },
  {
    id: 17,
    titleUz: 'Rus tili frazeologiyasi',
    titleRu: 'Фразеология русского языка',
    icon: '🧩',
    summaryUz: "Frazeologizmlar turlari, kelib chiqishi, leksik variantdorlik va nutqiy xatolar tahlili.",
    summaryRu: 'Типы фразеологизмов, происхождение, значения, синонимы, антонимы и исправление ошибок.',
  },
  {
    id: 18,
    titleUz: 'Leksikografiya va rus tili lug‘atlari',
    titleRu: 'Лексикография и словари русского языка',
    icon: '📚',
    summaryUz: "Izohli, orfoepik, frazeologik lug'atlar va lug'at maqolalari bilan to'g'ri ishlash.",
    summaryRu: 'Толковые, орфографические, фразеологические словари и работа со словарной статьёй.',
  },
  {
    id: 19,
    titleUz: 'Chuqurlashtirilgan fonetika va fonologiya',
    titleRu: 'Фонетика и фонология на углублённом уровне',
    icon: '🔬',
    summaryUz: "Fonema va tovush, kuchli va kuchsiz pozitsiyalar, reduksiya, fonetik transkripsiya.",
    summaryRu: 'Звуки и фонемы, сильные и слабые позиции, редукция, фонетическая транскрипция.',
  },
  {
    id: 20,
    titleUz: 'Murakkab leksik me’yorlar va nutq xatolari',
    titleRu: 'Лексические нормы и речевые ошибки повышенной сложности',
    icon: '⚠️',
    summaryUz: "Paronimlar, leksik moslashuvchanlik, pleyonazm, tavtologiya va jumlalarni tahrirlash.",
    summaryRu: 'Паронимы, сочетаемость, плеоназм, тавтология и редактирование сложных предложений.',
  },
  {
    id: 21,
    titleUz: 'Murakkab so‘z yasalishi va morfemika',
    titleRu: 'Словообразование и морфемика повышенной сложности',
    icon: '⚙️',
    summaryUz: "Morfemik va so'z yasalishi tahlili farqlari, so'z yasash zanjirlari, qiyin holatlar.",
    summaryRu: 'Морфемный и словообразовательный разбор, словообразовательные цепочки, чередования.',
  },
  {
    id: 22,
    titleUz: 'Morfologiyaning murakkab holatlari',
    titleRu: 'Сложные случаи морфологии',
    icon: '🔤',
    summaryUz: "Sifatdosh, ravishdosh, yordamchi so'z turkumlari va o'xshash shakllarni farqlash.",
    summaryRu: 'Причастия, деепричастия, служебные части речи и разграничение омонимичных форм.',
  },
  {
    id: 23,
    titleUz: 'Murakkab sintaksis',
    titleRu: 'Синтаксис повышенной сложности',
    icon: '🔗',
    summaryUz: "Bir bosh bo'lakli va to'liqsiz gaplar, grammatik asoslar va murakkab gap turlari.",
    summaryRu: 'Односоставные и неполные предложения, грамматические основы, виды связи.',
  },
  {
    id: 24,
    titleUz: 'Murakkab punktuatsiya',
    titleRu: 'Пунктуация повышенной сложности',
    icon: '✒️',
    summaryUz: "Ajratilgan bo'laklar, kirish so'zlar, tire, ikki nuqta va ma'noga bog'liq tinish belgilari.",
    summaryRu: 'Обособленные члены, вводные конструкции, тире, двоеточие и сложные правила.',
  },
] as const

export const DARSLIK_BLOCK_COUNT = DARSLIK_BLOCKS.length

/** blockId → learning path tugunlari (1–2 darajali sarlavhalar tartibi bilan). */
export const DARSLIK_BLOCK_OUTLINE: Record<number, string[]> = outlineData as Record<number, string[]>

export function getBlockOutline(blockId: number): string[] {
  return DARSLIK_BLOCK_OUTLINE[blockId] ?? []
}

/** Barcha bloklardagi mavzular (section) soni — progress va header uchun. */
export const DARSLIK_SECTION_COUNT = Object.values(DARSLIK_BLOCK_OUTLINE)
  .reduce((sum, list) => sum + list.length, 0)

/**
 * Blok ichidagi mavzular soni (mundarija bandlari) — `outline.json` dan.
 * O'qish vaqti (daqiqa) — oldindan hisoblangan, matnni yuklamasdan ko'rsatiladi.
 */
export interface DarslikBlockStats {
  sections: number
  minutes: number
}

export const DARSLIK_BLOCK_STATS: Record<number, DarslikBlockStats> = {
  1: { sections: 12, minutes: 8 },
  2: { sections: 19, minutes: 14 },
  3: { sections: 34, minutes: 20 },
  4: { sections: 33, minutes: 13 },
  5: { sections: 61, minutes: 18 },
  6: { sections: 52, minutes: 14 },
  7: { sections: 40, minutes: 11 },
  8: { sections: 54, minutes: 12 },
  9: { sections: 44, minutes: 10 },
  10: { sections: 60, minutes: 12 },
  11: { sections: 51, minutes: 17 },
  12: { sections: 19, minutes: 25 },
  13: { sections: 22, minutes: 23 },
  14: { sections: 19, minutes: 26 },
  15: { sections: 17, minutes: 27 },
  16: { sections: 14, minutes: 18 },
  17: { sections: 12, minutes: 16 },
  18: { sections: 18, minutes: 19 },
  19: { sections: 14, minutes: 15 },
  20: { sections: 13, minutes: 17 },
  21: { sections: 9, minutes: 14 },
  22: { sections: 7, minutes: 8 },
  23: { sections: 10, minutes: 10 },
  24: { sections: 11, minutes: 10 },
}

/** Blok matnini lazy yuklash — har bir `.md` alohida chunk bo'ladi. */
const BLOCK_LOADERS: Record<number, () => Promise<{ default: string }>> = {
  1: () => import('./block-01.md?raw'),
  2: () => import('./block-02.md?raw'),
  3: () => import('./block-03.md?raw'),
  4: () => import('./block-04.md?raw'),
  5: () => import('./block-05.md?raw'),
  6: () => import('./block-06.md?raw'),
  7: () => import('./block-07.md?raw'),
  8: () => import('./block-08.md?raw'),
  9: () => import('./block-09.md?raw'),
  10: () => import('./block-10.md?raw'),
  11: () => import('./block-11.md?raw'),
  12: () => import('./block-12.md?raw'),
  13: () => import('./block-13.md?raw'),
  14: () => import('./block-14.md?raw'),
  15: () => import('./block-15.md?raw'),
  16: () => import('./block-16.md?raw'),
  17: () => import('./block-17.md?raw'),
  18: () => import('./block-18.md?raw'),
  19: () => import('./block-19.md?raw'),
  20: () => import('./block-20.md?raw'),
  21: () => import('./block-21.md?raw'),
  22: () => import('./block-22.md?raw'),
  23: () => import('./block-23.md?raw'),
  24: () => import('./block-24.md?raw'),
}

export function getDarslikBlock(id: number): DarslikBlockMeta | undefined {
  return DARSLIK_BLOCKS.find((b) => b.id === id)
}

export function loadDarslikBlock(id: number): Promise<string> {
  const loader = BLOCK_LOADERS[id]
  if (!loader) return Promise.reject(new Error(`Unknown darslik block: ${id}`))
  return loader().then((mod) => mod.default)
}
