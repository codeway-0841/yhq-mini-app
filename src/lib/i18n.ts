export type Lang = 'uz' | 'ru'

const UZ = {
  // Nav
  home: "Bosh sahifa", lessons: "Darslik", tickets: "Biletlar",
  signs: "Belgilar", profile: "Profil", leaderboard: "Reyting",
  // Dashboard
  allTests: "Barcha testlar", fixMistakes: "Xatolarni tuzatish",
  topics: "Mavzular", octagon: "Oktagon", topicTest: "Mavzu test",
  ticketTest: "Bilet test", realExam: "Real imtihon", fifty: "50/100 talik",
  distracting: "Chalg'ituvchi", saved: "Saqlanganlar",
  roadSigns: "Yo'l belgilari", numeric: "Raqamli savollar",
  adaptive: "Smart test",
  // Test
  question: "savol", finish: "Yakunlash", prev: "Oldingi", next: "Keyingi",
  unanswered: "Javobsiz", results: "Natijalar", retry: "Qayta",
  correct: "To'g'ri", wrong: "Xato", passed: "O'tdi", failed: "O'tmadi",
  timeUp: "Vaqt tugadi!", explanation: "Tushuntirish",
  // Adaptive
  adaptiveTitle: "Smart / Adaptiv test",
  adaptiveDesc: "Xatolaringizga asoslangan savol tanlash",
  qAnswered: "ta savol javoblandi",
  exitAdaptive: "Chiqish",
  // Octagon
  octagonTitle: "Oktagon — PvP", findOpponent: "Raqib topish",
  searching: "Qidirilmoqda...", cancel: "Bekor qilish",
  waitOpponent: "Raqib kutilmoqda", round: "Tur",
  youWon: "G'alaba! 🏆", youLost: "Yutqazdingiz 😔", draw: "Durrang 🤝",
  oppDisconnected: "Raqib uzildi — g'alaba sizniki!",
  // Leaderboard
  rank: "O'rin", player: "O'yinchi", score: "Ball", streakCol: "Streak",
  youLabel: "(Siz)",
  leaderboardError: "Ma'lumot yuklanmadi. Qaytadan urinib ko'ring.",
  yourRank: "Sizning o'rningiz",
  notInTop50: "Top-50 da emassiz",
  // Profile
  yourTariff: "Sizning tarifingiz", freeTariff: "Matiz — Bepul",
  premiumTariff: "Premium", upgrade: "Kuchaytirish",
  addPhone: "Telefon raqami qo'shish", langLabel: "Ilova tili",
  payHistory: "To'lovlar tarixi", offlineMode: "Oflayn rejim",
  themeLabel: "Mavzu", darkTheme: "Qorong'i", lightTheme: "Yorug'",
  resetProgress: "Progresni qayta boshlash", syncServer: "Serverdan yangilash",
  contactUs: "Biz bilan bog'lanish", tgChannel: "Telegram kanalimiz",
  rateApp: "Ilovani baholash", shareApp: "Ulashish", installApp: "Ilovani o'rnatish",
  // Settings modal
  settingsTitle: "Sozlamalar", autoNextCorrect: "To'g'ri javobda avtomatik o'tish",
  autoNextWrong: "Xato javobda avtomatik o'tish", noAnimation: "Animatsiyasiz o'tish",
  shuffleOptions: "Variantlarni aralashtirish", fontSize: "Shrift o'lchami",
  fontStyle: "Shrift uslubi", fontSmall: "Kichik", fontMedium: "O'rtacha",
  fontLarge: "Katta", fontDefault: "Standart", fontSerif: "Serif", fontMono: "Mono",
  reportIssue: "Xatolik haqida xabar berish", saveBtn: "Saqlash",
  uzLang: "O'zbekcha", ruLang: "Русский",
} as const

type Keys = keyof typeof UZ

const RU: Record<Keys, string> = {
  home: "Главная", lessons: "Учебник", tickets: "Билеты",
  signs: "Знаки", profile: "Профиль", leaderboard: "Рейтинг",
  allTests: "Все тесты", fixMistakes: "Работа над ошибками",
  topics: "Темы", octagon: "Октагон", topicTest: "Тест по теме",
  ticketTest: "Тест по билету", realExam: "Реальный экзамен", fifty: "50/100 вопросов",
  distracting: "Каверзные", saved: "Сохранённые",
  roadSigns: "Дорожные знаки", numeric: "Числовые вопросы",
  adaptive: "Smart тест",
  question: "вопрос", finish: "Завершить", prev: "Назад", next: "Далее",
  unanswered: "Без ответа", results: "Результаты", retry: "Ещё раз",
  correct: "Правильно", wrong: "Ошибка", passed: "Сдано", failed: "Не сдано",
  timeUp: "Время вышло!", explanation: "Объяснение",
  adaptiveTitle: "Smart / Адаптивный тест",
  adaptiveDesc: "Вопросы подбираются по вашим ошибкам",
  qAnswered: "вопросов отвечено",
  exitAdaptive: "Выйти",
  octagonTitle: "Октагон — PvP", findOpponent: "Найти соперника",
  searching: "Поиск...", cancel: "Отмена",
  waitOpponent: "Ожидание соперника", round: "Тур",
  youWon: "Победа! 🏆", youLost: "Вы проиграли 😔", draw: "Ничья 🤝",
  oppDisconnected: "Соперник отключился — победа ваша!",
  rank: "Место", player: "Игрок", score: "Очки", streakCol: "Серия",
  youLabel: "(Вы)",
  leaderboardError: "Данные не загружены. Попробуйте снова.",
  yourRank: "Ваше место",
  notInTop50: "Вы не в Топ-50",
  yourTariff: "Ваш тариф", freeTariff: "Matiz — Бесплатно",
  premiumTariff: "Премиум", upgrade: "Улучшить",
  addPhone: "Добавить номер", langLabel: "Язык приложения",
  payHistory: "История оплат", offlineMode: "Оффлайн режим",
  themeLabel: "Тема", darkTheme: "Тёмная", lightTheme: "Светлая",
  resetProgress: "Сбросить прогресс", syncServer: "Обновить с сервера",
  contactUs: "Связаться с нами", tgChannel: "Наш Telegram канал",
  rateApp: "Оценить приложение", shareApp: "Поделиться", installApp: "Установить приложение",
  settingsTitle: "Настройки", autoNextCorrect: "Автопереход при верном ответе",
  autoNextWrong: "Автопереход при ошибке", noAnimation: "Без анимации",
  shuffleOptions: "Перемешивать варианты", fontSize: "Размер шрифта",
  fontStyle: "Стиль шрифта", fontSmall: "Мелкий", fontMedium: "Средний",
  fontLarge: "Крупный", fontDefault: "Стандарт", fontSerif: "Serif", fontMono: "Mono",
  reportIssue: "Сообщить об ошибке", saveBtn: "Сохранить",
  uzLang: "O'zbekcha", ruLang: "Русский",
}

const LANGS = { uz: UZ as Record<Keys, string>, ru: RU }

export function t(lang: Lang, key: Keys): string {
  return LANGS[lang]?.[key] ?? UZ[key]
}

export function useT(lang: Lang) {
  return (key: Keys) => t(lang, key)
}
