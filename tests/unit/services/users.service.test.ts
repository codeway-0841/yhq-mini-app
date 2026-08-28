import { afterEach, describe, expect, it, vi } from 'vitest'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { AvatarUploadSchema, TRIAL_DAYS, usersService } from '../../../server/modules/users/users.service'

const USER_ID = '123'

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

describe('usersService.updateAvatar', () => {
  it('repository yozuvi muvaffaqiyatli bo‘lsa jimgina o‘tadi', async () => {
    const set = vi.spyOn(usersRepository, 'setAvatarWebp').mockResolvedValue(true)
    await expect(usersService.updateAvatar(USER_ID, 'data:image/webp;base64,AAAA')).resolves.toBeUndefined()
    expect(set).toHaveBeenCalledWith(USER_ID, 'data:image/webp;base64,AAAA')
  })

  it('user yo‘q bo‘lsa 404 tashlaydi', async () => {
    vi.spyOn(usersRepository, 'setAvatarWebp').mockResolvedValue(false)
    await expect(usersService.updateAvatar(USER_ID, null)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('AvatarUploadSchema', () => {
  it('toza WebP data URL qabul qiladi', () => {
    expect(AvatarUploadSchema.safeParse({ image: 'data:image/webp;base64,iVBORw0KGgo=' }).success).toBe(true)
  })

  it('JPEG data URL ham qabul qilinadi (eski WebView client fallback)', () => {
    expect(AvatarUploadSchema.safeParse({ image: 'data:image/jpeg;base64,iVBORw0KGgo=' }).success).toBe(true)
  })

  it('boshqa format/fayl tiplarini rad etadi (parsing xurujlari yopiq)', () => {
    for (const image of [
      'data:image/png;base64,iVBORw0KGgo=',
      'data:image/webp;base64,<script>alert(1)</script>',
      'https://evil.example/x.webp',
      'data:image/webp;base64,',
      '',
    ]) {
      expect(AvatarUploadSchema.safeParse({ image }).success).toBe(false)
    }
  })

  it('100k belgi limitidan oshgan payload rad etiladi', () => {
    const image = `data:image/webp;base64,${'A'.repeat(100_001)}`
    expect(AvatarUploadSchema.safeParse({ image }).success).toBe(false)
  })
})
