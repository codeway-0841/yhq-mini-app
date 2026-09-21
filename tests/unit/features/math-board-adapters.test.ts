/**
 * Math Board — recognition adapterlar (Faza 4).
 *
 * manual: echo + bo'sh xato; gemini: server proxy chaqiruvi (api mock),
 * snapshot'siz xato; registry: faqat mavjud providerlar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAdapter, availableProviders, recognizeBlocks } from '../../../src/features/math-board/recognition/adapters'
import { api } from '../../../src/shared/api'

describe('recognition adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("registry faqat manual + gemini (spike qarorisiz myscript/mlkit YO'Q)", () => {
    expect(availableProviders().sort()).toEqual(['gemini', 'manual'])
    expect(getAdapter('myscript')).toBeNull()
    expect(getAdapter('mlkit')).toBeNull()
    expect(getAdapter('unknown')).toBeNull()
  })

  it('manual echo + bosh kiritish xato', async () => {
    const adapter = getAdapter('manual')
    expect(adapter?.provider).toBe('manual')
    await expect(adapter?.recognize({ manualLatex: '  ' })).rejects.toThrow('empty_manual_input')
    const r = await adapter?.recognize({ manualLatex: '\\frac{1}{2}' })
    expect(r).toMatchObject({ latex: '\\frac{1}{2}', alternatives: [], provider: 'manual' })
  })

  it('gemini snapshot siz xato', async () => {
    const adapter = getAdapter('gemini')
    await expect(adapter?.recognize({})).rejects.toThrow('missing_snapshot')
  })

  it('gemini server proxy natijasini qaytaradi (mime sniff)', async () => {
    const spy = vi.spyOn(api, 'recognizeHandwriting').mockResolvedValue({
      ok: true,
      latex: 'x=5',
      alternatives: ['x = 5'],
      confidence: 0.85,
    })
    const adapter = getAdapter('gemini')
    const r = await adapter?.recognize({ imageDataUrl: 'data:image/png;base64,AAA' })
    expect(r).toMatchObject({ latex: 'x=5', provider: 'gemini', confidence: 0.85 })
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'image/png', image: 'data:image/png;base64,AAA' }),
    )
  })

  it('gemini jpeg mime sniff', async () => {
    const spy = vi.spyOn(api, 'recognizeHandwriting').mockResolvedValue({
      ok: true, latex: 'x', alternatives: [], confidence: 0.5,
    })
    await getAdapter('gemini')?.recognize({ imageDataUrl: 'data:image/jpeg;base64,AAA' })
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'image/jpeg' }))
  })

  it('recognizeBlocks: bo‘sh → [] (chaqiriqsiz)', async () => {
    const spy = vi.spyOn(api, 'recognizeBlocks')
    expect(await recognizeBlocks([])).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('recognizeBlocks: natijani qaytaradi', async () => {
    vi.spyOn(api, 'recognizeBlocks').mockResolvedValue({
      ok: true,
      results: [{ blockId: 'b1', type: 'equation', latex: 'x=1', confidence: 0.9, alternatives: [] }],
    })
    const r = await recognizeBlocks([{ blockId: 'b1', imageDataUrl: 'data:image/png;base64,AAA' }])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ blockId: 'b1', latex: 'x=1' })
  })
})
