import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LibraryReaderPage from '../../../src/features/library/LibraryReaderPage'
import { loadPdfJs } from '../../../src/features/library/pdfjs-loader'
import { useAppStore } from '../../../src/shared/store/useAppStore'

vi.mock('../../../src/features/library/pdfjs-loader', () => ({
  loadPdfJs: vi.fn(),
  BundledPdfWasmFactory: class {},
}))

const renderPromise = Promise.resolve()
const renderTask = { promise: renderPromise, cancel: vi.fn() }
const getPage = vi.fn(async () => ({
  getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
  render: vi.fn(() => renderTask),
}))
const destroyDocument = vi.fn(async () => undefined)
const pdfDocument = { numPages: 3, getPage, destroy: destroyDocument }

function renderReader(slug = '1-sinf-alifbe') {
  return render(
    <MemoryRouter initialEntries={[`/kutubxona/kitob/${slug}`]}>
      <Routes>
        <Route path="/kutubxona/kitob/:slug" element={<LibraryReaderPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LibraryReaderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, language: 'uz' },
    })

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ({})),
    })

    const loadingTask = {
      promise: Promise.resolve(pdfDocument),
      onProgress: null,
      destroy: vi.fn(async () => undefined),
    }
    vi.mocked(loadPdfJs).mockResolvedValue({
      getDocument: vi.fn(() => loadingTask),
    } as never)
  })

  it('PDFni ilova ichida yuklaydi va betlar orasida o‘tadi', async () => {
    renderReader()

    expect(screen.getByRole('heading', { name: '1-sinf Alifbe' })).toBeTruthy()
    expect(screen.getByRole('status')).toHaveTextContent('Kitob yuklanmoqda...')

    expect(await screen.findByText('1 / 3')).toBeTruthy()
    await waitFor(() => expect(getPage).toHaveBeenCalledWith(1))

    fireEvent.click(screen.getByRole('button', { name: 'Keyingi' }))
    await waitFor(() => expect(getPage).toHaveBeenCalledWith(2))
    expect(screen.getByText('2 / 3')).toBeTruthy()
  })

  it('noma’lum kitob uchun xavfsiz xato holatini ko‘rsatadi', () => {
    renderReader('mavjud-emas')

    expect(screen.getAllByText('Kitob topilmadi')).toHaveLength(2)
    expect(loadPdfJs).not.toHaveBeenCalled()
  })
})
