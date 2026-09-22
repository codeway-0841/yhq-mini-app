import { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  FileSearch,
  Layers,
  ClipboardList,
  Sparkles,
  CircleCheck,
  FileJson,
  Copy,
  WandSparkles,
  RefreshCcw,
  Plus,
  Trash2,
  Globe,
  Link2,
  Check,
  Send,
  BookOpen,
  ArrowRight,
} from 'lucide-react'
import {
  GOLDEN_COURSE_STEP_ORDER,
  sampleGoldenCourseRun,
  buildGoldenCourseCodexPrompt,
  buildGoldenCourseStepUpdatePrompt,
  getSelectedVariant,
  isGoldenCourseRun,
  type GoldenCourseRequest,
  type GoldenCourseRun,
  type GoldenCourseStepId,
  type GoldenCourseSource,
} from '../../../../shared/golden-course'
import { api } from '../../../shared/api'
import { haptics } from '../../../platform/haptics'
import { convertAiCourseToWonderCourse } from '../lib/aiCourseAdapter'
import { useWonderStore } from '../store/useWonderStore'

const STORAGE_KEY = 'kivvi:golden-course-workspace:v1'

function createSource(kind: 'topic' | 'url' | 'text'): GoldenCourseSource {
  return {
    id: `src_${Math.random().toString(36).slice(2, 9)}`,
    kind,
    title: '',
    value: '',
    notes: '',
  }
}

function getStepIcon(stepId: string) {
  switch (stepId) {
    case 'course_brief':
      return FileText
    case 'source_pack':
      return FileSearch
    case 'curriculum':
      return Layers
    case 'lesson_specs':
      return ClipboardList
    case 'lesson_packages':
      return Sparkles
    case 'practice_packages':
      return CircleCheck
    case 'publish_bundle':
      return FileJson
    default:
      return FileText
  }
}

