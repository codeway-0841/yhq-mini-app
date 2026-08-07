/**
 * QuestionBankProvider — Data Provider interfeysi.
 *
 * Dashboard va API QATLAMI HECH QACHON DB'ga to'g'ridan-to'g'ri bog'lanmaydi —
 * faqat shu interfeys orqali ishlaydi. Yangi fan bazasi uchun shu interfeysni
 * implementatsiya qiluvchi yangi class yoziladi (Strategy Pattern).
 */
import type { topics, questions } from '../schema'

export type TopicRow   = typeof topics.$inferSelect
export type QuestionRow = typeof questions.$inferSelect

export interface QuestionBankProvider {
  readonly sourceId: string
  getAllQuestions(): Promise<QuestionRow[]>
  getQuestionById(questionId: number): Promise<QuestionRow | null>
  getQuestionsByTopic(topicId: number): Promise<QuestionRow[]>
  getTopics(): Promise<TopicRow[]>
  getStats(): Promise<{ totalQuestions: number; totalTopics: number }>
}
