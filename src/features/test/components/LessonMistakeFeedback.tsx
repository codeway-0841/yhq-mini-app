import { useEffect } from 'react'
import { Volume2 } from 'lucide-react'
import { speak, stopSpeaking } from '../../../shared/lib/speech'

export function LessonMistakeFeedback({ language, onAsk, onContinue }: {
  language: 'uz' | 'ru'
  onAsk: () => void
  onContinue: () => void
}) {
  const ru = language === 'ru'
  const message = ru ? 'Ответ неверный. Давайте разберёмся вместе.' : 'Javob xato. Keling, birga tushunib olamiz.'
  useEffect(() => () => stopSpeaking(), [])
  return (
    <div role="status" className="fixed right-4 bottom-[calc(6rem+var(--safe-bottom,0px))] z-40 w-[min(18rem,calc(100vw-2rem))] rounded-2xl bg-pcard p-3 text-pfg shadow-lg">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{message}</p>
        <button type="button" onClick={() => speak(message, language)} className="grid size-9 shrink-0 place-items-center rounded-full bg-psurface" aria-label={ru ? 'Прослушать подсказку' : 'Yordamni tinglash'}><Volume2 size={17} /></button>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => { stopSpeaking(); onAsk() }} className="flex-1 rounded-xl bg-psurface px-3 py-2 text-sm font-semibold">{ru ? 'Спросить ИИ' : 'AI yordam'}</button>
        <button type="button" onClick={() => { stopSpeaking(); onContinue() }} className="flex-1 rounded-xl bg-pprimary px-3 py-2 text-sm font-semibold text-ponprimary">{ru ? 'Дальше' : 'Davom etish'}</button>
      </div>
    </div>
  )
}
