import { Loader2, WifiOff, RefreshCw } from 'lucide-react'
import type { ConnStatus } from '../../../shared/lib/octagon-ws'

/** Aloqa/o'yin holati bannerlari — toast, reconnect, raqib kutish, server xatosi. */
export function DuelBanners({ toastMsg, conn, phase, oppWait, onRetry }: {
  toastMsg: string | null
  conn: ConnStatus
  phase: string
  oppWait: number | null
  onRetry: () => void
}) {
  return (
    <>
      {toastMsg && (
        <div className="mx-4 mt-2 bg-pwarning/10 border border-pwarning/40 text-fg text-xs font-semibold px-3 py-2 rounded-xl text-center">
          {toastMsg}
        </div>
      )}

      {conn === 'reconnecting' && phase !== 'idle' && (
        <div className="mx-4 mt-2 bg-pwarning/10 border border-pwarning/40 text-fg text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin flex-shrink-0" />
          Aloqa uzildi — qayta ulanmoqda...
        </div>
      )}

      {oppWait !== null && phase === 'in_round' && (
        <div className="mx-4 mt-2 bg-pwarning/10 border border-pwarning/40 text-fg text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin flex-shrink-0" />
          Raqib uzildi — {oppWait} soniya kutilmoqda
        </div>
      )}

      {conn === 'failed' && (
        <div className="mx-4 mt-2 bg-pdanger/10 border border-pdanger/40 text-fg text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-center gap-2">
          <WifiOff size={14} className="flex-shrink-0" />
          Serverga ulanib bo'lmadi
          <button onClick={onRetry}
            className="flex items-center gap-1 underline underline-offset-2 hover:text-fg transition-colors">
            <RefreshCw size={12} /> Qayta urinish
          </button>
        </div>
      )}
    </>
  )
}
