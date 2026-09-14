/**
 * PageHeader SSOT shartnomasi (2026-09-15 "hamma joyda bir xil header" fix).
 *
 *  - md (ichki sahifa): back tugma + sarlavha
 *  - lg (tab-root): back YO'Q, katta sarlavha
 *  - qalin doimiy chiziq YO'Q — divider scroll-CSS (.page-header) orqali
 *  - safe-area: sticky top safe-top naqshi buzilmasligi shart
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PageHeader } from '../../../src/shared/components/ui/page-header'

describe('PageHeader', () => {
  it('md — back tugma sarlavha bilan chiqadi, bosilganda onBack chaqiriladi', () => {
    const onBack = vi.fn()
    render(<PageHeader title="Biletlar" onBack={onBack} backLabel="Orqaga" />)
    expect(screen.getByRole('heading', { name: 'Biletlar' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Orqaga' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('lg (tab-root) — back tugma YO\'Q, katta sarlavha', () => {
    render(<PageHeader title="Testlar" size="lg" />)
    expect(screen.getByRole('heading', { name: 'Testlar' })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    const h = screen.getByRole('heading').className
    expect(h).toContain('text-[22px]')
  })

  it('qalin doimiy divider YO\'Q — faqat .page-header scroll-CSS', () => {
    const { container } = render(<PageHeader title="X" onBack={() => {}} />)
    const header = container.querySelector('header')!
    expect(header.className).toContain('page-header')
    expect(header.className).not.toContain('border-pline')
    expect(header.className).not.toContain('bg-pcanvas ')
  })

  it('safe-top naqshi (sticky top-0 + safe-top bir qatorda)', () => {
    const { container } = render(<PageHeader title="X" onBack={() => {}} />)
    const cls = container.querySelector('header')!.className
    expect(cls).toContain('sticky')
    expect(cls).toContain('top-0')
    expect(cls).toContain('var(--safe-top-body')
    expect(cls).toContain('var(--safe-top,0px)')
  })

  it('subtitle + actions + children (tablar/progress) chiqadi', () => {
    render(
      <PageHeader
        title="Kutubxona"
        subtitle="120 ta kitob"
        onBack={() => {}}
        actions={<button type="button">Info</button>}
      >
        <div data-testid="tabs" />
      </PageHeader>,
    )
    expect(screen.getByText('120 ta kitob')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Info' })).toBeTruthy()
    expect(screen.getByTestId('tabs')).toBeTruthy()
  })
})
