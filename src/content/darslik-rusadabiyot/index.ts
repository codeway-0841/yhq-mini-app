/**
 * Rus adabiyoti darsligi — attestatsiya va milliy sertifikat uchun xronologik bloklar.
 *
 * Manba: har bir blok — muayyan davr (xronologik / vaqt mezonlari) bo'yicha to'liq o'quv konspekti,
 * alohida `.md` faylda. Fayllar `?raw` bilan LAZY yuklanadi.
 */
import outlineData from './outline.json'

export interface DarslikBlockMeta {
  id: number
  titleUz: string
  titleRu: string
  icon: string
  summaryUz: string
  summaryRu: string
}

export const RUSADABIYOT_PROGRESS_MODULE_OFFSET = 300

export const RUSADABIYOT_BLOCKS: readonly DarslikBlockMeta[] = [
  {
    id: 1,
    titleUz: 'Adabiyot nazariyasi va oqimlari',
    titleRu: 'Теория литературы и литературные направления',
    icon: '📐',
    summaryUz: "Adabiy turlar, janrlar, yo'nalishlar (klassitsizm, romantizm, realizm, modernizm), badiiy vositalar va matn tahlili.",
    summaryRu: 'Литературные роды, жанры, направления (классицизм, романтизм, реализм, модернизм), тропы, фигуры речи и анализ текста.',
  },
  {
    id: 2,
    titleUz: 'Qadimgi rus adabiyoti (XI–XVII asrlar)',
    titleRu: 'Древнерусская литература (XI–XVII века)',
    icon: '📜',
    summaryUz: "Qadimgi rus qo'lyozmalari: «Qonun va inoyat haqida so'z», «Monomax o'gitlari», «Igor polki jangi», jangnoma qissalari, «Zadonshchina», «Domostroy», XVII asr adabiyoti.",
    summaryRu: '«Слово о законе и благодати», «Поучение» Мономаха, «Слово о полку Игореве», воинские повести, «Задонщина», «Домострой», литература XVII века.',
  },
  {
    id: 3,
    titleUz: 'XVIII asr rus adabiyoti (Klassitsizm va Ma’rifatparvarlik)',
    titleRu: 'Русская литература XVIII века (Классицизм и Просвещение)',
    icon: '🏛️',
    summaryUz: "She'r tuzilishi islohoti (Trediakovskiy, Lomonosov), klassitsizm nazariyasi, Kantemir satirasi, Sumarokov dramaturgiyasi, Fonvizin («Nedorosl») va Radishchev.",
    summaryRu: 'Реформа стихосложения (Тредиаковский, Ломоносов), теория классицизма, сатиры Кантемира, Сумароков, Фонвизин («Недоросль») и Радищев.',
  },
  {
    id: 4,
    titleUz: 'XIX asr birinchi yarmi rus adabiyoti (Oltin davr)',
    titleRu: 'Русская литература первой половины XIX века (Золотой век)',
    icon: '✨',
    summaryUz: "Rus romantizmi (Jukovskiy), Griboyedov («Aqllilik balosi»), Pushkin (she'riyat, «Yevgeniy Onegin», «Kapitan qizi»), Lermontov («Zamonamiz qahramoni») va Gogol («Revizor», «O'lik jonlar»).",
    summaryRu: 'Романтизм (Жуковский), Грибоедов («Горе от ума»), Пушкин («Евгений Онегин», «Капитанская дочка»), Лермонтов («Герой нашего времени»), Гоголь («Ревизор», «Мёртвые души»).',
  },
  {
    id: 5,
    titleUz: 'XIX asr ikkinchi yarmi rus adabiyoti (Realizm cho‘qqisi)',
    titleRu: 'Русская литература второй половины XIX века (Расцвет реализма)',
    icon: '🖋️',
    summaryUz: "Turgenev («Otalar va bolalar»), Goncharov («Oblomov»), Ostrovskiy dramaturgiyasi, Nekrasov she'riyati, Tyutchev, Fet, Dostoyevskiy («Jinoyat va jazo»), Tolstoy («Urush va tinchlik»), Chexov.",
    summaryRu: 'Тургенев («Отцы и дети»), Гончаров («Обломов»), драматургия Островского, поэзия Некрасова, Тютчева, Фета, Достоевский, Толстой («Война и мир»), Чехов.',
  },
  {
    id: 6,
    titleUz: 'XIX–XX asrlar bo‘sag‘asi rus adabiyoti va Kumush davr',
    titleRu: 'Русская литература рубежа XIX–XX веков и Серебряный век',
    icon: '🌙',
    summaryUz: "Simvolizm (Bryusov, Balmont, Blok), akmeizm (Axmatova, Gumilyov, Mandelshtam), futurizm (Mayakovskiy), Yesenin, Tsvetayeva, Gorkiy, Bunin va Kuprin.",
    summaryRu: 'Символизм (Блок, Брюсов, Бальмонт), акмеизм (Ахматова, Гумилёв, Мандельштам), футуризм (Маяковский), Есенин, Цветаева, Горький, Бунин, Куприн.',
  },
  {
    id: 7,
    titleUz: '1920–1930-yillar rus adabiyoti va sovet klassikasi',
    titleRu: 'Русская литература 1920–1930-х годов и советская классика',
    icon: '⚙️',
    summaryUz: "Bulgakov («Usta va Margarita», «It yuragi»), Platonov («Kotlovan»), Zamyatin («Biz»), Zoshchenko, Ilf va Petrov satiralari, Nabokov, Sholoxov («Tinch Don»), Pasternak.",
    summaryRu: 'Булгаков («Мастер и Маргарита», «Собачье сердце»), Платонов («Котлован»), Замятин («Мы»), Зощенко, Ильф и Петров, Набоков, Шолохов («Тихий Дон»), Пастернак.',
  },
  {
    id: 8,
    titleUz: 'Ulug‘ Vatan urushi davri adabiyoti (1941–1945)',
    titleRu: 'Литература периода Великой Отечественной войны (1941–1945)',
    icon: '🎖️',
    summaryUz: "Tvardovskiy («Vasiliy Tyorkin»), Simonov, Fadeyev («Yosh gvardiya»), Polevoy, leytenantlik nasri: Nekrasov, Bondarev, Vasilyev («Bu yerdagi tonglar sokin»), Bogomolov, Bikov, Grossman.",
    summaryRu: 'Твардовский («Василий Тёркин»), Симонов, Фадеев («Молодая гвардия»), Полевой, «лейтенантская проза»: Некрасов, Бондарев, Васильев, Богомолов, Быков, Гроссман.',
  },
  {
    id: 9,
    titleUz: 'XX asr ikkinchi yarmi va zamonaviy rus adabiyoti',
    titleRu: 'Русская литература второй половины XX века и современности',
    icon: '🌍',
    summaryUz: "Soljenitsin («Ivan Denisovichning bir kuni»), qishloq nasri: Rasputin, Shukshin, Astafyev, Abramov, Belov, Vampilov va Shvars dramaturgiyasi, Dovlatov va Yaxina («Zulayho ko'zini ochmoqda»).",
    summaryRu: 'Солженицын («Один день Ивана Денисовича»), «деревенская проза»: Распутин, Шукшин, Астафьев, Абрамов, Белов, драматургия Вампилова и Шварца, Довлатов, Яхина.',
  },
] as const

