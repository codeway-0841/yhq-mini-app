import type { QuestionBankProvider, QuestionRow, TopicRow } from './QuestionBankProvider'
import { questionsRepository } from '../modules/questions/questions.repository'

/** Fizika Test Print banki uchun alohida provider. */
export class PhysicsQuestionBankProvider implements QuestionBankProvider {
  readonly sourceId = 'physics_db'

  getAllQuestions(): Promise<QuestionRow[]> { return questionsRepository.findAll(this.sourceId) }
  getQuestionById(questionId: number): Promise<QuestionRow | null> {
    return questionsRepository.findById(questionId, this.sourceId)
  }
  getQuestionsByTopic(topicId: number): Promise<QuestionRow[]> {
    return questionsRepository.findByTopic(topicId, this.sourceId)
  }
  getTopics(): Promise<TopicRow[]> { return questionsRepository.findTopics(this.sourceId) }
  async getStats(): Promise<{ totalQuestions: number; totalTopics: number }> {
    const [totalQuestions, topicRows] = await Promise.all([
      questionsRepository.countByBank(this.sourceId),
      this.getTopics(),
    ])
    return { totalQuestions, totalTopics: topicRows.length }
  }
}
