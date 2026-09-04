import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import DashboardMenu from '../../../src/features/dashboard/components/DashboardMenu'
import { closeTopModal, hasOpenModal, registerModal } from '../../../src/shared/lib/navigation'

vi.mock('../../../src/shared/components/SettingsModal', () => ({
  default: ({ initialPicker }: { initialPicker: string }) => <div>Picker: {initialPicker}</div>,
}))

function Location() { return <p data-testid="location">{useLocation().pathname}</p> }
function setup() {
  render(<MemoryRouter><DashboardMenu /><Location /></MemoryRouter>)
  const trigger = screen.getByRole('button', { name: 'Menyu' })
  trigger.focus()
  fireEvent.click(trigger)
  return trigger
}

describe('DashboardMenu', () => {
  it('hides the floating trigger while another sheet is open and restores it on close', () => {
    render(<MemoryRouter><DashboardMenu /></MemoryRouter>)
    const trigger = screen.getByRole('button', { name: 'Menyu' })
    let unregister: () => void
    act(() => { unregister = registerModal(Symbol('subject-picker'), vi.fn()) })
    expect(trigger.parentElement?.style.visibility).toBe('hidden')
    expect(screen.queryByRole('button', { name: 'Menyu' })).toBeNull()
    act(() => { unregister() })
    expect(screen.getByRole('button', { name: 'Menyu' })).toBe(trigger)
  })
  it('opens four actions and restores focus on Escape', () => {
    const trigger = setup()
    expect(screen.getByRole('dialog', { name: 'Menyu' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Temalar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Statistika' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yutuqlar' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(hasOpenModal()).toBe(false)
  })

  it('Android back closes the menu without navigating', () => {
    setup()
    act(() => { expect(closeTopModal()).toBe(true) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('/')
  })

  it('opens the accent picker directly', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Temalar' }))
    expect(screen.getByText('Picker: accent')).toBeTruthy()
    expect(hasOpenModal()).toBe(false)
  })

  it('navigates to the shop and releases the scroll lock', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Do.kon/ }))
    expect(screen.getByTestId('location').textContent).toBe('/shop')
    expect(hasOpenModal()).toBe(false)
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('opens the existing statistics page', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Statistika' }))
    expect(screen.getByTestId('location').textContent).toBe('/statistika')
    expect(hasOpenModal()).toBe(false)
  })
})
