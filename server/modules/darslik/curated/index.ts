import type { DarslikCheck } from '../../../../shared/darslik-mastery'
import { block01Checks, BLOCK_01_CURATED_TOPIC_IDS } from './block-01'

/**
 * Pilot (1-blok) uchun qo'lda tekshirilgan darslar.
 *
 * Router tartibi: curated → AI draft → fallback. Bu ro'yxatdagi mavzular
 * uchun AI umuman chaqirilmaydi, ya'ni Meta billing xatosi pilotga ta'sir
 * qilmaydi.
 */
const CURATED: Record<string, DarslikCheck> = { ...block01Checks }

export function curatedDarslikCheck(topicId: string): DarslikCheck | null {
  return CURATED[topicId] ?? null
}

export function curatedDarslikTopicIds(): string[] {
  return [...BLOCK_01_CURATED_TOPIC_IDS]
}

export function isCuratedDarslikTopic(topicId: string): boolean {
  return Object.hasOwn(CURATED, topicId)
}
