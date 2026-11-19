import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, CheckCircle2, BookOpen, Clock, Lock } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useT } from '../../shared/i18n'
import { CoinIcon } from '../../shared/components/CoinIcon'
import { Button } from '../../shared/components/ui/button'
import { PageHeader } from '../../shared/components/ui/page-header'
import { BrilliantSparkle } from '../../shared/components/BrilliantLessonChrome'
import { SUBJECT_BASES } from '../../../shared/subjects'
import { INTERACTIVE_BOOKS, type InteractiveChapter } from './interactive-registry'
import { InteractiveLessonModal } from './InteractiveLessonModal'

export default function InteractiveLessonsPage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const user = useAppStore((s) => s.user)
  const currentSubject = useSubjectStore((s) => s.subject)
  const tt = useT(lang)
  const isRu = lang === 'ru'

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    return INTERACTIVE_BOOKS[currentSubject.id] ? currentSubject.id : 'fizika'
  })

  const [activeModal, setActiveModal] = useState<{ path: string; title: string } | null>(null)

  const doneList = useLessonsStore((s) => (user?.id ? s.byUser[user.id]?.[999] ?? [] : []))
  const book = INTERACTIVE_BOOKS[selectedSubjectId]

  const openChapter = (ch: InteractiveChapter) => {
    setActiveModal({
      path: ch.path,
      title: `${ch.number}-${isRu ? 'Глава' : 'Bob'}: ${isRu ? ch.titleRu : ch.titleUz}`,
    })
  }

  const openCatalog = () => {
    if (!book) return
    setActiveModal({
      path: book.catalogPath,
      title: isRu ? book.nameRu : book.nameUz,
    })
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-pcanvas text-pfg">
      <PageHeader
        title={tt('interactiveLessons')}
        onBack={() => navigate(-1)}
        backLabel={isRu ? 'Назад' : 'Orqaga'}
      />

      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pb-[calc(5.5rem+var(--safe-bottom,0px))] pt-2">
        {/* Brilliant 1:1 Hero Card — semantik bg-pcard, gradientsiz va blursiz */}
        <section className="mb-5 rounded-3xl bg-pcard p-5">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-psurface px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wider text-pfg">
            <BrilliantSparkle size={13} />
            <span>{isRu ? 'Визуальный формат · Аудио' : 'Vizual format · Ovozli'}</span>
          </div>

          <h2 className="font-display text-[23px] font-extrabold leading-tight tracking-tight text-pfg">
            {isRu ? 'Интерактивные анимированные уроки' : 'Interaktiv animatsion darslik'}
          </h2>

          <p className="mt-2 text-[14.5px] leading-relaxed text-pmuted">
            {isRu
              ? 'Изучайте фундаментальные законы через визуальные модели, доказательства и мини-задачи.'
              : 'Murakkab mavzularni jonli vizual modellar, ovozli tushuntirish va amaliy sinovlar orqali o‘rganing.'}
          </p>

          {book && (
            <div className="mt-5">
              <Button variant="primary" size="lg" block onClick={openCatalog}>
                <BookOpen size={18} strokeWidth={2.2} />
                <span>{isRu ? 'Открыть оглавление' : 'Mundarijani ochish'}</span>
              </Button>
            </div>
          )}
        </section>

        {/* Subject Filter Pills */}
        <div className="no-scrollbar mb-5 flex items-center gap-2 overflow-x-auto pb-1">
          {SUBJECT_BASES.map((sub) => {
            const hasBook = !!INTERACTIVE_BOOKS[sub.id]
            const isSelected = selectedSubjectId === sub.id

            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelectedSubjectId(sub.id)}
                className={`flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-bold transition-[background-color,color] duration-150 ${
                  isSelected
                    ? 'bg-pfg text-pcanvas'
                    : 'bg-psurface text-pmuted hover:text-pfg'
                }`}
              >
                <span aria-hidden="true">{sub.icon}</span>
                <span>{isRu ? sub.nameRu : sub.name}</span>
                {hasBook && (
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${isSelected ? 'bg-[#21c65b]' : 'bg-psuccess'}`}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Active Subject Content */}
        {book ? (
          <div>
            <div className="mb-3.5 flex items-end justify-between gap-2 px-0.5">
              <div className="min-w-0">
                <h3 className="truncate font-display text-[18px] font-extrabold tracking-tight text-pfg">
                  {isRu ? book.nameRu : book.nameUz}
                </h3>
                <p className="text-[12.5px] font-medium text-pmuted">
                  {book.chapters.length} {isRu ? 'интерактивных глав' : 'ta jonli bob'}
                </p>
              </div>

              <button
                type="button"
                onClick={openCatalog}
                className="shrink-0 cursor-pointer text-[13px] font-bold text-pprimary hover:underline"
              >
                {isRu ? 'Все главы' : 'Barcha boblar'}
              </button>
            </div>

            <div className="flex flex-col gap-3.5">
              {book.chapters.map((ch) => {
                const isDone = doneList.includes(ch.number)

                return (
                  <article
                    key={ch.key}
                    className="flex flex-col gap-4 rounded-3xl bg-pcard p-5"
                  >
                    <div>
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full bg-psurface px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wider text-pmuted">
                          {ch.number}-{isRu ? 'глава' : 'bob'}
                        </span>

                        <div className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--p-gold-rgb)/0.16)] px-2.5 py-1 text-[12px] font-extrabold tabular-nums text-pgold">
                          <CoinIcon size={13} />
                          <span>+25</span>
                        </div>
                      </div>

                      <h4 className="font-display text-[17px] font-extrabold leading-snug text-pfg">
                        {isRu ? ch.titleRu : ch.titleUz}
                      </h4>

                      <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-pmuted">
                        <Clock size={14} strokeWidth={2} />
                        <span>{ch.minutes} {isRu ? 'мин' : 'daqiqa'}</span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={isDone ? 'secondary' : 'primary'}
                      size="default"
                      block
                      onClick={() => openChapter(ch)}
                    >
                      {isDone ? (
                        <>
                          <CheckCircle2 size={17} strokeWidth={2.4} />
                          <span>{isRu ? 'Пройдено' : 'Yakunlangan'}</span>
                        </>
                      ) : (
                        <>
                          <Play size={16} className="fill-current" />
                          <span>{isRu ? 'Начать' : 'Boshlash'}</span>
                        </>
                      )}
                    </Button>
                  </article>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-psurface p-8 text-center">
            <div className="mb-3 grid size-14 place-items-center rounded-full bg-pcard text-pmuted">
              <Lock size={24} strokeWidth={2} />
            </div>
            <h3 className="font-display text-[17px] font-extrabold text-pfg">
              {isRu ? 'Скоро появится' : 'Tez kunda chiqadi'}
            </h3>
            <p className="mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-pmuted">
              {isRu
                ? 'Интерактивные анимированные уроки для этого предмета готовятся. Пока можно открыть уроки по физике.'
                : 'Bu fan bo‘yicha ovozli va animatsion darsliklar tayyorlanmoqda. Hozircha Fizika darslarini ko‘rishingiz mumkin.'}
            </p>
            <div className="mt-5 w-full max-w-[260px]">
              <Button variant="secondary" block onClick={() => setSelectedSubjectId('fizika')}>
                {isRu ? 'Перейти к Физике' : 'Fizika darslarini ochish'}
              </Button>
            </div>
          </div>
        )}
      </main>

      {activeModal && (
        <InteractiveLessonModal
          path={activeModal.path}
          title={activeModal.title}
          subjectId={selectedSubjectId}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  )
}
