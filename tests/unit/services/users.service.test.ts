import { afterEach, describe, expect, it, vi } from 'vitest'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { TRIAL_DAYS, usersService } from '../../../server/modules/users/users.service'

const USER_ID = 123n

afterEach(() => vi.restoreAllMocks())

describe('usersService.startTrial', () => {
  it('conditional update muvaffaqiyatli bo‘lsa trial beradi', async () => {
    vi.spyOn(usersRepository, 'tryGrantTrial').mockResolvedValue(true)
    const find = vi.spyOn(usersRepository, 'findById')

    await expect(usersService.startTrial(USER_ID)).resolves.toEqual({
      granted: true,
      days: TRIAL_DAYS,
    })
    expect(find).not.toHaveBeenCalled()
  })

  it('conditional update o‘tmasa takroriy trialni rad etadi', async () => {
    vi.spyOn(usersRepository, 'tryGrantTrial').mockResolvedValue(false)
    vi.spyOn(usersRepository, 'findById').mockResolvedValue({ id: USER_ID } as never)

    await expect(usersService.startTrial(USER_ID)).resolves.toEqual({
      granted: false,
      reason: 'already_used',
      days: 0,
    })
  })

  it('mavjud bo‘lmagan user uchun 404 qaytaradi', async () => {
    vi.spyOn(usersRepository, 'tryGrantTrial').mockResolvedValue(false)
    vi.spyOn(usersRepository, 'findById').mockResolvedValue(null)

    await expect(usersService.startTrial(USER_ID)).rejects.toMatchObject({ statusCode: 404 })
  })
})
