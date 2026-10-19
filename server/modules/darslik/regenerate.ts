import { DARSLIK_TOPIC_IDS } from '../../../shared/darslik-mastery'
import { curatedDarslikCheck } from './curated'
import { darslikRepository } from './darslik.repository'

/**
 * Darslik keshini regeneratsiya qilish — admin API va CLI uchun YAGONA manba.
 *
 * Curated mavzular deterministik: ular darhol qayta yoziladi (AI chaqirilmaydi).
 * Qolgan mavzular keshdan o'chiriladi va keyingi `POST /darslik/:topicId/check`
 * ularni AI/fallback orqali qayta yaratadi.
 */

export class DarslikRegenerationInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DarslikRegenerationInputError'
  }
}

export class DarslikTopicNotFoundError extends Error {
  readonly topicIds: string[]
  constructor(topicIds: string[]) {
    super('Unknown darslik topic ids: ' + topicIds.join(', '))
    this.name = 'DarslikTopicNotFoundError'
    this.topicIds = topicIds
  }
}

export interface DarslikRegenerationInput {
  topicIds?: readonly string[]
  blockId?: number
}

/**
 * Tanlovni aniq topic ro'yxatiga aylantiradi. `topicIds` va `blockId`
 * birga berilmasligi shart — aks holda qaysi biri ustunligi noaniq bo'ladi.
 */
export function resolveDarslikRegenerationTopics(input: DarslikRegenerationInput): string[] {
  const hasTopics = Boolean(input.topicIds?.length)
  const hasBlock = input.blockId !== undefined
  if (hasTopics === hasBlock) {
    throw new DarslikRegenerationInputError('Provide exactly one of topicIds or blockId')
  }

  const requested = hasTopics
    ? [...(input.topicIds as readonly string[])]
    : DARSLIK_TOPIC_IDS.filter(topicId => topicId.startsWith(String(input.blockId) + ':'))
  const topicIds = [...new Set(requested)]
  if (topicIds.length === 0) throw new DarslikRegenerationInputError('No darslik topics selected')

  const unknown = topicIds.filter(topicId => !DARSLIK_TOPIC_IDS.includes(topicId))
  if (unknown.length > 0) throw new DarslikTopicNotFoundError(unknown)
  return topicIds
}

export interface DarslikRegenerationResult {
  topics: number
  invalidated: number
  curatedReseeded: number
}

export async function regenerateDarslikChecks(input: DarslikRegenerationInput): Promise<DarslikRegenerationResult> {
  const topicIds = resolveDarslikRegenerationTopics(input)

  // Avval o'chirish: curated re-seed muvaffaqiyatsiz bo'lsa ham keyingi
  // /check deterministik curated bilan qayta quradi (AI'ga bog'lanmaydi).
  const invalidated = await darslikRepository.invalidate(topicIds)
  const curatedTopics = topicIds.filter(topicId => curatedDarslikCheck(topicId) !== null)
  for (const topicId of curatedTopics) {
    const curated = curatedDarslikCheck(topicId)
    if (curated) await darslikRepository.saveCheck(topicId, curated, { source: 'curated', force: true })
  }

  return {
    topics: topicIds.length,
    invalidated,
    curatedReseeded: curatedTopics.length,
  }
}
