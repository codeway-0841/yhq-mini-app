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
  adaptive: "Test yechish",
  // v1.1 Dashboard (Neon)
  greeting: "Salom", level: "Level", overallProgress: "Umumiy progress",
  continueLearn: "Davom etish", seeAll: "Barchasi", league: "Liga",
  streakConsec: "Ketma-ket", dailyTask: "Kunlik mashq", dailyTaskDesc: "10 ta maxsus savolni yeching",
  // v1.1 Mock grid
  testlarTitle: "Testlar", aiTutor: "AI Tutor", comingSoonD: "Tez orada",
  allTopicsDesc: "Barcha mavzular", mistakesDesc: "Xato ustida ishlash",
  officialTickets: "Rasmiy biletlar", duelTitle: "Duel", duelDesc: "Do'st bilan duel",
  modesTitle: "Rejimlar",
  // Testlar sahifasi (mode chooser)
  t20: "20 talik tezkor test", t50Test: "50 talik test", t100: "100 talik test",
  examDesc: "Asl imtihon simulyatori", diffEasy: "Oson", diffMid: "O'rtacha",
  diffHard: "Qiyin", minWord: "daqiqa",
  mistakes: "Xatolar", lessonWord: "dars", allDoneWord: "Barcha darslar tugal ✓",
  // Test
  question: "savol", finish: "Yakunlash", prev: "Oldingi", next: "Keyingi",
  unanswered: "Javobsiz", results: "Natijalar", retry: "Qayta",
  correct: "To'g'ri", wrong: "Xato", passed: "O'tdi ✓", failed: "O'tmadi ✗",
  timeUp: "Vaqt tugadi!", explanation: "Tushuntirish",
  study: "O'rganish", notFoundQ: "Savol topilmadi",
  shareResult: "Natijani ulashish", backWord: "Orqaga",
  // Dashboard
  promoText: "1 oylik Qora Jentra tarifiga 25% chegirma. Faqat bugun!",
  darslikDesc: "Noldan imtihondan o'tguncha bo'lgan...",
  changeDate: "Sanani o'zgartirish", daysWord: "kun",
  correctShort: "to'g'ri", wrongShort: "xato", remainingShort: "qolgan",
  // Biletlar
  allTab: "Barchasi", errorsTab: "Xatolar",
  noErrors: "Xato yo'q — yaxshi natija!", loadingDots: "Yuklanmoqda...",
  ticketWord: "bilet",
  // Umumiy/interfeys
  guestName: "Foydalanuvchi", riderLabel: "YO'LOVCHI ›",
  flagThanks: "Xatolik haqidagi xabar qabul qilindi. Rahmat!",
  unansweredCount: "ta javob berilmagan savol bor",
  exitConfirm: "Test natijalari saqlanmaydi. Chiqish uchun yana bosing.",
  exitSure: "Chiqishda ishonchingiz komilmi?",
  voiceLesson: "Ovozli", videoLesson: "Video", ruleBook: "Qoidasi",
  discuss: "Muhokama", comingSoon: "Tez kunda",
  notFoundText: "Bunday sahifa topilmadi", homeBtn: "Bosh sahifaga",
  // Adaptive
  adaptiveTitle: "Smart / Adaptiv test",
  adaptiveDesc: "Sizga mos savollar",
  qAnswered: "ta savol javoblandi",
  exitAdaptive: "Chiqish",
  // Octagon
  octagonTitle: "Birga bir jang", findOpponent: "Raqib topish",
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
  addPhone: "Telefon raqami", langLabel: "Ilova tili",
  payHistory: "To'lovlar tarixi", offlineMode: "Oflayn rejim",
  themeLabel: "Mavzu", darkTheme: "Qorong'i", lightTheme: "Yorug'",
  themeSystem: "Tizim", themeSystemDesc: "Qurilma sozlamasiga ergashish",
  darkThemeDesc: "Doim qorong'i mavzu", lightThemeDesc: "Doim yorug' mavzu",
  resetProgress: "Progresni qayta boshlash", syncServer: "Serverdan yangilash",
  contactUs: "Biz bilan bog'lanish", tgChannel: "Telegram kanalimiz",
  rateApp: "Ilovani baholash", shareApp: "Ulashish", installApp: "Ilovani o'rnatish",
  upgradeHint: "Yanada ko'proq imkoniyatlar uchun", premiumHint: "Barcha imkoniyatlar",
  closedGroup: "Yopiq guruh", joinWord: "Qo'shilish",
  generalSection: "Umumiy", helpSection: "Yordam",
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
  adaptive: "Тест решение",
  // v1.1 Dashboard (Neon)
  greeting: "Привет", level: "Уровень", overallProgress: "Общий прогресс",
  continueLearn: "Продолжить", seeAll: "Все", league: "Лига",
  streakConsec: "Подряд", dailyTask: "Ежедневная тренировка", dailyTaskDesc: "Решите 10 специальных вопросов",
  // v1.1 Mock grid
  testlarTitle: "Тесты", aiTutor: "AI Tutor", comingSoonD: "Скоро",
  allTopicsDesc: "Все темы", mistakesDesc: "Работа с ошибками",
  officialTickets: "Официальные билеты", duelTitle: "Дуэль", duelDesc: "Дуэль с другом",
  modesTitle: "Режимы",
  // Testlar sahifasi (mode chooser)
  t20: "Быстрый тест 20", t50Test: "Тест 50", t100: "Тест 100",
  examDesc: "Симулятор реального экзамена", diffEasy: "Легко", diffMid: "Средне",
  diffHard: "Сложно", minWord: "минут",
  mistakes: "Ошибки", lessonWord: "урок", allDoneWord: "Все уроки завершены ✓",
  question: "вопрос", finish: "Завершить", prev: "Назад", next: "Далее",
  unanswered: "Без ответа", results: "Результаты", retry: "Ещё раз",
  correct: "Правильно", wrong: "Ошибка", passed: "Сдано ✓", failed: "Не сдано ✗",
  timeUp: "Время вышло!", explanation: "Объяснение",
  study: "Изучить", notFoundQ: "Вопрос не найден",
  shareResult: "Поделиться результатом", backWord: "Назад",
  promoText: "Скидка 25% на тариф Qora Jentra на 1 месяц. Только сегодня!",
  darslikDesc: "С нуля до экзамена...",
  changeDate: "Изменить дату", daysWord: "дн.",
  correctShort: "верно", wrongShort: "ошибок", remainingShort: "осталось",
  allTab: "Все", errorsTab: "С ошибками",
  noErrors: "Нет ошибок — отличный результат!", loadingDots: "Загрузка...",
  ticketWord: "билет",
  guestName: "Пользователь", riderLabel: "ПАССАЖИР ›",
  flagThanks: "Сообщение об ошибке получено. Спасибо!",
  unansweredCount: "вопросов без ответа",
  exitConfirm: "Результаты не сохранятся. Нажмите ещё раз для выхода.",
  exitSure: "Точно выйти?",
  voiceLesson: "Озвучка", videoLesson: "Видео", ruleBook: "Правило",
  discuss: "Обсуждение", comingSoon: "Скоро",
  notFoundText: "Страница не найдена", homeBtn: "На главную",
  adaptiveTitle: "Smart / Адаптивный тест",
  adaptiveDesc: "Подходящие вам вопросы",
  qAnswered: "вопросов отвечено",
  exitAdaptive: "Выйти",
  octagonTitle: "Совместный бой", findOpponent: "Найти соперника",
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
  themeSystem: "Системная", themeSystemDesc: "Как в настройках устройства",
  darkThemeDesc: "Всегда тёмная тема", lightThemeDesc: "Всегда светлая тема",
  resetProgress: "Сбросить прогресс", syncServer: "Обновить с сервера",
  contactUs: "Связаться с нами", tgChannel: "Наш Telegram канал",
  rateApp: "Оценить приложение", shareApp: "Поделиться", installApp: "Установить приложение",
  upgradeHint: "Для больших возможностей", premiumHint: "Все возможности",
  closedGroup: "Закрытая группа", joinWord: "Присоединиться",
  generalSection: "Общее", helpSection: "Помощь",
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
