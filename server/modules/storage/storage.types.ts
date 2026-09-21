/**
 * Storage & Image Pipeline Type Definitions
 */

export type ImageType = 'avatar' | 'badge' | 'book_cover' | 'test_image' | 'general'

export interface ImageVariantSpec {
  name: string
  width?: number
  height?: number
  fit?: 'cover' | 'contain' | 'inside'
  withoutEnlargement?: boolean
}

export interface ImageVariantResult {
  key: string
  publicUrl: string
  width: number
  height: number
  sizeBytes: number
}

export interface ProcessedImage {
  hash: string
  type: ImageType
  key: string
  publicUrl: string
  width: number
  height: number
  sizeBytes: number
  mime: string
  variants: Record<string, ImageVariantResult>
  bufferMap: Map<string, Buffer>
}

export interface StoredImageRecord {
  id: number
  hash: string
  type: ImageType
  key: string
  publicUrl: string
  width: number
  height: number
  sizeBytes: number
  mime: string
  variants: Record<string, ImageVariantResult>
  refCount: number
  createdAt: Date
  updatedAt: Date
}

export interface IStorageProvider {
  uploadObject(key: string, body: Buffer, contentType: string, cacheControl?: string): Promise<void>
  deleteObject(key: string): Promise<void>
  deleteObjects(keys: string[]): Promise<void>
  objectExists(key: string): Promise<boolean>
  getPublicUrl(key: string): string
}

export interface UploadOptions {
  fileBuffer: Buffer
  originalName?: string
  mimeType?: string
  type: ImageType
  userId?: string
}

export interface ImageValidationResult {
  valid: boolean
  mimeType: string
  format: 'jpeg' | 'png' | 'webp'
  sizeBytes: number
  width?: number
  height?: number
  error?: string
}
