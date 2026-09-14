import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LibraryPage from '../../../src/features/library/LibraryPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'

vi.mock('../../../src/platform/open-link', () => ({
  openExternalLink: vi.fn(),
}))

describe('LibraryPage (Kutubxona)', () => {
  beforeEach(() => {
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, language: 'uz' },
    })
  })

  it('katalogni ko\'rsatadi va qidiruv bo\'yicha filtrlaydi', async () => {
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Kutubxona' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Kitob yoki fan qidirish...'), {
      target: { value: 'alifbe' },
    })

    expect(await screen.findByRole('button', { name: '1-sinf Alifbe' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '1-sinf Matematika' })).toBeNull()
  })

  it('kitob ochilganda sheet va PDF CTA ishlaydi', async () => {
    const { openExternalLink } = await import('../../../src/platform/open-link')

    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Kitob yoki fan qidirish...'), {
      target: { value: 'alifbe' },
    })
    fireEvent.click(await screen.findByRole('button', { name: '1-sinf Alifbe' }))

    expect(await screen.findByRole('heading', { name: '1-sinf Alifbe' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'PDF ochish' }))

    expect(openExternalLink).toHaveBeenCalledWith('/kutubxona/pdf/1-sinf/1-sinf-alifbe.pdf')
  })

  it('sinf filtri URL orqali qo\'llanadi', async () => {
    render(
      <MemoryRouter initialEntries={['/kutubxona?sinf=5']}>
        <LibraryPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: '5-sinf Matematika (1-qism)' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '1-sinf Alifbe' })).toBeNull()
  })
})
