/**
 * Modal "spec" primitivlari (App Store chek uslubi) — barcha sheet'lar shu
 * komponentlar orqali bir xil ko'rinishga ega bo'ladi. Test shartnomani
 * qulflaydi: semantika (dl/dt/dd), qiymat/izoh, tanlangan holat, bosilish.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoinIcon } from '../../../src/shared/components/CoinIcon'
import {
  SpecCard,
  SpecList,
  SpecRow,
  SpecHero,
  SpecAmount,
} from '../../../src/shared/components/ui/spec'

describe('Spec primitivlari', () => {
  it('SpecList ichida qatorlar semantik dl/dt/dd bo\'ladi', () => {
    const { container } = render(
      <SpecCard>
        <SpecList>
          <SpecRow label="Sana" value="28-sentabr" />
        </SpecList>
      </SpecCard>,
    )

    const list = container.querySelector('dl')
    expect(list).not.toBeNull()
    expect(container.querySelector('dt')?.textContent).toBe('Sana')
    expect(container.querySelector('dd')?.textContent).toBe('28-sentabr')
  })

  it('SpecList tashqarida dt/dd ishlatilmaydi (noto\'g\'ri HTML chiqmasin)', () => {
    const { container } = render(
      <SpecCard>
        <SpecRow label="Tarif" value="Oylik" />
      </SpecCard>,
    )

    expect(container.querySelector('dl')).toBeNull()
    expect(container.querySelector('dt')).toBeNull()
    expect(container.querySelector('dd')).toBeNull()
    expect(screen.getByText('Tarif')).toBeInTheDocument()
  })

  it('label + hint + value + valueHint birga ko\'rsatiladi', () => {
    render(
      <SpecCard>
        <SpecList>
          <SpecRow label="Oylik" hint="Click · 20-avg" value="29 000 so'm" valueHint="To'langan" />
        </SpecList>
      </SpecCard>,
    )

    expect(screen.getByText('Oylik')).toBeInTheDocument()
    expect(screen.getByText('Click · 20-avg')).toBeInTheDocument()
    expect(screen.getByText("29 000 so'm")).toBeInTheDocument()
    expect(screen.getByText("To'langan")).toBeInTheDocument()
  })

  it('ikonka chipi ohang sinfini oladi (semantik token)', () => {
    const { container } = render(
      <SpecCard>
        <SpecRow icon={<CoinIcon size={16} />} tone="gold" label="Tangalar" value="+120" />
      </SpecCard>,
    )

    const chip = container.querySelector('[aria-hidden="true"]')
    expect(chip?.className).toContain('bg-[rgb(var(--p-gold-rgb)/0.16)]')
    expect(chip?.className).toContain('rounded-full')
  })

  it('onClick — qator tugma bo\'ladi va bosiladi', () => {
    const onClick = vi.fn()
    render(
      <SpecCard>
        <SpecRow label="Inter Tight" onClick={onClick} selected />
      </SpecCard>,
    )

    const row = screen.getByRole('button', { name: 'Inter Tight' })
    expect(row).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(row)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('SpecAmount katta raqam va izohni chiqaradi', () => {
    render(<SpecAmount value="85%" caption="17 ta to'g'ri javob" />)

    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText("17 ta to'g'ri javob")).toBeInTheDocument()
  })

  it('SpecHero sarlavha, taglavha va badge\'ni chiqaradi', () => {
    render(
      <SpecHero
        icon={<CoinIcon size={32} />}
        badge={<span>🇺🇿</span>}
        title="Pro Upgrade"
        subtitle="AppScope"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Pro Upgrade' })).toBeInTheDocument()
    expect(screen.getByText('AppScope')).toBeInTheDocument()
    expect(screen.getByText('🇺🇿')).toBeInTheDocument()
  })
})
