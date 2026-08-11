import { eq, and, sql, desc } from 'drizzle-orm'
import { db } from '../../db/connection'
import {
  shopItems, tokenBalances, tokenTransactions,
  userPurchases, dailyRewards, tokenTasks, userTaskProgress,
  progress,
} from '../../schema'
import { AppError } from '../../middleware/error-handler'
import { tashkentDate } from '../../utils/date'

const DAILY_REWARD_BASE = 500
const DAILY_STREAK_BONUS = 100

export const shopRepository = {
  async getBalance(userId: string): Promise<number> {
    const [row] = await db.select({ balance: tokenBalances.balance })
      .from(tokenBalances).where(eq(tokenBalances.userId, userId))
    return row?.balance ?? 0
  },

  async ensureBalance(userId: string): Promise<void> {
    await db.insert(tokenBalances).values({ userId, balance: 0, totalEarned: 0 })
      .onConflictDoNothing()
  },

  async addTokens(userId: string, amount: number, type: string, refId?: string): Promise<number> {
    await this.ensureBalance(userId)
    const [updated] = await db.update(tokenBalances)
      .set({
        balance: sql`${tokenBalances.balance} + ${amount}`,
        totalEarned: amount > 0
          ? sql`${tokenBalances.totalEarned} + ${amount}`
          : tokenBalances.totalEarned,
      })
      .where(eq(tokenBalances.userId, userId))
      .returning({ balance: tokenBalances.balance })

    if (!updated) throw new AppError(500, 'Failed to update token balance')

    await db.insert(tokenTransactions).values({ userId, amount, type, refId })
    return updated.balance
  },

  async getItems(type: string, category?: string) {
    const conditions = [eq(shopItems.type, type), eq(shopItems.isActive, true)]
    if (category && category !== 'all') {
      conditions.push(eq(shopItems.category, category))
    }
    return db.select().from(shopItems).where(and(...conditions))
      .orderBy(shopItems.sortOrder)
  },

  async purchaseItem(userId: string, itemId: string): Promise<{ newBalance: number }> {
    const [item] = await db.select().from(shopItems).where(eq(shopItems.id, itemId))
    if (!item) throw new AppError(404, 'Item not found')
    if (!item.isActive) throw new AppError(400, 'Item is not available')

    // Check already owned (unique constraint provides atomic safety)
    const [existing] = await db.select({ id: userPurchases.id })
      .from(userPurchases)
      .where(and(eq(userPurchases.userId, userId), eq(userPurchases.itemId, itemId)))
    if (existing) throw new AppError(409, 'Already owned')

    // Atomic balance deduction — WHERE clause acts as guard against concurrent overspend
    await this.ensureBalance(userId)
    const [updated] = await db.update(tokenBalances)
      .set({ balance: sql`${tokenBalances.balance} - ${item.price}` })
      .where(and(eq(tokenBalances.userId, userId), sql`${tokenBalances.balance} >= ${item.price}`))
      .returning({ balance: tokenBalances.balance })

    if (!updated) throw new AppError(400, 'Insufficient balance')

    // Insert purchase — unique constraint (uq_user_purchase) prevents double-purchase at DB level
    const inserted = await db.insert(userPurchases).values({ userId, itemId, price: item.price })
      .onConflictDoNothing()
      .returning({ id: userPurchases.id })

    if (!inserted.length) {
      // Race: another request already purchased — refund the deducted tokens
      await db.update(tokenBalances)
        .set({ balance: sql`${tokenBalances.balance} + ${item.price}` })
        .where(eq(tokenBalances.userId, userId))
      throw new AppError(409, 'Already owned')
    }

    await db.insert(tokenTransactions).values({
      userId, amount: -item.price, type: 'purchase', refId: itemId,
    })

    return { newBalance: updated.balance }
  },

  async getUserPurchases(userId: string): Promise<string[]> {
    const rows = await db.select({ itemId: userPurchases.itemId })
      .from(userPurchases).where(eq(userPurchases.userId, userId))
    return rows.map(r => r.itemId)
  },

  async claimDailyReward(userId: string): Promise<{ tokens: number; streak: number; newBalance: number }> {
    const today = tashkentDate()
    await this.ensureBalance(userId)

    // Ensure daily_rewards row
    await db.insert(dailyRewards).values({ userId, lastClaimDate: null, streak: 0 })
      .onConflictDoNothing()

    const [reward] = await db.select().from(dailyRewards)
      .where(eq(dailyRewards.userId, userId))

    if (reward?.lastClaimDate === today) {
      throw new AppError(400, 'Already claimed today')
    }

    // Streak logic — use tashkentDate for yesterday to match today's timezone
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayStr = tashkentDate(yesterdayDate)
    const newStreak = reward?.lastClaimDate === yesterdayStr ? (reward.streak + 1) : 1
    const tokens = DAILY_REWARD_BASE + (newStreak - 1) * DAILY_STREAK_BONUS

    // Atomic guard: only update if lastClaimDate has not changed (prevents double-claim race)
    const [claimed] = await db.update(dailyRewards)
      .set({ lastClaimDate: today, streak: newStreak })
      .where(and(
        eq(dailyRewards.userId, userId),
        reward?.lastClaimDate
          ? eq(dailyRewards.lastClaimDate, reward.lastClaimDate)
          : sql`${dailyRewards.lastClaimDate} IS NULL`,
      ))
      .returning({ userId: dailyRewards.userId })

    if (!claimed) throw new AppError(400, 'Already claimed today')

    const newBalance = await this.addTokens(userId, tokens, 'daily', `daily_${today}`)

    // Lazy-import to avoid circular dependency
    const { tokenService } = await import('./token.service')
    setImmediate(() => {
      tokenService.onDailyLogin(userId).catch((err) => {
        console.error('[token] onDailyLogin failed:', userId, err)
      })
    })

    return { tokens, streak: newStreak, newBalance }
  },

  async getDailyRewardStatus(userId: string) {
    const today = tashkentDate()
    const [reward] = await db.select().from(dailyRewards)
      .where(eq(dailyRewards.userId, userId))
    return {
      claimed: reward?.lastClaimDate === today,
      streak: reward?.streak ?? 0,
      lastClaimDate: reward?.lastClaimDate ?? null,
    }
  },

  async getTasks() {
    return db.select().from(tokenTasks)
      .where(eq(tokenTasks.isActive, true))
      .orderBy(tokenTasks.sortOrder)
  },

  async getUserTaskProgress(userId: string) {
    return db.select({
      taskId: userTaskProgress.taskId,
      progress: userTaskProgress.progress,
      completed: userTaskProgress.completed,
    }).from(userTaskProgress).where(eq(userTaskProgress.userId, userId))
  },

  async getTransactionHistory(userId: string, limit = 50) {
    return db.select().from(tokenTransactions)
      .where(eq(tokenTransactions.userId, userId))
      .orderBy(desc(tokenTransactions.createdAt))
      .limit(limit)
  },

  async getUserTotalCorrect(userId: string): Promise<number | null> {
    const [row] = await db.select({ totalCorrect: progress.totalCorrect })
      .from(progress).where(eq(progress.userId, userId))
    return row?.totalCorrect ?? null
  },

  async findTask(taskId: string): Promise<{ reward: number; total: number } | null> {
    const [task] = await db.select({ reward: tokenTasks.reward, total: tokenTasks.total })
      .from(tokenTasks).where(and(eq(tokenTasks.id, taskId), eq(tokenTasks.isActive, true)))
    return task ?? null
  },

  async incrementTaskProgress(userId: string, taskId: string, delta: number, total: number): Promise<{ progress: number; completed: boolean } | null> {
    await db.insert(userTaskProgress)
      .values({ userId, taskId, progress: 0, completed: false })
      .onConflictDoNothing()

    const [updated] = await db.update(userTaskProgress)
      .set({
        progress: sql`LEAST(${userTaskProgress.progress} + ${delta}, ${total})`,
        completed: sql`LEAST(${userTaskProgress.progress} + ${delta}, ${total}) >= ${total}`,
        claimedAt: sql`CASE WHEN LEAST(${userTaskProgress.progress} + ${delta}, ${total}) >= ${total} THEN now() ELSE ${userTaskProgress.claimedAt} END`,
        updatedAt: sql`now()`,
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

    return updated ?? null
  },
}
