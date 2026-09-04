import { Loader2, WifiOff, RefreshCw } from 'lucide-react'
import type { ConnStatus } from '../../../shared/lib/octagon-ws'

/** Aloqa/o'yin holati bannerlari — toast, reconnect, raqib kutish, server xatosi. */
export function DuelBanners({ toastMsg, conn, phase, oppWait, onRetry, language = 'uz' }: {
  toastMsg: string | null
  conn: ConnStatus
  phase: string
  oppWait: number | null
  language?: 'uz' | 'ru'
  onRetry: () => void
}) {
  const isConnectionToast = !!toastMsg && /websocket|connection error|ulan|соедин|подключ/i.test(toastMsg)
  return (
    <>
      {toastMsg && !(isConnectionToast && conn !== 'open') && (
        <div className="mx-4 mt-2 bg-pwarning/15 text-pwarning text-xs font-semibold px-3 py-2 rounded-xl text-center shadow-xs">
          {/websocket|connection error/i.test(toastMsg) ? (language === 'ru' ? 'Не удалось подключиться. Проверьте соединение.' : 'Ulanib bo‘lmadi. Internet aloqasini tekshiring.') : toastMsg}
        </div>
      )}

      {conn === 'reconnecting' && phase !== 'idle' && (
        <div className="mx-4 mt-2 bg-pwarning/15 text-pwarning text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-center gap-2 shadow-xs">
          <Loader2 size={14} className="animate-spin flex-shrink-0" />
          {language === 'ru' ? 'Переподключение…' : 'Aloqa tiklanmoqda…'}
        </div>
      )}

      {oppWait !== null && phase === 'in_round' && (
        <div className="mx-4 mt-2 bg-pwarning/15 text-pwarning text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-center gap-2 shadow-xs">
          <Loader2 size={14} className="animate-spin flex-shrink-0" />
          {language === 'ru' ? `Ждём соперника: ${oppWait} сек` : `Raqib kutilmoqda: ${oppWait} soniya`}
        </div>
      )}

      {conn === 'failed' && (
        <div role="status" className="arena-connection">
          <WifiOff size={14} className="flex-shrink-0" />
          {language === 'ru' ? 'Нет соединения' : 'Aloqa uzildi'}
          <button onClick={onRetry}
            className="min-h-11 flex items-center gap-1 underline underline-offset-2 hover:text-pfg transition-colors">
            <RefreshCw size={14} /> {language === 'ru' ? 'Повторить' : 'Qayta urinish'}
          </button>
        </div>
      )}
    </>
  )
}
