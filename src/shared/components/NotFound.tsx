import { useNavigate } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'

export default function NotFound() {
  const navigate = useNavigate()
  const tt = useT(useAppStore((s) => s.settings.language))
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5">
      <EmptyState
        icon={Compass}
        title="404"
        description={tt('notFoundText')}
        action={
          <Button onClick={() => navigate('/', { replace: true })}>
            {tt('homeBtn')}
          </Button>
        }
      />
    </div>
  )
}
