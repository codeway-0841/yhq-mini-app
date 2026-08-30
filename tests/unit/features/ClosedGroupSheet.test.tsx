/**
 * ClosedGroupSheet — Profil'dagi "Yopiq guruh" sheet'i (Free: upsell, Subscribed: fan guruhlari).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ClosedGroupSheet } from '../../../src/features/profile/components/ClosedGroupSheet'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { getPlan } from '../../../shared/premium-plans'
import { api } from '../../../src/shared/api'
import * as telegram from '../../../src/platform/telegram'

vi.spyOn(telegram, 'openTelegramLink').mockImplementation(() => {})
vi.spyOn(api, 'getClosedGroupInvite').mockRejectedValue(new Error('test fallback'))

beforeEach(() => {
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
  useSubjectStore.setState({ subjectId: 'yhq' })
  vi.clearAllMocks()
})

describe('ClosedGroupSheet — Free User (Upsell View)', () => {
  it('sarlavha, 3 imkoniyat qatori va hint ko\'rsatiladi', () => {
    render(<ClosedGroupSheet isSubscribed={false} onClose={() => {}} onGetPlan={() => {}} />)

    expect(screen.getByText('Yopiq guruh')).toBeInTheDocument()
    expect(screen.getByText('Savol-javoblar')).toBeInTheDocument()
    expect(screen.getByText("O'quvchilar hamjamiyati")).toBeInTheDocument()
    expect(screen.getByText("Yangiliklar va foydali ma'lumotlar")).toBeInTheDocument()
    expect(screen.getByText('Guruh quyidagi tariflarda ochiladi')).toBeInTheDocument()
  })

  it('tarif kartalari SSOT tierName bilan (oylik model: ikkalasi ham "Oylik")', () => {
    render(<ClosedGroupSheet isSubscribed={false} onClose={() => {}} onGetPlan={() => {}} />)

    const year = getPlan('year')!
    const lifetime = getPlan('lifetime')!
    expect(screen.getByText(year.tierNameUz)).toBeInTheDocument()
    expect(screen.getByText(lifetime.tierNameUz)).toBeInTheDocument()
    expect(year.titleUz).toBe('Oylik')
    expect(lifetime.titleUz).toBe('Oylik')
    expect(screen.getAllByText('Oylik')).toHaveLength(2)
  })

  it('tarif kartasi bosilsa — o\'sha planKey qaytariladi', () => {
    const onGetPlan = vi.fn()
    render(<ClosedGroupSheet isSubscribed={false} onClose={() => {}} onGetPlan={onGetPlan} />)

    fireEvent.click(screen.getByText(getPlan('year')!.tierNameUz))
    expect(onGetPlan).toHaveBeenCalledWith('year')

    fireEvent.click(screen.getByText(getPlan('lifetime')!.tierNameUz))
    expect(onGetPlan).toHaveBeenCalledWith('lifetime')
  })

  it('CTA bosilsa — planKey\'siz chaqiriladi (default highlight tarif)', () => {
    const onGetPlan = vi.fn()
    render(<ClosedGroupSheet isSubscribed={false} onClose={() => {}} onGetPlan={onGetPlan} />)

    fireEvent.click(screen.getByText('Tarif olish'))
    expect(onGetPlan).toHaveBeenCalledWith()
  })

  it('ru tilda matnlar ruschada', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'ru' } })
    render(<ClosedGroupSheet isSubscribed={false} onClose={() => {}} onGetPlan={() => {}} />)

    expect(screen.getByText('Закрытая группа')).toBeInTheDocument()
    expect(screen.getByText('Сообщество учеников')).toBeInTheDocument()
    expect(screen.getByText('Купить тариф')).toBeInTheDocument()
    expect(screen.getByText(getPlan('year')!.tierNameRu)).toBeInTheDocument()
  })
})

describe('ClosedGroupSheet — Subscribed User (Focused Current Subject View)', () => {
  it('faqat joriy tanlangan fan kartasi, imkoniyatlar va Guruhga kirish CTA chiqadi', () => {
    useSubjectStore.setState({ subjectId: 'yhq' })
    render(<ClosedGroupSheet isSubscribed={true} onClose={() => {}} onGetPlan={() => {}} />)

    expect(screen.getByText('Yopiq guruh')).toBeInTheDocument()
    expect(screen.getByText("«Yo'l harakati qoidalari» fani bo'yicha yopiq VIP guruh")).toBeInTheDocument()
    expect(screen.getByText('Joriy fan')).toBeInTheDocument()
    expect(screen.getByText("Yo'l harakati qoidalari")).toBeInTheDocument()
    expect(screen.getByText('Savol-javoblar')).toBeInTheDocument()
    expect(screen.getByText("O'quvchilar hamjamiyati")).toBeInTheDocument()
    expect(screen.getByText("Yangiliklar va foydali ma'lumotlar")).toBeInTheDocument()

    // Boshqa fanlar chiqmasligi shart (user talabi: boshqa fanlar chiqmasin)
    expect(screen.queryByText('Rus tili')).not.toBeInTheDocument()
    expect(screen.queryByText('Fizika')).not.toBeInTheDocument()
  })

  it('asosiy fan "Guruhga kirish" bosilganda o\'sha fanning Telegram havolasini ochadi', async () => {
    useSubjectStore.setState({ subjectId: 'yhq' })
    render(<ClosedGroupSheet isSubscribed={true} onClose={() => {}} onGetPlan={() => {}} />)

    const enterBtn = screen.getByRole('button', { name: /Guruhga kirish/i })
    expect(enterBtn).toBeInTheDocument()

    fireEvent.click(enterBtn)
    await waitFor(() => {
      expect(telegram.openTelegramLink).toHaveBeenCalledWith('https://t.me/kiwi_uz_bot?start=group_yhq')
    })
  })

  it('boshqa fanda bo\'lsa — o\'sha fanning guruhi va havolasi chiqadi', async () => {
    useSubjectStore.setState({ subjectId: 'rustili' })
    render(<ClosedGroupSheet isSubscribed={true} onClose={() => {}} onGetPlan={() => {}} />)

    expect(screen.getByText('Rus tili')).toBeInTheDocument()
    expect(screen.queryByText("Yo'l harakati qoidalari")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Guruhga kirish/i }))
    await waitFor(() => {
      expect(telegram.openTelegramLink).toHaveBeenCalledWith('https://t.me/kiwi_uz_bot?start=group_rustili')
    })
  })

  it('ru tilda obunachi ekrani ruschada ko\'rsatiladi', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'ru' } })
    useSubjectStore.setState({ subjectId: 'rustili' })
    render(<ClosedGroupSheet isSubscribed={true} onClose={() => {}} onGetPlan={() => {}} />)

    expect(screen.getByText('Закрытая группа')).toBeInTheDocument()
    expect(screen.getByText('Закрытая VIP группа по предмету «Русский язык»')).toBeInTheDocument()
    expect(screen.getByText('Текущий предмет')).toBeInTheDocument()
    expect(screen.getByText('Русский язык')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Войти в группу/i })).toBeInTheDocument()
  })
})

