import { describe, it, expect } from 'vitest'
import { shuffleArray, seededShuffle, hashSeed } from '../../../src/shared/lib/seeded'

describe('seeded and shuffleArray utils', () => {
  it('shuffleArray preserves all elements', () => {
    const original = ['a', 'b', 'c', 'd', 'e']
    const result = shuffleArray(original)
    expect(result).toHaveLength(original.length)
    expect([...result].sort()).toEqual([...original].sort())
  })

  it('shuffleArray does not mutate original array', () => {
    const original = Object.freeze(['a', 'b', 'c', 'd', 'e'])
    const result = shuffleArray(original)
    expect(result).not.toBe(original)
    expect(original).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('seededShuffle returns deterministic output for same seed', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const res1 = seededShuffle(arr, 42)
    const res2 = seededShuffle(arr, 42)
    expect(res1).toEqual(res2)
  })

  it('hashSeed creates numerical hashes', () => {
    const h1 = hashSeed('yhq-test-seed')
    const h2 = hashSeed('yhq-test-seed')
    expect(h1).toBe(h2)
    expect(typeof h1).toBe('number')
  })
})