export default function GoldenCourseCodexView() {
  const addCustomCourse = useWonderStore((s) => s.addCustomCourse)
  const setActiveCourse = useWonderStore((s) => s.setActiveCourse)
  const setCurrentNav = useWonderStore((s) => s.setCurrentNav)

  const [request, setRequest] = useState<GoldenCourseRequest>(sampleGoldenCourseRun.request)
  const [run, setRun] = useState<GoldenCourseRun | null>(sampleGoldenCourseRun)
  const [rawRunJson, setRawRunJson] = useState<string>(JSON.stringify(sampleGoldenCourseRun, null, 2))
  const [selectedStepId, setSelectedStepId] = useState<GoldenCourseStepId>('course_brief')
  const [stepInstructions, setStepInstructions] = useState<Record<string, string>>({})
  const [isRunningPipeline, setIsRunningPipeline] = useState(false)
  const [isUpdatingStep, setIsUpdatingStep] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Restore workspace from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.request) setRequest(parsed.request)
        if (parsed.rawRunJson) {
          setRawRunJson(parsed.rawRunJson)
          const runObj = JSON.parse(parsed.rawRunJson)
          if (isGoldenCourseRun(runObj)) setRun(runObj)
        }
        if (parsed.selectedStepId) setSelectedStepId(parsed.selectedStepId)
        if (parsed.stepInstructions) setStepInstructions(parsed.stepInstructions)
      }
    } catch {
      // ignore
    }
  }, [])

  // Persist workspace to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          request,
          rawRunJson,
          selectedStepId,
          stepInstructions,
        }),
      )
    } catch {
      // ignore
    }
  }, [request, rawRunJson, selectedStepId, stepInstructions])

  const copyToClipboard = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      haptics.notify('success')
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      // fallback
    }
  }, [])

  const orchestratorPrompt = buildGoldenCourseCodexPrompt(request)
  const activeStep = run?.steps.find((s) => s.id === selectedStepId) || run?.steps[0] || null
  const activeVariant = activeStep ? getSelectedVariant(activeStep) : null
  const currentInstruction = selectedStepId ? stepInstructions[selectedStepId] || '' : ''
  const stepUpdatePrompt =
    run && activeStep
      ? buildGoldenCourseStepUpdatePrompt({
          request,
          run,
          stepId: activeStep.id,
          instruction: currentInstruction,
        })
      : ''

  const countLessons = run?.finalCourse.sections.reduce((acc, s) => acc + s.lessons.length, 0) || 0
  const countPractices =
    run?.finalCourse.sections.reduce(
      (acc, s) => acc + s.lessons.reduce((lAcc, l) => lAcc + l.practices.length, 0),
      0,
    ) || 0

  // Run pipeline via backend API
  const handleRunAiPipeline = async () => {
    if (isRunningPipeline) return
    haptics.impact('medium')
    setIsRunningPipeline(true)
    try {
      const res = await api.runGoldenCoursePipeline(request)
      if (res?.ok && res.run) {
        setRun(res.run)
        setRawRunJson(JSON.stringify(res.run, null, 2))
        haptics.notify('success')
      }
    } catch (err) {
      console.warn('[golden-codex] AI pipeline error:', err)
      // fallback to local deterministic run
      const local = sampleGoldenCourseRun
      setRun(local)
      setRawRunJson(JSON.stringify(local, null, 2))
    } finally {
      setIsRunningPipeline(false)
    }
  }

  // Update specific step via backend API
  const handleUpdateStep = async () => {
    if (!run || !activeStep || isUpdatingStep) return
    haptics.impact('medium')
    setIsUpdatingStep(true)
    try {
      const res = await api.updateGoldenCourseStep({
        request,
        run,
        stepId: activeStep.id,
        instruction: currentInstruction,
      })
      if (res?.ok && res.run) {
        setRun(res.run)
        setRawRunJson(JSON.stringify(res.run, null, 2))
        haptics.notify('success')
      }
    } catch (err) {
      console.warn('[golden-codex] Step update error:', err)
    } finally {
      setIsUpdatingStep(false)
    }
  }

  // Publish course to Wonder Studio
  const handlePublishToStudio = async () => {
    if (!run || isPublishing) return
    haptics.impact('medium')
    setIsPublishing(true)
    try {
      const res = await api.publishGoldenCourse(run)
      if (res?.ok && res.course?.id) {
        const detail = await api.getAiCourse(res.course.id)
        if (detail?.ok && detail.course) {
          const wonderCourse = convertAiCourseToWonderCourse(detail.course)
          addCustomCourse(wonderCourse)
          setActiveCourse(wonderCourse.id)
          setCurrentNav('home')
          haptics.notify('success')
          return
        }
      }
    } catch (err) {
      console.warn('[golden-codex] Publish error:', err)
    } finally {
      setIsPublishing(false)
    }
  }

  // Import JSON from textarea
  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(rawRunJson)
      if (!isGoldenCourseRun(parsed)) {
        throw new Error('JSON does not match golden-course-v0 schema')
      }
      setRun(parsed)
      haptics.notify('success')
    } catch (err) {
      alert((err as Error)?.message || 'Invalid JSON format')
    }
  }

  return (
    <div className="size-full overflow-y-auto bg-[#FBF9F4] dark:bg-[#140E0C] text-stone-900 dark:text-stone-100 p-4 sm:p-6 select-none font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Banner Header */}
        <div className="rounded-3xl border border-[#E7E2D6] dark:border-stone-800 bg-white dark:bg-[#1E1512] p-6 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 items-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs font-mono font-bold uppercase">
                <Sparkles size={13} className="text-amber-600" />
                <span>Wondering Flagship Production Architecture</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100">
                Golden Course Codex Workspace
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 max-w-2xl leading-relaxed">
                7 bosqichli to‘liq avtonom flagship kurs ishlab chiqarish quvuri: Brief, Source Pack,
                Curriculum, Lesson Specs (Misconception Engine), Lesson Packages, Practice Packages va Publish Bundle.
              </p>
            </div>

            {/* Metrics Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800/60 border border-[#E7E2D6] dark:border-stone-800">
                <div className="text-[10px] font-mono uppercase text-stone-400">Sources</div>
                <div className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100 mt-0.5">
                  {request.sources.length}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800/60 border border-[#E7E2D6] dark:border-stone-800">
                <div className="text-[10px] font-mono uppercase text-stone-400">Steps</div>
                <div className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100 mt-0.5">
                  {GOLDEN_COURSE_STEP_ORDER.length}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800/60 border border-[#E7E2D6] dark:border-stone-800">
                <div className="text-[10px] font-mono uppercase text-stone-400">Lessons</div>
                <div className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100 mt-0.5">
                  {countLessons}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800/60 border border-[#E7E2D6] dark:border-stone-800">
                <div className="text-[10px] font-mono uppercase text-stone-400">Practices</div>
                <div className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100 mt-0.5">
                  {countPractices}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Layout: Left Builder / Right Inspector */}
        <div className="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] gap-6 items-start">
          {/* LEFT: Flexible Request Builder & Prompt */}
          <div className="space-y-6">
            {/* 1. Request Builder */}
            <div className="rounded-3xl border border-[#E7E2D6] dark:border-stone-800 bg-white dark:bg-[#1E1512] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                    Input Dossier
                  </span>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    Flexible Request Builder
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRequest(sampleGoldenCourseRun.request)
                    haptics.selection()
                  }}
                  className="p-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-900 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCcw size={13} />
                  <span>Reset</span>
                </button>
              </div>

              {/* Working Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Working Title
                </label>
                <input
                  type="text"
                  value={request.workingTitle || ''}
                  onChange={(e) => setRequest((r) => ({ ...r, workingTitle: e.target.value }))}
                  placeholder="e.g. Reasoning About LLMs"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E2D6] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800/80 text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Course Brief */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Course Brief
                </label>
                <textarea
                  value={request.brief || ''}
                  onChange={(e) => setRequest((r) => ({ ...r, brief: e.target.value }))}
                  placeholder="Leave empty to let Codex infer it from sources..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E2D6] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800/80 text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                />
              </div>

              {/* Source Inputs */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Sources ({request.sources.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setRequest((r) => ({
                          ...r,
                          sources: [...r.sources, createSource('topic')],
                        }))
                      }
                      className="px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Globe size={12} />
                      <span>+ Topic</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRequest((r) => ({
                          ...r,
                          sources: [...r.sources, createSource('url')],
                        }))
                      }
                      className="px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Link2 size={12} />
                      <span>+ URL</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRequest((r) => ({
                          ...r,
                          sources: [...r.sources, createSource('text')],
                        }))
                      }
                      className="px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <FileText size={12} />
                      <span>+ Text</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {request.sources.map((s, idx) => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-2xl border border-[#E7E2D6] dark:border-stone-700/80 bg-[#FAF8F2] dark:bg-stone-800/50 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold uppercase text-stone-500">
                          Source {idx + 1} · {s.kind}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRequest((r) => ({
                              ...r,
                              sources: r.sources.filter((x) => x.id !== s.id),
                            }))
                          }
                          className="p-1 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                          aria-label="Delete source"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <input
                        type="text"
                        value={s.title || ''}
                        onChange={(e) =>
                          setRequest((r) => ({
                            ...r,
                            sources: r.sources.map((x) =>
                              x.id === s.id ? { ...x, title: e.target.value } : x,
                            ),
                          }))
                        }
                        placeholder="Optional title/label"
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E7E2D6] dark:border-stone-700 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:outline-none"
                      />

                      <textarea
                        value={s.value}
                        onChange={(e) =>
                          setRequest((r) => ({
                            ...r,
                            sources: r.sources.map((x) =>
                              x.id === s.id ? { ...x, value: e.target.value } : x,
                            ),
                          }))
                        }
                        placeholder={
                          s.kind === 'url'
                            ? 'https://example.com'
                            : s.kind === 'topic'
                              ? 'e.g. Attention mechanism in transformers'
                              : 'Paste canonical text excerpts here...'
                        }
                        rows={2}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E7E2D6] dark:border-stone-700 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Codex Orchestrator Prompt */}
            <div className="rounded-3xl border border-[#E7E2D6] dark:border-stone-800 bg-white dark:bg-[#1E1512] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                    Codex Prompt
                  </span>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    Orchestrator Prompt
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(orchestratorPrompt, 'orchestrator')}
                  className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F2] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {copiedKey === 'orchestrator' ? (
                    <Check size={13} className="text-emerald-600" />
                  ) : (
                    <Copy size={13} />
                  )}
                  <span>{copiedKey === 'orchestrator' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <textarea
                readOnly
                value={orchestratorPrompt}
                rows={8}
                className="w-full p-3 rounded-2xl border border-[#E7E2D6] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800/60 font-mono text-[11px] text-stone-700 dark:text-stone-300 focus:outline-none resize-none leading-relaxed select-text"
              />
            </div>
          </div>

          {/* RIGHT: Pipeline Inspector & Step Workspace */}
          <div className="space-y-6">
            {/* Top Action Bar */}
            <div className="rounded-3xl border border-[#E7E2D6] dark:border-stone-800 bg-white dark:bg-[#1E1512] p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                    Live Pipeline Run
                  </span>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    7-Step Pipeline Inspector
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isRunningPipeline}
                    onClick={handleRunAiPipeline}
                    className="px-4 py-2 rounded-xl bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] text-xs font-bold font-mono uppercase tracking-wider shadow-[0_3px_0_0_#2B8FD0] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <WandSparkles size={14} />
                    <span>{isRunningPipeline ? 'Running AI...' : 'Run Pipeline'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRun(sampleGoldenCourseRun)
                      setRawRunJson(JSON.stringify(sampleGoldenCourseRun, null, 2))
                      haptics.notify('success')
                    }}
                    className="px-3 py-2 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer"
                  >
                    Load Sample
                  </button>

                  <button
                    type="button"
                    onClick={handleImportJson}
                    className="px-3 py-2 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer"
                  >
                    Import JSON
                  </button>

                  {run && (
                    <button
                      type="button"
                      disabled={isPublishing}
                      onClick={handlePublishToStudio}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono uppercase tracking-wider shadow-[0_3px_0_0_#047857] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <BookOpen size={14} />
                      <span>{isPublishing ? 'Publishing...' : 'Publish To Studio'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 7-Step Navigation Tabs */}
              {run && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
                  {run.steps.map((step, sIdx) => {
                    const Icon = getStepIcon(step.id)
                    const isSelected = step.id === selectedStepId
                    const variant = getSelectedVariant(step)

                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => {
                          setSelectedStepId(step.id)
                          haptics.selection()
                        }}
                        className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[72px] ${
                          isSelected
                            ? 'bg-[#E0F2FE] dark:bg-[#0C4A6E]/40 border-[#0284C7] shadow-2xs'
                            : 'bg-[#FAF8F2] dark:bg-stone-800/50 border-[#E7E2D6] dark:border-stone-800 hover:border-stone-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-stone-400">
                            0{sIdx + 1}
                          </span>
                          <Icon size={14} className={isSelected ? 'text-[#0284C7]' : 'text-stone-400'} />
                        </div>
                        <div className="mt-1">
                          <div className="text-xs font-bold leading-tight line-clamp-1">
                            {step.title}
                          </div>
                          <div className="text-[10px] text-stone-500 dark:text-stone-400 line-clamp-1 mt-0.5">
                            {variant?.label || 'None'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Step Detail Workspace */}
            {run && activeStep && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="rounded-3xl border border-[#E7E2D6] dark:border-stone-800 bg-white dark:bg-[#1E1512] p-5 shadow-xs space-y-4">
                  {/* Step Title & Goal */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase text-stone-400 tracking-wider">
                        Active Step · {activeStep.id}
                      </span>
                      <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                        {activeStep.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-1">
                        {activeStep.goal}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const newId = `var_${Math.random().toString(36).slice(2, 7)}`
                        const copyVariant = activeVariant
                          ? { ...activeVariant, id: newId, label: `${activeVariant.label} (Copy)` }
                          : { id: newId, label: 'Custom Variant', format: 'markdown' as const, content: '' }
                        setRun((prev) =>
                          prev
                            ? {
                                ...prev,
                                steps: prev.steps.map((s) =>
                                  s.id === activeStep.id
                                    ? {
                                        ...s,
                                        selectedVariantId: newId,
                                        variants: [...s.variants, copyVariant],
                                      }
                                    : s,
                                ),
                              }
                            : prev,
                        )
                        haptics.notify('success')
                      }}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus size={13} />
                      <span>Add Variant</span>
                    </button>
                  </div>

                  {/* Summary Box */}
                  <div className="p-3.5 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800/60 border border-[#E7E2D6] dark:border-stone-800 text-xs leading-relaxed text-stone-800 dark:text-stone-200">
                    <span className="font-bold text-stone-900 dark:text-stone-100">Summary: </span>
                    {activeStep.summary}
                  </div>

                  {/* Variant Selection Pills */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                      Step Variants:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {activeStep.variants.map((v) => {
                        const isChosen = v.id === activeStep.selectedVariantId
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setRun((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      steps: prev.steps.map((s) =>
                                        s.id === activeStep.id
                                          ? { ...s, selectedVariantId: v.id }
                                          : s,
                                      ),
                                    }
                                  : prev,
                              )
                              haptics.selection()
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              isChosen
                                ? 'bg-amber-500/20 border-amber-500 text-amber-950 dark:text-amber-100 shadow-2xs font-bold'
                                : 'bg-[#FAF8F2] dark:bg-stone-800 border-[#E7E2D6] dark:border-stone-700 text-stone-600 dark:text-stone-400'
                            }`}
                          >
                            {v.label} ({v.format})
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Variant Content Area */}
                  {activeVariant && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                          Selected Variant Content ({activeVariant.format})
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeVariant.content, 'variant')}
                          className="px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === 'variant' ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedKey === 'variant' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      <textarea
                        value={activeVariant.content}
                        onChange={(e) => {
                          const val = e.target.value
                          setRun((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  steps: prev.steps.map((s) =>
                                    s.id === activeStep.id
                                      ? {
                                          ...s,
                                          variants: s.variants.map((v) =>
                                            v.id === activeVariant.id ? { ...v, content: val } : v,
                                          ),
                                        }
                                      : s,
                                  ),
                                }
                              : prev,
                          )
                        }}
                        rows={10}
                        className="w-full p-3.5 rounded-2xl border border-[#E7E2D6] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800/80 font-mono text-xs text-stone-900 dark:text-stone-100 focus:outline-none resize-y leading-relaxed"
                      />
                    </div>
                  )}

                  {/* Step Update / Regeneration Box */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-900 dark:text-amber-200 font-mono">
                        <Sparkles size={14} className="text-amber-600" />
                        <span>Regenerate Or Update This Step</span>
                      </div>

                      <button
                        type="button"
                        disabled={isUpdatingStep}
                        onClick={handleUpdateStep}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        <Send size={12} />
                        <span>{isUpdatingStep ? 'Updating...' : 'Regenerate Step'}</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      value={currentInstruction}
                      onChange={(e) =>
                        setStepInstructions((prev) => ({
                          ...prev,
                          [activeStep.id]: e.target.value,
                        }))
                      }
                      placeholder="e.g. make the curriculum builder-first, or tighten the misconception checks"
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-500/30 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:outline-none"
                    />

                    {stepUpdatePrompt && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-stone-500">
                            Generated Step Update Prompt
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(stepUpdatePrompt, 'stepUpdate')}
                            className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold cursor-pointer"
                          >
                            {copiedKey === 'stepUpdate' ? 'Copied prompt' : 'Copy update prompt'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Final Bundle Preview */}
                <div className="rounded-3xl border border-[#E7E2D6] dark:border-stone-800 bg-white dark:bg-[#1E1512] p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase text-stone-400">
                        Bundle Output
                      </span>
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                        Final Course Architecture ({run.finalCourse.name})
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={handlePublishToStudio}
                      className="px-3.5 py-1.5 rounded-xl bg-[#59B2E6] text-[#261312] text-xs font-bold font-mono uppercase flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>Study Now</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {run.finalCourse.sections.map((sec, sIdx) => (
                      <div
                        key={sec.name}
                        className="p-4 rounded-2xl border border-[#E7E2D6] dark:border-stone-800 bg-[#FAF8F2] dark:bg-stone-800/40 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                            {sIdx + 1}. {sec.name}
                          </h4>
                          <span className="text-[10px] font-mono text-stone-400">
                            {sec.lessons.length} lessons
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {sec.lessons.map((l) => (
                            <div
                              key={l.name}
                              className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700/80 space-y-1 shadow-2xs"
                            >
                              <div className="font-semibold text-xs text-stone-900 dark:text-stone-100">
                                {l.name}
                              </div>
                              {l.hook && (
                                <p className="text-[11px] text-stone-500 dark:text-stone-400 italic line-clamp-1">
                                  &ldquo;{l.hook}&rdquo;
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-[10px] font-mono text-stone-400 pt-1">
                                <span>{l.pages.length} pages</span>
                                <span>·</span>
                                <span>{l.practices.length} practices</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
