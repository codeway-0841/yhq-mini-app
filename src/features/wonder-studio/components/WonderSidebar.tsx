import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  MoreHorizontal,
  Flame,
  Star,
  ChevronDown,
  WandSparkles,
  Settings,
  LogOut,
  User,
  Check,
  Share2,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import {
  WonderHomeIcon,
  WonderCreateIcon,
  WonderCanvasIcon,
  WonderCoursesIcon,
  WonderProfileIcon,
  WonderSidebarToggleIcon,
} from './WonderIcons'
import { goBack } from '../../../shared/lib/navigation'
import { playSound } from '../../../shared/lib/sounds'
import { useAppStore } from '../../../shared/store/useAppStore'
import { api, avatarSrcFor } from '../../../shared/api'
import { useWonderStore, type WonderNav } from '../store/useWonderStore'
import type { WonderCourse } from '../types'

interface WonderSidebarProps {
  courses: WonderCourse[]
  activeCourse: WonderCourse
  onOpenCreate: () => void
  onOpenUpgrade: () => void
}

export default function WonderSidebar({
  courses,
  activeCourse,
  onOpenCreate,
  onOpenUpgrade,
}: WonderSidebarProps) {
  const navigate = useNavigate()
  const currentNav = useWonderStore((s) => s.currentNav)
  const setCurrentNav = useWonderStore((s) => s.setCurrentNav)
  const isSidebarCollapsed = useWonderStore((s) => s.isSidebarCollapsed)
  const toggleSidebar = useWonderStore((s) => s.toggleSidebar)
  const setActiveCourse = useWonderStore((s) => s.setActiveCourse)
  const unenrollCourse = useWonderStore((s) => s.unenrollCourse)
  const deleteCourse = useWonderStore((s) => s.deleteCourse)
  const renameCourse = useWonderStore((s) => s.renameCourse)
  const enrolledCourseIds = useWonderStore((s) => s.enrolledCourseIds)
  const wonderStreak = useWonderStore((s) => s.wonderStreak)
  const appUser = useAppStore((s) => s.user)
  const appDisplayName = useAppStore((s) => s.displayName)
  const appStreak = useAppStore((s) => s.streak)
  const appCoins = useAppStore((s) => s.coins)
  const appCustomAvatar = useAppStore((s) => s.customAvatar)

  const displayName = appDisplayName || appUser?.firstName || (appUser?.username ? `@${appUser.username}` : 'itp.0841')
  const displayStreak = appStreak || wonderStreak
  const displayCoins = appCoins || 0
  const avatarInitial = (displayName.charAt(0) || 'I').toUpperCase()
  const avatarSrc = appCustomAvatar || (appUser ? avatarSrcFor(appUser) : null) || undefined

  const enrolledCourses = courses.filter((c) => enrolledCourseIds.includes(c.id))

  const [coursesExpanded, setCoursesExpanded] = useState(true)
  const [canvasExpanded, setCanvasExpanded] = useState(true)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [activeMenuCourseId, setActiveMenuCourseId] = useState<string | null>(null)
  const [renamingCourseId, setRenamingCourseId] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const [deleteConfirmCourse, setDeleteConfirmCourse] = useState<WonderCourse | null>(null)
  const [copiedCourseId, setCopiedCourseId] = useState<string | null>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)
  const courseMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(e.target as Node)
      ) {
        setUserDropdownOpen(false)
      }
      if (
        courseMenuRef.current &&
        !courseMenuRef.current.contains(e.target as Node)
      ) {
        setActiveMenuCourseId(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // 1:1 Authentic Navigation Items matching Wondering bundle
  const navItems: {
    id: WonderNav
    label: string
    icon: (isActive: boolean) => React.ReactNode
  }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: (isActive) => (
        <WonderHomeIcon
          size={20}
          className={`transition-colors ${
            isActive
              ? 'text-stone-900 dark:text-stone-100'
              : 'text-stone-700 dark:text-stone-300'
          }`}
        />
      ),
    },
    {
      id: 'create',
      label: 'Create',
      icon: (isActive) => (
        <WonderCreateIcon
          size={20}
          className={`transition-colors ${
            isActive
              ? 'text-stone-900 dark:text-stone-100'
              : 'text-stone-700 dark:text-stone-300'
          }`}
        />
      ),
    },
    {
      id: 'canvas',
      label: 'Canvas',
      icon: (isActive) => (
        <WonderCanvasIcon
          size={20}
          className={`transition-colors ${
            isActive
              ? 'text-stone-900 dark:text-stone-100'
              : 'text-stone-700 dark:text-stone-300'
          }`}
        />
      ),
    },
    {
      id: 'courses',
      label: 'Courses',
      icon: (isActive) => (
        <WonderCoursesIcon
          size={20}
          className={`transition-colors ${
            isActive
              ? 'text-stone-900 dark:text-stone-100'
              : 'text-stone-700 dark:text-stone-300'
          }`}
        />
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (isActive) => (
        <WonderProfileIcon
          size={20}
          className={`transition-colors ${
            isActive
              ? 'text-stone-900 dark:text-stone-100'
              : 'text-stone-700 dark:text-stone-300'
          }`}
        />
      ),
    },
  ]

  // Collapsed Mode
  if (isSidebarCollapsed) {
    return (
      <aside className="hidden md:flex flex-col items-center justify-between py-4 px-2 w-16 bg-[#F6F4EE] dark:bg-[#150F0D] shrink-0 h-screen sticky top-[var(--safe-top,0px)] transition-all select-none z-40">
        <div className="flex flex-col items-center gap-4 w-full">
          <button
            type="button"
            onClick={toggleSidebar}
            className="p-1.5 rounded-xl hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-all cursor-pointer"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <img src="/star.svg" alt="Wondering" className="size-6 shrink-0" />
          </button>

          <div className="flex flex-col gap-1 w-full items-center">
            {navItems.map((item) => {
              const isActive = currentNav === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    playSound('click')
                    setCurrentNav(item.id)
                  }}
                  title={item.label}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                    isActive
                      ? 'bg-[#EBE7DE] dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:bg-[#EBE7DE]/60 dark:hover:bg-stone-800/40'
                  }`}
                >
                  {item.icon(isActive)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Collapsed Footer */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onOpenUpgrade}
            title="Upgrade"
            className="relative p-2 rounded-xl bg-[#E8F4FE] dark:bg-[#0C4A6E]/30 text-[#0284C7] dark:text-[#38BDF8] hover:bg-[#BAE6FD]/40 transition-colors cursor-pointer"
          >
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#38BDF8] animate-pulse" />
            <WandSparkles className="size-4" />
          </button>
        </div>
      </aside>
    )
  }

  // Expanded Mode (1:1 with Wondering production bundle)
  return (
    <aside className="w-64 bg-[#F6F4EE] dark:bg-[#150F0D] flex flex-col justify-between shrink-0 h-screen sticky top-[var(--safe-top,0px)] font-sans z-30 transition-all select-none">
      {/* Top Header & Navigation */}
      <div className="p-3 space-y-4 overflow-y-auto flex-1">
        {/* Brand & Collapse Header (1:1 with live_auth_dashboard.png) */}
        <div className="flex h-10 items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playSound('click')
                setCurrentNav('home')
              }}
              className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-serif hover:opacity-80 transition-opacity pl-1 cursor-pointer"
            >
              Wondering
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              title="Kivvi platformasiga qaytish"
              className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-200/70 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
            >
              ← Kivvi
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              playSound('click')
              toggleSidebar()
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-all cursor-pointer"
            aria-label="Collapse sidebar"
          >
            <WonderSidebarToggleIcon size={18} />
          </button>
        </div>

        {/* Primary Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentNav === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  playSound('click')
                  setCurrentNav(item.id)
                }}
                className={`group flex h-10 w-full items-center space-x-3 rounded-xl px-2.5 text-left text-sm transition-colors duration-150 cursor-pointer outline-none ${
                  isActive
                    ? 'bg-[#EBE7DE] dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-[#EBE7DE]/60 dark:hover:bg-stone-800/40'
                }`}
              >
                <div className="relative">
                  {item.icon(isActive)}
                </div>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Dynamic Section: Canvas (ONLY when in canvas mode) */}
        {currentNav === 'canvas' && (
          <div className="pt-3 border-t border-stone-200/50 dark:border-stone-800/50">
            <div className="flex items-center justify-between pl-2.5 pr-1 mb-1">
              <button
                type="button"
                onClick={() => setCanvasExpanded(!canvasExpanded)}
                className="flex min-h-9 flex-1 items-center gap-1.5 text-left text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors cursor-pointer"
              >
                <span>Canvas</span>
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ${
                    canvasExpanded ? '' : '-rotate-90'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => {}}
                title="New canvas"
                aria-label="New canvas"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200/60 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {canvasExpanded && (
              <ul className="space-y-0.5 pr-1">
                <li className="flex items-center gap-0.5 rounded-xl bg-[#EBE7DE] dark:bg-stone-800 font-medium">
                  <button
                    type="button"
                    className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm text-stone-950 dark:text-stone-100 font-medium truncate cursor-pointer"
                  >
                    <span className="truncate">Untitled canvas</span>
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}

        {/* Dynamic Section: Your courses (ONLY when in home mode) */}
        {currentNav === 'home' && (
          <div className="pt-3 border-t border-stone-200/50 dark:border-stone-800/50">
            <div className="flex items-center justify-between pl-2.5 pr-1 mb-1">
              <button
                type="button"
                onClick={() => setCoursesExpanded(!coursesExpanded)}
                className="flex min-h-9 flex-1 items-center gap-1.5 text-left text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors cursor-pointer"
              >
                <span>Your courses</span>
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ${
                    coursesExpanded ? '' : '-rotate-90'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={onOpenCreate}
                title="New course"
                aria-label="New course"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200/60 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {coursesExpanded && (
              enrolledCourses.length === 0 ? (
                <div className="px-2.5 py-2 text-xs text-stone-400 dark:text-stone-500 font-normal">
                  No courses yet
                </div>
              ) : (
                <ul className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
                  {enrolledCourses.map((course) => {
                    const isSelected = course.id === activeCourse.id && currentNav === 'home'
                    const isMenuOpen = activeMenuCourseId === course.id
                    const isRenaming = renamingCourseId === course.id
                    const isCustomCourse = course.id.startsWith('custom-') || course.id.startsWith('ai-')

                    return (
                      <li
                        key={course.id}
                        className={`group relative flex items-center gap-0.5 rounded-xl transition-colors ${
                          isSelected
                            ? 'bg-[#EBE7DE] dark:bg-stone-800 font-medium'
                            : 'hover:bg-[#EBE7DE]/50 dark:hover:bg-stone-800/40'
                        }`}
                      >
                        {isRenaming ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault()
                              if (renameInput.trim()) {
                                renameCourse(course.id, renameInput.trim())
                              }
                              setRenamingCourseId(null)
                            }}
                            className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1"
                          >
                            <input
                              type="text"
                              value={renameInput}
                              onChange={(e) => setRenameInput(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setRenamingCourseId(null)
                              }}
                              className="flex-1 min-w-0 bg-white dark:bg-stone-900 border border-amber-500 rounded-lg px-2 py-1 text-xs text-stone-900 dark:text-stone-100 outline-none"
                            />
                            <button
                              type="submit"
                              className="p-1 rounded-md bg-amber-500 text-stone-950 hover:bg-amber-400 cursor-pointer"
                              title="Saqlash"
                            >
                              <Check size={12} strokeWidth={3} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingCourseId(null)}
                              className="p-1 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-300 cursor-pointer"
                              title="Bekor qilish"
                            >
                              <X size={12} strokeWidth={2} />
                            </button>
                          </form>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCourse(course.id)
                                setCurrentNav('home')
                              }}
                              className={`flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm truncate cursor-pointer ${
                                isSelected
                                  ? 'text-stone-950 dark:text-stone-100 font-medium'
                                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                              }`}
                            >
                              <span className="truncate">{course.title}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveMenuCourseId(isMenuOpen ? null : course.id)
                              }}
                              className={`p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-opacity cursor-pointer ${
                                isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              }`}
                              aria-label="Course options"
                            >
                              <MoreHorizontal className="size-3.5" />
                            </button>
                          </>
                        )}

                        {/* Options Menu Popover */}
                        {isMenuOpen && (
                          <div
                            ref={courseMenuRef}
                            className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl bg-white dark:bg-stone-900 shadow-lg border border-stone-200 dark:border-stone-800 py-1 text-xs text-stone-700 dark:text-stone-200 animate-in fade-in zoom-in-95 duration-100 select-none"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (navigator.clipboard) {
                                  navigator.clipboard.writeText(window.location.href)
                                  setCopiedCourseId(course.id)
                                  setTimeout(() => setCopiedCourseId(null), 2000)
                                }
                                setActiveMenuCourseId(null)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition-colors cursor-pointer"
                            >
                              <Share2 size={13} className="text-stone-400" />
                              <span>{copiedCourseId === course.id ? 'Copied!' : 'Share course'}</span>
                            </button>

                            {isCustomCourse && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setRenamingCourseId(course.id)
                                  setRenameInput(course.title)
                                  setActiveMenuCourseId(null)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition-colors cursor-pointer"
                              >
                                <Pencil size={13} className="text-stone-400" />
                                <span>Rename course</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                unenrollCourse(course.id)
                                setActiveMenuCourseId(null)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 text-left transition-colors cursor-pointer"
                            >
                              <LogOut size={13} className="text-stone-400" />
                              <span>Remove from list</span>
                            </button>

                            {isCustomCourse && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirmCourse(course)
                                  setActiveMenuCourseId(null)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-left transition-colors cursor-pointer border-t border-stone-100 dark:border-stone-800"
                              >
                                <Trash2 size={13} />
                                <span>Delete permanently</span>
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer Section (1:1 with live_auth_dashboard.png) */}
      <div className="p-3 border-t border-stone-200/60 dark:border-stone-800/80 space-y-2.5 bg-[#F6F4EE] dark:bg-[#150F0D]">
        {/* Streak & Star Counts (1:1 with live_auth_dashboard.png) */}
        <button
          type="button"
          onClick={() => setCurrentNav('profile')}
          className="flex items-center justify-between w-full cursor-pointer rounded-xl py-1 px-2.5 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors"
          title={`${displayStreak} day streak | ${displayCoins} coins - Click to view profile`}
        >
          <div className="flex items-center space-x-2">
            <Flame className="size-4 text-stone-700 dark:text-stone-300" strokeWidth={1.8} />
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              {displayStreak}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Star className="size-4 text-stone-700 dark:text-stone-300" strokeWidth={1.8} />
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              {displayCoins}
            </span>
          </div>
        </button>

        {/* Upgrade Card (1:1 with live_auth_dashboard.png) */}
        <button
          type="button"
          onClick={onOpenUpgrade}
          className="relative flex w-full cursor-pointer items-center rounded-2xl bg-[#E8F4FE] dark:bg-[#0C4A6E]/30 px-3 py-2 text-left transition-colors duration-200 hover:bg-[#DDF0FD] dark:hover:bg-[#0C4A6E]/50 gap-2.5 border border-[#BAE6FD]/50 text-left"
          title="Upgrade to Pro"
        >
          <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-[#38BDF8] animate-pulse" />
          <WandSparkles className="size-4 shrink-0 text-[#0284C7] dark:text-[#38BDF8]" />
          <div className="flex flex-col items-start min-w-0">
            <span className="font-semibold text-xs leading-tight text-[#0369A1] dark:text-[#38BDF8]">Upgrade</span>
            <span className="text-[11px] text-[#0284C7] dark:text-[#38BDF8]/80 leading-tight">
              Learn without limits
            </span>
          </div>
        </button>

        {/* UserDropdown (1:1 with bundle line 2427190) */}
        <div className="relative" ref={userDropdownRef}>
          <button
            type="button"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex w-full items-center space-x-2 rounded-lg p-1 pr-3 transition-colors duration-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 cursor-pointer"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full shadow-2xs bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 text-sm font-bold overflow-hidden">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="size-full object-cover" />
              ) : (
                avatarInitial
              )}
            </div>
            <span className="flex-1 text-left text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
              {displayName}
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-stone-400 transition-transform duration-200 ${
                userDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {userDropdownOpen && (
            <div className="absolute bottom-full mb-2 z-50 inset-x-0 w-56 overflow-hidden rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FFFDF8] dark:bg-[#1C1411] shadow-xl p-1 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => {
                  setUserDropdownOpen(false)
                  setCurrentNav('profile')
                }}
                className={`flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                  currentNav === 'profile'
                    ? 'bg-stone-100 dark:bg-stone-800 font-bold text-stone-950 dark:text-stone-100'
                    : 'text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <User className="size-4 text-stone-500" />
                <span className="flex-1">Profile</span>
                {currentNav === 'profile' && <Check size={14} className="text-amber-600 shrink-0" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserDropdownOpen(false)
                  setCurrentNav('settings')
                }}
                className={`flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                  currentNav === 'settings'
                    ? 'bg-stone-100 dark:bg-stone-800 font-bold text-stone-950 dark:text-stone-100'
                    : 'text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <Settings className="size-4 text-stone-500" />
                <span className="flex-1">Settings</span>
                {currentNav === 'settings' && <Check size={14} className="text-amber-600 shrink-0" />}
              </button>
              <div className="h-px bg-stone-200 dark:bg-stone-800 my-1" />
              <button
                type="button"
                onClick={() => {
                  setUserDropdownOpen(false)
                  goBack(navigate)
                }}
                className="flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                <LogOut className="size-4" />
                <span>Back to KIVVI App</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Course Confirmation Modal */}
      {deleteConfirmCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  Kursni o&apos;chirasizmi?
                </h4>
                <p className="text-xs text-stone-500 line-clamp-1 truncate">
                  {deleteConfirmCourse.title}
                </p>
              </div>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Ushbu kurs va unga tegishli barcha darslar hamda o&apos;rganish statistikasi butunlay o&apos;chiriladi.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCourse(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => {
                  const cid = deleteConfirmCourse.id
                  deleteCourse(cid)
                  if (cid.startsWith('ai-')) {
                    const rawNum = parseInt(cid.replace('ai-', ''), 10)
                    if (rawNum > 0) api.deleteAiCourse(rawNum).catch(() => {})
                  }
                  setDeleteConfirmCourse(null)
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
