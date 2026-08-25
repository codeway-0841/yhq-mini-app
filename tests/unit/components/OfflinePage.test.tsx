import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OfflinePage from '../../../src/features/profile/OfflinePage'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { ToastProvider } from '../../../src/shared/components/ToastContainer'

const isSubjectDownloaded = vi.fn()
const downloadSubjectOffline = vi.fn()
const deleteSubjectOffline = vi.fn()
vi.mock('../../../src/shared/lib/offlinePackage', () => ({
  isSubjectDownloaded: (...a: unknown[]) => isSubjectDownloaded(...a),
  downloadSubjectOffline: (...a: unknown[]) => downloadSubjectOffline(...a),
  deleteSubjectOffline: (...a: unknown[]) => deleteSubjectOffline(...a),
}))

function renderPage() {
  // OfflinePage calls useToast() (shows a toast on download/delete failure) —
  // that hook throws without a ToastProvider ancestor, so it's included here
  // alongside MemoryRouter (needed for useNavigate/goBack).
  return render(<MemoryRouter><ToastProvider><OfflinePage /></ToastProvider></MemoryRouter>)
}

beforeEach(() => {
  isSubjectDownloaded.mockReset()
  downloadSubjectOffline.mockReset()
  deleteSubjectOffline.mockReset()
  useSubjectStore.setState({ subjectId: 'yhq' })
  useAppStore.setState({
    settings: {
      autoNextCorrect: true, autoNextWrong: false, noAnimation: false, shuffleOptions: false,
      fontSize: 'medium', fontStyle: 'default', language: 'uz', theme: 'dark', offlineMode: true,
    },
  })
})

describe('OfflinePage', () => {
  it('shows the download button when nothing is downloaded yet', async () => {
    isSubjectDownloaded.mockResolvedValue(false)
    renderPage()
    await waitFor(() => expect(screen.getByText('Yuklab olish')).toBeInTheDocument())
  })

  it('shows the delete button when the subject is already downloaded', async () => {
    isSubjectDownloaded.mockResolvedValue(true)
    renderPage()
    await waitFor(() => expect(screen.getByText("O'chirish")).toBeInTheDocument())
  })

  it('clicking download opens the confirm sheet, confirming starts the download', async () => {
    isSubjectDownloaded.mockResolvedValue(false)
    downloadSubjectOffline.mockResolvedValue(undefined)
    renderPage()
    await waitFor(() => screen.getByText('Yuklab olish'))

    fireEvent.click(screen.getByText('Yuklab olish'))
    expect(await screen.findByText('Rasmlarni yuklash')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Rasmlarni yuklash'))
    await waitFor(() => expect(downloadSubjectOffline).toHaveBeenCalledWith('yhq', expect.any(Function)))
  })

  it('clicking delete opens a confirm sheet, confirming deletes', async () => {
    isSubjectDownloaded.mockResolvedValue(true)
    deleteSubjectOffline.mockResolvedValue(undefined)
    renderPage()
    await waitFor(() => screen.getByText("O'chirish"))

    fireEvent.click(screen.getByText("O'chirish"))
    expect(await screen.findByText('Ha, o\'chirish')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Ha, o\'chirish'))
    await waitFor(() => expect(deleteSubjectOffline).toHaveBeenCalledWith('yhq'))
  })
})
