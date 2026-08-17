import { describe, it, expect, vi } from 'vitest'
import { drawCertificate, type CertificateData } from '../../../src/features/test/certificate-canvas'

describe('Certificate Canvas Drawer', () => {
  const mockCtx = {
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    roundRect: vi.fn(),
    setLineDash: vi.fn(),
  }

  const createMockCanvas = () => ({
    width: 0,
    height: 0,
    getContext: vi.fn((type: string) => (type === '2d' ? mockCtx : null)),
  } as unknown as HTMLCanvasElement)

  it('draws certificate with standard dimensions (1200x850)', () => {
    const canvas = createMockCanvas()
    const data: CertificateData = {
      userName: 'Azizbek Rahimov',
      subjectName: 'Yo‘l Harakati Qoidalari',
      score: 38,
      total: 40,
      percent: 95,
      date: '17-Avgust, 2026',
      certId: 'KIWI-TEST-1234',
      lang: 'uz',
    }

    drawCertificate(canvas, data)
    expect(canvas.width).toBe(1200)
    expect(canvas.height).toBe(850)
    expect(mockCtx.fillText).toHaveBeenCalledWith('Azizbek Rahimov', 600, 305)
    expect(mockCtx.fillText).toHaveBeenCalledWith('RASMIY BILIM SERTIFIKATI', 600, 150)
  })

  it('draws certificate with Russian localization', () => {
    const canvas = createMockCanvas()
    const data: CertificateData = {
      userName: 'Иван Иванов',
      subjectName: 'ПДД',
      score: 20,
      total: 20,
      percent: 100,
      date: '17 августа 2026 г.',
      certId: 'KIWI-RU-5678',
      lang: 'ru',
    }

    drawCertificate(canvas, data)
    expect(mockCtx.fillText).toHaveBeenCalledWith('СЕРТИФИКАТ УСПЕШНОЙ СДАЧИ', 600, 150)
    expect(mockCtx.fillText).toHaveBeenCalledWith('Иван Иванов', 600, 305)
  })

  it('handles empty username gracefully with fallback', () => {
    const canvas = createMockCanvas()
    const data: CertificateData = {
      userName: '',
      subjectName: 'YHQ',
      score: 18,
      total: 20,
      percent: 90,
      date: '17-Avgust, 2026',
      certId: 'KIWI-GUEST',
      lang: 'uz',
    }

    drawCertificate(canvas, data)
    expect(mockCtx.fillText).toHaveBeenCalledWith('Haydovchi', 600, 305)
  })
})
