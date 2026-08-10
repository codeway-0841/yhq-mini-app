import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastProps {
  id: string
  type: ToastType
  message: string
  duration?: number
  onClose: (id: string) => void
}

export default function Toast({ id, type, message, duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration)
      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  }

  const styles = {
    success: 'bg-green-50 dark:bg-green-900/20 border-l-green-500',
    error: 'bg-red-50 dark:bg-red-900/20 border-l-red-500',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-l-blue-500',
  }

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`
        flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-lg
        ${styles[type]}
        animate-fadeIn
      `}
    >
      {icons[type]}
      <p className="flex-1 text-[14px] text-fg font-medium">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
        aria-label="Yopish"
      >
        <X className="w-4 h-4 text-muted" />
      </button>
    </div>
  )
}
