// Darslik modules data
export const modules = [
  { id: 1, title: "Yo'l belgilari",            titleRu: 'Дорожные знаки',          lessonCount: 7,  color: '#a8453c', icon: '🚦' },
  { id: 2, title: 'Chorrahalar',               titleRu: 'Перекрёстки',             lessonCount: 6,  color: '#37718e', icon: '🔄' },
  { id: 3, title: "To'xtash va to'xtab turish", titleRu: 'Остановка и стоянка',    lessonCount: 5,  color: '#2e8b78', icon: '🅿️' },
  { id: 4, title: 'Asosiy manyovrlar',         titleRu: 'Основные манёвры',        lessonCount: 8,  color: '#74589b', icon: '↩️' },
  { id: 5, title: 'Maxsus vaziyatlar',         titleRu: 'Особые ситуации',         lessonCount: 6,  color: '#b0822b', icon: '⚠️' },
  { id: 6, title: 'Tezlik va masofa',          titleRu: 'Скорость и дистанция',    lessonCount: 5,  color: '#b96b34', icon: '⚡' },
  { id: 7, title: 'Piyodalar va velosipedlar', titleRu: 'Пешеходы и велосипедисты', lessonCount: 4, color: '#5566a8', icon: '🚶' },
  { id: 8, title: 'Xavfsizlik va yakuniy',     titleRu: 'Безопасность и итог',     lessonCount: 6,  color: '#5f7a3c', icon: '🛡️' },
]

/** moduleId → tegishli savol mavzulari (topics slug'lari).
 *  Darslik "Mashq" va TestPage "Nega shunday?" izohi uchun UMUMIY manba. */
export const MODULE_TOPICS: Record<number, string[]> = {
  1: ['yol-belgilari', 'yol-chiziqlari'],
  2: ['chorrahalar'],
  3: ['toxtatish-va-turish'],
  4: ['manyovr', 'quvib-otish', 'signallar'],
  5: ['temir-yol', 'yuk-tashish', 'yolovchi-tashish', 'shatakka-olish', 'avtomagistral', 'sirpanchiq-yol'],
  6: ['tezlik'],
  7: ['piyodalar'],
  8: ['birinchi-tibbiy-yordam', 'texnik-holat', 'yoritish', 'haydovchi-majburiyatlari', 'umumiy'],
}

export const finalStages = [
  { id: 'inner',  title: 'Ichki imtihon',       locked: false },
  { id: 'real',   title: 'Haqiqiy imtihon',      locked: true  },
  { id: 'davlat', title: 'Davlat test markazi',  locked: true  },
]
