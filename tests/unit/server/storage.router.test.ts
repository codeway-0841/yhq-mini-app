import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import sharp from 'sharp'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { storageRepository } from '../../../server/modules/storage/storage.repository'
import { storageService } from '../../../server/modules/storage/storage.service'
import { MockStorageProvider } from '../../../server/modules/storage/mock-storage'

const app = createApp()

describe('Storage & Avatar Router Endpoints', () => {
  let mockStorage: MockStorageProvider
  let sampleDataUrl: string
  let avatarDataUrl: string

  beforeEach(async () => {
    vi.restoreAllMocks()
    mockStorage = new MockStorageProvider('https://cdn.kivvi.uz')
    storageService.setProvider(mockStorage)

    // Auth resolve mock
    vi.spyOn(authRepository, 'resolveSession').mockImplementation(async (token) => {
      if (token === 'admin_token') {
        return {
          userId: '99999',
          provider: 'phone',
          expiresAt: new Date(Date.now() + 1000000),
        } as any
      }
      if (token === 'user_token') {
        return {
          userId: '12345',
          provider: 'telegram',
          expiresAt: new Date(Date.now() + 1000000),
        } as any
      }
      return null
    })

    // Mock DB select for requireAdmin middleware
    vi.spyOn(db, 'select').mockImplementation(((fields?: any) => ({
      from: vi.fn().mockImplementation((table: any) => ({
        where: vi.fn().mockImplementation(async () => {
          return [{ isAdmin: true }]
        }),
      })),
    })) as any)

    // User lookup mock for admin/users
    vi.spyOn(usersRepository, 'findById').mockImplementation(async (id) => {
      if (id === '99999') {
        return {
          id: '99999',
          firstName: 'Admin',
          isAdmin: true,
          tariff: 'premium',
          phone: '+998901112233',
        } as any
      }
      if (id === '12345') {
        return {
          id: '12345',
          firstName: 'User',
          isAdmin: false,
          tariff: 'free',
          phone: null,
          avatarWebp: 'https://cdn.kivvi.uz/images/avatar/test/256.webp',
        } as any
      }
      return null
    })

    // Mock storageRepository
    vi.spyOn(storageRepository, 'findByHashAndType').mockResolvedValue(null)
    vi.spyOn(storageRepository, 'insertImage').mockImplementation(async (data) => {
      return {
        id: 1,
        ...data,
        mime: data.mime || 'image/webp',
        refCount: data.refCount || 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any
    })

    // Create a 50x50 PNG data URL
    const pngBuf = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } },
    }).png().toBuffer()
    sampleDataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`

    const webpBuf = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } },
    }).webp().toBuffer()
    avatarDataUrl = `data:image/webp;base64,${webpBuf.toString('base64')}`
  })

  describe('POST /api/upload/image', () => {
    it('returns 400 for empty or invalid image payload', async () => {
      const res = await request(app)
        .post('/api/upload/image')
        .send({ image: 'invalid base64' })
        .expect(400)

      expect(res.body.error).toBeDefined()
    })

    it('successfully uploads and optimizes a valid image', async () => {
      const res = await request(app)
        .post('/api/upload/image')
        .send({
          image: sampleDataUrl,
          type: 'badge',
          filename: 'badge-test.png',
        })
        .expect(201)

      expect(res.body.ok).toBe(true)
      expect(res.body.image.type).toBe('badge')
      expect(res.body.image.mime).toBe('image/webp')
      expect(res.body.image.publicUrl).toContain('https://cdn.kivvi.uz/images/badge/')
      expect(res.body.image.variants['512']).toBeDefined()
    })
  })

  describe('POST /api/admin/upload', () => {
    it('returns 401 without auth', async () => {
      await request(app)
        .post('/api/admin/upload')
        .send({ image: sampleDataUrl, type: 'test_image' })
        .expect(401)
    })

    it('returns 403 for non-admin user', async () => {
      vi.spyOn(db, 'select').mockImplementation(((fields?: any) => ({
        from: vi.fn().mockImplementation((table: any) => ({
          where: vi.fn().mockImplementation(async () => {
            return [{ isAdmin: false }]
          }),
        })),
      })) as any)

      await request(app)
        .post('/api/admin/upload')
        .set('Authorization', 'Bearer user_token')
        .send({ image: sampleDataUrl, type: 'test_image' })
        .expect(403)
    })

    it('allows admin to upload assets', async () => {
      const res = await request(app)
        .post('/api/admin/upload')
        .set('Authorization', 'Bearer admin_token')
        .send({ image: sampleDataUrl, type: 'book_cover' })
        .expect(201)

      expect(res.body.ok).toBe(true)
      expect(res.body.image.type).toBe('book_cover')
      expect(res.body.image.variants['600x900']).toBeDefined()
    })
  })

  describe('PUT /api/users/:userId/avatar', () => {
    it('uploads user avatar through storage pipeline and returns publicUrl', async () => {
      vi.spyOn(usersRepository, 'setAvatar').mockResolvedValue({ oldAvatarKey: null })

      const res = await request(app)
        .put('/api/users/12345/avatar')
        .set('Authorization', 'Bearer user_token')
        .send({ image: avatarDataUrl })
        .expect(200)

      expect(res.body.ok).toBe(true)
      expect(res.body.avatarUrl).toContain('https://cdn.kivvi.uz/images/avatar/')
    })

    it('releases old avatar if replaced', async () => {
      vi.spyOn(usersRepository, 'setAvatar').mockResolvedValue({
        oldAvatarKey: 'images/avatar/oldhash/256.webp',
      })
      const releaseSpy = vi.spyOn(storageService, 'releaseImage').mockResolvedValue({
        deleted: true,
        remainingRefCount: 0,
      })

      const res = await request(app)
        .put('/api/users/12345/avatar')
        .set('Authorization', 'Bearer user_token')
        .send({ image: avatarDataUrl })
        .expect(200)

      expect(res.body.ok).toBe(true)
      expect(releaseSpy).toHaveBeenCalledWith('images/avatar/oldhash/256.webp')
    })
  })

  describe('GET /api/avatar/:userId', () => {
    it('returns 307 redirect to Cloudflare CDN URL when custom avatar exists', async () => {
      vi.spyOn(usersRepository, 'getAvatarWebp').mockResolvedValue(
        'https://cdn.kivvi.uz/images/avatar/samplehash/256.webp',
      )

      const res = await request(app)
        .get('/api/avatar/12345')
        .expect(307)

      expect(res.headers.location).toBe('https://cdn.kivvi.uz/images/avatar/samplehash/256.webp')
      expect(res.headers['cache-control']).toContain('public')
    })

    it('returns 404 when avatar is missing', async () => {
      vi.spyOn(usersRepository, 'getAvatarWebp').mockResolvedValue(null)

      await request(app)
        .get('/api/avatar/12345')
        .expect(404)
    })
  })
})
