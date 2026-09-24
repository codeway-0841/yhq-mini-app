/**
 * STRICT path allowlist — Worker faqat shu 3 shablonni taniydi:
 *
 *   /questions/<subject>/v<N>/manifest.json
 *   /questions/<subject>/v<N>/chunks/chunk-<NNN>.json
 *   /images/<subject>/<sha256-16>.<webp|png|jpg|jpeg>
 *
 * R2 obyekt kaliti HECH QACHON xom URL'dan olinmaydi — faqat parse
 * qilingan segmentlardan QURILADI. Traversal (`..`, `%2e`, `\`, `//`,
 * null-bayt) regex'ga kirmaydi va alohida ham rad etiladi.
 */

export type ParsedContentPath =
  | { kind: 'manifest'; subject: string; version: number; key: string }
  | { kind: 'chunk'; subject: string; version: number; chunk: string; key: string }
  | { kind: 'image'; subject: string; name: string; ext: string; key: string }

const SUBJECT = '([a-z][a-z0-9-]{0,31})'
const MANIFEST_RE = new RegExp(`^/questions/${SUBJECT}/v(\\d{1,6})/manifest\\.json$`)
const CHUNK_RE = new RegExp(`^/questions/${SUBJECT}/v(\\d{1,6})/chunks/chunk-(\\d{3})\\.json$`)
const IMAGE_RE = new RegExp(`^/images/${SUBJECT}/([a-f0-9]{16})\\.(webp|png|jpe?g)$`)

/**
 * pathname → typed parse yoki null (404). Xavfsizlik: birinchi tekshiruvda
 * har qanday encoded/shubhali belgi rad etiladi — shablonlarga faqat toza
 * ASCII yo'llar kiradi.
 */
export function parseContentPath(pathname: string): ParsedContentPath | null {
  if (!pathname || pathname.length > 256) return null
  if (
    pathname.includes('%') ||
    pathname.includes('..') ||
    pathname.includes('\\') ||
    pathname.includes('//') ||
    pathname.includes('\0') ||
    !pathname.startsWith('/')
  ) {
    return null
  }

  const manifest = MANIFEST_RE.exec(pathname)
  if (manifest) {
    const subject = manifest[1] as string
    const version = Number(manifest[2])
    if (!Number.isInteger(version) || version <= 0) return null
    return { kind: 'manifest', subject, version, key: `questions/${subject}/v${version}/manifest.json` }
  }

  const chunk = CHUNK_RE.exec(pathname)
  if (chunk) {
    const subject = chunk[1] as string
    const version = Number(chunk[2])
    const chunkName = chunk[3] as string
    if (!Number.isInteger(version) || version <= 0) return null
    return { kind: 'chunk', subject, version, chunk: chunkName, key: `questions/${subject}/v${version}/chunks/chunk-${chunkName}.json` }
  }

  const image = IMAGE_RE.exec(pathname)
  if (image) {
    const subject = image[1] as string
    const name = image[2] as string
    const ext = image[3] as string
    return { kind: 'image', subject, name, ext, key: `images/${subject}/${name}.${ext}` }
  }

  return null
}

/** Content-Type — faqat biz yuklagan turlar (rasmlar + JSON). */
export function contentTypeFor(path: ParsedContentPath): string {
  if (path.kind === 'image') {
    if (path.ext === 'png') return 'image/png'
    if (path.ext === 'jpg' || path.ext === 'jpeg') return 'image/jpeg'
    return 'image/webp'
  }
  return 'application/json; charset=utf-8'
}
