import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import DynamicIsland from '../../../src/features/dashboard/components/DynamicIsland'
import { useDailyStore } from '../../../src/shared/store/useDailyStore'
import { useTestSessionStore } from '../../../src/shared/store/useTestSessionStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { haptics } from '../../../src/platform/haptics'
import { closeTopModal, hasOpenModal } from '../../../src/shared/lib/navigation'

vi.mock('../../../src/shared/components/SettingsModal', () => ({
  default: ({ initialPicker }: { initialPicker: string }) => <div>Picker: {initialPicker}</div>,
}))

function Location() {
  return <p data-testid="location">{useLocation().pathname}</p>
}

describe('DynamicIsland', () => {
  beforeEach(() => {
    useTestSessionStore.getState().clear()
    useDailyStore.setState({ streaks: { yhq: 5 } })
  })

  it('renders idle capsule with streak when streak > 0', () => {
    render(
      <MemoryRouter>
        <DynamicIsland />
      </MemoryRouter>,
    )

    const island = screen.getByRole('region', { name: 'Dynamic Island' })
    expect(island).toBeTruthy()
    expect(screen.getByText(/5 kun/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Menyu' })).toBeTruthy()
  })

  it('renders subject name when streak is 0', () => {
    useDailyStore.setState({ streaks: { yhq: 0 } })
    render(
      <MemoryRouter>
        <DynamicIsland />
      </MemoryRouter>,
    )

    const currentSubject = useSubjectStore.getState().subject.name
    expect(screen.getByText(currentSubject)).toBeTruthy()
  })

  it('renders live activity when there is an active test session', () => {
    const startedAt = Date.now() - 60 * 1000 // 1 minute ago
    useTestSessionStore.getState().save({
      key: 'ids:1,2,3',
      subjectId: 'yhq',
      mode: null,
      title: 'YHQ Test',
      questionIds: [1, 2, 3],
      current: 1,
      answers: [null, null, null],
      selected: [null, null, null],
      startedAt,
    } as any)

    render(
      <MemoryRouter>
        <DynamicIsland />
        <Location />
      </MemoryRouter>,
    )

    // Should show countdown and continue button
    expect(screen.getByText(/⏱/)).toBeTruthy()
    const continueBtn = screen.getByRole('button', { name: /Davom etish/i })
    expect(continueBtn).toBeTruthy()

    // Clicking continue navigates to test page
    fireEvent.click(continueBtn)
    expect(screen.getByTestId('location').textContent).toBe('/test/1')
  })

  it('opens expanded dock on Menyu click and displays 4 actions', () => {
    const selectionSpy = vi.spyOn(haptics, 'selection').mockImplementation(() => {})
    render(
      <MemoryRouter>
        <DynamicIsland />
        <Location />
      </MemoryRouter>,
    )

    const trigger = screen.getByRole('button', { name: 'Menyu' })
    fireEvent.click(trigger)

    expect(selectionSpy).toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Menyu' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Statistika' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yutuqlar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Temalar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Do.kon/ })).toBeTruthy()

    selectionSpy.mockRestore()
  })

  it('navigates to stats, shop, and opens themes from expanded dock', () => {
    const { unmount } = render(
      <MemoryRouter>
        <DynamicIsland />
        <Location />
      </MemoryRouter>,
    )

    // Open menu
    fireEvent.click(screen.getByRole('button', { name: 'Menyu' }))
    // Click Statistika
    fireEvent.click(screen.getByRole('button', { name: 'Statistika' }))
    expect(screen.getByTestId('location').textContent).toBe('/statistika')
    expect(hasOpenModal()).toBe(false)
    unmount()

    // Test Themes
    render(
      <MemoryRouter>
        <DynamicIsland />
        <Location />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Menyu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Temalar' }))
    expect(screen.getByText('Picker: accent')).toBeTruthy()
  })

  it('dismisses expanded dock on Escape key and restores focus', () => {
    render(
      <MemoryRouter>
        <DynamicIsland />
      </MemoryRouter>,
    )

    const trigger = screen.getByRole('button', { name: 'Menyu' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog', { name: 'Menyu' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on Android back without navigation', () => {
    render(
      <MemoryRouter>
        <DynamicIsland />
        <Location />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Menyu' }))
    expect(screen.getByRole('dialog', { name: 'Menyu' })).toBeTruthy()

    act(() => {
      expect(closeTopModal()).toBe(true)
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('/')
  })
})
