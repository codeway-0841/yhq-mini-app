import { describe, it, expect } from 'vitest'
import { reviewsRepository } from '../../../server/modules/reviews/reviews.repository'
import reviewsRouter from '../../../server/modules/reviews/reviews.router'

describe('server/modules/reviews - Module Tests', () => {
  it('reviewsRepository defines all required CRUD and aggregation methods', () => {
    expect(typeof reviewsRepository.listApproved).toBe('function')
    expect(typeof reviewsRepository.getSummary).toBe('function')
    expect(typeof reviewsRepository.create).toBe('function')
    expect(typeof reviewsRepository.hasActiveReview).toBe('function')
    expect(typeof reviewsRepository.toggleHelpful).toBe('function')
    expect(typeof reviewsRepository.getUserLikedIds).toBe('function')
  })

  it('reviewsRouter is an express Router instance', () => {
    expect(reviewsRouter).toBeDefined()
    expect(typeof reviewsRouter).toBe('function')
    expect(typeof reviewsRouter.get).toBe('function')
    expect(typeof reviewsRouter.post).toBe('function')
  })
})
