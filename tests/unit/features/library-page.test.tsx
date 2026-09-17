import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import LibraryPage from '../../../src/features/library/LibraryPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="location">{location.pathname}</output>
}

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

  it('kitob ochilganda sheet va ilova ichidagi reader CTA ishlaydi', async () => {
    render(
      <MemoryRouter>
        <LibraryPage />
        <LocationProbe />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Kitob yoki fan qidirish...'), {
      target: { value: 'alifbe' },
    })
    fireEvent.click(await screen.findByRole('button', { name: '1-sinf Alifbe' }))

    expect(await screen.findByRole('heading', { name: '1-sinf Alifbe' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Kitobni ochish (Asl PDF)' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ilovada o‘qish' }))

    expect(screen.getByLabelText('location')).toHaveTextContent('/kutubxona/kitob/1-sinf-alifbe')
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
