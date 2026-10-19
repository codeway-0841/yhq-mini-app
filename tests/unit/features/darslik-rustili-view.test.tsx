import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownView } from '../../../src/features/darslik-rustili/MarkdownView'

/**
 * MarkdownView — darslik matnini ilova dizayn tilidagi semantik elementlarga
 * aylantiradi. Bu testlar renderer ↔ parser shartnomasini ushlaydi.
 */
describe('MarkdownView', () => {
  it('sarlavha, qalin matn, ro‘yxat, iqtibos, jadval va ajratgichni render qiladi', () => {
    render(
      <MarkdownView
        source={[
          '# Сарлавха',
          '',
          '**qalin** matn',
          '',
          '- birinchi',
          '- ikkinchi',
          '',
          '> iqtibos satri',
          '',
          '| A | B |',
          '|---|---|',
          '| 1 | 2 |',
          '',
          '---',
        ].join('\n')}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Сарлавха' })).toBeInTheDocument()
    expect(screen.getByText('qalin').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText(/iqtibos satri/).closest('blockquote')).toBeTruthy()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument()
    expect(document.querySelector('hr')).toBeTruthy()
  })

  it('raqamli ro‘yxatni <ol> sifatida chiqaradi', () => {
    render(<MarkdownView source={'1. birinchi\n2. ikkinchi'} />)
    expect(document.querySelector('ol')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
