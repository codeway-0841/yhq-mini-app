// Mock road signs — replace with real images and descriptions later

export const signCategories = Object.freeze([
  { id: 'ogohlantiruvchi', name: 'Ogohlantiruvchi',              count: 51, color: '#f59e0b', emoji: '⚠️' },
  { id: 'imtiyoz',         name: 'Imtiyoz',                      count:  9, color: '#3b82f6', emoji: '🔵' },
  { id: 'taqiqlovchi',     name: 'Taqiqlovchi',                  count: 39, color: '#ef4444', emoji: '🚫' },
  { id: 'buyuruvchi',      name: 'Buyuruvchi',                   count: 25, color: '#22c55e', emoji: '✅' },
  { id: 'axborot',         name: 'Axborot-ishora',               count: 88, color: '#8b5cf6', emoji: 'ℹ️' },
  { id: 'servis',          name: 'Servis',                       count: 18, color: '#06b6d4', emoji: '🏥' },
  { id: 'qoshimcha',       name: "Qo'shimcha axborot",           count: 61, color: '#f97316', emoji: '📋' },
  { id: 'transport',       name: "Transport vositalarini taniqlash", count: 14, color: '#84cc16', emoji: '🚗' },
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
