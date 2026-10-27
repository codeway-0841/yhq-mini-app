import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  listLiveRooms: vi.fn(),
  listLiveRecordings: vi.fn(),
}))

vi.mock('../../../src/shared/api', () => ({ api: apiMock }))

import LiveListPage from '../../../src/features/live/LivePages'
import { useAppStore } from '../../../src/shared/store/useAppStore'

const room = {
  id: 7,
  subjectId: 'fizika',
  teacherId: 'teacher-1',
  teacherName: 'Diana Mustafaeva',
  title: 'Mexanika: real loyiha',
  description: null,
  status: 'live' as const,
  scheduledAt: '2026-10-16T09:00:00.000Z',
  startedAt: '2026-10-16T09:00:00.000Z',
  endedAt: null,
  roomName: 'live_7',
  participantCount: 18,
  createdAt: '2026-10-16T08:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({
    user: null,
    settings: { ...useAppStore.getState().settings, language: 'uz' },
  })
})

describe('LiveListPage', () => {
  it('shows production room state and participant count', async () => {
    apiMock.listLiveRooms.mockResolvedValue({ rooms: [room], recordingEnabled: true })
    apiMock.listLiveRecordings.mockResolvedValue({ recordings: [] })

    render(<MemoryRouter><LiveListPage /></MemoryRouter>)

    expect(await screen.findByText('Mexanika: real loyiha')).toBeTruthy()
    expect(screen.getByText('JONLI EFIR')).toBeTruthy()
    expect(screen.getByText('Diana Mustafaeva')).toBeTruthy()
    expect(screen.getByText('18')).toBeTruthy()
    expect(apiMock.listLiveRooms).toHaveBeenCalledWith({ limit: 20 })
    expect(apiMock.listLiveRecordings).toHaveBeenCalledTimes(1)
  })

  it('offers a retry after a load failure', async () => {
    apiMock.listLiveRooms
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ rooms: [room], recordingEnabled: false })
    apiMock.listLiveRecordings.mockResolvedValue({ recordings: [] })

    render(<MemoryRouter><LiveListPage /></MemoryRouter>)

    const retry = await screen.findByRole('button', { name: 'Qayta urinish' })
    fireEvent.click(retry)

    await waitFor(() => expect(screen.getByText('Mexanika: real loyiha')).toBeTruthy())
    expect(apiMock.listLiveRooms).toHaveBeenCalledTimes(2)
  })
})
