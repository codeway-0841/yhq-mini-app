/**
 * AI Kunlik Test — topshiriq kartalari (4 tur: mcq/matching/short/essay).
 * Har biri 2 rejimda: JAVOB BERISH (interaktiv) yoki REVIEW (natija, reveal).
 * Dizayn: mavjud token'lar (pcard/pline/ppurple=AI aksent — dizayn qoidasi 8).
 */

import { Check, X } from 'lucide-react'
import type {
  AiTestMcqTaskPublic, AiTestMatchingTaskPublic,
  AiTestShortTaskPublic, AiTestEssayTaskPublic,
  AiTestGrading,
} from '../../../../shared/ai-daily-test'

/** Variant harflari (Kirill) — indeks bo'yicha */
const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'] as const

function TaskShell({ num, topic, prompt, children }: {
  num: number; topic: string; prompt: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-container border border-pline bg-pcard p-4">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="flex-shrink-0 grid size-7 place-items-center rounded-control text-[13px] font-bold"
          style={{ background: 'color-mix(in srgb, var(--p-purple) 14%, transparent)', color: 'var(--p-purple)' }}>
          {num}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-psubtle uppercase tracking-wide">{topic}</p>
          <p className="text-[15px] text-pfg leading-snug mt-0.5 whitespace-pre-wrap">{prompt}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function ReviewMark({ correct }: { correct: boolean }) {
  return correct
    ? <Check size={16} strokeWidth={2.5} className="flex-shrink-0 text-psuccess" />
    : <X size={16} strokeWidth={2.5} className="flex-shrink-0 text-pdanger" />
}

// ── 1. MCQ ──────────────────────────────────────────────────────────────────

export function McqTaskView({ task, num, value, onChange, review }: {
  task: AiTestMcqTaskPublic
  num: number
  value: string | undefined
  onChange?: (optionId: string) => void
  review?: AiTestGrading['mcq'][string]
}) {
  return (
    <TaskShell num={num} topic={task.topic} prompt={task.prompt}>
      <div className="flex flex-col gap-2">
        {task.options.map((opt, i) => {
          const selected = value === opt.id
          const isCorrect = review?.correctOptionId === opt.id
          const isWrongPick = review && selected && !review.correct
          let cls = 'border-plineStrong bg-psurface text-pfg'
          if (review) {
            if (isCorrect) cls = 'border-psuccess bg-psuccess/10 text-pfg'
            else if (isWrongPick) cls = 'border-pdanger bg-pdanger/10 text-pfg'
            else cls = 'border-pline bg-psurface text-psubtle'
          } else if (selected) {
            cls = 'border-ppurple text-pfg'
          }
          return (
            <button
              key={opt.id}
              type="button"
              disabled={!!review || !onChange}
              onClick={() => onChange?.(opt.id)}
              className={`w-full flex items-center gap-3 rounded-control border px-3.5 py-2.5 text-left transition-[background-color,border-color,transform] duration-[120ms] ease-out ${cls} ${!review ? 'active:scale-[0.99] hover:border-ppurple/60' : ''} disabled:cursor-default`}
              style={!review && selected ? { background: 'color-mix(in srgb, var(--p-purple) 12%, transparent)' } : undefined}
            >
              <span className={`flex-shrink-0 grid size-7 place-items-center rounded-full border text-[12.5px] font-bold ${
                isCorrect ? 'border-psuccess text-psuccess'
                : isWrongPick ? 'border-pdanger text-pdanger'
                : selected ? 'border-ppurple text-ppurple'
                : 'border-plineStrong text-pmuted'
              }`}>
                {LETTERS[i]}
              </span>
              <span className="flex-1 text-[14px] leading-snug">{opt.text}</span>
              {review && isCorrect && <Check size={16} strokeWidth={2.5} className="flex-shrink-0 text-psuccess" />}
              {review && isWrongPick && <X size={16} strokeWidth={2.5} className="flex-shrink-0 text-pdanger" />}
            </button>
          )
        })}
      </div>
    </TaskShell>
  )
}

// ── 2. MATCHING ─────────────────────────────────────────────────────────────

export function MatchingTaskView({ task, num, value, onChange, review, hint }: {
  task: AiTestMatchingTaskPublic
  num: number
  value: Record<string, string> | undefined
  onChange?: (leftId: string, rightId: string) => void
  review?: AiTestGrading['matching'][string]
  hint: string
}) {
  return (
    <TaskShell num={num} topic={task.topic} prompt={task.prompt}>
      <p className="text-[12px] text-psubtle mb-3">{hint}</p>
      <div className="flex flex-col gap-3">
        {task.left.map((l, li) => {
          const chosen = value?.[l.id]
          const correctRight = review?.correctMapping[l.id]
          const rowCorrect = review ? chosen === correctRight : undefined
          return (
            <div key={l.id} className="rounded-control border border-pline bg-psurface p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="flex-shrink-0 text-[13px] font-bold text-ppurple">{li + 1}.</span>
                <p className="flex-1 text-[14px] text-pfg leading-snug">{l.text}</p>
                {review && rowCorrect !== undefined && <ReviewMark correct={!!rowCorrect} />}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {task.right.map((r, ri) => {
                  const isChosen = chosen === r.id
                  const isCorrectOpt = review && correctRight === r.id
                  let cls = 'border-plineStrong text-pmuted'
                  if (review) {
                    if (isCorrectOpt) cls = 'border-psuccess text-psuccess'
                    else if (isChosen) cls = 'border-pdanger text-pdanger line-through'
                  } else if (isChosen) {
                    cls = 'border-ppurple text-ppurple font-bold'
                  }
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={!!review || !onChange}
                      onClick={() => onChange?.(l.id, r.id)}
                      title={r.text}
                      className={`grid size-9 place-items-center rounded-control border bg-pcard text-[13px] transition-[border-color,transform] duration-[120ms] ease-out ${cls} ${!review ? 'active:scale-[0.95]' : ''} disabled:cursor-default`}
                    >
                      {LETTERS[ri]}
                    </button>
                  )
                })}
              </div>
              {/* O'ng kolonka matnlari (bir marta, birinchi qatorda to'liq) */}
            </div>
          )
        })}
      </div>
      {/* O'ng kolonka ro'yxati */}
      <div className="mt-3 rounded-control border border-pline bg-pcanvas p-3">
        {task.right.map((r, ri) => (
          <p key={r.id} className="text-[13px] text-pmuted leading-relaxed">
            <span className="font-bold text-ppurple">{LETTERS[ri]}</span> — {r.text}
          </p>
        ))}
      </div>
    </TaskShell>
  )
}

// ── 3. SHORT ANSWER ─────────────────────────────────────────────────────────

export function ShortTaskView({ task, num, value, onChange, review, yourAnswerLabel, correctAnswerLabel }: {
  task: AiTestShortTaskPublic
  num: number
  value: string | undefined
  onChange?: (text: string) => void
  review?: AiTestGrading['short'][string]
  yourAnswerLabel: string
  correctAnswerLabel: string
}) {
  return (
    <TaskShell num={num} topic={task.topic} prompt={task.prompt}>
      {review ? (
        <div className="flex flex-col gap-2 text-[14px]">
          <div className="flex items-center gap-2">
            <ReviewMark correct={review.correct} />
            <p className="text-psubtle">{yourAnswerLabel}: <span className={`font-semibold ${review.correct ? 'text-psuccess' : 'text-pdanger'}`}>{value?.trim() || '—'}</span></p>
          </div>
          {!review.correct && (
            <p className="text-psubtle">{correctAnswerLabel}: <span className="font-semibold text-psuccess">{review.acceptedAnswers[0]}</span></p>
          )}
        </div>
      ) : (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          maxLength={300}
          className="w-full rounded-control border border-plineStrong bg-psurface px-3.5 py-2.5 text-[14px] text-pfg placeholder:text-psubtle focus:outline-none focus:ring-2 focus:ring-ppurple"
          placeholder="…"
        />
      )}
    </TaskShell>
  )
}

// ── 4. ESSAY ────────────────────────────────────────────────────────────────

export function EssayTaskView({ task, num, value, onChange, review, placeholder, wordsLabel }: {
  task: AiTestEssayTaskPublic
  num: number
  value: string
  onChange?: (text: string) => void
  review?: AiTestGrading['essay']
  placeholder: string
  wordsLabel: string
}) {
  const wordCount = (value.trim().match(/\S+/g) ?? []).length
  const inRange = wordCount >= task.minWords && wordCount <= task.maxWords
  return (
    <TaskShell num={num} topic={task.topic} prompt={task.prompt}>
      {review !== undefined ? (
        <div className="flex flex-col gap-2">
          {review ? (
            <>
              <p className="text-[14px] text-pfg">
                <span className="text-[22px] font-bold text-ppurple">{review.score}</span>
                <span className="text-psubtle"> / 10</span>
              </p>
              {review.feedback && (
                <p className="text-[13.5px] text-pmuted leading-relaxed whitespace-pre-wrap">{review.feedback}</p>
              )}
            </>
          ) : null}
        </div>
      ) : (
        <>
          <textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            rows={9}
            maxLength={10_000}
            className="w-full rounded-control border border-plineStrong bg-psurface px-3.5 py-3 text-[14px] text-pfg leading-relaxed placeholder:text-psubtle focus:outline-none focus:ring-2 focus:ring-ppurple resize-y"
            placeholder={placeholder}
          />
          <p className={`mt-1.5 text-right text-[12px] font-medium ${inRange ? 'text-psuccess' : 'text-psubtle'}`}>
            {wordCount} / {task.minWords}–{task.maxWords} {wordsLabel}
          </p>
        </>
      )}
    </TaskShell>
  )
}
