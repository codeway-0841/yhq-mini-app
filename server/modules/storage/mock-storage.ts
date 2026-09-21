/**
 * Mock / In-Memory Storage Provider for Tests and Local Fallback
 */

import type { IStorageProvider } from './storage.types'

export interface MockStoredFile {
  body: Buffer
  contentType: string
  cacheControl?: string
  uploadedAt: Date
}

export class MockStorageProvider implements IStorageProvider {
  private readonly files = new Map<string, MockStoredFile>()
  public readonly publicUrlBase: string

  constructor(publicUrlBase = 'https://mock-cdn.kivvi.uz') {
    this.publicUrlBase = publicUrlBase.replace(/\/+$/, '')
  }

  public getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, '')
    return `${this.publicUrlBase}/${cleanKey}`
  }

  public async uploadObject(
    key: string,
    body: Buffer,
    contentType = 'image/webp',
    cacheControl = 'public, max-age=31536000, immutable',
  ): Promise<void> {
    const cleanKey = key.replace(/^\/+/, '')
    this.files.set(cleanKey, {
      body: Buffer.from(body),
      contentType,
      cacheControl,
      uploadedAt: new Date(),
    })
  }

  public async objectExists(key: string): Promise<boolean> {
    const cleanKey = key.replace(/^\/+/, '')
    return this.files.has(cleanKey)
  }

  public async deleteObject(key: string): Promise<void> {
    const cleanKey = key.replace(/^\/+/, '')
    this.files.delete(cleanKey)
  }

  public async deleteObjects(keys: string[]): Promise<void> {
    for (const k of keys) {
      const cleanKey = k.replace(/^\/+/, '')
      this.files.delete(cleanKey)
    }
  }

  public getStoredObject(key: string): MockStoredFile | undefined {
    const cleanKey = key.replace(/^\/+/, '')
    return this.files.get(cleanKey)
  }

  public getStoredCount(): number {
    return this.files.size
  }

  public getAllKeys(): string[] {
    return Array.from(this.files.keys())
  }

  public clear(): void {
    this.files.clear()
  }
}
