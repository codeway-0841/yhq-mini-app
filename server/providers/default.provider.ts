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
  readonly sourceId = 'traffic_rules_db'

  getAllQuestions(): Promise<QuestionRow[]> {
    return questionsRepository.findAll()
  }

  getQuestionById(questionId: number): Promise<QuestionRow | null> {
    return questionsRepository.findById(questionId)
  }

  getQuestionsByTopic(topicId: number): Promise<QuestionRow[]> {
    return questionsRepository.findByTopic(topicId)
  }

  getTopics(): Promise<TopicRow[]> {
    return questionsRepository.findTopics()
  }

  async getStats(): Promise<{ totalQuestions: number; totalTopics: number }> {
    const [qs, ts] = await Promise.all([
      questionsRepository.findAll(),
      questionsRepository.findTopics(),
    ])
    return { totalQuestions: qs.length, totalTopics: ts.length }
  }
}
