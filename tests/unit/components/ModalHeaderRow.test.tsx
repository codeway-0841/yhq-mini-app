import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModalHeaderRow } from '@/shared/components/ModalHeaderRow'

/**
 * ModalHeaderRow — namuna standarti (grabber tepada alohida, pastda bir qator):
 * [dumaloq X chapda | sarlavha o'rtada | spacer o'ngda].
 */
describe('ModalHeaderRow', () => {
  it('X + sarlavha bir qatorda: X chapda in-flow, sarlavha o‘rtada', () => {
    const onClose = vi.fn()
    const { container } = render(
      <ModalHeaderRow onClose={onClose} label="Yopish">
        <h2>Test sarlavha</h2>
      </ModalHeaderRow>,
    )

    const row = container.firstElementChild as HTMLElement
    expect(row.className).toMatch(/flex/)
    expect(row.className).toMatch(/items-center/)

    // X tugmasi — birinchilardan, ABSOLUTE emas (qatorda in-flow)
    const closeBtn = screen.getByRole('button', { name: 'Yopish' })
    expect(closeBtn.className).not.toMatch(/absolute/)
    expect(closeBtn.className).toMatch(/rounded-full/)
    expect(row.firstElementChild).toBe(closeBtn)

    // Sarlavha o'rtada
    const titleWrap = closeBtn.nextElementSibling as HTMLElement
    expect(titleWrap.className).toMatch(/flex-1/)
    expect(titleWrap.className).toMatch(/text-center/)
    expect(titleWrap.textContent).toBe('Test sarlavha')

    // O'ngda simmetriya spacer'i (sarlavha rostdan markazda)
    const spacer = titleWrap.nextElementSibling as HTMLElement
    expect(spacer.getAttribute('aria-hidden')).toBe('true')
    expect(spacer.className).toMatch(/size-10/)

    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('right berilsa spacer o‘rniga action chiqadi', () => {
    const onClose = vi.fn()
    render(
      <ModalHeaderRow onClose={onClose} right={<button type="button">TTS</button>}>
        <h2>Sarlavha</h2>
      </ModalHeaderRow>,
    )
    expect(screen.getByRole('button', { name: 'TTS' })).toBeDefined()
  })
})
