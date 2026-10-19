/**
 * Dashboard "Personal" qatori — IMG_0928.MOV bilan 1:1 shartnomasi (2026-10-19).
 *
 * Video kadri (384×832) o'lchovlari shu yerda qulflangan:
 *   qator 4 element: [avatar+ism] [fan] [analitika] [tema]
 *   barcha elementlar balandligi 42px, avatar doirasi 30px
 *   glass retsepti CSS'da (.dash-top-pill / .dash-top-circle) — Tailwind
 *   klasslari bilan bajarilmaydi, shuning uchun index.css ham tekshiriladi.
 *
 * Regressiya bo'lsa (masalan kimdir qatorni yana "chip + kapsula"ga qaytarsa)
 * shu test yiqiladi.
 */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '../../../src/features/dashboard/components/TopBar'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useAppStore } from '../../../src/shared/store/useAppStore'

const SRC = path.resolve(__dirname, '../../../src')

function renderBar(over: Partial<React.ComponentProps<typeof TopBar>> = {}) {
  const props = {
    user: null,
    displayName: 'Ali',
    onSubjects: vi.fn(),
    onProfile: vi.fn(),
    ...over,
  }
  const utils = render(
    <MemoryRouter>
      <TopBar {...props} />
    </MemoryRouter>,
  )
  return { ...utils, props }
}

describe('Dashboard "Personal" qatori (video 1:1)', () => {
  it('aniq 4 element: shaxs pill, fan pill, analitika doirasi, tema doirasi', () => {
    useSubjectStore.getState().setSubject('yhq')
    const { container } = renderBar()
    const pills = container.querySelectorAll('.dash-top-pill')
    const circles = container.querySelectorAll('.dash-top-circle')
    expect(pills).toHaveLength(2)
    expect(circles).toHaveLength(2)
  })

  it('avatar doirasi video o\'lchamida (30px) va ism pill ichida turadi', () => {
    const { container } = renderBar()
    const avatar = container.querySelector('.dash-top-avatar')
    expect(avatar).toBeTruthy()
    expect(avatar!.closest('.dash-top-pill')).toBeTruthy()
    expect(avatar!.querySelector('svg')).toBeTruthy()   // to'ldirilgan odam glifi
    expect(screen.getByText('Ali')).toBeTruthy()
  })

  it('shaxs pill → profil, fan pill → fan tanlash', () => {
    useSubjectStore.getState().setSubject('yhq')
    const { props } = renderBar()
    fireEvent.click(screen.getByRole('button', { name: /Profil: Ali/ }))
    fireEvent.click(screen.getByRole('button', { name: /Fan tanlash/ }))
    expect(props.onProfile).toHaveBeenCalledTimes(1)
    expect(props.onSubjects).toHaveBeenCalledTimes(1)
  })

  it('analitika doirasi Statistikaga, tema doirasi mavjud (aria-label almashadi)', () => {
    useAppStore.setState((s) => ({ settings: { ...s.settings, theme: 'dark' } }))
    renderBar()
    expect(screen.getByRole('button', { name: 'Statistika' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Light mode' })).toBeTruthy()
    useAppStore.setState((s) => ({ settings: { ...s.settings, theme: 'light' } }))
    renderBar()
    expect(screen.getAllByRole('button', { name: 'Dark mode' }).length).toBeGreaterThan(0)
  })

  it('tanga/do\'kon qatordan olib tashlangan (coin Profil orqali ochiladi)', () => {
    const { container } = renderBar()
    expect(container.querySelectorAll('.dash-top-circle')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Do'kon/ })).toBeNull()
  })

  it('glass retsepti CSS\'da: 42px balandlik, to\'liq yumaloq, tokenli border', () => {
    const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8')
    expect(css).toContain('.dash-top-pill')
    expect(css).toContain('.dash-top-circle')
    expect(css).toMatch(/\.dash-top-pill,[\s\S]{0,240}height:\s*42px/)
    expect(css).toMatch(/\.dash-top-avatar[\s\S]{0,200}width:\s*30px/)
    expect(css).toContain('var(--p-line-strong)')
    // Rang tokenlardan — aksent mavzularida ham ishlashi shart
    expect(css).toMatch(/\.dash-top-pill,[\s\S]{0,400}color-mix\(in srgb, var\(--p-fg\)/)
  })
})
