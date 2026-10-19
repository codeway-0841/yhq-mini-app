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
}

export function getDarslikBlock(id: number): DarslikBlockMeta | undefined {
  return DARSLIK_BLOCKS.find((b) => b.id === id)
}

export function loadDarslikBlock(id: number): Promise<string> {
  const loader = BLOCK_LOADERS[id]
  if (!loader) return Promise.reject(new Error(`Unknown darslik block: ${id}`))
  return loader().then((mod) => mod.default)
}
