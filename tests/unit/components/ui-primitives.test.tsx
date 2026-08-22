/**
 * KIWI UI primitivlari (src/shared/components/ui) — xatti-harakat va dizayn
 * shartnomasi testlari.
 *
 * Bu yerda "chiroyli ko'rinadimi" tekshirilmaydi — TIZIM QOIDALARI tekshiriladi:
 *  - loading holati tugmani bloklaydi va aria-busy beradi
 *  - xato holati aria-invalid orqali (vizual va screen reader bitta manbadan)
 *  - SegmentedRing segment sonini to'g'ri chizadi va done > total ni cheklaydi
 *  - nested Sheet/Dialog sarlavha id'lari UNIKAL (aria-labelledby to'qnashmasin)
 *  - ConfirmDialog tugmasi AMALNI aytadi va handler'ni chaqiradi
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Inbox } from 'lucide-react'
import {
  Button, Input, Badge, Alert, AlertTitle, Progress, SegmentedRing,
  Switch, EmptyState, Sheet, SheetHeader, SheetTitle, ConfirmDialog,
} from '../../../src/shared/components/ui'

describe('Button', () => {
  it('bosilganda handler chaqiriladi', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Boshlash</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Boshlash' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('loading — tugma bloklanadi, aria-busy qo\'yiladi va handler chaqirilmaydi', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Yuborish</Button>)
    const btn = screen.getByRole('button', { name: /Yuborish/ })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disabled tugma handler chaqirmaydi', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Sotib olish</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Sotib olish' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it("Duolingo 3D qoldig'i yo'q — translate/qattiq soya klasslari ishlatilmaydi", () => {
    render(<Button>Test</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('active:scale-[0.98]')
    expect(cls).not.toMatch(/active:translate-y/)
    expect(cls).not.toMatch(/shadow-\[0_2px_0/)
  })

  it('asChild — tugma stilini boshqa elementga beradi', () => {
    render(<Button asChild><a href="#/shop">Do'kon</a></Button>)
    expect(screen.getByRole('link', { name: "Do'kon" })).toBeInTheDocument()
  })
})

describe('Input', () => {
  it('xato holati aria-invalid orqali beriladi', () => {
    render(<Input aria-label="Promo kod" aria-invalid defaultValue="KIWI" />)
    expect(screen.getByLabelText('Promo kod')).toHaveAttribute('aria-invalid', 'true')
  })

  it('qiymat kiritish ishlaydi', () => {
    const onChange = vi.fn()
    render(<Input aria-label="Telefon" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '+998901234567' } })
    expect(onChange).toHaveBeenCalled()
  })
})

describe('Badge / Alert', () => {
  it('badge matnni ko\'rsatadi', () => {
    render(<Badge variant="accent">Premium</Badge>)
    expect(screen.getByText('Premium')).toBeInTheDocument()
  })

  it('danger alert role="alert" (screen reader darhol o\'qiydi)', () => {
    render(<Alert variant="danger"><AlertTitle>Xatolik</AlertTitle></Alert>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('boshqa variantlar role="status" (uzmaydi)', () => {
    render(<Alert variant="warning"><AlertTitle>Internet uzildi</AlertTitle></Alert>)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('Progress', () => {
  it('label aria-valuetext ga ham yoziladi', () => {
    render(<Progress value={72} label="18 / 25" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuetext', '18 / 25')
    expect(screen.getByText('18 / 25')).toBeInTheDocument()
  })

  it('qiymat 0-100 oralig\'iga cheklanadi', () => {
    const { container } = render(<Progress value={180} />)
    const indicator = container.querySelector('[data-state]')?.querySelector('div')
    expect(indicator).toHaveStyle({ width: '100%' })
  })
})

describe('SegmentedRing', () => {
  it('total ta segment chizadi', () => {
    const { container } = render(<SegmentedRing total={6} done={4} />)
    expect(container.querySelectorAll('circle')).toHaveLength(6)
  })

  it('done ta segment aksent rangida', () => {
    const { container } = render(<SegmentedRing total={6} done={4} />)
    const filled = container.querySelectorAll('circle.stroke-pprimary')
    expect(filled).toHaveLength(4)
  })

  it('done > total bo\'lsa cheklanadi (vizual buzilmaydi)', () => {
    const { container } = render(<SegmentedRing total={3} done={99} />)
    expect(container.querySelectorAll('circle.stroke-pprimary')).toHaveLength(3)
  })

  it('total=0 bo\'lsa ham yiqilmaydi', () => {
    const { container } = render(<SegmentedRing total={0} done={0} />)
    expect(container.querySelectorAll('circle')).toHaveLength(1)
  })
})

describe('Switch', () => {
  it('holat almashadi', () => {
    const onCheckedChange = vi.fn()
    render(<Switch aria-label="Tovush" checked={false} onCheckedChange={onCheckedChange} />)
    const sw = screen.getByRole('switch', { name: 'Tovush' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })
})

describe('EmptyState', () => {
  it('sarlavha, izoh va amalni ko\'rsatadi', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Hali xato yo'q"
        description="Test yechganingizda noto'g'ri javoblar shu yerda to'planadi."
        action={<Button size="sm">Testni boshlash</Button>}
      />,
    )
    expect(screen.getByText("Hali xato yo'q")).toBeInTheDocument()
    expect(screen.getByText(/to'planadi/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Testni boshlash' })).toBeInTheDocument()
  })
})

describe('Sheet — a11y', () => {
  it('dialog roli va sarlavhaga bog\'lanish (aria-labelledby)', () => {
    render(<Sheet onClose={() => {}}><SheetHeader><SheetTitle>Fanni tanlang</SheetTitle></SheetHeader></Sheet>)
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)).toHaveTextContent('Fanni tanlang')
  })

  it('NESTED sheet — sarlavha id\'lari UNIKAL (aria-labelledby to\'qnashmaydi)', () => {
    render(
      <>
        <Sheet onClose={() => {}}><SheetHeader><SheetTitle>Birinchi</SheetTitle></SheetHeader></Sheet>
        <Sheet onClose={() => {}} zIndex={60}><SheetHeader><SheetTitle>Ikkinchi</SheetTitle></SheetHeader></Sheet>
      </>,
    )
    const ids = screen.getAllByRole('dialog').map((d) => d.getAttribute('aria-labelledby'))
    expect(ids[0]).toBeTruthy()
    expect(ids[1]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
    expect(document.getElementById(ids[0]!)).toHaveTextContent('Birinchi')
    expect(document.getElementById(ids[1]!)).toHaveTextContent('Ikkinchi')
  })

  it('open={false} — hech narsa render qilinmaydi', () => {
    render(<Sheet open={false} onClose={() => {}}><SheetHeader><SheetTitle>Yopiq</SheetTitle></SheetHeader></Sheet>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  const base = {
    title: "Natijani o'chirasizmi?",
    description: 'Bu amalni qaytarib bo\'lmaydi.',
    confirmLabel: "O'chirish",
    cancelLabel: 'Bekor qilish',
  }

  it('tugma matni AMALNI aytadi ("Ha" emas)', () => {
    render(<ConfirmDialog {...base} destructive onConfirm={() => {}} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: "O'chirish" })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /^Ha$/ })).not.toBeInTheDocument()
  })

  it('tasdiqlash va bekor qilish handlerlari', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: "O'chirish" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('loading — ikkala tugma ham bloklanadi (ikki marta yuborilmasin)', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...base} loading onConfirm={onConfirm} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /O'chirish/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bekor qilish' })).toBeDisabled()
  })
})
