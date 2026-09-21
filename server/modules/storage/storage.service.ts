/**
 * Cloudflare R2 Storage Pipeline Service
 *
 * Implements validation, SHA-256 deduplication, WebP variant generation,
 * R2 uploads with immutable caching, and reference-counted orphan cleanup.
 */

import { config } from '../../config'
import { AppError } from '../../middleware/error-handler'
import { R2StorageProvider } from './r2-client'
import { MockStorageProvider } from './mock-storage'
import { validateImageBuffer } from './image-validator'
import { computeSha256, processImage } from './image-processor'
import { storageRepository } from './storage.repository'
import type { IStorageProvider, ImageType, StoredImageRecord, UploadOptions } from './storage.types'

export class StorageService {
  private provider: IStorageProvider

  constructor(customProvider?: IStorageProvider) {
    if (customProvider) {
      this.provider = customProvider
    } else if (config.r2.isConfigured) {
      this.provider = new R2StorageProvider({
        accountId: config.r2.accountId!,
        accessKeyId: config.r2.accessKeyId!,
        secretAccessKey: config.r2.secretAccessKey!,
        bucket: config.r2.bucket!,
        publicUrl: config.r2.publicUrl,
      })
    } else {
      this.provider = new MockStorageProvider(config.r2.publicUrl || 'https://cdn.kivvi.uz')
    }
  }

  /**
   * Set storage provider (used in tests or dynamic switching)
   */
  public setProvider(provider: IStorageProvider): void {
    this.provider = provider
  }

  public getProvider(): IStorageProvider {
    return this.provider
  }

  /**
   * Upload an image buffer through the complete pipeline:
   * 1. Validate magic bytes, MIME, and size
   * 2. Compute SHA-256 hash
   * 3. Check for existing image (Deduplication) -> increment ref_count if found
   * 4. Optimize into WebP size variants with Sharp
   * 5. Upload all variants to Cloudflare R2 with immutable cache header
   * 6. Save image metadata to PostgreSQL Neon
   */
  public async uploadImage(options: UploadOptions): Promise<StoredImageRecord & { isDuplicate?: boolean }> {
    const { fileBuffer, mimeType, type } = options

    // 1. Validation
    const validation = await validateImageBuffer(fileBuffer, mimeType, { type })
    if (!validation.valid) {
      throw new AppError(400, validation.error || 'Noto\'g\'ri rasm formati')
    }

    // 2. SHA-256 Hash
    const hash = computeSha256(fileBuffer)

    // 3. Deduplication check
    const existing = await storageRepository.findByHashAndType(hash, type)
    if (existing) {
      const updated = await storageRepository.incrementRefCount(existing.id)
      return {
        ...(updated || existing),
        isDuplicate: true,
      }
    }

    // 4. Optimize and generate WebP size variants
    const processed = await processImage(fileBuffer, type, (key) => this.provider.getPublicUrl(key))

    // 5. Upload all variants to Cloudflare R2
    for (const [key, variantBuffer] of processed.bufferMap.entries()) {
      await this.provider.uploadObject(
        key,
        variantBuffer,
        'image/webp',
        'public, max-age=31536000, immutable',
      )
    }

    // 6. Record metadata in DB
    const saved = await storageRepository.insertImage({
      hash: processed.hash,
      type: processed.type,
      key: processed.key,
      publicUrl: processed.publicUrl,
      width: processed.width,
      height: processed.height,
      sizeBytes: processed.sizeBytes,
      mime: processed.mime,
      variants: processed.variants,
      refCount: 1,
    })

    return {
      ...saved,
      isDuplicate: false,
    }
  }

  /**
   * Release image reference when replaced or deleted.
   * If ref_count drops to <= 0, deletes all variant files from storage and deletes DB row.
   */
  public async releaseImage(idOrKey: number | string): Promise<{ deleted: boolean; remainingRefCount: number }> {
    const image = typeof idOrKey === 'number'
      ? await storageRepository.findById(idOrKey)
      : await storageRepository.findByKey(idOrKey)

    if (!image) {
      return { deleted: false, remainingRefCount: 0 }
    }

    const updated = await storageRepository.decrementRefCount(image.id)
    const remaining = updated?.refCount ?? 0

    if (remaining <= 0) {
      // Gather all object keys for all variants
      const keysToDelete: string[] = [image.key]
      if (image.variants && typeof image.variants === 'object') {
        for (const variant of Object.values(image.variants)) {
          if (variant?.key) {
            keysToDelete.push(variant.key)
          }
        }
      }

      // Delete from Cloudflare R2 storage
      await this.provider.deleteObjects(keysToDelete)

      // Delete from DB
      await storageRepository.deleteImage(image.id)

      return { deleted: true, remainingRefCount: 0 }
    }

    return { deleted: false, remainingRefCount: remaining }
  }

  public async getImageByHash(hash: string, type: ImageType): Promise<StoredImageRecord | null> {
    return storageRepository.findByHashAndType(hash, type)
  }

  public async getImageByKey(key: string): Promise<StoredImageRecord | null> {
    return storageRepository.findByKey(key)
  }

  public getPublicUrl(key: string): string {
    return this.provider.getPublicUrl(key)
  }
}

export const storageService = new StorageService()