export const RUSADABIYOT_BLOCK_COUNT = RUSADABIYOT_BLOCKS.length

export const RUSADABIYOT_BLOCK_OUTLINE: Record<number, string[]> = outlineData as Record<number, string[]>

export function getRusadabiyotBlockOutline(blockId: number): string[] {
  return RUSADABIYOT_BLOCK_OUTLINE[blockId] ?? []
}

export const RUSADABIYOT_SECTION_COUNT = Object.values(RUSADABIYOT_BLOCK_OUTLINE)
  .reduce((sum, list) => sum + list.length, 0)

export interface RusadabiyotBlockStats {
  sections: number
  minutes: number
}

export const RUSADABIYOT_BLOCK_STATS: Record<number, RusadabiyotBlockStats> = {
  1: { sections: 38, minutes: 44 },
  2: { sections: 64, minutes: 40 },
  3: { sections: 78, minutes: 59 },
  4: { sections: 19, minutes: 51 },
  5: { sections: 28, minutes: 37 },
  6: { sections: 91, minutes: 91 },
  7: { sections: 85, minutes: 90 },
  8: { sections: 141, minutes: 125 },
  9: { sections: 154, minutes: 153 },
}

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
}

export function getRusadabiyotBlock(id: number): DarslikBlockMeta | undefined {
  return RUSADABIYOT_BLOCKS.find((b) => b.id === id)
}

export function loadRusadabiyotBlock(id: number): Promise<string> {
  const loader = BLOCK_LOADERS[id]
  if (!loader) return Promise.reject(new Error(`Unknown rusadabiyot block: ${id}`))
  return loader().then((mod) => mod.default)
}
