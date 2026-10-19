import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import StatInfoSheet from '../../../src/shared/components/StatInfoSheet'

describe('StatInfoSheet typography', () => {
  it('bullet matnlarni semantik va o\'qiladigan ro\'yxatga aylantiradi', () => {
    const onClose = vi.fn()
    render(
      <StatInfoSheet
        title="XP qanday to'planadi?"
        body={'• Birinchi to\'g\'ri javob — +10 XP\n• Xatoni tuzatish — +15 XP\nXP darajani oshiradi.'}
        onClose={onClose}
      />,
    )

    const title = screen.getByRole('heading', { name: "XP qanday to'planadi?" })
    expect(title).not.toHaveAttribute('data-drag-handle')
    // 2026-10: barcha modal sarlavhalari yagona shkala — 17px (ModalShell/SheetTitle)
    expect(title.className).toContain('text-[17px]')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('XP darajani oshiradi.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /tushunarli/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
