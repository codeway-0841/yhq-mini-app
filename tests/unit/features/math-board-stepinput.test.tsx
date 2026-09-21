/**
 * Math Board — StepInput remount DOM testi (P2-C).
 *
 * Talab: parent `key` o'zgarganda maydon YANGI initial'ni ko'rsatadi
 * (eski formula qaytmaydi); key bir xil bo'lsa prop o'zgarishi ichki
 * holatni ezmaydi (kursor xavfsizligi).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import StepInput from '../../../src/features/math-board/components/StepInput'

vi.mock('mathlive', () => ({}))

const noop = (): void => {}

function fieldText(container: HTMLElement): string {
  return container.querySelector('math-field')?.textContent ?? ''
}

describe('StepInput remount', () => {
  it('parent key o‘zgarsa — yangi initial ko‘rinadi (eski qaytmaydi)', () => {
    const { container, rerender } = render(
      <StepInput key="a" value="x=1" onLatex={noop} label="t" />,
    )
    expect(fieldText(container)).toContain('x=1')
    rerender(<StepInput key="b" value="x=2" onLatex={noop} label="t" />)
    expect(fieldText(container)).toContain('x=2')
    expect(fieldText(container)).not.toContain('x=1')
  })

  it('key bir xil bo‘lsa — prop o‘zgarishi ichki holatni ezmaydi', () => {
    const { container, rerender } = render(
      <StepInput key="a" value="x=1" onLatex={noop} label="t" />,
    )
    expect(fieldText(container)).toContain('x=1')
    rerender(<StepInput key="a" value=" Cleared " onLatex={noop} label="t" />)
    // Uncontrolled: mount'dagi qiymat yashaydi
    expect(fieldText(container)).toContain('x=1')
  })
})
