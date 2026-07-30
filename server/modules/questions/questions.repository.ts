import { eq } from 'drizzle-orm'
import { db } from '../../db/connection'
import { questions, topics } from '../../schema'

export const questionsRepository = {
  findAll() {
    return db.select().from(questions)
  },

  findByTopic(topicId: number) {
    return db.select().from(questions).where(eq(questions.topicId, topicId))
  },

  findTopics() {
    return db.select().from(topics)
  },
}
