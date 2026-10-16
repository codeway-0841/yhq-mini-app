import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Play, CheckCircle2, Sparkles, BookOpen, Clock, Lock } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useT } from '../../shared/i18n'
import { CoinIcon } from '../../shared/components/CoinIcon'
import { SUBJECT_BASES } from '../../../shared/subjects'
import { INTERACTIVE_BOOKS, type InteractiveChapter } from './interactive-registry'
import { InteractiveLessonModal } from './InteractiveLessonModal'

export default function InteractiveLessonsPage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const user = useAppStore((s) => s.user)
  const currentSubject = useSubjectStore((s) => s.subject)
  const tt = useT(lang)

  // Selected subject in the interactive reader (defaults to current subject or fizika)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    return INTERACTIVE_BOOKS[currentSubject.id] ? currentSubject.id : 'fizika'
  })

  // Modal player state
  const [activeModal, setActiveModal] = useState<{ path: string; title: string } | null>(null)

  const doneList = useLessonsStore((s) => (user?.id ? s.byUser[user.id]?.[999] ?? [] : []))
  const book = INTERACTIVE_BOOKS[selectedSubjectId]

  const openChapter = (ch: InteractiveChapter) => {
    setActiveModal({
      path: ch.path,
      title: `${ch.number}-Bob: ${lang === 'ru' ? ch.titleRu : ch.titleUz}`
    })
  }

  const openCatalog = () => {
    if (!book) return
    setActiveModal({
      path: book.catalogPath,
      title: lang === 'ru' ? book.nameRu : book.nameUz
    })
  }

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-4 pb-20 animate-fadeIn">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-psurface text-pfg shadow-2xs hover:bg-pcard active:scale-95 transition-all text-sm font-medium cursor-pointer"
        >
          <ChevronLeft size={18} />
          <span>{lang === 'ru' ? 'Назад' : 'Orqaga'}</span>
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-semibold">
          <Sparkles size={14} />
          <span>{tt('interactiveLessons')}</span>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#162032] via-[#0f1724] to-[#0a1019] text-white p-6 mb-6 border border-white/10 shadow-lg">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3 border border-blue-500/30">
            <span>3Blue1Brown Uslubi</span>
            <span>•</span>
            <span>Diktor Ovozi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            {lang === 'ru' ? 'Интерактивные Анимированные Уроки' : 'Interaktiv Animatsion Darslik'}
          </h1>
          <p className="text-sm sm:text-base text-gray-300 mb-5 leading-relaxed">
            {lang === 'ru'
              ? 'Изучайте фундаментальные законы через визуальные динамические модели, математические доказательства и интерактивные тесты.'
              : "Fizika va boshqa fanlarning eng murakkab mavzularini jonli animatsiyalar, diktor ovozi va sinovlar orqali o'rganing."}
          </p>

          {book && (
            <button
              onClick={openCatalog}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-md hover:brightness-110 active:scale-95 transition-all text-sm cursor-pointer"
            >
              <BookOpen size={16} />
              <span>{lang === 'ru' ? 'Открыть оглавление' : 'Mundarijani ochish'}</span>
            </button>
          )}
        </div>

        {/* Decorative backdrop glow */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
      </div>

      {/* Subject Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-6">
        {SUBJECT_BASES.map((sub) => {
          const hasBook = !!INTERACTIVE_BOOKS[sub.id]
          const isSelected = selectedSubjectId === sub.id

          return (
            <button
              key={sub.id}
              onClick={() => setSelectedSubjectId(sub.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer border ${
                isSelected
                  ? 'bg-pprimary text-ponprimary border-pprimary shadow-sm'
                  : 'bg-psurface text-pfg border-pline hover:bg-pcard'
              }`}
            >
              <span>{sub.icon}</span>
              <span>{lang === 'ru' ? sub.nameRu : sub.name}</span>
              {hasBook && (
                <span className={`size-2 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Active Subject Content */}
      {book ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-pfg">
                {lang === 'ru' ? book.nameRu : book.nameUz}
              </h2>
              <p className="text-xs text-pmuted">
                {book.chapters.length} {lang === 'ru' ? 'интерактивных глав доступно' : 'ta jonli bob mavjud'}
              </p>
            </div>

            <button
              onClick={openCatalog}
              className="text-xs font-semibold text-pprimary hover:underline cursor-pointer"
            >
              {lang === 'ru' ? 'Все главы →' : "Barcha boblar →"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {book.chapters.map((ch) => {
              const isDone = doneList.includes(ch.number)

              return (
                <div
                  key={ch.key}
                  className="flex flex-col justify-between p-5 rounded-2xl bg-pcard hover:bg-psurface transition-all shadow-xs group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400">
                        {ch.number}-{lang === 'ru' ? 'Глава' : 'Bob'}
                      </span>

                      <div className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-md">
                        <CoinIcon size={13} />
                        <span>+25</span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-pfg mb-2 group-hover:text-pprimary transition-colors">
                      {lang === 'ru' ? ch.titleRu : ch.titleUz}
                    </h3>
                  </div>

                  <div className="mt-4 pt-3 border-t border-pline flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-pmuted">
                      <Clock size={14} />
                      <span>{ch.minutes} {lang === 'ru' ? 'мин' : 'daqiqa'}</span>
                    </div>

                    <button
                      onClick={() => openChapter(ch)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                        isDone
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20'
                          : 'bg-pprimary text-ponprimary shadow-xs hover:brightness-105'
                      }`}
                    >
                      {isDone ? (
                        <>
                          <CheckCircle2 size={14} />
                          <span>{lang === 'ru' ? 'Пройдено' : 'Yakunlangan'}</span>
                        </>
                      ) : (
                        <>
                          <Play size={14} className="fill-current" />
                          <span>{lang === 'ru' ? 'Начать' : 'Boshlash'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Empty State for subjects without interactive books yet */
        <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-psurface border border-dashed border-pline text-center">
          <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
            <Lock size={26} />
          </div>
          <h3 className="text-base font-bold text-pfg mb-1">
            {lang === 'ru' ? 'Скоро появится' : 'Tez kunda chiqadi'}
          </h3>
          <p className="text-xs text-pmuted max-w-sm mb-4">
            {lang === 'ru'
              ? 'Интерактивные анимированные уроки для этого предмета находятся в процессе озвучки и подготовки.'
              : "Bu fan bo'yicha ovozli va animatsion darsliklar montaj jarayonida. Hozircha Fizika darslarini ko'rishingiz mumkin."}
          </p>
          <button
            onClick={() => setSelectedSubjectId('fizika')}
            className="px-4 py-2 rounded-xl bg-pprimary text-ponprimary text-xs font-semibold cursor-pointer active:scale-95 transition-all"
          >
            ⚡ {lang === 'ru' ? 'Перейти к Физике' : "Fizika darslarini ochish"}
          </button>
        </div>
      )}

      {/* Fullscreen Interactive Lesson Modal */}
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
