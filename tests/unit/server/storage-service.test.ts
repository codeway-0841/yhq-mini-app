import { describe, it, expect, vi, beforeEach } from 'vitest'
import sharp from 'sharp'
import { StorageService } from '../../../server/modules/storage/storage.service'
import { MockStorageProvider } from '../../../server/modules/storage/mock-storage'
import { R2StorageProvider } from '../../../server/modules/storage/r2-client'
import { storageRepository } from '../../../server/modules/storage/storage.repository'
import type { StoredImageRecord } from '../../../server/modules/storage/storage.types'

describe('Storage Service & Pipeline Tests', () => {
  let mockStorage: MockStorageProvider
  let service: StorageService
  let sampleImageBuffer: Buffer

  beforeEach(async () => {
    vi.restoreAllMocks()
    mockStorage = new MockStorageProvider('https://cdn.kivvi.uz')
    service = new StorageService(mockStorage)

    // Create a 200x200 PNG test image
    sampleImageBuffer = await sharp({
      create: { width: 200, height: 200, channels: 4, background: { r: 50, g: 150, b: 250, alpha: 0.9 } },
    }).png().toBuffer()
  })

  describe('Mock Storage Provider', () => {
    it('uploads, checks existence, and deletes objects', async () => {
      const key = 'test/sample.webp'
      const buf = Buffer.from('webp-data')

      expect(await mockStorage.objectExists(key)).toBe(false)

      await mockStorage.uploadObject(key, buf, 'image/webp')
      expect(await mockStorage.objectExists(key)).toBe(true)

      const stored = mockStorage.getStoredObject(key)
      expect(stored?.body.toString()).toBe('webp-data')
      expect(stored?.contentType).toBe('image/webp')

      expect(mockStorage.getPublicUrl(key)).toBe('https://cdn.kivvi.uz/test/sample.webp')

      await mockStorage.deleteObject(key)
      expect(await mockStorage.objectExists(key)).toBe(false)
    })

    it('deletes multiple objects', async () => {
      await mockStorage.uploadObject('a.webp', Buffer.from('a'))
      await mockStorage.uploadObject('b.webp', Buffer.from('b'))
      expect(mockStorage.getStoredCount()).toBe(2)

      await mockStorage.deleteObjects(['a.webp', 'b.webp'])
      expect(mockStorage.getStoredCount()).toBe(0)
    })
  })

  describe('R2 Storage Provider', () => {
    it('formats public URLs correctly', () => {
      const r2 = new R2StorageProvider({
        accountId: 'acc123',
        accessKeyId: 'key123',
        secretAccessKey: 'secret123',
        bucket: 'kivvi-media',
        publicUrl: 'https://images.kivvi.uz',
      })

      expect(r2.getPublicUrl('images/avatar/123.webp')).toBe('https://images.kivvi.uz/images/avatar/123.webp')
    })
  })

  describe('StorageService.uploadImage Pipeline', () => {
    it('uploads a new image, processes variants, and stores metadata', async () => {
      let insertedRecord: StoredImageRecord | null = null

      vi.spyOn(storageRepository, 'findByHashAndType').mockResolvedValue(null)
      vi.spyOn(storageRepository, 'insertImage').mockImplementation(async (data) => {
        insertedRecord = {
          id: 1,
          ...data,
          mime: data.mime || 'image/webp',
          refCount: data.refCount || 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        return insertedRecord
      })

      const res = await service.uploadImage({
        fileBuffer: sampleImageBuffer,
        type: 'avatar',
        userId: 'u123',
      })

      expect(res.id).toBe(1)
      expect(res.type).toBe('avatar')
      expect(res.mime).toBe('image/webp')
      expect(res.isDuplicate).toBe(false)
      expect(res.variants['64']).toBeDefined()
      expect(res.variants['128']).toBeDefined()
      expect(res.variants['256']).toBeDefined()

      // Ensure mock storage received all 3 variants
      expect(mockStorage.getStoredCount()).toBe(3)
    })

    it('deduplicates identical image uploads (SHA-256) and avoids re-uploading', async () => {
      const existingRecord: StoredImageRecord = {
        id: 42,
        hash: 'abc123hash',
        type: 'avatar',
        key: 'images/avatar/abc123hash/256.webp',
        publicUrl: 'https://cdn.kivvi.uz/images/avatar/abc123hash/256.webp',
        width: 256,
        height: 256,
        sizeBytes: 1500,
        mime: 'image/webp',
        variants: {
          '256': {
            key: 'images/avatar/abc123hash/256.webp',
            publicUrl: 'https://cdn.kivvi.uz/images/avatar/abc123hash/256.webp',
            width: 256,
            height: 256,
            sizeBytes: 1500,
          },
        },
        refCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.spyOn(storageRepository, 'findByHashAndType').mockResolvedValue(existingRecord)
      const incSpy = vi.spyOn(storageRepository, 'incrementRefCount').mockResolvedValue({
        ...existingRecord,
        refCount: 2,
      })
      const insertSpy = vi.spyOn(storageRepository, 'insertImage')

      const res = await service.uploadImage({
        fileBuffer: sampleImageBuffer,
        type: 'avatar',
      })

      expect(res.id).toBe(42)
      expect(res.isDuplicate).toBe(true)
      expect(res.refCount).toBe(2)
      expect(incSpy).toHaveBeenCalledWith(42)
      expect(insertSpy).not.toHaveBeenCalled()
      // Nothing was newly written to storage
      expect(mockStorage.getStoredCount()).toBe(0)
    })

    it('rejects invalid or non-image files with 400 AppError', async () => {
      const corruptBuf = Buffer.from('hello plain text')
      await expect(
        service.uploadImage({
          fileBuffer: corruptBuf,
          type: 'avatar',
        }),
      ).rejects.toThrow('Qo\'llab-quvvatlanmaydigan fayl formati')
    })
  })

  describe('StorageService.releaseImage & Orphan Cleanup', () => {
    it('decrements refCount when refCount > 1 and keeps files', async () => {
      const existing: StoredImageRecord = {
        id: 10,
        hash: 'hash10',
        type: 'badge',
        key: 'images/badge/hash10/512.webp',
        publicUrl: 'https://cdn.kivvi.uz/images/badge/hash10/512.webp',
        width: 512,
        height: 512,
        sizeBytes: 5000,
        mime: 'image/webp',
        variants: {
          '512': {
            key: 'images/badge/hash10/512.webp',
            publicUrl: 'https://cdn.kivvi.uz/images/badge/hash10/512.webp',
            width: 512,
            height: 512,
            sizeBytes: 5000,
          },
        },
        refCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.spyOn(storageRepository, 'findById').mockResolvedValue(existing)
      vi.spyOn(storageRepository, 'decrementRefCount').mockResolvedValue({
        ...existing,
        refCount: 1,
      })
      const deleteStorageSpy = vi.spyOn(mockStorage, 'deleteObjects')
      const deleteDbSpy = vi.spyOn(storageRepository, 'deleteImage')

      const res = await service.releaseImage(10)
      expect(res.deleted).toBe(false)
      expect(res.remainingRefCount).toBe(1)
      expect(deleteStorageSpy).not.toHaveBeenCalled()
      expect(deleteDbSpy).not.toHaveBeenCalled()
    })

    it('cleans up storage and DB when refCount drops to 0', async () => {
      const existing: StoredImageRecord = {
        id: 15,
        hash: 'hash15',
        type: 'avatar',
        key: 'images/avatar/hash15/256.webp',
        publicUrl: 'https://cdn.kivvi.uz/images/avatar/hash15/256.webp',
        width: 256,
        height: 256,
        sizeBytes: 3000,
        mime: 'image/webp',
        variants: {
          '64': { key: 'images/avatar/hash15/64.webp', publicUrl: '', width: 64, height: 64, sizeBytes: 500 },
          '128': { key: 'images/avatar/hash15/128.webp', publicUrl: '', width: 128, height: 128, sizeBytes: 1000 },
          '256': { key: 'images/avatar/hash15/256.webp', publicUrl: '', width: 256, height: 256, sizeBytes: 3000 },
        },
        refCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Pre-populate mock storage with the 3 variants
      await mockStorage.uploadObject('images/avatar/hash15/64.webp', Buffer.from('v1'))
      await mockStorage.uploadObject('images/avatar/hash15/128.webp', Buffer.from('v2'))
      await mockStorage.uploadObject('images/avatar/hash15/256.webp', Buffer.from('v3'))
      expect(mockStorage.getStoredCount()).toBe(3)

      vi.spyOn(storageRepository, 'findById').mockResolvedValue(existing)
      vi.spyOn(storageRepository, 'decrementRefCount').mockResolvedValue({
        ...existing,
        refCount: 0,
      })
      const deleteDbSpy = vi.spyOn(storageRepository, 'deleteImage').mockResolvedValue(true)

      const res = await service.releaseImage(15)
      expect(res.deleted).toBe(true)
      expect(res.remainingRefCount).toBe(0)
      expect(deleteDbSpy).toHaveBeenCalledWith(15)
      // All 3 variant files removed from mock storage
      expect(mockStorage.getStoredCount()).toBe(0)
    })
  })
})
