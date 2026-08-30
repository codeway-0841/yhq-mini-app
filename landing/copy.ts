/** Landing matnlari — UZ birlamchi, RU ikkilamchi. */
export type Lang = 'uz' | 'ru'

type Pair = { uz: string; ru: string }

export const t = (p: Pair, lang: Lang) => (lang === 'uz' ? p.uz : p.ru)

export const copy = {
  nav: {
    features: { uz: 'Imkoniyatlar', ru: 'Возможности' } as Pair,
    process:  { uz: 'Qanday ishlaydi', ru: 'Как это работает' } as Pair,
    subjects: { uz: 'Fanlar', ru: 'Предметы' } as Pair,
    pricing:  { uz: 'Narxlar', ru: 'Цены' } as Pair,
    faq:      { uz: 'Savollar', ru: 'Вопросы' } as Pair,
    login:    { uz: 'Kirish', ru: 'Войти' } as Pair,
    cta:      { uz: 'Boshlash', ru: 'Начать' } as Pair,
  },
  hero: {
    pill: { uz: 'Yangi: haftalik Boss Battle rejimi', ru: 'Новое: еженедельный режим Boss Battle' } as Pair,
    h1a: { uz: 'Imtihonga tayyorgarlik.', ru: 'Подготовка к экзаменам.' } as Pair,
    h1b: { uz: 'Endi boshqacha.', ru: 'Теперь по-другому.' } as Pair,
    sub: {
      uz: "Yodlash bilan cheklanib qolmang. Mavzularni tushuning, bilimlaringizni amaliy savollar bilan mustahkamlang va imtihonga o‘xshash muhitda o‘zingizni sinab ko‘ring. Barcha fanlar uchun mashqlar, imtihon simulyatsiyasi va jonli duellar — samarali tayyorgarlik uchun kerak bo‘lgan hamma narsa bir joyda.",
      ru: 'Не ограничивайтесь зубрёжкой. Понимайте темы, закрепляйте знания практическими вопросами и проверяйте себя в атмосфере реального экзамена. Тренировки по всем предметам, симуляция экзамена и живые дуэли — всё необходимое для эффективной подготовки в одном месте.',
    } as Pair,
    ctaPrimary: { uz: 'Bepul boshlash', ru: 'Начать бесплатно' } as Pair,
    ctaSecondary: { uz: 'Qanday ishlaydi', ru: 'Как это работает' } as Pair,
    trust: { uz: 'Tez va oson ro‘yxatdan o‘ting.', ru: 'Быстрая и простая регистрация.' } as Pair,
    demoLabel: { uz: 'Jonli demo — bosing va sinang', ru: 'Живое демо — нажмите и проверьте' } as Pair,
  },
  stats: {
    q:    { uz: 'savollar bazasi', ru: 'вопросов в базе' } as Pair,
    subj: { uz: 'fan bitta platformada', ru: 'предметов на одной платформе' } as Pair,
    pvp:  { uz: 'jonli PvP arena', ru: 'живая PvP-арена' } as Pair,
    reg:  { uz: "ro'yxatdan o'tish vaqti", ru: 'время регистрации' } as Pair,
  },
  showcase: {
    eyebrow: { uz: 'Jonli demo', ru: 'Живое демо' } as Pair,
    title: { uz: 'Ilovani ochmasdan — hammasini ko‘ring', ru: 'Смотрите всё, не открывая приложение' } as Pair,
    sub: {
      uz: 'Asosiy jarayonlar shu yerda jonli ijro bo‘ladi — xuddi ilovani o‘zingiz ishlatayotgandek.',
      ru: 'Основные процессы работают прямо здесь — как будто вы уже пользуетесь приложением.',
    } as Pair,
    duel: {
      eyebrow: { uz: 'PvP duellar', ru: 'PvP-дуэли' } as Pair,
      title: { uz: 'Do‘stingizga qarshi jonli jang', ru: 'Живой бой против друга' } as Pair,
      body: {
        uz: 'Bir xil savollar ikkala ekranda real vaqtda. 10 raund — har biri 15 soniya: tezlik ham, aniqlik ham hisobga olinadi.',
        ru: 'Одинаковые вопросы на обоих экранах в реальном времени. 10 раундов по 15 секунд: считаются и скорость, и точность.',
      } as Pair,
      bullets: {
        uz: ['10 raund · har biri 15 soniya', 'Jonli rejim — hech qanday kechikishsiz', 'Havola yoki PIN orqali taklif'],
        ru: ['10 раундов · по 15 секунд', 'Живой режим — без задержек', 'Приглашение по ссылке или PIN'],
      },
      demoLabel: { uz: '', ru: '' } as Pair,
    },
    boss: {
      eyebrow: { uz: 'Boss Battle', ru: 'Boss Battle' } as Pair,
      title: { uz: 'Har hafta — jamoaviy boss jangi', ru: 'Каждую неделю — командный бой с боссом' } as Pair,
      body: {
        uz: 'Butun platforma bitta bossga qarshi birlashadi. Har bir to‘g‘ri javobingiz — jamoaga hissa. Boss yengilsa, mukofot barchaga beriladi.',
        ru: 'Вся платформа объединяется против одного босса. Каждый ваш верный ответ — вклад в общее дело. Победили — награда всем.',
      } as Pair,
      bullets: {
        uz: ['Har bir to‘g‘ri javob = 5 zarar', 'Boss yengilsa — barchaga coin', 'Har dushanba yangi boss'],
        ru: ['Каждый верный ответ = 5 урона', 'Босс повержен — монеты всем', 'Новый босс каждый понедельник'],
      },
      demoLabel: { uz: 'Jonli jamoaviy jang', ru: 'Живой командный бой' } as Pair,
    },
    shop: {
      eyebrow: { uz: 'Coinlar va merch', ru: 'Монеты и мерч' } as Pair,
      title: { uz: 'Coin evaziga HAQIQIY sovg‘alar', ru: 'РЕАЛЬНЫЕ подарки за монеты' } as Pair,
      body: {
        uz: 'To‘g‘ri javoblar, kunlik vazifalar va boss mukofotlari coin keltiradi. Yig‘ilgan coinlarni KIWI merchiga almashtiring — futbolka, shopper sumka yoki stikerlar to‘plami.',
        ru: 'Верные ответы, ежедневные задания и награды за боссов приносят монеты. Обменивайте их на мерч KIWI — футболку, шоппер или набор наклеек.',
      } as Pair,
      bullets: {
        uz: ['Har bir to‘g‘ri javob = 2 coin', 'Haqiqiy sovg‘alar: kiyim, sumka, stikerlar', 'Buyurtma ilovaning o‘zida rasmiylashtiriladi'],
        ru: ['Каждый верный ответ = 2 монеты', 'Реальные товары: одежда, сумка, наклейки', 'Заказ оформляется прямо в приложении'],
      },
      demoLabel: { uz: 'Coin → merch — jonli', ru: 'Монеты → мерч — живьём' } as Pair,
    },
  },
  bento: {
    eyebrow: { uz: 'Qo‘shimcha imkoniyatlar', ru: 'Ещё возможности' } as Pair,
    title: { uz: 'O‘rganish uchun qulay vositalar', ru: 'Набор полезных инструментов' } as Pair,
    sub: {
      uz: 'Har bir funksiya bitta maqsadga xizmat qiladi: imtihonni ishonch bilan a’lo darajada topshirishingiz uchun.',
      ru: 'Каждая функция служит одной цели: чтобы вы сдали экзамен с уверенностью.',
    } as Pair,
  },
  process: {
    eyebrow: { uz: 'Jarayon', ru: 'Процесс' } as Pair,
    title: { uz: 'Uch qadam — natijagacha', ru: 'Три шага — до результата' } as Pair,
  },
  subjects: {
    eyebrow: { uz: 'Fanlar', ru: 'Предметы' } as Pair,
    title: { uz: 'Bitta platforma — barcha fanlar', ru: 'Одна платформа — все предметы' } as Pair,
    sub: {
      uz: 'Hozir YHQ va Rus tili to‘liq faol. Qolgan fanlar bazasi to‘ldirilmoqda va tez orada ochiladi.',
      ru: 'Сейчас полностью активны ПДД и Русский язык. Базы остальных предметов пополняются и скоро откроются.',
    } as Pair,
    active: { uz: 'Faol', ru: 'Активен' } as Pair,
    soon: { uz: 'Tez kunda', ru: 'Скоро' } as Pair,
  },
  pricing: {
    eyebrow: { uz: 'Narxlar', ru: 'Цены' } as Pair,
    title: { uz: 'Oddiy va shaffof narxlar', ru: 'Простые и прозрачные цены' } as Pair,
    sub: {
      uz: 'Asosiy imkoniyatlar — bepul va cheksiz. Premium kerak bo‘lsa: barcha tariflar 30 kunga, yashirin to‘lovlar va avtomatik yechib olish yo‘q.',
      ru: 'Базовые возможности — бесплатно и без ограничений. Если нужен Premium: все тарифы на 30 дней, без скрытых платежей и автосписаний.',
    } as Pair,
    free: { uz: 'Bepul', ru: 'Бесплатно' } as Pair,
    freeSub: { uz: 'Boshlash uchun hamma narsa', ru: 'Всё для старта' } as Pair,
    per30: { uz: '/ 30 kun', ru: '/ 30 дней' } as Pair,
    popular: { uz: 'Eng ommabop', ru: 'Самый популярный' } as Pair,
    cta: { uz: 'Boshlash', ru: 'Начать' } as Pair,
    freeFeatures: {
      uz: ['1 000+ rasmiy YHQ savollari va biletlar', 'PvP duellar, reyting va boss janglari', 'Kunlik vazifalar, coinlar va merch', 'Belgilar o‘yini va flashcards'],
      ru: ['1 000+ официальных вопросов и билетов ПДД', 'PvP-дуэли, рейтинг и битвы с боссом', 'Ежедневные задания, монеты и мерч', 'Игра знаков и флешкарты'],
    },
    note: {
      uz: 'To‘lov Click yoki Payme orqali — xavfsiz. Promokod bilan chegirma mavjud. Obunani istalgan payt yangilamaslik mumkin — u o‘z-o‘zidan tugaydi.',
      ru: 'Оплата через Click или Payme — безопасно. По промокоду — скидка. Подписку можно не продлевать — она завершится сама.',
    } as Pair,
  },
  faq: {
    eyebrow: { uz: 'FAQ', ru: 'FAQ' } as Pair,
    title: { uz: 'Ko‘p so‘raladigan savollar', ru: 'Частые вопросы' } as Pair,
    items: [
      {
        q: { uz: 'KIWI bepulmi?', ru: 'KIWI бесплатный?' },
        a: {
          uz: 'Ha. Barcha testlar, biletlar, PvP duellar va belgilar o‘yini to‘liq bepul. Premium obuna ovozli sharhlar, video darslar va eksklyuziv temalarni ochadi.',
          ru: 'Да. Все тесты, билеты, PvP-дуэли и игра знаков полностью бесплатны. Подписка открывает аудиокомментарии, видеоуроки и эксклюзивные темы.',
        },
      },
      {
        q: { uz: 'Telegram kerakmi?', ru: 'Нужен ли Telegram?' },
        a: {
          uz: 'Ha, kerak. Platforma Telegram bot va Telegram Mini App orqali ishlaydi — barcha natijalar, eslatmalar va duel takliflari to‘g‘ridan-to‘g‘ri botingizga yuboriladi.',
          ru: 'Да, нужен. Платформа работает через Telegram-бота и Telegram Mini App — все результаты, напоминания и приглашения на дуэли приходят прямо в вашего бота.',
        },
      },
      {
        q: { uz: 'PvP duel qanday ishlaydi?', ru: 'Как работает PvP-дуэль?' },
        a: {
          uz: 'Ikki o‘yinchi bir xil savollarga jonli tarzda javob beradi. Unda tezlik ham, aniqlik ham muhim — harakatlar bir zumda, hech qanday kechikishlarsiz hisoblanadi.',
          ru: 'Два игрока отвечают на одинаковые вопросы одновременно в прямом эфире. Важны и скорость, и точность — результаты определяются мгновенно и без задержек.',
        },
      },
      {
        q: { uz: 'Boss Battle nima?', ru: 'Что такое Boss Battle?' },
        a: {
          uz: 'Har hafta butun platforma bitta kuchli bossga qarshi kurashadi. Har bir to‘g‘ri javob bossga 5 zarar yetkazadi. Boss yengilsa — barcha ishtirokchilar coin mukofotini oladi.',
          ru: 'Каждую неделю вся команда сражается с одним сильным боссом. Каждый правильный ответ наносит боссу 5 урона. Победили — все участники получают монеты.',
        },
      },
      {
        q: { uz: 'Coinlarni qayerga sarflash mumkin?', ru: 'Куда тратить монеты?' },
        a: {
          uz: 'To‘g‘ri javoblar, kunlik vazifalar, Lucky Spin va boss mukofotlari coin keltiradi. Ularni do‘konda mavzuli temalar, avatar ramkalari va premium kunlarga almashtirishingiz mumkin.',
          ru: 'Правильные ответы, ежедневные задания, Lucky Spin и награды за боссов приносят монеты. В магазине их можно обменять на темы, рамки аватара и дни премиума.',
        },
      },
      {
        q: { uz: 'Natijalarim saqlanib qoladimi?', ru: 'Сохраняются ли мои результаты?' },
        a: {
          uz: 'Ha. Barcha natijalaringiz serverda xavfsiz saqlanadi va akkauntingizga bog‘lanadi — Telegram, veb yoki Android ilovadan kirsangiz ham davom ettiraverasiz.',
          ru: 'Да. Весь прогресс хранится на сервере и привязан к аккаунту — продолжайте с Telegram, веба или Android-приложения.',
        },
      },
    ],
  },
  cta: {
    title: { uz: 'Bilimingizni bugun sinab ko‘ring', ru: 'Проверьте свои знания уже сегодня' } as Pair,
    sub: {
      uz: 'Tez va oson ro‘yxatdan o‘ting — birinchi test bepul, karta talab qilinmaydi.',
      ru: 'Зарегистрируйтесь за 30 секунд — первый тест бесплатно, карта не нужна.',
    } as Pair,
    button: { uz: 'Bepul boshlash', ru: 'Начать бесплатно' } as Pair,
    bot: { uz: "Telegram'da ochish", ru: 'Открыть в Telegram' } as Pair,
  },
  footer: {
    tagline: { uz: 'Zamonaviy ta’lim platformasi', ru: 'Современная образовательная платформа' } as Pair,
    app: { uz: 'Ilova', ru: 'Приложение' } as Pair,
    resources: { uz: 'Resurslar', ru: 'Ресурсы' } as Pair,
    start: { uz: 'Boshlash', ru: 'Начать' } as Pair,
    login: { uz: 'Kirish', ru: 'Войти' } as Pair,
    tgBot: { uz: 'Telegram bot', ru: 'Telegram-бот' } as Pair,
    privacy: { uz: 'Maxfiylik siyosati', ru: 'Политика конфиденциальности' } as Pair,
    rights: { uz: 'Barcha huquqlar himoyalangan.', ru: 'Все права защищены.' } as Pair,
  },
}
