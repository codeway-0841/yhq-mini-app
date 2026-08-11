import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../server/modules/shop/shop.repository', () => ({
  shopRepository: {
    getUserTotalCorrect: vi.fn(),
    findTask: vi.fn(),
    incrementTaskProgress: vi.fn(),
    addTokens: vi.fn(),
  },
}))

import { tokenService } from '../../../server/modules/shop/token.service'
import { shopRepository } from '../../../server/modules/shop/shop.repository'

const mock = shopRepository as {
  getUserTotalCorrect: ReturnType<typeof vi.fn>
  findTask: ReturnType<typeof vi.fn>
  incrementTaskProgress: ReturnType<typeof vi.fn>
  addTokens: ReturnType<typeof vi.fn>
}

afterEach(() => vi.clearAllMocks())

describe('tokenService.onCorrectAnswer', () => {
  it('awards 50 tokens at every 10th correct answer', async () => {
    mock.getUserTotalCorrect.mockResolvedValue(20)
    mock.addTokens.mockResolvedValue(100)
    mock.findTask.mockResolvedValue(null)

    await tokenService.onCorrectAnswer('u1')

    expect(mock.addTokens).toHaveBeenCalledWith('u1', 50, 'task', 'correct_20')
  })

  it('awards at 10, 30, 100, etc.', async () => {
    for (const n of [10, 30, 100]) {
      vi.clearAllMocks()
      mock.getUserTotalCorrect.mockResolvedValue(n)
      mock.addTokens.mockResolvedValue(100)
      mock.findTask.mockResolvedValue(null)

      await tokenService.onCorrectAnswer('u1')
      expect(mock.addTokens).toHaveBeenCalledWith('u1', 50, 'task', `correct_${n}`)
    }
  })

  it('does NOT award at non-multiples of 10', async () => {
    mock.getUserTotalCorrect.mockResolvedValue(13)
    mock.findTask.mockResolvedValue(null)

    await tokenService.onCorrectAnswer('u1')

    expect(mock.addTokens).not.toHaveBeenCalled()
  })

  it('does NOT award when totalCorrect is 0', async () => {
    mock.getUserTotalCorrect.mockResolvedValue(0)
    mock.findTask.mockResolvedValue(null)

    await tokenService.onCorrectAnswer('u1')

    expect(mock.addTokens).not.toHaveBeenCalled()
  })

  it('does nothing when user has no progress', async () => {
    mock.getUserTotalCorrect.mockResolvedValue(null)

    await tokenService.onCorrectAnswer('u1')

    expect(mock.addTokens).not.toHaveBeenCalled()
    expect(mock.findTask).not.toHaveBeenCalled()
  })

  it('also increments test3 task', async () => {
    mock.getUserTotalCorrect.mockResolvedValue(7)
    mock.findTask.mockResolvedValue({ reward: 50, total: 3 })
    mock.incrementTaskProgress.mockResolvedValue({ progress: 2, completed: false })

    await tokenService.onCorrectAnswer('u1')

    expect(mock.findTask).toHaveBeenCalledWith('test3')
    expect(mock.incrementTaskProgress).toHaveBeenCalledWith('u1', 'test3', 1, 3)
  })
})

describe('tokenService.onTestComplete', () => {
  it('increments score80 task when score >= 80', async () => {
    mock.findTask.mockResolvedValue({ reward: 100, total: 5 })
    mock.incrementTaskProgress.mockResolvedValue({ progress: 1, completed: false })

    await tokenService.onTestComplete('u1', 85)

    expect(mock.findTask).toHaveBeenCalledWith('score80')
  })

  it('does nothing when score < 80', async () => {
    await tokenService.onTestComplete('u1', 79)

    expect(mock.findTask).not.toHaveBeenCalled()
  })
})

describe('tokenService.incrementTask', () => {
  it('skips invalid delta', async () => {
    await tokenService.incrementTask('u1', 'x', 0)
    await tokenService.incrementTask('u1', 'x', -5)
    await tokenService.incrementTask('u1', 'x', NaN)
    await tokenService.incrementTask('u1', 'x', Infinity)

    expect(mock.findTask).not.toHaveBeenCalled()
  })

  it('skips when task not found', async () => {
    mock.findTask.mockResolvedValue(null)

    await tokenService.incrementTask('u1', 'ghost', 1)

    expect(mock.incrementTaskProgress).not.toHaveBeenCalled()
  })

  it('awards tokens when task completes', async () => {
    mock.findTask.mockResolvedValue({ reward: 200, total: 5 })
    mock.incrementTaskProgress.mockResolvedValue({ progress: 5, completed: true })
    mock.addTokens.mockResolvedValue(500)

    await tokenService.incrementTask('u1', 'score80', 1)

    expect(mock.addTokens).toHaveBeenCalledWith('u1', 200, 'task', 'score80')
  })

  it('does NOT award when task not yet complete', async () => {
    mock.findTask.mockResolvedValue({ reward: 200, total: 5 })
    mock.incrementTaskProgress.mockResolvedValue({ progress: 3, completed: false })

    await tokenService.incrementTask('u1', 'score80', 1)

    expect(mock.addTokens).not.toHaveBeenCalled()
  })

  it('does NOT award when update returns null (race: already completed)', async () => {
    mock.findTask.mockResolvedValue({ reward: 200, total: 5 })
    mock.incrementTaskProgress.mockResolvedValue(null)

    await tokenService.incrementTask('u1', 'score80', 1)

    expect(mock.addTokens).not.toHaveBeenCalled()
  })
})
