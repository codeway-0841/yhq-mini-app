/**
 * Storage Repository — DB operations for `images` table
 */

import { eq, and, sql } from 'drizzle-orm'
import { db } from '../../db/connection'
import { images } from '../../schema'
import type { ImageType, ImageVariantResult, StoredImageRecord } from './storage.types'

export const storageRepository = {
  async findByHashAndType(hash: string, type: ImageType): Promise<StoredImageRecord | null> {
    const rows = await db
      .select()
      .from(images)
      .where(and(eq(images.hash, hash), eq(images.type, type)))
      .limit(1)

    return (rows[0] as StoredImageRecord) ?? null
  },

  async findByKey(key: string): Promise<StoredImageRecord | null> {
    const rows = await db
      .select()
      .from(images)
      .where(eq(images.key, key))
      .limit(1)

    return (rows[0] as StoredImageRecord) ?? null
  },

  async findById(id: number): Promise<StoredImageRecord | null> {
    const rows = await db
      .select()
      .from(images)
      .where(eq(images.id, id))
      .limit(1)

    return (rows[0] as StoredImageRecord) ?? null
  },

  async insertImage(data: {
    hash: string
    type: ImageType
    key: string
    publicUrl: string
    width: number
    height: number
    sizeBytes: number
    mime?: string
    variants: Record<string, ImageVariantResult>
    refCount?: number
  }): Promise<StoredImageRecord> {
    const [row] = await db
      .insert(images)
      .values({
        hash: data.hash,
        type: data.type,
        key: data.key,
        publicUrl: data.publicUrl,
        width: data.width,
        height: data.height,
        sizeBytes: data.sizeBytes,
        mime: data.mime || 'image/webp',
        variants: data.variants,
        refCount: data.refCount ?? 1,
      })
      .returning()

    return row as StoredImageRecord
  },

  /**
   * Atomically increments ref_count for an image
   */
  async incrementRefCount(id: number): Promise<StoredImageRecord | null> {
    const [row] = await db
      .update(images)
      .set({
        refCount: sql`${images.refCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(images.id, id))
      .returning()

    return (row as StoredImageRecord) ?? null
  },

  /**
   * Atomically decrements ref_count for an image and returns updated record
   */
  async decrementRefCount(id: number): Promise<StoredImageRecord | null> {
    const [row] = await db
      .update(images)
      .set({
        refCount: sql`GREATEST(0, ${images.refCount} - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(images.id, id))
      .returning()

    return (row as StoredImageRecord) ?? null
  },

  async deleteImage(id: number): Promise<boolean> {
    const res = await db.delete(images).where(eq(images.id, id)).returning({ id: images.id })
    return res.length > 0
  },

  async deleteByKey(key: string): Promise<boolean> {
    const res = await db.delete(images).where(eq(images.key, key)).returning({ id: images.id })
    return res.length > 0
  },
}
