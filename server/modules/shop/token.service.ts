import { eq, and, sql } from 'drizzle-orm'
import { db } from '../../db/connection'
import { progress, userTaskProgress, tokenTasks } from '../../schema'
import { shopRepository } from './shop.repository'

const CORRECT_PER_REWARD = 10
const CORRECT_REWARD_AMOUNT = 50

export const tokenService = {
  async onCorrectAnswer(userId: string): Promise<void> {
    const [row] = await db.select({ totalCorrect: progress.totalCorrect })
      .from(progress).where(eq(progress.userId, userId))
    if (!row) return

    const total = row.totalCorrect
    if (total > 0 && total % CORRECT_PER_REWARD === 0) {
      await shopRepository.addTokens(userId, CORRECT_REWARD_AMOUNT, 'task', `correct_${total}`)
    }

    await this.incrementTask(userId, 'test3', 1)
  },

  async onTestComplete(userId: string, scorePercent: number): Promise<void> {
    if (scorePercent >= 80) {
      await this.incrementTask(userId, 'score80', 1)
    }
  },

  async onVideoWatch(userId: string): Promise<void> {
    await this.incrementTask(userId, 'video', 1)
  },

  async onReferral(userId: string): Promise<void> {
    await this.incrementTask(userId, 'invite', 1)
  },

  async onDailyLogin(userId: string): Promise<void> {
    await this.incrementTask(userId, 'daily', 1)
  },

  async incrementTask(userId: string, taskId: string, delta: number): Promise<void> {
    if (delta <= 0 || !Number.isFinite(delta)) return

    const [task] = await db.select({ reward: tokenTasks.reward, total: tokenTasks.total })
      .from(tokenTasks).where(and(eq(tokenTasks.id, taskId), eq(tokenTasks.isActive, true)))
    if (!task) return

    await db.insert(userTaskProgress)
      .values({ userId, taskId, progress: 0, completed: false })
      .onConflictDoNothing()

    // Atomic: increment progress + mark completed in single UPDATE with WHERE guard.
    // The `completed = false` condition prevents double-award on concurrent calls.
    const [updated] = await db.update(userTaskProgress)
      .set({
        progress: sql`LEAST(${userTaskProgress.progress} + ${delta}, ${task.total})`,
        completed: sql`LEAST(${userTaskProgress.progress} + ${delta}, ${task.total}) >= ${task.total}`,
        claimedAt: sql`CASE WHEN LEAST(${userTaskProgress.progress} + ${delta}, ${task.total}) >= ${task.total} THEN now() ELSE ${userTaskProgress.claimedAt} END`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userTaskProgress.userId, userId),
        eq(userTaskProgress.taskId, taskId),
        eq(userTaskProgress.completed, false),
      ))
      .returning({
        progress: userTaskProgress.progress,
        completed: userTaskProgress.completed,
      })

    if (updated?.completed) {
      await shopRepository.addTokens(userId, task.reward, 'task', taskId)
    }
  },
}
