import { StrictMode } from 'react'
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

/** StrictMode qo'shilgan variant — mount-unmount-remount siklini takrorlaydi
 *  (src/main.tsx ilovani aynan shunday o'raydi, ya'ni bu REAL dev xulqi). */
function renderPageStrict() {
  return render(
    <StrictMode><MemoryRouter><ToastProvider><OfflinePage /></ToastProvider></MemoryRouter></StrictMode>
  )
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

  it('keeps the downloaded state and shows an error toast when delete fails', async () => {
    isSubjectDownloaded.mockResolvedValue(true)
    deleteSubjectOffline.mockRejectedValue(new Error('quota'))
    renderPage()
    await waitFor(() => screen.getByText("O'chirish"))

    fireEvent.click(screen.getByText("O'chirish"))
    expect(await screen.findByText('Ha, o\'chirish')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Ha, o\'chirish'))
    await waitFor(() => expect(deleteSubjectOffline).toHaveBeenCalledWith('yhq'))

    // Kesh haqiqatan o'chmadi — delete tugmasi ko'rinishda qolishi kerak,
    // 'Yuklab olish'ga almashmasligi kerak.
    expect(await screen.findByText("Xatolik yuz berdi. Qayta urinib ko'ring")).toBeInTheDocument()
    expect(screen.getByText("O'chirish")).toBeInTheDocument()
  })

  it('shows the download button again and an error toast when download fails', async () => {
    isSubjectDownloaded.mockResolvedValue(false)
    downloadSubjectOffline.mockRejectedValue(new Error('network'))
    renderPage()
    await waitFor(() => screen.getByText('Yuklab olish'))

    fireEvent.click(screen.getByText('Yuklab olish'))
    expect(await screen.findByText('Rasmlarni yuklash')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Rasmlarni yuklash'))
    await waitFor(() => expect(downloadSubjectOffline).toHaveBeenCalledWith('yhq', expect.any(Function)))

    expect(await screen.findByText("Yuklab bo'lmadi. Qaytadan urinib ko'ring")).toBeInTheDocument()
    expect(screen.getByText('Yuklab olish')).toBeInTheDocument()
  })
  it('StrictMode remount ostida ham progress UI ga yetib boradi', async () => {
    isSubjectDownloaded.mockResolvedValue(false)
    // Yuklash progressni bosqichma-bosqich xabar qiladi, keyin tugaydi.
    downloadSubjectOffline.mockImplementation(async (_sid: string, onProgress: (p: unknown) => void) => {
      onProgress({ done: 1, total: 2, percent: 50 })
      onProgress({ done: 2, total: 2, percent: 100 })
    })
    renderPageStrict()
    await waitFor(() => screen.getByText('Yuklab olish'))

    fireEvent.click(screen.getByText('Yuklab olish'))
    fireEvent.click(await screen.findByText('Rasmlarni yuklash'))

    // mountedRef remount'da true ga qaytarilmasa, progress ham, yakuniy holat
    // ham UI ga umuman yetib bormaydi — ekran "Yuklab olish"da qotib qoladi.
    await waitFor(() => expect(screen.getByText("O'chirish")).toBeInTheDocument())
  })
})
