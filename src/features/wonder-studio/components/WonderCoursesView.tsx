import { useState, useRef, useEffect } from 'react'
import {
  Search,
  ChevronDown,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Download,
  BookOpen,
} from 'lucide-react'
import WonderCourseOverviewView from './WonderCourseOverviewView'
import { useWonderStore } from '../store/useWonderStore'
import type { WonderCourse, WonderLessonNode } from '../types'

interface WonderCoursesViewProps {
  courses: WonderCourse[]
  activeCourse?: WonderCourse
  onStartLearning: () => void
  onPreviewLesson?: (lesson: WonderLessonNode) => void
}

/**
 * 1:1 Authentic PublicCourseCard from wondering.app
 * Exact aspect-[3/2], subtle 3D hover scale, dark vignette and compact lesson pills.
 */
function PublicCourseCard({
  course,
  metricBadge,
  onSelect,
}: {
  course: WonderCourse
  metricBadge?: { type: 'trend' | 'download'; value: string }
  onSelect: () => void
}) {
  const totalLessons = course.sections.reduce(
    (acc, s) => acc + s.lessons.length,
    0,
  )

  return (
    <div
      onClick={onSelect}
      className="group relative aspect-[3/2] rounded-2xl transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 cursor-pointer select-none"
    >
      <div className="relative block size-full overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#FAF8F2] dark:bg-stone-900 transition-[border-color] duration-300 hover:border-stone-400 dark:hover:border-stone-700">
        {course.localCoverImage || course.coverImage ? (
          <img
            src={course.localCoverImage || course.coverImage}
            alt={course.title}
            className="object-cover size-full group-hover:scale-[1.03] transition-transform duration-300 motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-900">
            <BookOpen className="size-8 text-stone-400" />
          </div>
        )}

        {/* Top-Left Metric Badge */}
        {metricBadge && (
          <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-xs border border-white/10 shadow-2xs">
            {metricBadge.type === 'trend' ? (
              <TrendingUp className="size-3.5 text-emerald-400" />
            ) : (
              <Download className="size-3.5 text-sky-300" />
            )}
            <span>{metricBadge.value}</span>
          </span>
        )}

        {/* Bottom Vignette & Typography */}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/25 to-transparent p-3 text-white">
          <h3 dir="auto" className="line-clamp-2 text-sm font-semibold leading-snug">
            {course.title}
          </h3>
          <div className="mt-1 flex items-baseline gap-2 text-xs text-stone-200">
            <span className="truncate font-medium">
              by <span dir="auto">{course.author || 'Wondering'}</span>
            </span>
            <span className="ml-auto shrink-0 opacity-80">
              {totalLessons} lessons
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 1:1 Authentic PublicCourseRow from wondering.app
 * Edge gradients, snap-proximity carousel, and floating smooth scroll arrows.
 */
function PublicCourseRow({
  title,
  badge,
  headerIcon,
  courses,
  onSelectCourse,
  metricType = 'trend',
}: {
  title: string
  badge?: string
  headerIcon?: React.ReactNode
  courses: WonderCourse[]
  onSelectCourse: (c: WonderCourse) => void
  metricType?: 'trend' | 'download'
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollState, setScrollState] = useState({
    overflow: false,
    left: false,
    right: false,
  })

  const updateScrollState = () => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setScrollState({
      overflow: maxScroll > 2,
      left: maxScroll > 2 && el.scrollLeft > 2,
      right: maxScroll > 2 && el.scrollLeft < maxScroll - 2,
    })
  }

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [courses.length])

  const handleScroll = (direction: -1 | 1) => {
    const el = scrollRef.current
    if (el) {
      el.scrollBy({
        left: direction * Math.max(280, el.clientWidth * 0.75),
        behavior: 'smooth',
      })
    }
  }

  if (courses.length === 0) return null

  const trendDeltas = [
    '+22 this week',
    '+18 this week',
    '+15 this week',
    '+12 this week',
    '+9 this week',
    '+6 this week',
  ]

  return (
    <section className="space-y-3">
      {/* Row Header */}
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          {headerIcon}
          <h2 className="truncate text-xl font-semibold text-stone-900 dark:text-stone-100">
            {title}
          </h2>
          {badge && (
            <span className="shrink-0 rounded-full bg-stone-200/70 dark:bg-stone-800 px-2.5 py-0.5 text-xs font-medium text-stone-600 dark:text-stone-400">
              {badge}
            </span>
          )}
        </div>

        {courses.length > 2 && (
          <button
            type="button"
            className="shrink-0 uppercase font-mono text-xs font-bold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 tracking-wider transition-colors cursor-pointer"
          >
            View all
          </button>
        )}
      </div>

      {/* Snap Carousel Container with Edge Gradient Fades */}
      <div role="group" className="relative">
        <div
          ref={scrollRef}
          className="no-scrollbar flex snap-x snap-proximity gap-4 overflow-x-auto pb-3 pt-2 sm:px-0 px-4 scroll-smooth"
        >
          {courses.map((course, idx) => (
            <div
              key={course.id}
              className="w-[62vw] max-w-[240px] shrink-0 snap-start sm:w-[240px]"
            >
              <PublicCourseCard
                course={course}
                metricBadge={{
                  type: metricType,
                  value:
                    metricType === 'trend'
                      ? trendDeltas[idx % trendDeltas.length]
                      : `${1250 - idx * 90}`,
                }}
                onSelect={() => onSelectCourse(course)}
              />
            </div>
          ))}
        </div>

        {/* Left & Right Edge Fades (Scraped directly from Wondering) */}
        {scrollState.left && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r from-[#FFFCF0] dark:from-[#261312] via-[#FFFCF0]/50 dark:via-[#261312]/50 to-transparent sm:block z-10"
          />
        )}
        {scrollState.right && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-[#FFFCF0] dark:from-[#261312] via-[#FFFCF0]/50 dark:via-[#261312]/50 to-transparent sm:block z-10"
          />
        )}

        {/* Floating Circular Arrow Buttons */}
        {scrollState.overflow && (
          <>
            {scrollState.left && (
              <div className="absolute left-2 top-1/2 hidden -translate-y-1/2 sm:block z-20">
                <button
                  type="button"
                  onClick={() => handleScroll(-1)}
                  className="flex size-10 items-center justify-center rounded-full border border-stone-200/80 dark:border-stone-800 bg-[#FAF8F2]/90 dark:bg-stone-900/90 text-stone-700 dark:text-stone-300 backdrop-blur-md shadow-md hover:bg-white hover:border-stone-400 transition-all cursor-pointer"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="size-5" />
                </button>
              </div>
            )}
            {scrollState.right && (
              <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 sm:block z-20">
                <button
                  type="button"
                  onClick={() => handleScroll(1)}
                  className="flex size-10 items-center justify-center rounded-full border border-stone-200/80 dark:border-stone-800 bg-[#FAF8F2]/90 dark:bg-stone-900/90 text-stone-700 dark:text-stone-300 backdrop-blur-md shadow-md hover:bg-white hover:border-stone-400 transition-all cursor-pointer"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default function WonderCoursesView({
  courses,
  activeCourse: _activeCourse,
  onStartLearning,
  onPreviewLesson,
}: WonderCoursesViewProps) {
  const setActiveCourse = useWonderStore((s) => s.setActiveCourse)

  // Selected course for dedicated overview display
  const [viewingCourse, setViewingCourse] = useState<WonderCourse | null>(null)

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All categories')
  const [selectedLanguage, setSelectedLanguage] = useState('All languages')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false)

  // If user selected a specific course to inspect, show 1:1 Course Overview!
  if (viewingCourse) {
    return (
      <WonderCourseOverviewView
        course={viewingCourse}
        onStartLearning={onStartLearning}
        onPreviewLesson={onPreviewLesson}
        onBackToCatalog={() => setViewingCourse(null)}
      />
    )
  }

  // Filter courses by search
  const filterByQuery = (list: WonderCourse[]) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return list
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.author?.toLowerCase().includes(q),
    )
  }

  const trendingCourses = filterByQuery(
    courses.slice(0, 6).length ? courses.slice(0, 6) : courses,
  )

  const softwareCourses = filterByQuery(
    courses.filter(
      (c) =>
        c.category === 'Software Engineering' ||
        c.title.toLowerCase().includes('whatsapp') ||
        c.title.toLowerCase().includes('architecture') ||
        c.title.toLowerCase().includes('cdn') ||
        c.title.toLowerCase().includes('lifecycle') ||
        c.title.toLowerCase().includes('azure'),
    ),
  )

  const aiCourses = filterByQuery(
    courses.filter(
      (c) =>
        c.category === 'AI & Data' ||
        c.title.toLowerCase().includes('llm') ||
        c.title.toLowerCase().includes('ai') ||
        c.title.toLowerCase().includes('data'),
    ),
  )

  const designCourses = filterByQuery(
    courses.filter(
      (c) =>
        c.category === 'Product & Design' ||
        c.title.toLowerCase().includes('design') ||
        c.title.toLowerCase().includes('mom test') ||
        c.title.toLowerCase().includes('creative'),
    ),
  )

  const productivityCourses = filterByQuery(
    courses.filter(
      (c) =>
        c.category === 'Productivity' ||
        c.title.toLowerCase().includes('psychology') ||
        c.title.toLowerCase().includes('learn') ||
        c.title.toLowerCase().includes('rubik') ||
        c.title.toLowerCase().includes('investing') ||
        c.title.toLowerCase().includes('question'),
    ),
  )

  const handleSelectCourse = (course: WonderCourse) => {
    setActiveCourse(course.id)
    setViewingCourse(course)
  }

  return (
    <div className="max-w-6xl mx-auto py-4 font-sans select-none space-y-10 animate-in fade-in duration-150">
      {/* 1:1 Hero Header with Serif Title from explore_desktop.png */}
      <div className="text-center space-y-2 pt-2">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight">
          Explore shared courses
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-xl mx-auto">
          Browse courses shared by learners across the community and try it out.
        </p>
      </div>

      {/* 1:1 Filters Bar from explore_desktop.png */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 shadow-2xs"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2 relative">
          {/* Category Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCategoryDropdownOpen(!categoryDropdownOpen)
                setLanguageDropdownOpen(false)
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 shadow-2xs hover:bg-stone-50 cursor-pointer"
            >
              <span>{selectedCategory}</span>
              <ChevronDown size={14} className="text-stone-400" />
            </button>

            {categoryDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setCategoryDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-lg p-1.5 space-y-1 z-40 text-xs">
                  {[
                    'All categories',
                    'Software Engineering',
                    'AI & Data',
                    'Product & Design',
                    'Productivity',
                  ].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat)
                        setCategoryDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg font-medium ${
                        selectedCategory === cat
                          ? 'bg-amber-100 dark:bg-stone-800 font-bold'
                          : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Language Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setLanguageDropdownOpen(!languageDropdownOpen)
                setCategoryDropdownOpen(false)
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 shadow-2xs hover:bg-stone-50 cursor-pointer"
            >
              <span>{selectedLanguage}</span>
              <ChevronDown size={14} className="text-stone-400" />
            </button>

            {languageDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setLanguageDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-40 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-lg p-1.5 space-y-1 z-40 text-xs">
                  {['All languages', 'English', "O'zbekcha", 'Русский'].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => {
                        setSelectedLanguage(lang)
                        setLanguageDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg font-medium ${
                        selectedLanguage === lang
                          ? 'bg-amber-100 dark:bg-stone-800 font-bold'
                          : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 1: 📈 Trending */}
      {(selectedCategory === 'All categories' || selectedCategory === 'Trending') && (
        <PublicCourseRow
          title="Trending"
          badge="This week"
          headerIcon={
            <TrendingUp className="size-5 shrink-0 text-stone-900 dark:text-stone-100" />
          }
          courses={trendingCourses}
          onSelectCourse={handleSelectCourse}
          metricType="trend"
        />
      )}

      {/* Row 2: Software Engineering */}
      {(selectedCategory === 'All categories' || selectedCategory === 'Software Engineering') && (
        <PublicCourseRow
          title="Software Engineering"
          badge={`${softwareCourses.length * 15} courses`}
          courses={softwareCourses}
          onSelectCourse={handleSelectCourse}
          metricType="download"
        />
      )}

      {/* Row 3: AI & Data */}
      {(selectedCategory === 'All categories' || selectedCategory === 'AI & Data') && (
        <PublicCourseRow
          title="AI & Data"
          badge={`${aiCourses.length * 12} courses`}
          courses={aiCourses}
          onSelectCourse={handleSelectCourse}
          metricType="trend"
        />
      )}

      {/* Row 4: Product & Design */}
      {(selectedCategory === 'All categories' || selectedCategory === 'Product & Design') && (
        <PublicCourseRow
          title="Product & Design"
          badge={`${designCourses.length * 8} courses`}
          courses={designCourses}
          onSelectCourse={handleSelectCourse}
          metricType="download"
        />
      )}

      {/* Row 5: Productivity */}
      {(selectedCategory === 'All categories' || selectedCategory === 'Productivity') && (
        <PublicCourseRow
          title="Productivity"
          badge={`${productivityCourses.length * 9} courses`}
          courses={productivityCourses}
          onSelectCourse={handleSelectCourse}
          metricType="trend"
        />
      )}
    </div>
  )
}
