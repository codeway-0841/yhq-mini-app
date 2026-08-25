import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, Trash2 } from 'lucide-react'
import { goBack } from '../../shared/lib/navigation'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import {
  downloadSubjectOffline, isSubjectDownloaded, deleteSubjectOffline, type DownloadProgress,
} from '../../shared/lib/offlinePackage'
import { Progress } from '../../shared/components/ui/progress'
import DialogOverlay from '../../shared/components/DialogOverlay'
import { useToast } from '../../shared/components/ToastContainer'

type Status = 'checking' | 'idle' | 'downloading' | 'downloaded'

export default function OfflinePage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const subjectId = useSubjectStore((s) => s.subjectId)
  const { info: showToast } = useToast()

  const [status, setStatus] = useState<Status>('checking')
  const [progress, setProgress] = useState<DownloadProgress>({ done: 0, total: 1, percent: 0 })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Uzoq davom etadigan downloadSubjectOffline() paytida foydalanuvchi
  // sahifadan chiqib ketsa (orqaga tugma) — keyingi setState chaqiruvlari
  // unmount qilingan komponentga tegmasin.
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  useEffect(() => {
    let cancelled = false
    setStatus('checking')
    isSubjectDownloaded(subjectId).then((yes) => {
      if (!cancelled) setStatus(yes ? 'downloaded' : 'idle')
    })
    return () => { cancelled = true }
  }, [subjectId])

  const startDownload = async () => {
    setConfirmOpen(false)
    setStatus('downloading')
    setProgress({ done: 0, total: 1, percent: 0 })
    // subjectId'ni ushbu chaqiruv boshlanganda qulflab olamiz. Taqqoslash
    // useSubjectStore.getState() orqali — LIVE qiymat — chunki React'dagi
    // `subjectId` o'zgaruvchi shu closure yaratilgan render'ga qotib qolgan,
    // taqqoslasa ikkalasi ham bir xil "muzlagan" qiymat bo'lib, hech narsani
    // ushlamas edi (foydalanuvchi async davomida boshqa fanga o'tsa ham).
    const forSubject = subjectId
    try {
      await downloadSubjectOffline(forSubject, (p: DownloadProgress) => {
        if (mountedRef.current && forSubject === useSubjectStore.getState().subjectId) setProgress(p)
      })
      if (mountedRef.current && forSubject === useSubjectStore.getState().subjectId) setStatus('downloaded')
    } catch {
      if (mountedRef.current && forSubject === useSubjectStore.getState().subjectId) {
        setStatus('idle')
        showToast(tt('offlineDownloadFailed'))
      }
    }
  }

  const confirmDelete = async () => {
    setDeleteOpen(false)
    const forSubject = subjectId
    try {
      await deleteSubjectOffline(forSubject)
      // Faqat MUVAFFAQIYATDA 'idle'ga o'tamiz — kesh haqiqatan o'chdi.
      // Xatoda pastdagi catch'da hech narsa o'zgarmaydi: kesh hali ham
      // joyida, shuning uchun status 'downloaded' bo'lib qolishi to'g'ri
      // (startDownload'dagi try/catch bilan bir xil naqsh — har ikki
      // natija o'z holatini o'zi, alohida qulf bilan qo'yadi).
      if (mountedRef.current && forSubject === useSubjectStore.getState().subjectId) setStatus('idle')
    } catch (err) {
      console.warn('[OfflinePage] o\'chirib bo\'lmadi:', (err as Error)?.message ?? err)
      if (mountedRef.current && forSubject === useSubjectStore.getState().subjectId) showToast(tt('shopError'))
    }
  }

  return (
    <div className="px-5 pt-4 pb-10">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="grid size-11 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h1 className="text-xl font-semibold">{tt('offlineScreenTitle')}</h1>
      </div>

      <p className="px-1 mb-5 text-[13px] text-pmuted">{tt('offlineScreenDesc')}</p>

      <div className="rounded-container border border-pline bg-pcard p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: 'color-mix(in srgb, var(--p-primary) 10%, transparent)' }}>
            <Download size={16} strokeWidth={1.75} style={{ color: 'var(--p-primary)' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-pfg">{tt('offlineDownloadTitle')}</p>
            <p className="text-[12px] text-pmuted">{tt('offlineDownloadDesc')}</p>

            {status === 'downloading' && (
              <div className="mt-3">
                <Progress value={progress.percent} label={`${progress.percent}%`} />
              </div>
            )}
          </div>
        </div>

        <div className="mt-3">
          {status === 'downloaded' ? (
            <button onClick={() => setDeleteOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-control bg-pdanger/10 py-2.5 text-[13px] font-semibold text-pdanger">
              <Trash2 size={14} strokeWidth={1.75} />
              {tt('offlineDeleteBtn')}
            </button>
          ) : (
            <button onClick={() => setConfirmOpen(true)} disabled={status === 'downloading' || status === 'checking'}
              className="w-full rounded-control bg-pprimary py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
              {tt('offlineDownloadBtn')}
            </button>
          )}
        </div>
      </div>

      {confirmOpen && (
        <DialogOverlay onClose={() => setConfirmOpen(false)} labelId="offline-confirm-title">
          <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-4 pb-8">
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-5" />
            <p id="offline-confirm-title" className="text-center text-base font-black mb-2 text-fg">{tt('offlineConfirmSheetTitle')}</p>
            <p className="text-center text-[13px] text-muted mb-5">{tt('offlineConfirmSheetDesc')}</p>
            <button onClick={startDownload} className="w-full rounded-2xl bg-pprimary py-3 text-[14px] font-bold text-white mb-2">
              {tt('offlineConfirmSheetConfirm')}
            </button>
            <button onClick={() => setConfirmOpen(false)} className="w-full rounded-2xl bg-canvas border border-line py-3 text-[14px] font-bold text-fg">
              {tt('offlineConfirmSheetCancel')}
            </button>
          </div>
        </DialogOverlay>
      )}

      {deleteOpen && (
        <DialogOverlay onClose={() => setDeleteOpen(false)} labelId="offline-delete-title">
          <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-4 pb-8">
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-5" />
            <p id="offline-delete-title" className="text-center text-base font-black mb-2 text-fg">{tt('offlineDeleteSheetTitle')}</p>
            <p className="text-center text-[13px] text-muted mb-5">{tt('offlineDeleteSheetDesc')}</p>
            <button onClick={confirmDelete} className="w-full rounded-2xl bg-pdanger py-3 text-[14px] font-bold text-white mb-2">
              {tt('offlineDeleteSheetConfirm')}
            </button>
            <button onClick={() => setDeleteOpen(false)} className="w-full rounded-2xl bg-canvas border border-line py-3 text-[14px] font-bold text-fg">
              {tt('offlineDeleteSheetCancel')}
            </button>
          </div>
        </DialogOverlay>
      )}
    </div>
  )
}
