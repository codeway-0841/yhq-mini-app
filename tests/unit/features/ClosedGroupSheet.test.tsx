/**
 * ClosedGroupSheet — Profil'dagi "Yopiq guruh" upsell bottom sheet'i.
 * Tarif kartalari SSOT'dan (shared/premium-plans.ts): year + lifetime.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

import { ClosedGroupSheet } from '../../../src/features/profile/components/ClosedGroupSheet'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { getPlan } from '../../../shared/premium-plans'

beforeEach(() => {
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
})

describe('ClosedGroupSheet', () => {
  it('sarlavha, 3 imkoniyat qatori va hint ko\'rsatiladi', () => {
    render(<ClosedGroupSheet onClose={() => {}} onGetPlan={() => {}} />)

    expect(screen.getByText('Yopiq guruh')).toBeInTheDocument()
    expect(screen.getByText('Savol-javoblar')).toBeInTheDocument()
    expect(screen.getByText("O'quvchilar hamjamiyati")).toBeInTheDocument()
    expect(screen.getByText("Yangiliklar va foydali ma'lumotlar")).toBeInTheDocument()
    expect(screen.getByText('Guruh quyidagi tariflarda ochiladi')).toBeInTheDocument()
  })

  it('tarif kartalari SSOT tierName bilan (oylik model: ikkalasi ham "Oylik")', () => {
    render(<ClosedGroupSheet onClose={() => {}} onGetPlan={() => {}} />)

    const year = getPlan('year')!
    const lifetime = getPlan('lifetime')!
    expect(screen.getByText(year.tierNameUz)).toBeInTheDocument()
    expect(screen.getByText(lifetime.tierNameUz)).toBeInTheDocument()
    // Oylik model: ikkala kartaning davomiylik yozuvi "Oylik"
    expect(year.titleUz).toBe('Oylik')
    expect(lifetime.titleUz).toBe('Oylik')
    expect(screen.getAllByText('Oylik')).toHaveLength(2)
  })

  it('tarif kartasi bosilsa — o\'sha planKey qaytariladi', () => {
    const onGetPlan = vi.fn()
    render(<ClosedGroupSheet onClose={() => {}} onGetPlan={onGetPlan} />)

    fireEvent.click(screen.getByText(getPlan('year')!.tierNameUz))
    expect(onGetPlan).toHaveBeenCalledWith('year')

    fireEvent.click(screen.getByText(getPlan('lifetime')!.tierNameUz))
    expect(onGetPlan).toHaveBeenCalledWith('lifetime')
  })

  it('CTA bosilsa — planKey\'siz chaqiriladi (default highlight tarif)', () => {
    const onGetPlan = vi.fn()
    render(<ClosedGroupSheet onClose={() => {}} onGetPlan={onGetPlan} />)

    fireEvent.click(screen.getByText('Tarif olish'))
    expect(onGetPlan).toHaveBeenCalledWith()
  })

  it('ru tilda matnlar ruschada', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'ru' } })
    render(<ClosedGroupSheet onClose={() => {}} onGetPlan={() => {}} />)

    expect(screen.getByText('Закрытая группа')).toBeInTheDocument()
    expect(screen.getByText('Сообщество учеников')).toBeInTheDocument()
    expect(screen.getByText('Купить тариф')).toBeInTheDocument()
    expect(screen.getByText(getPlan('year')!.tierNameRu)).toBeInTheDocument()
  })
})
