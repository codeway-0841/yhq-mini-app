import { shopRepository } from './shop.repository'

const CORRECT_PER_REWARD = 10
const CORRECT_REWARD_AMOUNT = 50

export const tokenService = {
  async onCorrectAnswer(userId: string): Promise<void> {
    const totalCorrect = await shopRepository.getUserTotalCorrect(userId)
    if (totalCorrect === null) return

    if (totalCorrect > 0 && totalCorrect % CORRECT_PER_REWARD === 0) {
      await shopRepository.addTokens(userId, CORRECT_REWARD_AMOUNT, 'task', `correct_${totalCorrect}`)
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

    const task = await shopRepository.findTask(taskId)
    if (!task) return

    const updated = await shopRepository.incrementTaskProgress(userId, taskId, delta, task.total)

    if (updated?.completed) {
      await shopRepository.addTokens(userId, task.reward, 'task', taskId)
    }
  },
}
