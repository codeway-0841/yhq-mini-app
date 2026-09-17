/**
 * AI Kurs yaratish (/ai-kurslar/yangi).
 * 4 input turi (mavzu/havola/PDF/suhbat) + mavzu matni + chuqurlik.
 * POST /api/ai-courses → tafsilotga o'tadi. 429 = oylik limit.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, FileText, MessagesSquare, Type, Loader2 } from 'lucide-react'
import { api, ApiError } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useToast } from '../../shared/components/ToastContainer'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { PageHeader } from '../../shared/components/ui/page-header'
import { Textarea } from '../../shared/components/ui/textarea'
import { Input } from '../../shared/components/ui/input'
import { track } from '../../shared/lib/analytics'
import type { AiCourseInputKind, AiCourseLessonLength } from '../../../shared/ai-courses'

const KIND_ICONS: { id: AiCourseInputKind; icon: typeof Type }[] = [
  { id: 'topic', icon: Type },
  { id: 'link', icon: Link2 },
  { id: 'pdf', icon: FileText },
  { id: 'chat', icon: MessagesSquare },
]

const LENGTHS: AiCourseLessonLength[] = ['short', 'standard', 'deep']

export default function AiCourseCreate() {
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)
  const { error: showError } = useToast()
  const tt = useT(language)

  const [kind, setKind] = useState<AiCourseInputKind>('topic')
  const [topic, setTopic] = useState('')
  const [inputRef, setInputRef] = useState('')
  const [length, setLength] = useState<AiCourseLessonLength>('standard')
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Generatsiya ~27s: bosqich matni vaqtga qarab almashadi (0-8s reja, 8-22s darslar, keyin tekshiruv)
  useEffect(() => {
    if (!busy) { setElapsed(0); return }
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500)
    return () => clearInterval(timer)
  }, [busy])

  const stepLabel = !busy ? null
    : elapsed < 8 ? tt('aiCourseStepPlan')
    : elapsed < 22 ? tt('aiCourseStepLessons')
    : tt('aiCourseStepCheck')

  const kindLabel = (k: AiCourseInputKind) =>
    k === 'topic' ? tt('aiCourseInputTopic')
    : k === 'link' ? tt('aiCourseInputLink')
    : k === 'pdf' ? tt('aiCourseInputPdf')
    : tt('aiCourseInputChat')

  const lengthLabel = (l: AiCourseLessonLength) =>
    l === 'short' ? tt('aiCourseLengthShort')
    : l === 'deep' ? tt('aiCourseLengthDeep')
    : tt('aiCourseLengthStandard')

  const create = async () => {
    if (busy || topic.trim().length < 3) return
    setBusy(true)
    try {
      track('ai_course_create_submit', { kind, length })
      const r = await api.createAiCourse({
        topic: topic.trim().slice(0, 200),
        inputKind: kind,
        inputRef: inputRef.trim().slice(0, 500),
        lessonLength: length,
        language,
      })
      navigate(`/ai-kurslar/${r.course.id}`, { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'COURSE_LIMIT_REACHED') {
        showError(tt('aiCourseLimitReached'))
      } else {
        showError(tt('aiCourseLoadError'))
      }
      setBusy(false)
    }
  }

  return (
    <div className="px-4 pb-4">
      <PageHeader title={tt('aiCourseCreate')} onBack={() => goBack(navigate)} backLabel={tt('backWord')} className="-mx-4 mb-4" />

      <div className="rounded-2xl bg-pcard p-4 shadow-xs">
        <p className="mb-2 text-[14px] font-bold text-pfg">{tt('aiCourseTopicLabel')}</p>

        <div className="mb-3 grid grid-cols-4 gap-2">
          {KIND_ICONS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-semibold transition-all active:scale-[0.97] ${
                kind === id ? 'bg-pprimary text-ponprimary shadow-md' : 'bg-psurface text-pmuted shadow-2xs'
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
              {kindLabel(id)}
            </button>
          ))}
        </div>

        <Textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={tt('aiCourseTopicHint')}
          rows={3}
          maxLength={200}
        />

        {kind !== 'topic' && (
          <div className="mt-2">
            <Input
              value={inputRef}
              onChange={(e) => setInputRef(e.target.value)}
              placeholder={tt('aiCourseInputRefHint')}
              maxLength={500}
            />
          </div>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2">
          {LENGTHS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLength(l)}
              className={`rounded-xl px-2 py-2 text-[12px] font-semibold transition-all active:scale-[0.97] ${
                length === l ? 'bg-pprimary text-ponprimary shadow-md' : 'bg-psurface text-pmuted shadow-2xs'
              }`}
            >
              {lengthLabel(l)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={create}
          disabled={busy || topic.trim().length < 3}
          className="btn-premium mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy && <Loader2 size={18} className="animate-spin" />}
          {busy ? (stepLabel ?? tt('aiCourseCreating')) : tt('aiCourseCreate')}
        </button>
        {busy && (
          <p className="mt-2 text-center text-[12px] text-pmuted">{tt('aiCourseWaitNote')}</p>
        )}
      </div>
    </div>
  )
}
