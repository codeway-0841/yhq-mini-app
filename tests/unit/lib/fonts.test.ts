import { describe, expect, it } from 'vitest'
import { ensureFontLoaded } from '../../../src/shared/lib/fonts'

describe('optional fonts', () => {
  it('keeps the default font local and loads the Grotesk choice on demand', () => {
    const initialCount = document.head.querySelectorAll('link[rel="stylesheet"]').length
    ensureFontLoaded('default')
    expect(document.head.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(initialCount)

    ensureFontLoaded('grotesk')
    const links = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
    expect(links).toHaveLength(initialCount + 1)
    expect(links.at(-1)?.href).toContain('Bricolage+Grotesque')

    ensureFontLoaded('grotesk')
    expect(document.head.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(initialCount + 1)
  })
})
