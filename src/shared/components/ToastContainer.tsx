import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'
import Toast, { type ToastType } from './Toast'

interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, type, message, duration }])
  }, [])

  const closeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const success = useCallback((message: string, duration?: number) => {
    showToast('success', message, duration)
  }, [showToast])

  const error = useCallback((message: string, duration?: number) => {
    showToast('error', message, duration ?? 5000) // Errors shown longer
  }, [showToast])

  const info = useCallback((message: string, duration?: number) => {
    showToast('info', message, duration)
  }, [showToast])

  // Context value MEMO (audit C2): har toast setState'da yangi obyekt barcha
  // useToast() consumer'larini (deyarli har sahifa) qayta render qilardi.
  const value = useMemo(() => ({ showToast, success, error, info }), [showToast, success, error, info])

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast Container - top-center (mobile), top-right (desktop) */}
      <div
        className="fixed top-[calc(1rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-50 flex flex-col gap-2 w-full max-w-md px-4 sm:px-0 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} onClose={closeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
