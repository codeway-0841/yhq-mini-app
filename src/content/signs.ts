// Mock road signs — replace with real images and descriptions later

export const signCategories = Object.freeze([
  { id: 'ogohlantiruvchi', name: 'Ogohlantiruvchi',              count: 51, color: '#b96b34', emoji: '⚠️' },
  { id: 'imtiyoz',         name: 'Imtiyoz',                      count:  9, color: '#37718e', emoji: '🔵' },
  { id: 'taqiqlovchi',     name: 'Taqiqlovchi',                  count: 39, color: '#a8453c', emoji: '🚫' },
  { id: 'buyuruvchi',      name: 'Buyuruvchi',                   count: 25, color: '#2e8b78', emoji: '✅' },
  { id: 'axborot',         name: 'Axborot-ishora',               count: 88, color: '#74589b', emoji: 'ℹ️' },
  { id: 'servis',          name: 'Servis',                       count: 18, color: '#5566a8', emoji: '🏥' },
  { id: 'qoshimcha',       name: "Qo'shimcha axborot",           count: 61, color: '#b96b34', emoji: '📋' },
  { id: 'transport',       name: "Transport vositalarini taniqlash", count: 14, color: '#5f7a3c', emoji: '🚗' },
])

export function getSignsByCategory(categoryId: string) {
  const cat = signCategories.find(c => c.id === categoryId)
  if (!cat) {
    console.warn(`getSignsByCategory: unknown categoryId "${categoryId}"`)
    return []
  }
  return Array.from({ length: cat.count }, (_, i) => ({
    id: `${categoryId}-${i + 1}`,
    categoryId,
    name: `${cat.name} belgisi ${i + 1}`,
    shortName: `${i + 1}`,
    image: '',   // replace with real image URL; empty string renders no broken <img>
    description: `Bu belgi ${cat.name.toLowerCase()} toifasiga kiradi. To'liq tavsif bu yerda bo'ladi. Qonun matni va haydovchiga nisbatan talablar shu yerda ko'rsatiladi.`,
    legalRef: `YHQ ${cat.id.toUpperCase()}-${i + 1}`,
  }))
}
