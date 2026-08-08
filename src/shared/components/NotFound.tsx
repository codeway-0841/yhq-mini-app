import { useNavigate } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'

export default function NotFound() {
  const navigate = useNavigate()
  const tt = useT(useAppStore((s) => s.settings.language))
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <Compass size={56} className="text-muted mb-4" />
      <h1 className="text-3xl font-black mb-1">404</h1>
      <p className="text-sm text-muted mb-6">{tt('notFoundText')}</p>
      <button
        onClick={() => navigate('/', { replace: true })}
        className="px-6 py-3 rounded-xl bg-duo-green text-ponprimary font-bold">
        {tt('homeBtn')}
      </button>
    </div>
  )
}
