export interface ShopAvatar {
  id: string
  name: string
  nameRu: string
  image: string
  price: number
  category: AvatarCategory
}

export type AvatarCategory = 'all' | 'premium' | 'new' | 'boy' | 'funny' | 'minimal' | 'animals' | 'anime' | 'retro'

export interface ShopMerch {
  id: string
  name: string
  nameRu: string
  image: string
  price: number
  category: MerchCategory
}

export type MerchCategory = 'all' | 'clothing' | 'accessories' | 'stickers' | 'bags' | 'dishes' | 'other'

export interface ShopBadge {
  id: string
  name: string
  nameRu: string
  icon: string
  price: number
}

export interface TokenTask {
  id: string
  titleUz: string
  titleRu: string
  reward: number
  progress: number
  total: number
  completed: boolean
}

export interface TokenPackage {
  id: string
  amount: number
  price: number
  discount?: number
}

export const AVATAR_CATEGORIES: { key: AvatarCategory; uz: string; ru: string }[] = [
  { key: 'all', uz: 'Barchasi', ru: 'Все' },
  { key: 'premium', uz: 'Premium', ru: 'Премиум' },
  { key: 'new', uz: 'Yangi', ru: 'Новые' },
  { key: 'boy', uz: 'Boy', ru: 'Парни' },
  { key: 'funny', uz: "G'alati", ru: 'Забавные' },
  { key: 'minimal', uz: 'Minimal', ru: 'Минимал' },
  { key: 'animals', uz: 'Hayvonlar', ru: 'Животные' },
  { key: 'anime', uz: 'Anime', ru: 'Аниме' },
  { key: 'retro', uz: 'Retro', ru: 'Ретро' },
]

export const MERCH_CATEGORIES: { key: MerchCategory; uz: string; ru: string }[] = [
  { key: 'all', uz: 'Barchasi', ru: 'Все' },
  { key: 'clothing', uz: 'Kiyim', ru: 'Одежда' },
  { key: 'accessories', uz: 'Aksessuar', ru: 'Аксессуары' },
  { key: 'stickers', uz: 'Stiker', ru: 'Стикеры' },
  { key: 'bags', uz: 'Sumka', ru: 'Сумки' },
  { key: 'dishes', uz: 'Idish', ru: 'Посуда' },
  { key: 'other', uz: 'Boshqalar', ru: 'Прочее' },
]

export const MOCK_TASKS: TokenTask[] = [
  { id: 'daily', titleUz: 'Kundalik kirish', titleRu: 'Ежедневный вход', reward: 50, progress: 1, total: 1, completed: true },
  { id: 'test3', titleUz: 'Test yeching', titleRu: 'Решите тест', reward: 50, progress: 0, total: 3, completed: false },
  { id: 'video', titleUz: 'Video dars tomosha qiling', titleRu: 'Посмотрите видеоурок', reward: 30, progress: 0, total: 2, completed: false },
  { id: 'score80', titleUz: '5 ta testda 80%+ oling', titleRu: 'Наберите 80%+ в 5 тестах', reward: 100, progress: 0, total: 5, completed: false },
  { id: 'invite', titleUz: "Do'st taklif qiling", titleRu: 'Пригласите друга', reward: 200, progress: 0, total: 1, completed: false },
]

