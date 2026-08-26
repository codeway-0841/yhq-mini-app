import signsData from './signs.yhq.json'
import signsDataRu from './signs.ru.yhq.json'

export interface RoadSignContent {
  type: string
  value: string
}

export interface RoadSign {
  id: string
  code: string
  groupId: number
  categoryId: string
  order: number
  name: string
  nameRu?: string
  shortName: string
  shortNameRu?: string
  image: string
  description: string
  descriptionRu?: string
  legalRef: string
  content: RoadSignContent[]
}

export interface SignCategory {
  id: string
  groupId: number
  code: string
  name: string
  nameRu?: string
  count: number
  color: string
  emoji: string
  image: string
}

const GROUP_ID_TO_CAT_ID: Record<number, { id: string; color: string; emoji: string }> = {
  1:  { id: 'ogohlantiruvchi', color: '#b96b34', emoji: '⚠️' },
  2:  { id: 'imtiyoz',         color: '#37718e', emoji: '🔵' },
  3:  { id: 'taqiqlovchi',     color: '#a8453c', emoji: '🚫' },
  4:  { id: 'buyuruvchi',      color: '#2e8b78', emoji: '✅' },
  5:  { id: 'axborot',         color: '#74589b', emoji: 'ℹ️' },
  6:  { id: 'servis',          color: '#5566a8', emoji: '🏥' },
  7:  { id: 'qoshimcha',       color: '#b96b34', emoji: '📋' },
  10: { id: 'taniqlik',        color: '#d97706', emoji: '🏷️' },
}

const rawGroups = signsData.groups as Array<{ id: number; code: string; name: string; image: string }>
const rawSigns = signsData.signs as Array<{
  id: number
  code: string
  groupId: number
  order: number
  name: string
  image: string
  content: RoadSignContent[]
}>

const ruGroupsMap = new Map<number, string>(
  ((signsDataRu as { groups?: Array<{ id: number; name: string }> }).groups || []).map((g) => [g.id, g.name])
)
const ruSignsMap = new Map<string, { name: string; content: RoadSignContent[] }>(
  ((signsDataRu as { signs?: Array<{ code: string; name: string; content: RoadSignContent[] }> }).signs || []).map((s) => [
    s.code,
    { name: s.name, content: s.content || [] },
  ])
)

function resolveImage(img: string): string {
  if (!img) return ''
  const filename = img.split('/').pop() || img
  return `/images/signs/${filename}`
}

export function cleanSignDescription(raw?: string): string {
  if (!raw) return ''
  let str = raw.trim()

  // Remove leading duplicate title list or paragraphs
  str = str.replace(/^\s*<ul>\s*<li>\s*(?:<strong[^>]*>)?\s*[\d.]+\s*["«“][^<]+["»”]\s*(?:<\/strong>)?\s*<\/li>\s*<\/ul>/i, '')
  str = str.replace(/^\s*<p>\s*<strong[^>]*>\s*[\d.]+\s*["«“][^<]+["»”]\s*<\/strong>\s*<\/p>/i, '')
  str = str.replace(/^\s*[\d.]+\s*["«“][^"\r\n]+["»”]\s*(\r?\n)+/i, '')

  // Convert HTML elements into clean markdown/text
  str = str
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '') // strip any other html tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return str
}

const ALL_SIGNS: RoadSign[] = rawSigns.map((s) => {
  const meta = GROUP_ID_TO_CAT_ID[s.groupId] ?? { id: String(s.groupId), color: '#37718e', emoji: '📌' }
  const rawDesc = Array.isArray(s.content) ? s.content.map((c) => c.value).join('\n\n') : ''
  const desc = cleanSignDescription(rawDesc)

  const ruData = ruSignsMap.get(s.code)
  const ruRawDesc = ruData && Array.isArray(ruData.content) ? ruData.content.map((c) => c.value).join('\n\n') : ''
  const descRu = ruRawDesc ? cleanSignDescription(ruRawDesc) : undefined

  return {
    id: `sign-${s.id}`,
    code: s.code,
    groupId: s.groupId,
    categoryId: meta.id,
    order: s.order,
    name: s.name,
    nameRu: ruData?.name,
    shortName: s.name,
    shortNameRu: ruData?.name,
    image: resolveImage(s.image),
    description: desc,
    descriptionRu: descRu,
    legalRef: `YHQ 1-ilova ${s.code}`,
    content: s.content || [],
  }
})

const SIGNS_BY_CATEGORY: Record<string, RoadSign[]> = {}
const SIGNS_BY_GROUP_ID: Record<number, RoadSign[]> = {}

for (const s of ALL_SIGNS) {
  if (!SIGNS_BY_CATEGORY[s.categoryId]) SIGNS_BY_CATEGORY[s.categoryId] = []
  SIGNS_BY_CATEGORY[s.categoryId].push(s)

  if (!SIGNS_BY_GROUP_ID[s.groupId]) SIGNS_BY_GROUP_ID[s.groupId] = []
  SIGNS_BY_GROUP_ID[s.groupId].push(s)
}

export const signCategories: readonly SignCategory[] = Object.freeze(
  rawGroups.map((g) => {
    const meta = GROUP_ID_TO_CAT_ID[g.id] ?? { id: String(g.id), color: '#37718e', emoji: '📌' }
    const catSigns = SIGNS_BY_CATEGORY[meta.id] || []
    return {
      id: meta.id,
      groupId: g.id,
      code: g.code,
      name: g.name,
      nameRu: ruGroupsMap.get(g.id),
      count: catSigns.length,
      color: meta.color,
      emoji: meta.emoji,
      image: resolveImage(g.image),
    }
  })
)

export function getSignsByCategory(categoryIdOrGroupId: string | number): RoadSign[] {
  if (typeof categoryIdOrGroupId === 'number') {
    return SIGNS_BY_GROUP_ID[categoryIdOrGroupId] ?? []
  }
  return SIGNS_BY_CATEGORY[categoryIdOrGroupId] ?? []
}

export function getAllSigns(): RoadSign[] {
  return ALL_SIGNS
}

export function getSignByCode(code: string): RoadSign | undefined {
  const norm = code.trim().toLowerCase()
  return ALL_SIGNS.find((s) => s.code.toLowerCase() === norm)
}

export function searchSigns(query: string): RoadSign[] {
  const q = query.trim().toLowerCase()
  if (!q) return ALL_SIGNS
  return ALL_SIGNS.filter(
    (s) =>
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.nameRu && s.nameRu.toLowerCase().includes(q)) ||
      s.description.toLowerCase().includes(q) ||
      (s.descriptionRu && s.descriptionRu.toLowerCase().includes(q))
  )
}
