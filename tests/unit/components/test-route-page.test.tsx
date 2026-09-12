import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const { routeConfig, serverPracticeSpy } = vi.hoisted(() => ({
  routeConfig: { testSessionsV2Enabled: false },
  serverPracticeSpy: vi.fn(),
}))

vi.mock('../../../src/shared/config', () => ({ config: routeConfig }))
vi.mock('../../../src/features/test/TestPage', () => ({
  default: () => <div>legacy-test-page</div>,
}))
vi.mock('../../../src/features/test/ServerPracticePage', () => ({
  default: (props: unknown) => {
    serverPracticeSpy(props)
    return <div>server-practice-page</div>
  },
}))

import TestRoutePage from '../../../src/features/test/TestRoutePage'

function renderRoute(state: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/test/1', state }]}>
      <Routes><Route path="/test/:id" element={<TestRoutePage />} /></Routes>
    </MemoryRouter>,
  )
}

describe('TestRoutePage', () => {
  beforeEach(() => {
    serverPracticeSpy.mockClear()
    routeConfig.testSessionsV2Enabled = false
  })

  it('keeps the legacy engine when test sessions v2 is disabled', () => {
    renderRoute({ mode: 'random50', title: '50 talik test' })

    expect(screen.getByText('legacy-test-page')).toBeInTheDocument()
    expect(serverPracticeSpy).not.toHaveBeenCalled()
  })

  it('routes v2-capable modes to the server-authoritative engine', () => {
    routeConfig.testSessionsV2Enabled = true
    renderRoute({ mode: 'random50', title: '50 talik test' })

    expect(screen.getByText('server-practice-page')).toBeInTheDocument()
    expect(serverPracticeSpy).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'random50',
      title: '50 talik test',
    }))
  })

  it('routes marathon to the server-authoritative engine without public full-bank loading', () => {
    routeConfig.testSessionsV2Enabled = true
    renderRoute({ mode: 'marathon', title: 'Marafon' })

    expect(screen.getByText('server-practice-page')).toBeInTheDocument()
    expect(serverPracticeSpy).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'marathon',
      selector: { type: 'marathon' },
      title: 'Marafon',
    }))
  })

  it('passes topic selectors without exposing question IDs to the server engine', () => {
    routeConfig.testSessionsV2Enabled = true
    renderRoute({ mode: 'topic', serverSelector: { type: 'topic', topicId: 77 }, title: 'Mavzu' })

    expect(serverPracticeSpy).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'topic',
      selector: { type: 'topic', topicId: 77 },
      title: 'Mavzu',
    }))
  })

  it('passes ticket selectors without exposing question IDs to the server engine', () => {
    routeConfig.testSessionsV2Enabled = true
    renderRoute({ mode: 'ticket', serverSelector: { type: 'ticket', ticketNumber: 2 }, title: '2 - bilet' })

    expect(serverPracticeSpy).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'ticket',
      selector: { type: 'ticket', ticketNumber: 2 },
      title: '2 - bilet',
    }))
  })

  it('passes lesson and module selectors without exposing question IDs to the server engine', () => {
    routeConfig.testSessionsV2Enabled = true
    renderRoute({
      mode: 'lesson',
      serverSelector: { type: 'lesson', moduleId: 1, lessonIndex: 0 },
      title: 'Dars mashqi',
    })

    expect(serverPracticeSpy).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'lesson',
      selector: { type: 'lesson', moduleId: 1, lessonIndex: 0 },
      title: 'Dars mashqi',
    }))

    serverPracticeSpy.mockClear()
    renderRoute({
      mode: 'module',
      serverSelector: { type: 'module', moduleId: 1 },
      title: 'Modul sinovi',
    })

    expect(serverPracticeSpy).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'module',
      selector: { type: 'module', moduleId: 1 },
      title: 'Modul sinovi',
    }))
  })
})
