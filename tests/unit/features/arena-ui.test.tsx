import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IdleScreen } from '../../../src/features/octagon/components/IdleScreen'
import { DuelBanners } from '../../../src/features/octagon/components/DuelBanners'
import { SearchingScreen } from '../../../src/features/octagon/components/SearchingScreen'
import { t } from '../../../src/shared/i18n'

vi.mock('../../../src/shared/api', () => ({ api: { getAchievements: vi.fn() }, avatarSrcFor: vi.fn() }))
vi.mock('../../../src/platform/haptics', () => ({ haptics: { impact: vi.fn(), notify: vi.fn() } }))
vi.mock('../../../src/shared/lib/sounds', () => ({ playSound: vi.fn() }))
vi.mock('../../../src/platform/telegram', () => ({ shareUrl: vi.fn() }))
vi.mock('../../../src/shared/lib/navigation', () => ({ registerModal: () => () => {} }))
vi.mock('../../../src/features/octagon/components/DuelLeaderboardView', () => ({ DuelLeaderboardView: () => null }))

afterEach(cleanup)
const tt = (key: Parameters<typeof t>[1]) => t('uz', key)
const props = { tt, user: null, language: 'uz' as const, connFailed: false, onFind: vi.fn(), onJoinWithPin: vi.fn(), onCreateRoom: vi.fn() }

describe('Arena entry flow', () => {
  it('shows a single connection message with a working retry action', () => {
    const onRetry = vi.fn()
    render(<><DuelBanners toastMsg="WebSocket connection error" conn="failed" phase="idle" oppWait={null} onRetry={onRetry} /><IdleScreen {...props} connFailed connection="failed" /></>)
    expect(screen.getAllByText('Aloqa uzildi')).toHaveLength(1)
    expect(screen.queryByText(/Internet aloqasini/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
  it('shows connecting instead of a misleading zero online count and disables matchmaking', () => {
    render(<IdleScreen {...props} connection="connecting" />)
    expect(screen.getByRole('status').textContent).toContain('Ulanmoqda')
    expect((screen.getByRole('button', { name: tt('findOpponent') }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('creates a room through the server callback without exposing a made-up PIN', () => {
    const onCreateRoom = vi.fn()
    render(<IdleScreen {...props} onCreateRoom={onCreateRoom} connection="open" />)
    fireEvent.click(screen.getByRole('button', { name: /Do‘st bilan/ }))
    expect(screen.queryByText(/\d{3} \d{3}/)).toBeNull()
    const buttons = screen.getAllByRole('button', { name: tt('tabCreateRoom') })
    fireEvent.click(buttons[buttons.length - 1])
    expect(onCreateRoom).toHaveBeenCalledTimes(1)
  })
  it('keeps room creation disabled while disconnected', () => {
    render(<IdleScreen {...props} connFailed connection="failed" />)
    fireEvent.click(screen.getByRole('button', { name: /Do‘st bilan/ }))
    const buttons = screen.getAllByRole('button', { name: tt('tabCreateRoom') })
    expect((buttons[buttons.length - 1] as HTMLButtonElement).disabled).toBe(true)
  })
  it('shows room creation pending until the server provides a PIN', () => {
    render(<SearchingScreen tt={tt} duelCode={null} duelLink={null} onCancel={vi.fn()} roomPending />)
    expect(screen.getByText('Xona yaratilmoqda…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: tt('copyPinBtn') })).toBeNull()
  })
})
