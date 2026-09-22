import { useState } from 'react'
import {
  X,
  Plus,
  Trash2,
  Pin,
  Search,
  BookOpen,
  StickyNote,
  Download,
  FileText,
  Check,
} from 'lucide-react'
import { WonderSectionNotebookIcon } from './WonderIcons'
import { useWonderStore } from '../store/useWonderStore'
import { haptics } from '../../../platform/haptics'
import {
  generateAnkiTsv,
  generateCourseMarkdownConspectus,
  copyTextToClipboard,
} from '../lib/exportUtils'
import type { WonderCourse, WonderLessonNode } from '../types'

interface WonderNotesDrawerProps {
  course: WonderCourse
  activeLesson?: WonderLessonNode | null
}

export default function WonderNotesDrawer({ course, activeLesson }: WonderNotesDrawerProps) {
  const isNotesDrawerOpen = useWonderStore((s) => s.isNotesDrawerOpen)
  const setNotesDrawerOpen = useWonderStore((s) => s.setNotesDrawerOpen)
  const lessonNotes = useWonderStore((s) => s.lessonNotes)
  const addLessonNote = useWonderStore((s) => s.addLessonNote)
  const deleteLessonNote = useWonderStore((s) => s.deleteLessonNote)
  const addCanvasCard = useWonderStore((s) => s.addCanvasCard)

  const lessonId = activeLesson?.id || course.sections[0]?.lessons[0]?.id || course.id
  const lessonTitle = activeLesson?.title || course.title

  const [activeTab, setActiveTab] = useState<'notes' | 'concepts'>('notes')
  const [newNoteText, setNewNoteText] = useState('')
  const [conceptFilter, setConceptFilter] = useState('')
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null)

  const notesList = lessonNotes[lessonId] || []

  const showCopyToast = (message: string) => {
    setCopiedNotification(message)
    setTimeout(() => {
      setCopiedNotification(null)
    }, 2800)
  }

  const handleExportAnki = async () => {
    haptics.selection()
    const tsv = generateAnkiTsv(course)
    const success = await copyTextToClipboard(tsv)
    if (success) {
      haptics.notify('success')
      showCopyToast("Anki TSV nusxalandi! (Anki > Import orqali yuklang)")
    } else {
      haptics.notify('error')
    }
  }

  const handleExportConspectus = async () => {
    haptics.selection()
    const md = generateCourseMarkdownConspectus(course, lessonNotes)
    const success = await copyTextToClipboard(md)
    if (success) {
      haptics.notify('success')
      showCopyToast("Kurs konspekti (Markdown) nusxalandi!")
    } else {
      haptics.notify('error')
    }
  }

  // Extract all keywords across the course
  const allCourseConcepts = course.sections.flatMap((sec) =>
    sec.lessons.flatMap((les) =>
      les.pages.flatMap((page) =>
        (page.keywords || []).map((kw) => ({
          ...kw,
          lessonTitle: les.title,
        })),
      ),
    ),
  )

  const filteredConcepts = allCourseConcepts.filter(
    (c) =>
      c.word.toLowerCase().includes(conceptFilter.toLowerCase()) ||
      c.definition.toLowerCase().includes(conceptFilter.toLowerCase()),
  )

  if (!isNotesDrawerOpen) return null

  const handleCreateNote = () => {
    if (!newNoteText.trim()) return
    addLessonNote(lessonId, newNoteText.trim())
    setNewNoteText('')
    haptics.notify('success')
  }

  const handlePinNoteToCanvas = (text: string) => {
    addCanvasCard(course.id, {
      title: `Note: ${lessonTitle}`,
      content: text,
      category: 'core',
      color: '#FEF9C3',
      x: 100 + Math.random() * 120,
      y: 100 + Math.random() * 120,
    })
    haptics.notify('success')
  }

  const handlePinConceptToCanvas = (word: string, def: string) => {
    addCanvasCard(course.id, {
      title: word,
      content: def,
      category: 'insight',
      color: '#E0F2FE',
      x: 140 + Math.random() * 140,
      y: 140 + Math.random() * 140,
    })
    haptics.notify('success')
  }

  return (
    <div className="fixed inset-y-0 right-0 top-[var(--safe-top,0px)] z-[60] w-full sm:w-[420px] bg-[#FFFDF8] dark:bg-[#1E1512] border-l border-stone-200/90 dark:border-stone-800 shadow-2xl flex flex-col font-sans select-none animate-in slide-in-from-right-4 duration-200">
      {/* Header (1:1 with authentic Wondering Notes Drawer) */}
      <div className="flex items-center justify-between p-4 border-b border-stone-200/80 dark:border-stone-800 shrink-0 bg-[#FBF9F4] dark:bg-[#18110F]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-2xl bg-[#EBE7DE] dark:bg-stone-800 border border-stone-300/70 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 shrink-0">
            <WonderSectionNotebookIcon size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-serif leading-tight">
              Notes & Saved Concepts
            </h2>
            <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
              {lessonTitle}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setNotesDrawerOpen(false)}
          title="Close notes"
          aria-label="Close notes"
          className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center p-2 gap-1.5 border-b border-stone-200/60 dark:border-stone-800/80 bg-[#FFFDF8] dark:bg-[#1E1512] shrink-0 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'notes'
              ? 'bg-[#EBE7DE] dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold shadow-2xs'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <StickyNote size={14} />
          <span>My Notes ({notesList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('concepts')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'concepts'
              ? 'bg-[#EBE7DE] dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold shadow-2xs'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <BookOpen size={14} />
          <span>Concepts ({allCourseConcepts.length})</span>
        </button>
      </div>

      {/* Export Toolbar */}
      <div className="px-3 py-2 border-b border-stone-200/60 dark:border-stone-800/80 bg-[#FAF8F2] dark:bg-[#18110F] flex items-center justify-between gap-2 shrink-0">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
          Eksport:
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportAnki}
            title="Anki uchun TSV formatida nusxalash"
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-300/80 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-all flex items-center gap-1 cursor-pointer"
          >
            <Download size={11} />
            <span>Anki (.tsv)</span>
          </button>
          <button
            type="button"
            onClick={handleExportConspectus}
            title="Kurs konspektini to'liq Markdown formatida nusxalash"
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 border border-stone-300/80 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all flex items-center gap-1 cursor-pointer"
          >
            <FileText size={11} />
            <span>Konspekt (.md)</span>
          </button>
        </div>
      </div>

      {/* Copy notification toast */}
      {copiedNotification && (
        <div className="mx-3 mt-2 p-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm animate-in fade-in slide-in-from-top-1 duration-150 shrink-0">
          <Check size={14} className="stroke-[3]" />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* Tab Content: Personal Notes */}
      {activeTab === 'notes' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-4 space-y-4">
          {/* Notes List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {notesList.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-stone-400 dark:text-stone-500 space-y-2">
                <StickyNote size={32} strokeWidth={1.5} />
                <p className="text-xs max-w-xs leading-relaxed">
                  No notes for this lesson yet. Jot down takeaways, key realizations, or personal analogies.
                </p>
              </div>
            ) : (
              notesList.map((note, idx) => (
                <div
                  key={idx}
                  className="group relative p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800/70 border border-stone-200/80 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 space-y-2 shadow-2xs animate-in fade-in"
                >
                  <p className="whitespace-pre-wrap leading-relaxed select-text">{note}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-stone-200/50 dark:border-stone-700/50 text-[11px] text-stone-400">
                    <span>Note #{idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePinNoteToCanvas(note)}
                        className="hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-0.5 cursor-pointer"
                        title="Pin to Spatial Canvas"
                      >
                        <Pin size={11} />
                        <span>Canvas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLessonNote(lessonId, idx)}
                        className="hover:text-red-500 p-0.5 cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* New Note Input Box */}
          <div className="pt-2 border-t border-stone-200/70 dark:border-stone-800 space-y-2 pb-[calc(1rem+var(--safe-bottom,0px))]">
            <textarea
              rows={2}
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Add a new personal note..."
              className="w-full p-2.5 rounded-xl border border-stone-200/90 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-hidden resize-none font-medium"
            />
            <button
              type="button"
              disabled={!newNoteText.trim()}
              onClick={handleCreateNote}
              className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                newNoteText.trim()
                  ? 'bg-[#59B2E6] hover:bg-[#4EA5D9] text-[#261312] shadow-[0_3px_0_0_#2B8FD0] active:translate-y-0.5 active:shadow-none'
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed'
              }`}
            >
              <Plus size={14} />
              <span>ADD NOTE</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab Content: Saved Concepts & Glossary */}
      {activeTab === 'concepts' && (
        <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3 pb-[calc(1rem+var(--safe-bottom,0px))]">
          {/* Search Filter */}
          <div className="relative shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={conceptFilter}
              onChange={(e) => setConceptFilter(e.target.value)}
              placeholder="Search concepts or mental models..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-stone-200/90 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-hidden font-medium"
            />
          </div>

          {/* Concepts List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {filteredConcepts.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-center text-xs text-stone-400">
                No matching concepts found.
              </div>
            ) : (
              filteredConcepts.map((kw, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800/70 border border-stone-200/80 dark:border-stone-700 space-y-1 text-xs shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 leading-snug">
                      {kw.word}
                    </h4>
                    <button
                      type="button"
                      onClick={() => handlePinConceptToCanvas(kw.word, kw.definition)}
                      title="Pin to Spatial Canvas"
                      className="text-stone-400 hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-0.5 text-[11px] shrink-0 cursor-pointer"
                    >
                      <Pin size={12} />
                      <span>Canvas</span>
                    </button>
                  </div>
                  <p className="text-stone-600 dark:text-stone-300 text-[11px] leading-relaxed">
                    {kw.definition}
                  </p>
                  <div className="pt-1 text-[10px] text-stone-400 font-medium">
                    From: {kw.lessonTitle}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
