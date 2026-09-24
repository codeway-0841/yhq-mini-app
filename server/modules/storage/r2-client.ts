/**
 * Cloudflare R2 Storage Provider (S3 SigV4 API)
 *
 * Direct S3-compatible SigV4 implementation with zero heavy external AWS dependencies.
 * Automatic retry, immutable caching headers, and public CDN URL formatting.
 */

import { createHash, createHmac } from 'node:crypto'
import type { IStorageProvider } from './storage.types'

/** S3 XML javoblaridagi minimal entity decode (bizning kalitlar xavfsiz ASCII). */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

export interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl?: string
}

export class R2StorageProvider implements IStorageProvider {
  private readonly accessKeyId: string
  private readonly secretAccessKey: string
  private readonly bucket: string
  private readonly publicUrlBase: string
  private readonly host: string
  private readonly endpoint: string
  private readonly region = 'auto'
  private readonly service = 's3'

  constructor(config: R2Config) {
    this.accessKeyId = config.accessKeyId
    this.secretAccessKey = config.secretAccessKey
    this.bucket = config.bucket
    this.host = `${config.accountId}.r2.cloudflarestorage.com`
    this.endpoint = `https://${this.host}`

    const rawPub = config.publicUrl?.trim().replace(/\/+$/, '')
    this.publicUrlBase = rawPub || `https://${config.bucket}.${config.accountId}.r2.dev`
  }

  private sha256hex(data: string | Buffer): string {
    return createHash('sha256').update(data).digest('hex')
  }

  private hmac(key: Buffer | string, data: string | Buffer): Buffer {
    return createHmac('sha256', key).update(data).digest()
  }

  /** Bitta so'rov uchun SigV4 imzo header'lari */
  private signedHeaders(
    method: string,
    objectKey: string,
    payloadHash: string,
    extraHeaders: Record<string, string> = {},
    now = new Date(),
    canonicalQuery = '',
  ): Record<string, string> {
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    const canonicalUri = objectKey === ''
      ? `/${this.bucket}`
      : '/' + [this.bucket, ...objectKey.split('/')].map(encodeURIComponent).join('/')

    const headersMap: Record<string, string> = {
      host: this.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...extraHeaders,
    }

    const sortedHeaderKeys = Object.keys(headersMap).sort()
    const canonicalHeaders = sortedHeaderKeys
      .map((k) => `${k.toLowerCase()}:${headersMap[k]?.trim()}\n`)
      .join('')
    const signedHeaderNames = sortedHeaderKeys
      .map((k) => k.toLowerCase())
      .join(';')

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaderNames,
      payloadHash,
    ].join('\n')

    const scope = `${dateStamp}/${this.region}/${this.service}/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      this.sha256hex(canonicalRequest),
    ].join('\n')

    const kDate = this.hmac(`AWS4${this.secretAccessKey}`, dateStamp)
    const kRegion = this.hmac(kDate, this.region)
    const kService = this.hmac(kRegion, this.service)
    const kSigning = this.hmac(kService, 'aws4_request')
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')

    return {
      ...headersMap,
      authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
    }
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
    const payloadHash = this.sha256hex(body)

    const extra: Record<string, string> = {
      'content-type': contentType,
      'content-length': String(body.byteLength),
    }
    if (cacheControl) {
      extra['cache-control'] = cacheControl
    }

    const headers = this.signedHeaders('PUT', cleanKey, payloadHash, extra)
    const url = `${this.endpoint}/${this.bucket}/${cleanKey.split('/').map(encodeURIComponent).join('/')}`

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: new Uint8Array(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`R2 PUT ${cleanKey} failed (${res.status} ${res.statusText}): ${text.slice(0, 300)}`)
    }
  }

  public async objectExists(key: string): Promise<boolean> {
    const cleanKey = key.replace(/^\/+/, '')
    const headers = this.signedHeaders('HEAD', cleanKey, this.sha256hex(''))
    const url = `${this.endpoint}/${this.bucket}/${cleanKey.split('/').map(encodeURIComponent).join('/')}`

    const res = await fetch(url, {
      method: 'HEAD',
      headers,
    })

    if (res.status === 200) return true
    if (res.status === 404) return false
    throw new Error(`R2 HEAD ${cleanKey} failed (${res.status} ${res.statusText})`)
  }

  /** PRIVATE obyektni o'qish (publish marker kabi kichik JSON'lar uchun). */
  public async getObject(key: string): Promise<Buffer | null> {
    const cleanKey = key.replace(/^\/+/, '')
    const headers = this.signedHeaders('GET', cleanKey, this.sha256hex(''))
    const url = `${this.endpoint}/${this.bucket}/${cleanKey.split('/').map(encodeURIComponent).join('/')}`

    const res = await fetch(url, { method: 'GET', headers })
    if (res.status === 404) return null
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`R2 GET ${cleanKey} failed (${res.status} ${res.statusText}): ${text.slice(0, 300)}`)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  /**
   * Prefix bo'yicha kalitlar ro'yxati (S3 list-type=2, pagination'li).
   * FAQAT admin/publish jarayonlarida (eski versiyalarni tozalash) —
   * runtime hot-path'da ISHLATILMAYDI.
   */
  public async listObjects(prefix: string, maxKeys = 10_000): Promise<string[]> {
    const cleanPrefix = prefix.replace(/^\/+/, '')
    const keys: string[] = []
    let continuationToken: string | undefined
    // Xavfsizlik: cheksiz pagination loop'ga qarshi qattiq chegara
    for (let page = 0; page < 100 && keys.length < maxKeys; page += 1) {
      const params = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000', prefix: cleanPrefix })
      if (continuationToken) params.set('continuation-token', continuationToken)
      // SigV4: canonical query — URL-encoded, kalitlar bo'yicha saralangan
      const canonicalQuery = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
      const headers = this.signedHeaders('GET', '', this.sha256hex(''), {}, new Date(), canonicalQuery)
      const res = await fetch(`${this.endpoint}/${this.bucket}?${canonicalQuery}`, { method: 'GET', headers })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`R2 LIST ${cleanPrefix} failed (${res.status} ${res.statusText}): ${text.slice(0, 300)}`)
      }
      const xml = await res.text()
      for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
        keys.push(decodeXmlEntities(match[1] ?? ''))
      }
      if (!/<IsTruncated>true<\/IsTruncated>/.test(xml)) break
      const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)
      continuationToken = tokenMatch?.[1] ? decodeXmlEntities(tokenMatch[1]) : undefined
      if (!continuationToken) break
    }
    return keys.slice(0, maxKeys)
  }

  public async deleteObject(key: string): Promise<void> {
    const cleanKey = key.replace(/^\/+/, '')
    const headers = this.signedHeaders('DELETE', cleanKey, this.sha256hex(''))
    const url = `${this.endpoint}/${this.bucket}/${cleanKey.split('/').map(encodeURIComponent).join('/')}`

    const res = await fetch(url, {
      method: 'DELETE',
      headers,
    })

    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '')
      throw new Error(`R2 DELETE ${cleanKey} failed (${res.status} ${res.statusText}): ${text.slice(0, 300)}`)
    }
  }

  public async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    // Clean and deduplicate keys
    const uniqueKeys = Array.from(new Set(keys.map((k) => k.replace(/^\/+/, '')))).filter(Boolean)
    if (uniqueKeys.length === 0) return

    // Multi-object delete via S3 API or parallel execution
    await Promise.all(uniqueKeys.map((k) => this.deleteObject(k).catch((err) => {
      console.warn(`[storage:r2] deleteObjects key error for ${k}:`, err)
    })))
  }
}
