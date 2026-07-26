// Mock questions — replace with real API data later

const THREE_OPTION_IDS = new Set([3, 7, 12, 17])

// 20 unique question definitions — no cycling
const RAW = [
  { text: 'Aholi punkti ichida ruxsat etilgan maksimal tezlik qancha?', opts: ['30 km/soat', '60 km/soat', '90 km/soat', '110 km/soat'], correct: 'F2', topic: 'Tezlik' },
  { text: 'Yo\'l kesishmasida kim ustuvorlik huquqiga ega?', opts: ['Chapdan kelayotgan', 'O\'ngdan kelayotgan', 'To\'g\'ri ketayotgan', 'Katta transport'], correct: 'F2', topic: 'Chorrahalar' },
  { text: '"To\'xtash taqiqlanadi" belgisi qaysi?', opts: ['Qizil doira, qora chiziq', 'Ko\'k doira, oq chiziq', 'Sariq uchburchak'], correct: 'F1', topic: 'Yo\'l belgilari' },
  { text: 'Piyoda yo\'lida to\'xtalish mumkinmi?', opts: ['Ha, 5 daqiqagacha', 'Yo\'q, taqiqlangan', 'Ha, har doim', 'Faqat kechasi'], correct: 'F2', topic: 'To\'xtash' },
  { text: 'Yuk mashinasi shahar ichida qanday tezlikda harakatlanishi kerak?', opts: ['40 km/soat', '60 km/soat', '70 km/soat', '80 km/soat'], correct: 'F2', topic: 'Tezlik' },
  { text: 'Xavfli yuk tashuvchi avtobus orqasida qancha masofa saqlanadi?', opts: ['10 metr', '30 metr', '50 metr', '100 metr'], correct: 'F3', topic: 'Masofa' },
  { text: 'Tumanli havoda fara qachon yoqiladi?', opts: ['Faqat kechasi', 'Har doim', 'Doim emas', 'Yo\'riqnomaga qarab'], correct: 'F2', topic: 'Yorug\'lik' },
  { text: 'Yon yo\'ldan asosiy yo\'lga chiqishda kim yo\'l beradi?', opts: ['Asosiy yo\'l', 'Yon yo\'l haydovchisi', 'Ikkovlari bir vaqtda', 'Belgi bo\'lmasa'], correct: 'F2', topic: 'Ustuvorlik' },
  { text: 'Temir yo\'l kesishmasida to\'xtash chizig\'iga necha metr qolganida to\'xtash kerak?', opts: ['2 metr', '5 metr', '10 metr', '15 metr'], correct: 'F3', topic: 'Temir yo\'l' },
  { text: 'Avtobus bekatida to\'xtash taqiqlanishining sababi nima?', opts: ['Yo\'l tor', 'Harakat xavfsizligi', 'Yuk tashish', 'Belgi bo\'lmagani'], correct: 'F2', topic: 'To\'xtash' },
  { text: 'Ko\'cha chiroqlari o\'chganda fara holati qanday bo\'ladi?', opts: ['O\'chiriladi', 'Yoqiladi', 'Qisqa yorug\'likka o\'tiladi', 'O\'zgarmaydi'], correct: 'F2', topic: 'Yorug\'lik' },
  { text: 'Yo\'l harakati qoidalarida "ustuvorlik yo\'li" nima?', opts: ['Tezkor yo\'l', 'Belgilangan asosiy yo\'l', 'Piyoda yo\'li', 'Velosipedlar yo\'li'], correct: 'F2', topic: 'Ustuvorlik' },
  { text: 'Qaysi belgi "Bola yurish yo\'li"ni anglatadi?', opts: ['Sariq uchburchak', 'Ko\'k kvadrat', 'Yashil doira'], correct: 'F1', topic: 'Yo\'l belgilari' },
  { text: 'Nosoz tormozli avtomobil qanday holda harakatlanishi mumkin?', opts: ['Sekin harakatlanish mumkin', 'Umuman harakatlanib bo\'lmaydi', 'Kechasi mumkin', 'Shahardan tashqarida mumkin'], correct: 'F2', topic: 'Texnik holat' },
  { text: 'Ajratuvchi chiziq nima vazifani bajaradi?', opts: ['Tezlikni belgilaydi', 'Qarama-qarshi oqimlarni ajratadi', 'To\'xtash joyini ko\'rsatadi', 'Kesishma boshlanishini bildiradi'], correct: 'F2', topic: 'Yo\'l belgilash' },
  { text: 'Bir yo\'nalishli yo\'lda burilish qanday amalga oshiriladi?', opts: ['Faqat o\'ngga', 'Faqat chapga', 'Har ikki tomonga', 'Faqat to\'g\'riga'], correct: 'F3', topic: 'Manyovr' },
  { text: 'Tuman sharoitida ko\'rish masofasi 50 metrga tushganda tezlik qanday bo\'lishi kerak?', opts: ['50 km/soat', '30 km/soat', 'Ko\'rish masofasidan oshmasligi', '70 km/soat'], correct: 'F3', topic: 'Tezlik' },
  { text: 'Avtobus harakatlanishni boshlaganda haydovchi nima qilishi shart?', opts: ['Signal berishi', 'Ko\'zguda tekshirib, yo\'l berishi'], correct: 'F2', topic: 'Ustuvorlik' },
  { text: 'Shahar tashqarisida piyoda yo\'l chetida qanday tomonda yuradi?', opts: ['O\'ng tomonda', 'Chap tomonda — yuzma-yuz', 'Istalgan tomonda', 'Yo\'l o\'rtasida'], correct: 'F2', topic: 'Piyodalar' },
  { text: 'Yo\'l belgisi va svetofor zid ko\'rsatma berganda nima qilinadi?', opts: ['Belgiga amal qilinadi', 'Svetofori ustun', 'Haydovchi o\'zi tanlaydi', 'Ikkoviga ham amal qilinadi'], correct: 'F2', topic: 'Boshqaruv' },
]

export const questions = RAW.map((q, i) => {
  const useThree = THREE_OPTION_IDS.has(i + 1)
  const optionIds = ['F1', 'F2', 'F3', 'F4']
  const options = q.opts
    .slice(0, useThree ? 3 : 4)
    .map((text, idx) => ({ id: optionIds[idx], text }))

  const correctExists = options.some(o => o.id === q.correct)
  if (!correctExists) {
    console.warn(`Question ${i + 1}: correct="${q.correct}" not in options — falling back to F1`)
  }

  return {
    id: i + 1,
    text: q.text,
    image: null,
    options,
    correct: correctExists ? q.correct : 'F1',
    topic: q.topic,
  }
})

// Each ticket gets its own slice of questions (cycling over the pool)
const TICKET_SIZE = 20
export const tickets = Array.from({ length: 40 }, (_, i) => {
  const start = (i * 5) % questions.length
  const ids = Array.from({ length: TICKET_SIZE }, (__, j) => questions[(start + j) % questions.length].id)
  return {
    id: i + 1,
    title: `${i + 1} - bilet`,
    isNew: i >= 30,
    questionCount: TICKET_SIZE,
    questionIds: ids,
  }
})
