/**
 * Darslik kontenti — har bir modul uchun darslar (UZ/RU).
 * modules.ts dagi lessonCount bilan bir xil uzunlikda bo'lishi shart.
 */

export interface Lesson {
  titleUz: string
  titleRu: string
  bodyUz:  string[]
  bodyRu:  string[]
}

/** moduleId → darslar ro'yxati */
export const lessons: Record<number, Lesson[]> = {
  // ─── 1-modul: Yo'l belgilari (7 dars) ──────────────────────────────
  1: [
    {
      titleUz: "Ogohlantirish belgilari",
      titleRu: "Предупреждающие знаки",
      bodyUz: [
        "Ogohlantirish belgilari haydovchini yo'ldagi xavfli joylar haqida oldindan xabardor qiladi. Ko'pincha qizil ramkali oq uchburchak shaklida bo'ladi.",
        "Bunday belgilarni ko'rganingizda tezlikni kamaytiring va harakatga ehtiyotkorlik bilan hozirlaning. Belgi bevosita taqiq qo'ymaydi, lekin xavfni bartaraf etishga tayyor turishingiz kerak.",
        "Masalan: 'Xavfli burilish', 'Sirpanchiq yo'l', 'Piyodalar o'tish joyi', 'Bolalar', 'Temir yo'l kesishmasi' belgilari."
      ],
      bodyRu: [
        "Предупреждающие знаки заранее информируют водителя об опасных участках дороги. Обычно это белый треугольник с красной окантовкой.",
        "Увидев такой знак, снизьте скорость и будьте готовы к манёврам. Знак ничего не запрещает напрямую, но требует повышенного внимания.",
        "Примеры: «Опасный поворот», «Скользкая дорога», «Пешеходный переход», «Дети», «Железнодорожный переезд»."
      ],
    },
    {
      titleUz: "Ustuvorlik belgilari",
      titleRu: "Знаки приоритета",
      bodyUz: [
        "Ustuvorlik belgilari tartibga solinmagan chorrahalarda harakat ketma-ketligini belgilaydi: kim birinchi o'tishi kerakligini ko'rsatadi.",
        "'Asosiy yo'l' (2.1) — siz ustuvorlikka egasiz. 'Yo'l bering' (2.4) va 'To'xtang' (2.5) — boshqa transport vositalariga yo'l berishingiz shart.",
        "'To'xtang' (STOP) belgisida to'liq to'xtash majburiy — hatto yo'l bo'sh bo'lsa ham."
      ],
      bodyRu: [
        "Знаки приоритета определяют очерёдность проезда на нерегулируемых перекрёстках: кто должен проехать первым.",
        "«Главная дорога» (2.1) — у вас приоритет. «Уступите дорогу» (2.4) и «Движение без остановки запрещено» (2.5) — вы обязаны уступить.",
        "На знаке STOP (2.5) обязательна полная остановка — даже если дорога свободна."
      ],
    },
    {
      titleUz: "Taqiqlovchi belgilari",
      titleRu: "Запрещающие знаки",
      bodyUz: [
        "Taqiqlovchi belgilari qizil doira shaklida bo'ladi va ma'lum harakatlarni taqiqlaydi: kirish, quvib o'tish, to'xtash, tezlik va h.k.",
        "Taqiqlovchi belgi o'sha belgi o'rnatilgan joydan keyingi chorrahalargacha (yoki zona tugashi belgisigacha) amal qiladi.",
        "Tezlikni cheklash (3.24) belgisi faqat ko'rsatilgan tezlikdan yuqorisini taqiqlaydi — pastroq harakatlanishga ruxsat."
      ],
      bodyRu: [
        "Запрещающие знаки имеют форму красного круга и запрещают определённые действия: въезд, обгон, остановку, скорость и т.д.",
        "Знак действует от места установки до ближайшего перекрёстка (или до знака конца зоны ограничений).",
        "Ограничение скорости (3.24) запрещает движение только быстрее указанной — медленнее ехать можно."
      ],
    },
    {
      titleUz: "Buyruq belgilari",
      titleRu: "Предписывающие знаки",
      bodyUz: [
        "Buyruq belgilari ko'k doira shaklida bo'ladi va ruxsat etilgan harakat yo'nalishlarini yoki boshqa majburiy talablarni bildiradi.",
        "Masalan: 'To'g'riga harakat', 'O'ngga burilish', 'Aylanma harakat' — faqat ko'rsatilgan yo'nalishda harakatlanish mumkin.",
        "'Piyodalar yo'lkasi' (4.5) belgisi o'rnatilgan yo'lkada faqat piyodalar harakatlanishi mumkin."
      ],
      bodyRu: [
        "Предписывающие знаки имеют форму синего круга и указывают разрешённые направления движения или иные обязательные требования.",
        "Например: «Движение прямо», «Движение направо», «Круговое движение» — двигаться можно только в указанном направлении.",
        "На дорожке со знаком «Пешеходная дорожка» (4.5) могут двигаться только пешеходы."
      ],
    },
    {
      titleUz: "Axborot-ko'rsatgich belgilari",
      titleRu: "Информационно-указательные знаки",
      bodyUz: [
        "Axborot-ko'rsatgich belgilari (ko'k to'rtburchak) haydovchiga yo'l va atrofdagi obyektlar haqida ma'lumot beradi: avtoturargoh, shifoхона, avtomagistral, teskari harakat yo'li.",
        "'Avtomagistral' (5.1) belgisidan keyin maxsus qoidalar boshlanadi: to'xtash, orqaga harakatlanish va o'quv haydashi taqiqlanadi.",
        "'Teskari harakat yo'li' (5.6) — bu yo'lda ikki yo'nalishli harakat; quvib o'tish alohida qoidalarga bo'ysunadi."
      ],
      bodyRu: [
        "Информационно-указательные знаки (синий прямоугольник) информируют о дороге и окружающих объектах: стоянка, больница, автомагистраль, дорога с односторонним движением.",
        "После знака «Автомагистраль» (5.1) действуют особые правила: остановка, движение задним ходом и учебная езда запрещены.",
        "«Дорога с односторонним движением» (5.6) указывает направление одностороннего движения."
      ],
    },
    {
      titleUz: "Xizmat ko'rsatish belgilari",
      titleRu: "Знаки сервиса",
      bodyUz: [
        "Xizmat ko'rsatish belgilari yo'l bo'ylab joylashgan xizmat obyektlarini ko'rsatadi: yoqilg'i quyish stansiyasi, avtouyiv, mehmonxona, oziq-ovqat nuqtasi, telefon.",
        "Bu belgilar oq fonda ko'k kvadrat ichida qora belgi shaklida bo'ladi va hech qanday taqiq yoki majburiyat kiritmaydi.",
        "Belgi oldidan obyektgacha bo'lgan masofa ko'rsatilgan tablitsa bo'lishi mumkin."
      ],
      bodyRu: [
        "Знаки сервиса указывают расположение объектов обслуживания вдоль дороги: АЗС, мойка, гостиница, пункт питания, телефон.",
        "Это чёрный символ в синем квадрате на белом фоне. Знаки не вводят запретов и обязательств.",
        "Перед знаком может стоять табличка с расстоянием до объекта."
      ],
    },
    {
      titleUz: "Qo'shimcha axborot belgilari (tablitsalar)",
      titleRu: "Знаки дополнительной информации (таблички)",
      bodyUz: [
        "Tablitsalar asosiy belgi bilan birga o'rnatiladi va uning amal qilish zonasini, masofa yo'nalishini yoki qaysi transport turiga tegishli ekanini aniqlashtiradi.",
        "'Amal qilish zonasi' tablitsasi (8.2.1) — belgi faqat ko'rsatilgan masofada amal qiladi.",
        "'Transport vositasi turi' tablitsasi — belgi faqat ko'rsatilgan transport turiga nisbatan amal qiladi."
      ],
      bodyRu: [
        "Таблички устанавливаются вместе с основным знаком и уточняют зону его действия, направление или вид транспорта, на который распространяется знак.",
        "Табличка «Зона действия» (8.2.1) — знак действует только на указанном расстоянии.",
        "Табличка «Вид транспортного средства» — знак действует только для изображённого вида транспорта."
      ],
    },
  ],

  // ─── 2-modul: Chorrahalar (6 dars) ─────────────────────────────────
  2: [
    {
      titleUz: "Tartibga solingan chorrahalar",
      titleRu: "Регулируемые перекрёстки",
      bodyUz: [
        "Tartibga solingan chorraha — svetofor yoki tartibga soluvchi (rostdagi nazoratchi) boshqaradigan chorraha. Bu yerda ustuvorlik belgilari AMAL QILMAYDI.",
        "Svetofor yashil bo'lsa ham, burilishda piyodalarga va velosipedchilarga yo'l bering.",
        "Tartibga soluvchi ishoralari svetofor va belgilardan ustun turadi — avval uning ishoralariga bo'ysuning."
      ],
      bodyRu: [
        "Регулируемый перекрёсток — это перекрёсток, управляемый светофором или регулировщиком. Знаки приоритета здесь НЕ действуют.",
        "Даже при зелёном свете, поворачивая, уступите пешеходам и велосипедистам.",
        "Жесты регулировщика имеют приоритет над светофором и знаками — подчиняйтесь прежде всего им."
      ],
    },
    {
      titleUz: "Tartibga solinmagan chorrahalar",
      titleRu: "Нерегулируемые перекрёстки",
      bodyUz: [
        "Tartibga solinmagan chorrahada asosiy qoida: belgilar, keyin asosiy/ikkinchi darajali yo'l tushunchasi, eng oxirida esa 'o'ng tomondagi g'ovuq' qoidasi.",
        "Agar asosiy yo'l yo'nalishini o'zgartirsa, asosiy yo'ldagi haydovchilar o'zaro 'o'ng tomondagi g'ovuq' qoidasi bo'yicha o'tishadi.",
        "Дужорест: 'o'ng g'ovuq' qoidasi faqat teng ahamiyatli yo'llar kesishganda qo'llaniladi."
      ],
      bodyRu: [
        "На нерегулируемом перекрёстке: сначала знаки, затем понятие главной/второстепенной дороги, и лишь в конце — правило «помехи справа».",
        "Если главная дорога меняет направление, водители на главной дороге проезжают друг друга по правилу «помехи справа».",
        "Правило «помехи справа» действует только при пересечении равнозначных дорог."
      ],
    },
    {
      titleUz: "Asosiy yo'l tushunchasi",
      titleRu: "Понятие главной дороги",
      bodyUz: [
        "Asosiy yo'l — qattiq qoplama (asfalt, beton) bo'lgan yoki 'Asosiy yo'l' belgisi bilan belgilangan yo'l. Qumli yo'l har doim ikkinchi darajali.",
        "Ikkinchi darajali yo'ldan chiqayotgan haydovchi asosiy yo'ldagi barcha transport vositalariga yo'l berishi shart.",
        "Asosiy yo'l yo'nalishini o'zgartirsa, bu belgi yoki tablitsa bilan ko'rsatiladi (8.15 — asosiy yo'l yo'nalishi)."
      ],
      bodyRu: [
        "Главная дорога — дорога с твёрдым покрытием (асфальт, бетон) или обозначенная знаком «Главная дорога». Грунтовая дорога всегда второстепенная.",
        "Водитель, выезжающий со второстепенной дороги, обязан уступить всем транспортным средствам на главной.",
        "Изменение направления главной дороги обозначается знаком или табличкой (8.15 — направление главной дороги)."
      ],
    },
    {
      titleUz: "Tramvay ustuvorligi",
      titleRu: "Приоритет трамвая",
      bodyUz: [
        "Teng ahamiyatli yo'llarda tramvay yo'l transport vositalaridan qat'iy nazar, har doim ustuvorlikka ega (burilish yo'nalishidan qat'iy nazar).",
        "Lekin tartibga solinmagan chorrahada tramvay ham 'o'ng tomondagi g'ovuq' qoidasiga bo'ysunadi — agar u o'ngdan kelayotgan boshqa tramvayga nisbatan bo'lmasa.",
        "Svetofor bilan boshqariladigan chorrahada har kim faqat o'z svetofori signaliga bo'ysunadi."
      ],
      bodyRu: [
        "На равнозначных дорогах трамвай всегда имеет приоритет перед безрельсовыми транспортными средствами независимо от направления движения.",
        "Однако на нерегулируемом перекрёстке трамвай также подчиняется правилу «помехи справа» по отношению к другим трамваям.",
        "На регулируемом перекрёстке все подчиняются только сигналам своего светофора."
      ],
    },
    {
      titleUz: "Aylanma harakat (aylantirish aylanasi)",
      titleRu: "Круговое движение",
      bodyUz: [
        "Aylanma harakatli chorraha — bu tartibga solinmagan chorraha; u yerda 'Aylanma harakat' (4.3) belgisi o'rnatiladi.",
        "Замалда келган 'Yo'l bering' (2.4) belgisi bo'lsa, kirmoqchi bo'lgan haydovchi aylanadagi harakatlanayotgan transportga yo'l beradi.",
        "Aylanada quvib o'tish va to'xtab turish taqiqlanadi — chiqish yo'nalishini oldindan egallang."
      ],
      bodyRu: [
        "Перекрёсток с круговым движением — нерегулируемый перекрёсток, обозначенный знаком «Круговое движение» (4.3).",
        "Если перед въездом стоит знак «Уступите дорогу» (2.4), въезжающий водитель уступает тем, кто уже движется по кругу.",
        "На круговом движении обгон и остановка запрещены — заранее займите нужную полосу для выезда."
      ],
    },
    {
      titleUz: "Kechikish va tiqin holatida",
      titleRu: "Заторы и «вафельное» правило",
      bodyUz: [
        "Tiqin paytida chorrahaga kirish taqiqlanadi — agar bu boshqa yo'nalishdagi transportga to'sqinlik qilsa (imtixon savollarida tez uchraydi).",
        "Золо-сарыq (nogiron to'rtburchak chiziqlari — 'vafelni belgilash') kesib o'tib faqat to'xtab turmaydigan holda harakatlanish mumkin.",
        "Chorrahani kesib o'tayotganda harakatlanishni to'xtatish tiqin sharoitida yo'l hang'amasi yo'qolishining oldini oladi."
      ],
      bodyRu: [
        "При заторе запрещено выезжать на перекрёсток, если это создаст помехи транспорту, движущемуся в поперечном направлении.",
        "По жёлтой разметке («вафельная») можно двигаться только без остановки на ней.",
        "Соблюдение этого правила предотвращает парализацию перекрёстка при заторе."
      ],
    },
  ],

  // ─── 3-modul: To'xtash va to'xtab turish (5 dars) ──────────────────
  3: [
    {
      titleUz: "Farqi: to'xtash va to'xtab turish",
      titleRu: "Разница: остановка и стоянка",
      bodyUz: [
        "To'xtash — 5 daqiqagacha bo'lgan qisqa muddatli to'xtash (yo'lovchi tushirish, yuk?. Nimetovish yoki svetofor signali talabi).",
        "To'xtab turish — 5 daqiqadan ortiq, yo'lovchi tushirish yoki yuklash bilan bog'liq bo'lmagan harakatni to'xtatish.",
        "Taqiq belgisi 3.27 — ikkalasini ham taqiqlaydi; 3.28 — faqat to'xtab turishni taqiqlaydi (to'xtash mumkin)."
      ],
      bodyRu: [
        "Остановка — кратковременная остановка до 5 минут (высадка пассажиров, загрузка, требование светофора).",
        "Стоянка — прекращение движения более чем на 5 минут, не связанное с посадкой/высадкой или загрузкой.",
        "Знак 3.27 запрещает и то, и другое; 3.28 запрещает только стоянку (останавливаться можно)."
      ],
    },
    {
      titleUz: "To'xtash taqiqlangan joylar",
      titleRu: "Где запрещена остановка",
      bodyUz: [
        "Temir yo'l kesishmasida, tunnelda, ko'prikda, ko'taruvchi kovushda va ostida — to'liq taqiqlanadi.",
        "Piyodalar o'tish joyida va undan 5 metr oldin — taqiqlanadi. Avtobus bekatlaridan 15 metr ichida — taqiqlanadi.",
        "Jarima chegarasiga e'tibor bering: chiziq 1.4 (sariq) to'xtab turishni, chiziq 1.10 (sariq uzun chiziq) to'xtashni taqiqlaydi."
      ],
      bodyRu: [
        "На железнодорожных переездах, в тоннелях, на мостах, эстакадах и под ними — полностью запрещено.",
        "На пешеходном переходе и ближе 5 метров перед ним — запрещено. В пределах 15 метров от остановки автобуса — запрещено.",
        "Разметка 1.4 (жёлтая сплошная) запрещает стоянку, 1.10 (жёлтая прерывистая) запрещает и остановку."
      ],
    },
    {
      titleUz: "Ruxsat etilgan joylar",
      titleRu: "Где стоянка разрешена",
      bodyUz: [
        "Yo'lning o'ng chetida, yo'l chetkasida (chetkening), yoki maxsus ajratilgan turargohlarda to'xtab turish mumkin.",
        "Aholi punktida chiqib old Toshkentdan chetda ?  Binolar orasidan tor ko'chalar — faqat transport oquviga xalaqulik bermaydigan joyda.",
        "Tungi vaqtda yo'l chetkasida to'xtab turganda gabarit chiroqlarini yoritish yoki avariya signalini yoqish shart."
      ],
      bodyRu: [
        "Останавливаться можно на правом крае проезжей части, на обочине или в специально отведённых местах для стоянки.",
        "В населённых пунктах на узких улицах — только если это не мешает движению транспорта.",
        "Ночью на обочине при остановке обязательно включить габаритные огни или аварийную сигнализацию."
      ],
    },
    {
      titleUz: "Avtobus bekatlari va temir yo'l kesishmalari",
      titleRu: "Остановки транспорта и переезды",
      bodyUz: [
        "Avtobus bekatidan 15 metr ichida faqat marshrutli transport to'xtashi mumkin — oddiy avtomobillar faqat yo'lovchi tushirish/olish uchun qisqa to'xtashi mumkin (agar xalaqulik bermasa).",
        "Temir yo'l kesishmasida to'xtash qat'iyan taqiqlanadi — hatto shlagbaum ochiq bo'lsa ham.",
        "Kesishmaga 50 metrdan kam masofada quvib o'tish taqiqlanadi."
      ],
      bodyRu: [
        "В пределах 15 метров от автобусной остановки останавливаться может только маршрутный транспорт — обычные автомобили лишь для краткой посадки/высадки (если не мешают).",
        "Остановка на железнодорожном переезде категорически запрещена — даже если шлагбаум открыт.",
        "Обгон ближе чем за 50 метров до переезда запрещён."
      ],
    },
    {
      titleUz: "To'xtashda qilingan tipik xatolar",
      titleRu: "Типичные ошибки при остановке",
      bodyUz: [
        "Chiziqli to'xtab turishgan joyning chegaralpasidan chiqib ketish — eng ko'p uchraydigan jarimalardan biri.",
        "Ikkinchi qatorda to'xtab turish (double parking) qat'iyan taqiqlanadi — bu harakatga jiddiy xalaqulik keltiradi.",
        "Tungi vaqtda va ko'rinmaslikda gabarit chiroqlarsiz to'xtab turish — halokat keltirib chiqaradi."
      ],
      bodyRu: [
        "Выход за границы обозначенного места для стоянки — одно из самых распространённых нарушений.",
        "Стоянка вторым рядом (double parking) категорически запрещена — это серьёзное препятствие движению.",
        "Остановка ночью и в условиях недостаточной видимости без габаритных огней приводит к ДТП."
      ],
    },
  ],

  // ─── 4-modul: Manyovrlar (8 dars) ──────────────────────────────────
  4: [
    {
      titleUz: "Burilish qoidalari",
      titleRu: "Правила поворота",
      bodyUz: [
        "Burilishdan oldin tegishli qatnov qismini oldindan egallang va burilish ko'rsatkichini yoqing.",
        "O'ngga burilish — eng o'ng qatnov qismdan, iloji boricha o'ng chekkaga yaqin. Chapga burilish yoki qaytish — eng chap qatnov qismdan.",
        "Ko'p qatnov qismida burilishganda boshqa qatnov qismlardagi transportga xalaqulik bermang."
      ],
      bodyRu: [
        "Перед поворотом заранее займите соответствующую полосу и включите указатель поворота.",
        "Поворот направо — с крайней правой полосы, как можно правее. Поворот налево или разворот — с крайней левой полосы.",
        "При повороте с многополосной дороги не создавайте помех транспорту, движущемуся по соседним полосам."
      ],
    },
    {
      titleUz: "Qaytish (разворот)",
      titleRu: "Разворот",
      bodyUz: [
        "Qaytish eng chap qatnov qismdan amalga oshiriladi; agar qatnov qismi Qaytishga imkon bermasa, o'ng chekkadan ham mumkin (faqat alohida belgilanmagan joylarda).",
        "Qaytishda barcha yo'l qatnashchilariga (piyodalar ham) yo'l bering — siz birinchi bo'lib bura olmaysiz.",
        "Ko'prikda, tunnelda, temir yo'l kesishmasida va piyodalar o'tish joyida qaytish qat'iyan taqiqlanadi."
      ],
      bodyRu: [
        "Разворот выполняется с крайней левой полосы; если ширина не позволяет — допускается с правого края (если нет специальных знаков).",
        "При развороте уступите дорогу всем участникам движения, включая пешеходов.",
        "Разворот категорически запрещён на мостах, в тоннелях, на железнодорожных переездах и пешеходных переходах."
      ],
    },
    {
      titleUz: "Orqaga harakatlanish",
      titleRu: "Движение задним ходом",
      bodyUz: [
        "Orqaga harakatlanishga faqat boshqa transport va piyodalarga xalaqulik bermaydigan holotta ruxsat etiladi.",
        "Chorrahada va piyodalar o'tish joyida orqaga harakatlanish taqiqlanadi.",
        "Shart bo'lsa, tashqaridan turuvchi kishining yordamini oling — bu imtixon savollarida to'g'ri javob sanaladi."
      ],
      bodyRu: [
        "Движение задним ходом разрешено только если это не создаст помех другим транспортным средствам и пешеходам.",
        "На перекрёстках и пешеходных переходах движение задним ходом запрещено.",
        "При необходимости воспользуйтесь помощью человека, стоящего снаружи — это правильный ответ на экзамене."
      ],
    },
    {
      titleUz: "Quvib o'tish (обгон)",
      titleRu: "Обгон",
      bodyUz: [
        "Quvib o'tish — qarama-qarshi qatnov qismiga chiqib bajariladi. Oldindan ishonch hosil qiling: qarama-qarshi yo'l bo'sh va harakat xavfsiz.",
        "Quvib o'tishdan oldin burilish ko'rsatkichini yoqing, jarima chiroq (farlarni) almashtiring yoki ovoz signalini bering (shaxardan tashqarida).",
        "Quvib o'tilayotgan avtomobil uzil-kesil o'ng qatnov qismsiga qaytishi va ortiqcha masofani saqlashi shart."
      ],
      bodyRu: [
        "Обгон выполняется с выездом на полосу встречного движения. Убедитесь: встречная полоса свободна и манёвр безопасен.",
        "Перед обгоном включите указатель поворота, переключите свет фар или подайте звуковой сигнал (вне населённого пункта).",
        "Обгоняемый автомобиль не должен увеличивать скорость."
      ],
    },
    {
      titleUz: "Quvib o'tish taqiqlangan joylar",
      titleRu: "Где запрещён обгон",
      bodyUz: [
        "Tartibga solingan chorrahalarda va tartibga solinmagan chorrahalarda (ikkinchi darajali yo'lda harakatlanganda) — taqiqlanadi.",
        "Piyodalar o'tish joyi, temir yo'l kesishmasi va unga yaqin 50 m, tunnel, ko'prik, ko'taruvchi ostida — taqiqlanadi.",
        "Oxirgi qismi ko'rinmaydigan burilishlar va ko'tarilishlar oxirida ham quvib o'tish taqiqlanadi."
      ],
      bodyRu: [
        "Обгон запрещён на регулируемых перекрёстках и на нерегулируемых (при движении по второстепенной дороге).",
        "На пешеходных переходах, жд переездах и ближе чем 50 м до них, в тоннелях, на мостах и под эстакадами — запрещён.",
        "Также запрещён в конце подъёма и на поворотах с ограниченной видимостью."
      ],
    },
    {
      titleUz: "Qatnov qismi o'zgartirish",
      titleRu: "Перестроение",
      bodyUz: [
        "Qatnov qismini o'zgartirishda ushbu qatnov qismida harakatlanayotgan transport vositalariga yo'l bering.",
        "Bir vaqtning o'zida ikki transport bir qatnov qismiga o'zgarsa, o'ng tomonda bo'lgan ustuvorlikka ega ('o'ng g'ovuq').",
        "Oldindan ko'zguni tekshiring, ko'rsatkichni yoqing va faqat xavfsiz nisbatganda o'zgarishni boshlang."
      ],
      bodyRu: [
        "При перестроении уступите транспортным средствам, движущимся по соседней полосе без изменения направления.",
        "Если два ТС одновременно перестраиваются в одну полосу — приоритет у того, кто справа («помеха справа»).",
        "Проверьте зеркала, включите указатель и начинайте перестроение только при безопасной дистанции."
      ],
    },
    {
      titleUz: "Ko'rsatkich signallari",
      titleRu: "Сигналы указателей",
      bodyUz: [
        "Burilish ko'rsatkichlari harakat boshlanishidan oldin yoqilishi va tugagandan keyin o'chirilishi kerak.",
        "Qo'l bilan signal berish — faqat ko'rsatkich ishlamasa: o'ng burilish — chap qo'l tirsakdan bukilgan yuқoriga; chap burilish — chap qo'l yon tomonga.",
        "Avariya signalization (avariyka) to'xtagan transport haqida boshqalarni ogohlantiradi — unga majburiy bo'lib qo'llaniladi."
      ],
      bodyRu: [
        "Указатели поворота должны включаться до начала манёвра и выключаться после его завершения.",
        "Подача сигнала рукой — только при неисправности указателей: поворот направо — согнутая в локте левая рука вверх; налево — рука в сторону.",
        "Аварийная сигнализация предупреждает об остановившемся транспорте — применение обязательно во многих случаях."
      ],
    },
    {
      titleUz: "Imtihonda eng ko'p uchraydigan manyovr xatolari",
      titleRu: "Частые ошибки маневрирования на экзамене",
      bodyUz: [
        "Chorrahada orqaga harakatlanish va qaytish — taqiqlanadi (imtihonning keng tarqalgan savollaridan).",
        "Quvib o'tishni bosha qaytish — oxirgi natijasini anglamasdan tez-tez xatolik keltiradi: tunel, ko'prik, kesishma oldidan taqiqlanganini unutish.",
        "Ko'rsatkich yoqmasdan qatnov qismini o'zgartirish — imtihonda xato deb hisoblanadi."
      ],
      bodyRu: [
        "Движение задним ходом и разворот на перекрёстке — запрещены (частые экзаменационные вопросы).",
        "Частая ошибка — забыть, что обгон запрещён перед тоннелем, мостом, жд переездом.",
        "Перестроение без включения указателя поворота — на экзамене засчитывается как ошибка."
      ],
    },
  ],

  // ─── 5-modul: Maxsus vaziyatlar (6 dars) ───────────────────────────
  5: [
    {
      titleUz: "Maxsus signalli transport",
      titleRu: "Транспорт со спецсигналами",
      bodyUz: [
        "Yaqinlashayotgan maxsus xizmat transportiga (tez yordam, yong'in, militsiya) yaltiroq chiroq va maxsus ovoz signali yoqilgan bo'lsa — yo'l bering: chetga surib to'xtang.",
        "Yo'l bermaslik uchun jiddiy jarima belgilangan va imtihonda ham muhim mavzu.",
        "Maxsus signal yoqilmagan transport oddiy qoidalarga bo'ysunadi — yo'l berish majburiy emas."
      ],
      bodyRu: [
        "Приближающемуся спецтранспорту (скорая, пожарная, милиция) с включённым проблесковым маячком и звуковым сигналом — уступите дорогу: прижмитесь к краю и остановитесь.",
        "За невыполнение предусмотрен серьёзный штраф, тема часто встречается на экзамене.",
        "Транспорт без включённых спецсигналов подчиняется обычным правилам — уступать не обязательно."
      ],
    },
    {
      titleUz: "Yuk tashish qoidalari",
      titleRu: "Правила перевозки грузов",
      bodyUz: [
        "Yuk transport o'lchamlaridan chiqib turmasligi yoki mahkam joylashtirilishi kerak; tushib ketmasligi va xalakulik keltirmasligi shart.",
        "2,5 metrdan ortiq chiqib turadigan yuk uchun maxsus ruxsatnoma talab etiladi.",
        "Yuk old va orqa tomondan 1 metrdan ortiq chiqib turgan bo'lsa, kunduzi 'Katta yuk' belgisi, tunda chiroq va qaytaruvchi blik o'rnatiladi."
      ],
      bodyRu: [
        "Груз не должен выступать за габариты транспорта или должен быть надёжно закреплён; не должен падать или создавать помехи.",
        "Для груза, выступающего более чем на 2,5 метра, требуется специальное разрешение.",
        "Если груз выступает спереди/сзади более чем на 1 метр — знак «Крупногабаритный груз» днём, фонари и световозвращатели ночью."
      ],
    },
    {
      titleUz: "Temir yo'l kesishmalari",
      titleRu: "Железнодорожные переезды",
      bodyUz: [
        "Kesishmaga faqat shlagbaum ochiq bo'lganda va yo'l bo'sh bo'lganda kiring — kesishmada moshina to'xtab tiqilib qolmasligi uchun.",
        "Qizil chiroq yonib-turib (yoki miltillovchi) bo'lsa, ovoz signali tinglansa — to'xtang.",
        "Kesishmada quvib o'tish, to'xtash, orqaga harakatlanish va qaytish qat'iyan taqiqlanadi."
      ],
      bodyRu: [
        "Въезжайте на переезд только при открытом шлагбауме и свободном пути — чтобы не застрять на переезде.",
        "При горящем или мигающем красном сигнале, а также при звуковом сигнале — остановитесь.",
        "На переезде категорически запрещены обгон, остановка, движение задним ходом и разворот."
      ],
    },
    {
      titleUz: "Tunnel va ko'priklar",
      titleRu: "Тоннели и мосты",
      bodyUz: [
        "Tunnelda yaqin yoritish chiroqlarini yoqing, quvib o'tish va to'xtab turish taqiqlanadi.",
        "Ko'prik ustida va ostida qaytish va orqaga harakatlanish taqiqlanadi.",
        "Tor ko'priklarda qarama-qarshi harakatda ehtiyotkorlik bilan yaqinlashib, birinchilikni belgilab oling."
      ],
      bodyRu: [
        "В тоннеле включите ближний свет, обгон и остановка запрещены.",
        "На мостах и под ними запрещены разворот и движение задним ходом.",
        "На узких мостах осторожно сближайтесь со встречным транспортом, заранее определите очерёдность."
      ],
    },
    {
      titleUz: "Sirpanchiq yo'l va muzlama",
      titleRu: "Скользкая дорога и гололёд",
      bodyUz: [
        "Sirpanchiq yo'lda keskin tormozlash va burilish — oldini olish uchun tezlikni kamaytiring va masofani oshiring.",
        "Muzlamada harakatlanish tezligini 10–15 km/soatgacha kamaytirish va silliq rul boshqaruvi tavsiya etiladi.",
        "Oldingi transport bilan masofani kamida ikki baravar oshirish — barqaror tormoz yo'li oshib ketadi."
      ],
      bodyRu: [
        "На скользкой дороге избегайте резкого торможения и поворотов — заранее снижайте скорость и увеличивайте дистанцию.",
        "При гололёде рекомендуется двигаться со скоростью 10–15 км/ч и плавно управлять рулём.",
        "Увеличьте дистанцию до впереди идущего транспорта минимум вдвое — тормозной путь значительно возрастает."
      ],
    },
    {
      titleUz: "Yomg'ir va tuman",
      titleRu: "Дождь и туман",
      bodyUz: [
        "Yomg'irda suv pelenchasi (akvaplaning) xavfi oshadi — tezlikni kamaytirish tavsiya etiladi.",
        "Tumanda yaqin yoritish chiroqlarini yoqing — uzoq yoritish tuman pardasidan qaytib ko'zlarni qamashtiradi.",
        "Ko'rinmaslik 300 metrdan kam bo'lsa, harakatlanish chegarasiga jiddiy ehtiyotkorlik bilan rioya eting; sharoit yomonlashsa to'xtab turish afzal."
      ],
      bodyRu: [
        "При дожде возрастает риск аквапланирования — рекомендуется снизить скорость.",
        "В тумане включите ближний свет — дальний свет отражается от тумана и слепит.",
        "При видимости менее 300 метров соблюдайте особую осторожность; при ухудшении условий лучше остановиться."
      ],
    },
  ],

  // ─── 6-modul: Tezlik va masofa (5 dars) ────────────────────────────
  6: [
    {
      titleUz: "Aholi punktida tezlik",
      titleRu: "Скорость в населённых пунктах",
      bodyUz: [
        "Aholi punktida transport vositalarining maksimal tezligi 70 km/soat (agar belgilar bilan boshqa cheklanmagan bo'lsa).",
        "Yashash hududida (5.30 belgisi) tezlik 20 km/soatdan oshmasligi kerak — bu yerda piyodalar ustuvor.",
        "Tezlik cheklovi 3.24 belgisida ko'rsatilgan raqamdan yuqori bo'lmasligi shart; pastroq ruxsat etiladi."
      ],
      bodyRu: [
        "В населённом пункте максимальная скорость — 70 км/ч (если знаками не установлено иное).",
        "В жилой зоне (знак 5.30) скорость не должна превышать 20 км/ч — приоритет у пешеходов.",
        "Ограничение знаком 3.24 запрещает превышать указанную скорость; двигаться медленнее разрешено."
      ],
    },
    {
      titleUz: "Aholi punktidan tashqarida",
      titleRu: "Вне населённых пунктов",
      bodyUz: [
        "Yengil avtomobillar uchun aholi punktidan tashqarida 90 km/soat, avtomagistralda esa 110 km/soat ruxsat etiladi.",
        "Yuk avtomobillari va avtobuslar uchun maxsus chegaralar mavjud — ularga nisbatan pastroq.",
        "Belgilar bilan o'rnatilgan pastroq chegaralar umumiy qoidalardan ustun turadi."
      ],
      bodyRu: [
        "Легковым автомобилям вне населённого пункта разрешено 90 км/ч, на автомагистрали — 110 км/ч.",
        "Для грузовиков и автобусов установлены особые ограничения — ниже общих.",
        "Более низкие ограничения, установленные знаками, имеют приоритет над общими правилами."
      ],
    },
    {
      titleUz: "Masofa (distantsiya) tanlash",
      titleRu: "Выбор дистанции",
      bodyUz: [
        "Masofa oldingi transport to'xtashiga yetarli masofani ta'minlashi kerak — qoida sifatida sekunda qoidasidan foydalaning (2 soniya quruqli yo'lda).",
        "Yomg'ir, muzlama yoki tuman sharoitida masofani ikki baravar oshiring.",
        "Yirik yuk avtomobillari ortidan harakatlangsангиз, ko'rinish maydoni uchun masofani yanada oshiring."
      ],
      bodyRu: [
        "Дистанция должна позволить остановиться, если впереди идущий ТС затормозит — используйте правило 2 секунд на сухой дороге.",
        "При дожде, гололёде или тумане увеличьте дистанцию вдвое.",
        "При движении за крупногабаритным транспортом увеличьте дистанцию для обзорности."
      ],
    },
    {
      titleUz: "Tormoz yo'li va to'xtash yo'li",
      titleRu: "Тормозной и остановочный путь",
      bodyUz: [
        "To'xtash yo'li = reaksiya yo'li + tormozlash yo'li. Tezlik ikki baravar oshsa, tormoz yo'li 4 baravar oshadi.",
        "Yuk ortib qayd etilganda tormoz yo'li ortadi — yengil avtomobil tirkama bilan harakatlanganda uzayadi.",
        "Nam qoplama tormoz yo'lini sezilarli uzaytiradi — tezlikni shunga qarab belgilang."
      ],
      bodyRu: [
        "Остановочный путь = путь реакции + тормозной путь. При удвоении скорости тормозной путь увеличивается в 4 раза.",
        "При движении с прицепом тормозной путь легкового автомобиля увеличивается.",
        "Мокрое покрытие значительно удлиняет тормозной путь — учитывайте это при выборе скорости."
      ],
    },
    {
      titleUz: "Xavfsiz tezlik tanlash tamoyillari",
      titleRu: "Принципы выбора безопасной скорости",
      bodyUz: [
        "Tezlik har doim yo'l, ob-havo va ko'rinmaslik sharoitiga mos bo'lishi kerak — belgi ruxsat etgandek tez harakatlanish shart emas.",
        "Qarama-qarshi harakatda va tor joylarda ehtiyotkorlik bilan yaqinlashish va masofani tegishli hisoblash zarur.",
        "Tungi vaqtda tezlik faralar yoritish masofasidan oshmaslik uchun past tanlanadi."
      ],
      bodyRu: [
        "Скорость всегда должна соответствовать дорожным условиям, погоде и видимости — знак разрешает, но не обязывает ехать быстро.",
        "При разъезде в узких местах держите дистанцию и сбавляйте скорость.",
        "Ночью скорость выбирается так, чтобы можно было остановиться в пределах видимости фар."
      ],
    },
  ],

  // ─── 7-modul: Piyodalar va velosipedlar (4 dars) ───────────────────
  7: [
    {
      titleUz: "Piyodalar o'tish joyi",
      titleRu: "Пешеходный переход",
      bodyUz: [
        "Tartibga solinmagan piyodalar o'tish joyida haydovchi piyodalarga yo'l berishi KERAK — tezlikni kamaytiring yoki to'xtang.",
        "Agar bir qatnov qismidagi avtomobil to'xtagan bo'lsa, qo'shni qatnov qismidagi harakatlanish faqat piyoda yo'qligiga ishonch hosil qilgandan keyin.",
        "Piyodalar o'tish joyida quvib o'tish qat'iyan taqiqlanadi."
      ],
      bodyRu: [
        "На нерегулируемом пешеходном переходе водитель ОБЯЗАН уступить пешеходам — снизьте скорость или остановитесь.",
        "Если автомобиль на соседней полосе остановился — продолжать движение можно только убедившись, что пешеходов нет.",
        "Обгон на пешеходном переходе категорически запрещён."
      ],
    },
    {
      titleUz: "Bolalar va maktab hududlari",
      titleRu: "Дети и школьные зоны",
      bodyUz: [
        "'Bolalar' (1.22) belgisi bolalar uyushmasi, maktab yoki i.q. bog'cha yonida o'rnatiladi — tezlikni kamaytiring.",
        "Bolalar kutilmaгда yo'lga chiqib ketishi mumkin — har doim tezkor tormozlashга tayyor turing.",
        "Maktab oldidan utayotgan avtobusga yaqinlashgаnda ehtiyotkorlik bilan harakatланing."
      ],
      bodyRu: [
        "Знак «Дети» (1.22) устанавливается возле школ и детских учреждений — снизьте скорость.",
        "Дети могут неожиданно выбежать на дорогу — будьте готовы к экстренному торможению.",
        "Проезжайте автобусы с детьми у школ с особой осторожностью."
      ],
    },
    {
      titleUz: "Trotuar va piyodalar yo'lkalar",
      titleRu: "Тротуары и пешеходные дорожки",
      bodyUz: [
        "Trotuarda yoki piyodalar yo'lkasida (4.5 belгisi) harakatlanish va to'xtab turish taqiqlanadi.",
        "Trotuar yo'lkasini kesib o'tish (uchastkaga kirish uchun) vaqtida pедестриanlar ustuvorlikka ega.",
        "Maxsus ajratilmagan yo'lda piyodalar chekkadan o'tishi kerak — ularga yo'l bering."
      ],
      bodyRu: [
        "Движение и остановка на тротуарах и пешеходных дорожках (знак 4.5) запрещены.",
        "При пересечении тротуара (для въезда на участок) приоритет у пешеходов.",
        "На необозначенных дорогах пешеходы идут по краю — уступайте им дорогу."
      ],
    },
    {
      titleUz: "Velosipedchilar bilan harakat",
      titleRu: "Движение рядом с велосипедистами",
      bodyUz: [
        "Velosipedchilar yo'lning o'ng chetida harakatlanadi; 14 yoshdan kichiklari trotuarda harakatlanishi mumkin.",
        "Velosipedchini quvib o'tganda kamida 1,5 metr yonlama masofani saqlng.",
        "Velosiped yo'lkasini (4.4 belгisi) kesib o'tayotganda velosipedchilarga yo'l bering."
      ],
      bodyRu: [
        "Велосипедисты движутся по правому краю; дети до 14 лет могут двигаться по тротуарам.",
        "При обгоне велосипедиста держите боковую дистанцию не менее 1,5 метра.",
        "При пересечении велодорожки (знак 4.4) уступите велосипедистам."
      ],
    },
  ],

  // ─── 8-modul: Xavfsizlik va yakuniy (6 dars) ───────────────────────
  8: [
    {
      titleUz: "Birinchi tibbiy yordam asoslari",
      titleRu: "Основы первой помощи",
      bodyUz: [
        "DTP holatida avval xavfsiz joyga o'ting, avariya signalini yoqing va ogohlantiruvchi uchburchak belgisini o'rnating (shaxarda 15 m, tashqarida 30 m).",
        "Qon ketishda to'g'ridan-to'g'ri bosim (прямое давление) yoki turniket qo'llaniladi; turniket 1 soatdan ortiq saqlanmaydi.",
        "Yurak-to'qloq reanimatsiyasi (YTR): 30 ta ko'krak bosimi : 2 ta sun'iy nafas."
      ],
      bodyRu: [
        "При ДТП сначала уберегите себя, включите аварийную сигнализацию и выставите знак аварийной остановки (15 м в городе, 30 м вне).",
        "При кровотечении — прямое давление или жгут; жгут накладывается не более чем на 1 час.",
        "СЛР (сердечно-лёгочная реанимация): 30 нажатий на грудную клетку : 2 вдоха."
      ],
    },
    {
      titleUz: "Transport texnik holati",
      titleRu: "Техническое состояние",
      bodyUz: [
        "Harakatdan oldin texnik holatni tekshiring: tormoz suyuqligi, gidravlika, shishkanlik, chiroqlar, to'xtash signal ratio.",
        "Rul boshqaruvida, tormoz tizimida yoki gabarit chiroqlarida nosozlik bo'lsa harakat taqiqlanadi.",
        "Yo'lvosida nosozlik aniqlгanda tormoz tizimi muammosi bor transport boshqa transportda shatakka olinishi yoki maxsus ortiqchi bilan tashilishi kerak."
      ],
      bodyRu: [
        "Перед поездкой проверяйте: тормозную жидкость, рулевое, шины, световые приборы, стоп-сигналы.",
        "Движение запрещено при неисправности рулевого управления, тормозной системы или габаритных огней.",
        "Транспорт с неисправными тормозами буксируется только с жёсткой сцепкой или частичной погрузкой."
      ],
    },
    {
      titleUz: "Majburiy jihozlar",
      titleRu: "Обязательное оборудование",
      bodyUz: [
        "Har bir transport vosidasida: aptechka, o't o'chirgich, avariya ogohlantirish uchburchagi, xavfsizlik kamerlari bo'lishi shart.",
        "Xavfsizlik kamerlarini haydovchi va old o'rindiq yo'lovchisi taqishi majburiy; bolalar uchun maxsus o'rindiq talab etiladi.",
        "Moto haydovchilar dubulg'i (шлем) taqishi shart — yo'lovchi ham."
      ],
      bodyRu: [
        "В каждом автомобиле обязательны: аптечка, огнетушитель, знак аварийной остановки, ремни безопасности.",
        "Водитель и передний пассажир обязаны быть пристёгнутыми; для детей требуется специальное кресло.",
        "Мотоциклисты обязаны надевать шлем — включая пассажира."
      ],
    },
    {
      titleUz: "Avariya holatida harakatlar ketma-ketligи",
      titleRu: "Порядок действий при ДТП",
      bodyUz: [
        "1) Zudlik bilan avtobuseksiya — transportni to'xtating, dvigatelni o'chiring, avariyka va uchburchakni o'rnating.",
        "2) Jabrlangаnlarga birinchi yordam ko'rsating, 112/103 ga qo'ng'iroq qiling.",
        "3) DTP dalil nom hujjatlarini saqlang, guvohlarni toping; transportni joyidan qo'zg'atmang (xavfsizlik xavfi bo'lmasa)."
      ],
      bodyRu: [
        "1) Немедленно остановите транспорт, заглушите двигатель, включите аварийку и выставите знак.",
        "2) Окажите первую помощь пострадавшим, позвоните 112/103.",
        "3) Сохраните обстановку ДТП, найдите свидетелей; не перемещайте ТС (если нет угрозы безопасности)."
      ],
    },
    {
      titleUz: "Imtihongа tayyorgarlik bo'yicha maslahatlar",
      titleRu: "Советы по подготовке к экзамену",
      bodyUz: [
        "Savollarni dialikkat bilan o'qing — 'TAQIQLANADI' va 'RUXSAT ETILADI' variantlarini adashtirmaslikka e'tibor bering.",
        "Raқамli savollar (masofa, tezlik, jismoniy chegaralar) — aniqroq yodlab oling: ular imtihonda aniq talab qilinadi.",
        "Kartali savollar (rasmlar) bo'yicha mashq qiling — ko'p istiqamati rasmli savollar imtihonda ustunlik qiladi."
      ],
      bodyRu: [
        "Читайте вопросы внимательно — не путайте варианты «ЗАПРЕЩЕНО» и «РАЗРЕШЕНО».",
        "Числовые вопросы (дистанция, скорость, ограничения) — выучите точно: на экзамене требуется точность.",
        "Тренируйтесь с вопросами-рисунками — на экзамене преобладают вопросы с изображениями."
      ],
    },
    {
      titleUz: "Xulosa va takrorlash reja",
      titleRu: "Итог и план повторения",
      bodyUz: [
        "Har kuni 15–20 ta savol yeching — muntazam mashq kundalik yomon o'rganishdan samaraliroq.",
        "Xatolar ustida alohida ishlang — 'Xatolar' rejimi sizning shaxsiy zaif joylaringizni qamrab oladi.",
        "Qo'rqmang: imtihon imkoniyatida 90% va undan yuqori ball olish mumkin bo'lgan savollar to'plamidan iborat."
      ],
      bodyRu: [
        "Решайте 15–20 вопросов ежедневно — регулярная практика эффективнее разового повторения.",
        "Работайте над ошибками отдельно — режим «Работа над ошибками» охватывает ваши слабые места.",
        "Не волнуйтесь: для сдачи достаточно 90%+ правильных ответов из стандартного набора."
      ],
    },
  ],
}

/** Jami darslar soni */
export const TOTAL_LESSONS = Object.values(lessons).reduce((s, arr) => s + arr.length, 0)
