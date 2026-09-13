import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface VercelHeader {
  source: string
  headers: Array<{ key: string; value: string }>
}

function readPermissionsPolicy(): string {
  const vercel = JSON.parse(readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf8')) as {
    headers: VercelHeader[]
  }
  const global = vercel.headers.find((entry) => entry.source === '/(.*)')
  const policy = global?.headers.find((header) => header.key === 'Permissions-Policy')?.value

  if (!policy) throw new Error('vercel.json da global Permissions-Policy topilmadi')
  return policy
}

describe('config/permissions-policy', () => {
  it('same-origin kamera oqimiga ruxsat beradi', () => {
    const directives = new Map(
      readPermissionsPolicy()
        .split(',')
        .map((directive) => directive.trim().split('='))
        .map(([name, value]) => [name, value] as const)
    )

    expect(directives.get('camera')).toBe('(self)')
    expect(directives.get('microphone')).toBe('()')
    expect(directives.get('geolocation')).toBe('()')
  })
})
