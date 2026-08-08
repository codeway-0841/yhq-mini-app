/**
 * Mavzular kesimida diagnostika — rasmiy imtihon simulyatori yakunida
 * (va boshqa test rejimlarida) ko'rsatiladigan tahlil.
 *
 * SOF funksiya — React/store'dan mustaqil (unit-test uchun).
 * Saralash: eng ZAIF mavzu birinchi (ustozga "nimani takrorlash kerak"
 * darhol ko'rinsin); tenglikda savollar soni ko'p bo'lgani birinchi.
 */

export interface TopicBreakdownItem {
  topicId: number | null
  name:    string
  correct: number
  /** Javobsiz savollar ham hisobga olinadi (imtihonda javobsiz = 0 ball) */
  total:   number
  pct:     number
}

export interface TopicNameRow {
  id:     number
  nameUz: string
  nameRu: string
}

export function buildTopicBreakdown(
  items: { topicId: number | null; status: 'correct' | 'incorrect' | 'unanswered' }[],
  topics: TopicNameRow[],
  lang: 'uz' | 'ru',
  generalLabel: string,
): TopicBreakdownItem[] {
  const byId = new Map(topics.map((t) => [t.id, t]))
  const groups = new Map<number | null, { correct: number; total: number }>()

  for (const it of items) {
    const g = groups.get(it.topicId) ?? { correct: 0, total: 0 }
    g.total += 1
    if (it.status === 'correct') g.correct += 1
    groups.set(it.topicId, g)
  }

  return [...groups.entries()]
    .map(([topicId, g]) => {
      const topic = topicId == null ? null : byId.get(topicId)
      const name = topicId == null
        ? generalLabel
        : topic ? (lang === 'ru' ? topic.nameRu : topic.nameUz) : `#${topicId}`
      return { topicId, name, correct: g.correct, total: g.total, pct: Math.round((g.correct / g.total) * 100) }
    })
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
}