export const MOCK_AVATARS: ShopAvatar[] = [
  { id: 'cosmonaut', name: 'Kosmonavt', nameRu: 'Космонавт', image: '🧑‍🚀', price: 1500, category: 'boy' },
  { id: 'panda', name: 'Panda Gamer', nameRu: 'Панда Геймер', image: '🐼', price: 1200, category: 'animals' },
  { id: 'ninja', name: 'Ninja', nameRu: 'Ниндзя', image: '🥷', price: 1800, category: 'boy' },
  { id: 'minimal-boy', name: 'Minimal Boy', nameRu: 'Минимал', image: '👦', price: 800, category: 'minimal' },
  { id: 'cyberpunk', name: 'Cyberpunk', nameRu: 'Киберпанк', image: '🤖', price: 2000, category: 'premium' },
  { id: 'sun', name: 'Quyosh', nameRu: 'Солнце', image: '☀️', price: 1000, category: 'funny' },
  { id: 'lion', name: 'Sher', nameRu: 'Лев', image: '🦁', price: 1600, category: 'animals' },
  { id: 'robot', name: 'Ovozli Robot', nameRu: 'Робот', image: '🤖', price: 1300, category: 'retro' },
  { id: 'football', name: 'Qiz bola', nameRu: 'Девочка', image: '⚽', price: 900, category: 'funny' },
  { id: 'samurai', name: 'Samuray', nameRu: 'Самурай', image: '⚔️', price: 1700, category: 'anime' },
  { id: 'penguin', name: 'Pingvin', nameRu: 'Пингвин', image: '🐧', price: 1100, category: 'animals' },
  { id: 'elf', name: 'Yashil Yigit', nameRu: 'Зелёный', image: '🧝', price: 950, category: 'anime' },
]

export const MOCK_MERCH: ShopMerch[] = [
  { id: 'hoodie', name: 'KIWI Hoodie', nameRu: 'KIWI Худи', image: '🧥', price: 150000, category: 'clothing' },
  { id: 'tshirt', name: 'KIWI Futbolka', nameRu: 'KIWI Футболка', image: '👕', price: 80000, category: 'clothing' },
  { id: 'cap', name: 'KIWI Kepka', nameRu: 'KIWI Кепка', image: '🧢', price: 60000, category: 'accessories' },
  { id: 'bag', name: 'KIWI Sumka', nameRu: 'KIWI Сумка', image: '👜', price: 180000, category: 'bags' },
  { id: 'thermos', name: 'KIWI Termos', nameRu: 'KIWI Термос', image: '🫗', price: 70000, category: 'dishes' },
  { id: 'stickers', name: 'KIWI Sticker Pack', nameRu: 'KIWI Стикеры', image: '🎨', price: 25000, category: 'stickers' },
]

export const MOCK_BADGES: ShopBadge[] = [
  { id: 'top1', name: 'Top 1%', nameRu: 'Топ 1%', icon: '🏆', price: 10000 },
  { id: 'strong', name: 'Katta bilimdon', nameRu: 'Знаток', icon: '⭐', price: 2500 },
  { id: 'fast', name: 'Tezkor', nameRu: 'Быстрый', icon: '⚡', price: 2000 },
  { id: 'perfect', name: 'Mukammal', nameRu: 'Идеальный', icon: '🌟', price: 2500 },
  { id: 'champion', name: 'Chempion', nameRu: 'Чемпион', icon: '🥇', price: 3500 },
  { id: 'math', name: 'Matematika ustasi', nameRu: 'Мастер математики', icon: '🔢', price: 2000 },
  { id: 'physics', name: 'Fizika dahosi', nameRu: 'Гений физики', icon: '🔬', price: 1800 },
  { id: 'history', name: 'Tarix bilmdoni', nameRu: 'Историк', icon: '📜', price: 1800 },
  { id: 'biology', name: 'Biologiya eksperti', nameRu: 'Биолог', icon: '🧬', price: 1800 },
  { id: 'chemistry', name: 'Kimyo sehrgari', nameRu: 'Химик', icon: '🧪', price: 1800 },
]

export const MOCK_PACKAGES: TokenPackage[] = [
  { id: 'p1', amount: 1000, price: 10000 },
  { id: 'p2', amount: 2500, price: 20000, discount: 10 },
  { id: 'p3', amount: 5500, price: 40000, discount: 15 },
  { id: 'p4', amount: 12000, price: 80000, discount: 20 },
]

export const LEVEL_REWARDS = [
  { level: 1, tokens: 500 },
  { level: 2, tokens: 1000 },
  { level: 3, tokens: 1500 },
  { level: 4, tokens: 2000 },
  { level: 5, tokens: 2500 },
  { level: 6, tokens: 3000 },
  { level: 7, tokens: 3500 },
]
