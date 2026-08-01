// Mock road signs — replace with real images and descriptions later

export const signCategories = Object.freeze([
  { id: 'ogohlantiruvchi', name: 'Ogohlantiruvchi',              count: 51, color: '#ff9600', emoji: '⚠️' },
  { id: 'imtiyoz',         name: 'Imtiyoz',                      count:  9, color: '#1cb0f6', emoji: '🔵' },
  { id: 'taqiqlovchi',     name: 'Taqiqlovchi',                  count: 39, color: '#ff4b4b', emoji: '🚫' },
  { id: 'buyuruvchi',      name: 'Buyuruvchi',                   count: 25, color: '#58cc02', emoji: '✅' },
  { id: 'axborot',         name: 'Axborot-ishora',               count: 88, color: '#ce82ff', emoji: 'ℹ️' },
  { id: 'servis',          name: 'Servis',                       count: 18, color: '#1899d6', emoji: '🏥' },
  { id: 'qoshimcha',       name: "Qo'shimcha axborot",           count: 61, color: '#e59400', emoji: '📋' },
  { id: 'transport',       name: "Transport vositalarini taniqlash", count: 14, color: '#46a302', emoji: '🚗' },
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
