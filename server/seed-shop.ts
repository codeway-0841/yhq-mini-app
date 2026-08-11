import 'dotenv/config'
import { db } from './db/connection'
import { shopItems, tokenTasks } from './schema'

const AVATARS = [
  { id: 'cosmonaut', type: 'avatar', nameUz: 'Kosmonavt', nameRu: 'Космонавт', image: '🧑‍🚀', price: 1500, category: 'boy', sortOrder: 1 },
  { id: 'panda', type: 'avatar', nameUz: 'Panda Gamer', nameRu: 'Панда Геймер', image: '🐼', price: 1200, category: 'animals', sortOrder: 2 },
  { id: 'ninja', type: 'avatar', nameUz: 'Ninja', nameRu: 'Ниндзя', image: '🥷', price: 1800, category: 'boy', sortOrder: 3 },
  { id: 'minimal-boy', type: 'avatar', nameUz: 'Minimal Boy', nameRu: 'Минимал', image: '👦', price: 800, category: 'minimal', sortOrder: 4 },
  { id: 'cyberpunk', type: 'avatar', nameUz: 'Cyberpunk', nameRu: 'Киберпанк', image: '🤖', price: 2000, category: 'premium', sortOrder: 5 },
  { id: 'sun', type: 'avatar', nameUz: 'Quyosh', nameRu: 'Солнце', image: '☀️', price: 1000, category: 'funny', sortOrder: 6 },
  { id: 'lion', type: 'avatar', nameUz: 'Sher', nameRu: 'Лев', image: '🦁', price: 1600, category: 'animals', sortOrder: 7 },
  { id: 'robot', type: 'avatar', nameUz: 'Ovozli Robot', nameRu: 'Робот', image: '🤖', price: 1300, category: 'retro', sortOrder: 8 },
  { id: 'football', type: 'avatar', nameUz: 'Futbolchi', nameRu: 'Футболист', image: '⚽', price: 900, category: 'funny', sortOrder: 9 },
  { id: 'samurai', type: 'avatar', nameUz: 'Samuray', nameRu: 'Самурай', image: '⚔️', price: 1700, category: 'anime', sortOrder: 10 },
  { id: 'penguin', type: 'avatar', nameUz: 'Pingvin', nameRu: 'Пингвин', image: '🐧', price: 1100, category: 'animals', sortOrder: 11 },
  { id: 'elf', type: 'avatar', nameUz: 'Yashil Yigit', nameRu: 'Зелёный', image: '🧝', price: 950, category: 'anime', sortOrder: 12 },
]

const MERCH = [
  { id: 'hoodie', type: 'merch', nameUz: 'KIWI Hoodie', nameRu: 'KIWI Худи', image: '🧥', price: 150000, category: 'clothing', sortOrder: 1 },
  { id: 'tshirt', type: 'merch', nameUz: 'KIWI Futbolka', nameRu: 'KIWI Футболка', image: '👕', price: 80000, category: 'clothing', sortOrder: 2 },
  { id: 'cap', type: 'merch', nameUz: 'KIWI Kepka', nameRu: 'KIWI Кепка', image: '🧢', price: 60000, category: 'accessories', sortOrder: 3 },
  { id: 'bag', type: 'merch', nameUz: 'KIWI Sumka', nameRu: 'KIWI Сумка', image: '👜', price: 180000, category: 'bags', sortOrder: 4 },
  { id: 'thermos', type: 'merch', nameUz: 'KIWI Termos', nameRu: 'KIWI Термос', image: '🫗', price: 70000, category: 'dishes', sortOrder: 5 },
  { id: 'stickers', type: 'merch', nameUz: 'KIWI Sticker Pack', nameRu: 'KIWI Стикеры', image: '🎨', price: 25000, category: 'stickers', sortOrder: 6 },
]

const BADGES = [
  { id: 'top1', type: 'badge', nameUz: 'Top 1%', nameRu: 'Топ 1%', image: '🏆', price: 10000, category: 'all', sortOrder: 1 },
  { id: 'strong', type: 'badge', nameUz: 'Katta bilimdon', nameRu: 'Знаток', image: '⭐', price: 2500, category: 'all', sortOrder: 2 },
  { id: 'fast', type: 'badge', nameUz: 'Tezkor', nameRu: 'Быстрый', image: '⚡', price: 2000, category: 'all', sortOrder: 3 },
  { id: 'perfect', type: 'badge', nameUz: 'Mukammal', nameRu: 'Идеальный', image: '🌟', price: 2500, category: 'all', sortOrder: 4 },
  { id: 'champion', type: 'badge', nameUz: 'Chempion', nameRu: 'Чемпион', image: '🥇', price: 3500, category: 'all', sortOrder: 5 },
  { id: 'math', type: 'badge', nameUz: 'Matematika ustasi', nameRu: 'Мастер математики', image: '🔢', price: 2000, category: 'all', sortOrder: 6 },
  { id: 'physics', type: 'badge', nameUz: 'Fizika dahosi', nameRu: 'Гений физики', image: '🔬', price: 1800, category: 'all', sortOrder: 7 },
  { id: 'history', type: 'badge', nameUz: 'Tarix bilimdon', nameRu: 'Историк', image: '📜', price: 1800, category: 'all', sortOrder: 8 },
  { id: 'biology', type: 'badge', nameUz: 'Biologiya eksperti', nameRu: 'Биолог', image: '🧬', price: 1800, category: 'all', sortOrder: 9 },
  { id: 'chemistry', type: 'badge', nameUz: 'Kimyo sehrgari', nameRu: 'Химик', image: '🧪', price: 1800, category: 'all', sortOrder: 10 },
]

const TASKS = [
  { id: 'daily', titleUz: 'Kundalik kirish', titleRu: 'Ежедневный вход', reward: 50, total: 1, sortOrder: 1 },
  { id: 'test3', titleUz: '3 ta test yeching', titleRu: 'Решите 3 теста', reward: 50, total: 3, sortOrder: 2 },
  { id: 'video', titleUz: '2 ta video dars tomosha qiling', titleRu: 'Посмотрите 2 видеоурока', reward: 30, total: 2, sortOrder: 3 },
  { id: 'score80', titleUz: '5 ta testda 80%+ oling', titleRu: 'Наберите 80%+ в 5 тестах', reward: 100, total: 5, sortOrder: 4 },
  { id: 'invite', titleUz: "Do'st taklif qiling", titleRu: 'Пригласите друга', reward: 200, total: 1, sortOrder: 5 },
]

async function seed() {
  console.log('Seeding shop items...')

  const allItems = [...AVATARS, ...MERCH, ...BADGES]
  await db.insert(shopItems).values(allItems).onConflictDoNothing()
  console.log(`  shop_items: ${allItems.length} rows (onConflictDoNothing)`)

  await db.insert(tokenTasks).values(TASKS).onConflictDoNothing()
  console.log(`  token_tasks: ${TASKS.length} rows (onConflictDoNothing)`)

  console.log('Done.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
