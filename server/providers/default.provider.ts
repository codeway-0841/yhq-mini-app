import type { QuestionBankProvider, QuestionRow, TopicRow } from './QuestionBankProvider'
import { questionsRepository } from '../modules/questions/questions.repository'

/**
 * DefaultQuestionBankProvider — YHQ (traffic_rules) bazasini
 * mavjud repository orqali taqdim etadigan adapter.
 * Hozir BARCHA fanlar shu provider'ga bog'langan (vaqtinchalik).
 *
 * Kelajakda yangi fan bazasi uchun shunga o'xshash yangi class yoziladi:
 *   class PhysicsQuestionBankProvider implements QuestionBankProvider { ... }
 */
export class DefaultQuestionBankProvider implements QuestionBankProvider {
  readonly sourceId: string

  constructor(sourceId = 'traffic_rules_db') {
    this.sourceId = sourceId
  }

  getAllQuestions(): Promise<QuestionRow[]> {
    return questionsRepository.findAll(this.sourceId)
  }

  getQuestionById(questionId: number): Promise<QuestionRow | null> {
    return questionsRepository.findById(questionId, this.sourceId)
  }

  getQuestionsByTopic(topicId: number): Promise<QuestionRow[]> {
    return questionsRepository.findByTopic(topicId, this.sourceId)
  }

  getTopics(): Promise<TopicRow[]> {
    return questionsRepository.findTopics(this.sourceId)
  }

  async getStats(): Promise<{ totalQuestions: number; totalTopics: number }> {
    const [qCount, ts] = await Promise.all([
      questionsRepository.countByBank(this.sourceId),
      questionsRepository.findTopics(this.sourceId),
    ])
    return { totalQuestions: qCount, totalTopics: ts.length }
  }
}
