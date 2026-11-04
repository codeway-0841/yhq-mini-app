import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronDown, SquarePen, Trash2 } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'
import { Avatar } from './Avatar'
import { avatarSrcFor, type ApiUser } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { Button } from '../../../shared/components/ui/button'

export interface UserExtraProfile {
  firstName: string
  lastName: string
  username: string
  age: string
  occupation: string
  gender: 'male' | 'female'
  country: string
  region: string
  district: string
  neighborhood: string
}

const STORAGE_KEY = 'kivvi_user_extra_profile'

const DEFAULT_EXTRA: UserExtraProfile = {
  firstName: 'Ruslan',
  lastName: 'Abl',
  username: '@ddqgrvtrdswe222',
  age: '28',
  occupation: 'Ishlayman',
  gender: 'male',
  country: 'Uzbekistan',
  region: 'Buxoro viloyati',
  district: 'Jondor tumani',
  neighborhood: 'Darveshi',
}

const REGIONS_LIST = [
  'Andijon viloyati',
  'Buxoro viloyati',
  'Jizzax viloyati',
  'Qashqadaryo viloyati',
  'Qoraqalpog‘iston Respublikasi',
  'Navoiy viloyati',
  'Namangan viloyati',
  'Samarqand viloyati',
  'Sirdaryo viloyati',
  'Surxondaryo viloyati',
  'Toshkent viloyati',
  'Toshkent shahri',
  'Farg‘ona viloyati',
  'Xorazm viloyati',
]

const OCCUPATIONS_LIST = [
  'Ishlayman',
  'Universitetda o‘qiyman',
  'Kollej/litseyda o‘qiyman',
  'Maktabda o‘qiyman',
]

function loadExtraProfile(userId?: string, displayName?: string, username?: string): UserExtraProfile {
  if (typeof window === 'undefined') return DEFAULT_EXTRA
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId || 'default'}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_EXTRA, ...parsed }
    }
  } catch {}

  const parts = (displayName || '').trim().split(/\s+/)
  const firstName = parts[0] || DEFAULT_EXTRA.firstName
  const lastName = parts.slice(1).join(' ') || DEFAULT_EXTRA.lastName
  const userHandle = username ? `@${username.replace(/^@/, '')}` : DEFAULT_EXTRA.username

  return {
    ...DEFAULT_EXTRA,
    firstName,
    lastName,
    username: userHandle,
  }
}

function saveExtraProfile(data: UserExtraProfile, userId?: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId || 'default'}`, JSON.stringify(data))
  } catch {}
}

interface ProfileDetailsViewProps {
  user: ApiUser | null | undefined
  name: string
  onBack: () => void
  onEditPhoto: () => void
  onEditPhone: () => void
  lang?: 'uz' | 'ru'
}

export function ProfileDetailsView({
  user,
  name,
  onBack,
  onEditPhoto,
  onEditPhone,
  lang = 'uz',
}: ProfileDetailsViewProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'address'>('info')
  const [editMode, setEditMode] = useState<'none' | 'info' | 'address'>('none')
  const [extra, setExtra] = useState<UserExtraProfile>(() =>
    loadExtraProfile(user?.id, name, user?.username)
  )

  // Edit draft state
  const [editFirstName, setEditFirstName] = useState(extra.firstName)
  const [editLastName, setEditLastName] = useState(extra.lastName)
  const [editUsername, setEditUsername] = useState(extra.username)
  const [editAge, setEditAge] = useState(extra.age)
  const [editOccupation, setEditOccupation] = useState(extra.occupation)
  const [editGender, setEditGender] = useState<'male' | 'female'>(extra.gender)

  // Address edit state
  const [editCountry, setEditCountry] = useState(extra.country)
  const [editRegion, setEditRegion] = useState(extra.region)
  const [editDistrict, setEditDistrict] = useState(extra.district)
  const [editNeighborhood, setEditNeighborhood] = useState(extra.neighborhood)

  // Bottom Sheets
  const [showOccupationSheet, setShowOccupationSheet] = useState(false)
  const [selectedOccupationTemp, setSelectedOccupationTemp] = useState(extra.occupation)

  const [showRegionSheet, setShowRegionSheet] = useState(false)
  const [selectedRegionTemp, setSelectedRegionTemp] = useState(extra.region)

  const [showDistrictModal, setShowDistrictModal] = useState(false)
  const [tempDistrict, setTempDistrict] = useState(extra.district)

  const [showNeighborhoodModal, setShowNeighborhoodModal] = useState(false)
  const [tempNeighborhood, setTempNeighborhood] = useState(extra.neighborhood)

  const setDisplayName = useAppStore((s) => s.setDisplayName)
  const ru = lang === 'ru'

  // Sync edits when extra changes
  useEffect(() => {
    setEditFirstName(extra.firstName)
    setEditLastName(extra.lastName)
    setEditUsername(extra.username)
    setEditAge(extra.age)
    setEditOccupation(extra.occupation)
    setEditGender(extra.gender)
    setEditCountry(extra.country)
    setEditRegion(extra.region)
    setEditDistrict(extra.district)
    setEditNeighborhood(extra.neighborhood)
  }, [extra])

  const handleSaveInfo = () => {
    const updated: UserExtraProfile = {
      ...extra,
      firstName: editFirstName.trim() || 'Ruslan',
      lastName: editLastName.trim() || 'Abl',
      username: editUsername.trim().startsWith('@') ? editUsername.trim() : `@${editUsername.trim()}`,
      age: editAge.trim() || '28',
      occupation: editOccupation.trim() || 'Ishlayman',
      gender: editGender,
    }
    setExtra(updated)
    saveExtraProfile(updated, user?.id)

    const full = `${updated.firstName} ${updated.lastName}`.trim()
    if (full && full !== name) {
      setDisplayName(full)
    }

    playSound('click')
    haptics.notify('success')
    setEditMode('none')
  }

  const handleSaveAddress = () => {
    const updated: UserExtraProfile = {
      ...extra,
      country: editCountry.trim() || 'Uzbekistan',
      region: editRegion.trim() || 'Buxoro viloyati',
      district: editDistrict.trim() || 'Jondor tumani',
      neighborhood: editNeighborhood.trim() || 'Darveshi',
    }
    setExtra(updated)
    saveExtraProfile(updated, user?.id)

    playSound('click')
    haptics.notify('success')
    setEditMode('none')
  }

  const handleResetInfo = () => {
    playSound('click')
    haptics.impact('medium')
    setEditFirstName(DEFAULT_EXTRA.firstName)
    setEditLastName(DEFAULT_EXTRA.lastName)
    setEditUsername(DEFAULT_EXTRA.username)
    setEditAge(DEFAULT_EXTRA.age)
    setEditOccupation(DEFAULT_EXTRA.occupation)
    setEditGender(DEFAULT_EXTRA.gender)
  }

  const currentFullName = `${extra.firstName} ${extra.lastName}`.trim() || name
  const phoneDisplay = user?.phone || '+998934440841'

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 2: MA'LUMOTLARNI TAHRIRLASH (2-rasm: 100% SCROLLSIZ, BORDERSIZ CHEVRON, THEME BUTTON)
  // ══════════════════════════════════════════════════════════════════════════
  if (editMode === 'info') {
    return (
      <div className="fixed inset-0 z-50 bg-pcanvas flex flex-col justify-between overflow-hidden px-4 py-2.5 pb-[max(12px,var(--safe-bottom,0px))] select-none">
        {/* Top bar header */}
        <div className="flex-none flex items-center justify-between py-1.5">
          <button
            type="button"
            onClick={() => {
              playSound('click')
              haptics.impact('light')
              setEditMode('none')
            }}
            className="size-10 rounded-full bg-white dark:bg-pcard shadow-sm flex items-center justify-center text-pfg active:scale-95 transition-transform"
            aria-label={ru ? 'Назад' : 'Orqaga'}
          >
            <ChevronLeft size={20} strokeWidth={2.4} />
          </button>

          <h1 className="text-[16px] font-extrabold text-pfg tracking-tight">
            {ru ? 'Редактировать данные' : 'Ma’lumotlarni tahrirlash'}
          </h1>

          <button
            type="button"
            onClick={handleResetInfo}
            className="size-10 rounded-full bg-white dark:bg-pcard shadow-sm flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-95 transition-transform"
            aria-label={ru ? 'Сбросить' : 'Tozalash'}
            title={ru ? 'Сбросить данные' : 'Ma’lumotlarni tiklash'}
          >
            <Trash2 size={18} strokeWidth={2.2} />
          </button>
        </div>

        {/* Avatar (toza, qalamchasiz) */}
        <div className="flex-none my-1 flex justify-center">
          <Avatar
            name={`${editFirstName} ${editLastName}`.trim() || name}
            photoUrl={avatarSrcFor(user) ?? undefined}
            size="lg"
            onEditPhoto={onEditPhoto}
          />
        </div>

        {/* Inputs list (tightly spaced, 100% fits viewport) */}
        <div className="flex-1 flex flex-col justify-center gap-2 max-w-lg mx-auto w-full my-auto">
          {/* Ismingiz */}
          <div className="rounded-2xl bg-psurface border-2 border-pline-strong px-3.5 py-1.5 shadow-xs focus-within:border-pprimary transition-colors">
            <label className="block text-[11px] font-medium text-pmuted">
              {ru ? 'Имя' : 'Ismingiz'}
            </label>
            <input
              type="text"
              value={editFirstName}
              onChange={(e) => setEditFirstName(e.target.value)}
              maxLength={32}
              className="w-full bg-transparent text-[14.5px] font-bold text-pfg outline-none leading-tight"
              placeholder={ru ? 'Имя' : 'Ismingiz'}
            />
          </div>

          {/* Familiya */}
          <div className="rounded-2xl bg-psurface border-2 border-pline-strong px-3.5 py-1.5 shadow-xs focus-within:border-pprimary transition-colors">
            <label className="block text-[11px] font-medium text-pmuted">
              {ru ? 'Фамилия' : 'Familiya'}
            </label>
            <input
              type="text"
              value={editLastName}
              onChange={(e) => setEditLastName(e.target.value)}
              maxLength={32}
              className="w-full bg-transparent text-[14.5px] font-bold text-pfg outline-none leading-tight"
              placeholder={ru ? 'Фамилия' : 'Familiya'}
            />
          </div>

          {/* Username */}
          <div className="rounded-2xl bg-psurface border-2 border-pline-strong px-3.5 py-1.5 shadow-xs focus-within:border-pprimary transition-colors">
            <label className="block text-[11px] font-medium text-pmuted">
              Username
            </label>
            <input
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              maxLength={32}
              className="w-full bg-transparent text-[14.5px] font-bold text-pfg outline-none leading-tight"
              placeholder="@username"
            />
          </div>

          {/* Yosh */}
          <div className="rounded-2xl bg-psurface border-2 border-pline-strong px-3.5 py-1.5 shadow-xs focus-within:border-pprimary transition-colors">
            <label className="block text-[11px] font-medium text-pmuted">
              {ru ? 'Возраст' : 'Yosh'}
            </label>
            <input
              type="number"
              value={editAge}
              onChange={(e) => setEditAge(e.target.value)}
              maxLength={3}
              className="w-full bg-transparent text-[14.5px] font-bold text-pfg outline-none leading-tight"
              placeholder="28"
            />
          </div>

          {/* Faoliyat turi (Dropdown Selector) */}
          <button
            type="button"
            onClick={() => {
              playSound('click')
              haptics.impact('light')
              setSelectedOccupationTemp(editOccupation)
              setShowOccupationSheet(true)
            }}
            className="w-full text-left rounded-2xl bg-psurface border-2 border-pline-strong px-3.5 py-2 shadow-xs flex items-center justify-between active:scale-[0.99] transition-transform"
          >
            <div>
              <span className="block text-[11px] font-medium text-pmuted">
                {ru ? 'Род деятельности' : 'Faoliyat turi'}
              </span>
              <span className="block text-[14.5px] font-bold text-pfg leading-tight mt-0.5">
                {editOccupation || (ru ? 'Выберите' : 'Tanlang')}
              </span>
            </div>
            <ChevronDown size={18} className="text-pfg shrink-0" strokeWidth={2.4} />
          </button>

          {/* Jins (Segmented Pill Switcher) */}
          <div className="rounded-2xl bg-psurface border-2 border-pline-strong px-3.5 py-2 shadow-xs">
            <span className="block text-[11px] font-medium text-pmuted mb-1.5">
              {ru ? 'Пол' : 'Jins'}
            </span>
            <div className="grid grid-cols-2 p-1 rounded-full bg-pcard border-2 border-pline-strong gap-1">
              <button
                type="button"
                onClick={() => {
                  playSound('click')
                  haptics.impact('light')
                  setEditGender('male')
                }}
                className={cn(
                  'py-1.5 rounded-full flex items-center justify-center transition-all select-none',
                  editGender === 'male'
                    ? 'bg-pprimary text-ponprimary shadow-xs'
                    : 'text-pmuted hover:text-pfg'
                )}
                aria-label={ru ? 'Мужской' : 'Erkak'}
              >
                <svg className="size-4.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound('click')
                  haptics.impact('light')
                  setEditGender('female')
                }}
                className={cn(
                  'py-1.5 rounded-full flex items-center justify-center transition-all select-none',
                  editGender === 'female'
                    ? 'bg-pprimary text-ponprimary shadow-xs'
                    : 'text-pmuted hover:text-pfg'
                )}
                aria-label={ru ? 'Женский' : 'Ayol'}
              >
                <svg className="size-4.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a4 4 0 0 0-4 4c0 1.5.8 2.8 2 3.5V11c-.5.3-1 .8-1.5 1.3C7.2 13.5 6 15.6 6 18v2h12v-2c0-2.4-1.2-4.5-2.5-5.7-.5-.5-1-1-1.5-1.3V9.5c1.2-.7 2-2 2-3.5a4 4 0 0 0-4-4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom CTA: SAQLASH (Theme Button) */}
        <div className="flex-none max-w-lg mx-auto w-full pt-2">
          <Button
            block
            size="default"
            onClick={handleSaveInfo}
            className="font-black text-[15px] uppercase tracking-wider h-12 shadow-sm"
          >
            {ru ? 'СОХРАНИТЬ' : 'SAQLASH'}
          </Button>
        </div>

        {/* ── SHEET: Faoliyat turi (1-rasm) ── */}
        {showOccupationSheet && (
          <DialogOverlay
            onClose={() => setShowOccupationSheet(false)}
            position="bottom"
            swipeToDismiss
            labelId="occupation-sheet-title"
          >
            <div className="w-full max-w-lg mx-auto rounded-t-sheet bg-pcard px-5 pt-3 pb-[calc(1.5rem+var(--safe-bottom,0px))] text-pfg shadow-2xl">
              <div
                data-drag-handle
                className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-white/20 mx-auto mt-1 mb-4 cursor-grab touch-none select-none"
              />
              <h2 id="occupation-sheet-title" className="text-[18px] font-black text-pfg mb-3 px-1">
                {ru ? 'Род деятельности' : 'Faoliyat turi'}
              </h2>

              <div className="divide-y divide-pline">
                {OCCUPATIONS_LIST.map((occ) => {
                  const isSelected = selectedOccupationTemp === occ
                  return (
                    <button
                      key={occ}
                      type="button"
                      onClick={() => {
                        playSound('click')
                        haptics.impact('light')
                        setSelectedOccupationTemp(occ)
                      }}
                      className="w-full flex items-center justify-between py-3.5 px-1 text-left active:bg-psurface transition-colors"
                    >
                      <span className="text-[15px] font-bold text-pfg">
                        {occ}
                      </span>
                      <div
                        className={cn(
                          'size-5 rounded-full flex items-center justify-center transition-all',
                          isSelected
                            ? 'border-[3.5px] border-pprimary bg-transparent'
                            : 'bg-gray-200 dark:bg-white/10'
                        )}
                      />
                    </button>
                  )
                })}
              </div>

              <div className="mt-4">
                <Button
                  block
                  size="default"
                  onClick={() => {
                    setEditOccupation(selectedOccupationTemp)
                    playSound('click')
                    haptics.impact('light')
                    setShowOccupationSheet(false)
                  }}
                  className="font-black text-[15px] uppercase tracking-wider h-12 shadow-sm"
                >
                  {ru ? 'ВЫБРАТЬ' : 'TANLASH'}
                </Button>
              </div>
            </div>
          </DialogOverlay>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 3: MANZILNI TAHRIRLASH (4-rasm: YAXLIT BLOK, 100% SCROLLSIZ, BORDERSIZ CHEVRON, THEME BUTTON)
  // ══════════════════════════════════════════════════════════════════════════
  if (editMode === 'address') {
    return (
      <div className="fixed inset-0 z-50 bg-pcanvas flex flex-col justify-between overflow-hidden px-4 py-2.5 pb-[max(12px,var(--safe-bottom,0px))] select-none">
        {/* Top bar header */}
        <div className="flex-none flex items-center justify-between py-1.5">
          <button
            type="button"
            onClick={() => {
              playSound('click')
              haptics.impact('light')
              setEditMode('none')
            }}
            className="size-10 rounded-full bg-white dark:bg-pcard shadow-sm flex items-center justify-center text-pfg active:scale-95 transition-transform"
            aria-label={ru ? 'Назад' : 'Orqaga'}
          >
            <ChevronLeft size={20} strokeWidth={2.4} />
          </button>

          <h1 className="text-[16px] font-extrabold text-pfg tracking-tight">
            {ru ? 'Редактировать адрес' : 'Manzilni tahrirlash'}
          </h1>

          <div className="size-10" aria-hidden="true" />
        </div>

        {/* Address Fields inside SINGLE rounded card (4-rasm) */}
        <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full my-auto">
          <div className="overflow-hidden rounded-3xl bg-pcard border-2 border-pline-strong p-3 space-y-2.5 shadow-xs">
            {/* Mamlakat */}
            <div className="rounded-2xl bg-psurface border-2 border-pline-strong px-4 py-3 flex items-center justify-between">
              <div>
                <span className="block text-[11px] font-medium text-pmuted">
                  {ru ? 'Страна' : 'Mamlakat'}
                </span>
                <span className="mt-0.5 block text-[15px] font-bold text-pfg">
                  {editCountry}
                </span>
              </div>
              <ChevronDown size={18} className="text-pfg shrink-0" strokeWidth={2.4} />
            </div>

            {/* Viloyat (Clickable -> Opens Region Sheet) */}
            <button
              type="button"
              onClick={() => {
                playSound('click')
                haptics.impact('light')
                setSelectedRegionTemp(editRegion)
                setShowRegionSheet(true)
              }}
              className="w-full text-left rounded-2xl bg-psurface border-2 border-pline-strong px-4 py-3 flex items-center justify-between active:scale-[0.99] transition-transform"
            >
              <div>
                <span className="block text-[11px] font-medium text-pmuted">
                  {ru ? 'Область' : 'Viloyat'}
                </span>
                <span className="mt-0.5 block text-[15px] font-bold text-pfg">
                  {editRegion}
                </span>
              </div>
              <ChevronDown size={18} className="text-pfg shrink-0" strokeWidth={2.4} />
            </button>

            {/* Tuman */}
            <button
              type="button"
              onClick={() => {
                setTempDistrict(editDistrict)
                setShowDistrictModal(true)
              }}
              className="w-full text-left rounded-2xl bg-psurface border-2 border-pline-strong px-4 py-3 flex items-center justify-between active:scale-[0.99] transition-transform"
            >
              <div>
                <span className="block text-[11px] font-medium text-pmuted">
                  {ru ? 'Район' : 'Tuman'}
                </span>
                <span className="mt-0.5 block text-[15px] font-bold text-pfg">
                  {editDistrict}
                </span>
              </div>
              <ChevronDown size={18} className="text-pfg shrink-0" strokeWidth={2.4} />
            </button>

            {/* Mahalla */}
            <button
              type="button"
              onClick={() => {
                setTempNeighborhood(editNeighborhood)
                setShowNeighborhoodModal(true)
              }}
              className="w-full text-left rounded-2xl bg-psurface border-2 border-pline-strong px-4 py-3 flex items-center justify-between active:scale-[0.99] transition-transform"
            >
              <div>
                <span className="block text-[11px] font-medium text-pmuted">
                  {ru ? 'Махалля' : 'Mahalla'}
                </span>
                <span className="mt-0.5 block text-[15px] font-bold text-pfg">
                  {editNeighborhood}
                </span>
              </div>
              <ChevronDown size={18} className="text-pfg shrink-0" strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Bottom CTA: SAQLASH (Theme Button) */}
        <div className="flex-none max-w-lg mx-auto w-full pt-2">
          <Button
            block
            size="default"
            onClick={handleSaveAddress}
            className="font-black text-[15px] uppercase tracking-wider h-12 shadow-sm"
          >
            {ru ? 'СОХРАНИТЬ' : 'SAQLASH'}
          </Button>
        </div>

        {/* ── SHEET: Viloyatni tanlang (3 va 5-rasmlar) ── */}
        {showRegionSheet && (
          <DialogOverlay
            onClose={() => setShowRegionSheet(false)}
            position="bottom"
            swipeToDismiss
            labelId="region-sheet-title"
          >
            <div className="w-full max-w-lg mx-auto max-h-[80vh] flex flex-col rounded-t-sheet bg-pcard px-5 pt-3 pb-[calc(1.5rem+var(--safe-bottom,0px))] text-pfg shadow-2xl">
              <div
                data-drag-handle
                className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-white/20 mx-auto mt-1 mb-4 cursor-grab touch-none select-none shrink-0"
              />
              <h2 id="region-sheet-title" className="text-[18px] font-black text-pfg mb-2 px-1 shrink-0">
                {ru ? 'Выберите область' : 'Viloyatni tanlang'}
              </h2>

              <div className="overflow-y-auto overscroll-contain flex-1 divide-y divide-pline pr-1">
                {REGIONS_LIST.map((reg) => {
                  const isSelected = selectedRegionTemp === reg
                  return (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => {
                        playSound('click')
                        haptics.impact('light')
                        setSelectedRegionTemp(reg)
                      }}
                      className="w-full flex items-center justify-between py-3.5 px-1 text-left active:bg-psurface transition-colors"
                    >
                      <span className="text-[15px] font-bold text-pfg">
                        {reg}
                      </span>
                      <div
                        className={cn(
                          'size-5 rounded-full flex items-center justify-center transition-all shrink-0',
                          isSelected
                            ? 'border-[3.5px] border-pprimary bg-transparent'
                            : 'bg-gray-200 dark:bg-white/10'
                        )}
                      />
                    </button>
                  )
                })}
              </div>

              <div className="pt-3 shrink-0">
                <Button
                  block
                  size="default"
                  onClick={() => {
                    setEditRegion(selectedRegionTemp)
                    playSound('click')
                    haptics.impact('light')
                    setShowRegionSheet(false)
                  }}
                  className="font-black text-[15px] uppercase tracking-wider h-12 shadow-sm"
                >
                  {ru ? 'ВЫБРАТЬ' : 'TANLASH'}
                </Button>
              </div>
            </div>
          </DialogOverlay>
        )}

        {/* Tuman edit modal */}
        {showDistrictModal && (
          <DialogOverlay onClose={() => setShowDistrictModal(false)} position="bottom" swipeToDismiss>
            <div className="w-full max-w-lg mx-auto rounded-t-sheet bg-pcard px-5 pt-3 pb-[calc(1.5rem+var(--safe-bottom,0px))] text-pfg shadow-2xl">
              <div data-drag-handle className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-white/20 mx-auto mt-1 mb-4" />
              <h3 className="text-[18px] font-black text-pfg mb-3">{ru ? 'Район' : 'Tuman'}</h3>
              <input
                type="text"
                value={tempDistrict}
                onChange={(e) => setTempDistrict(e.target.value)}
                className="w-full rounded-2xl bg-psurface border-2 border-pline-strong px-4 py-3 text-[15px] font-bold text-pfg outline-none focus:border-pprimary"
                placeholder={ru ? 'Введите район' : 'Tuman nomini kiriting'}
              />
              <div className="mt-4">
                <Button
                  block
                  size="default"
                  onClick={() => {
                    setEditDistrict(tempDistrict.trim() || editDistrict)
                    setShowDistrictModal(false)
                  }}
                  className="font-black text-[15px] uppercase tracking-wider h-12 shadow-sm"
                >
                  {ru ? 'ВЫБРАТЬ' : 'TANLASH'}
                </Button>
              </div>
            </div>
          </DialogOverlay>
        )}

        {/* Mahalla edit modal */}
        {showNeighborhoodModal && (
          <DialogOverlay onClose={() => setShowNeighborhoodModal(false)} position="bottom" swipeToDismiss>
            <div className="w-full max-w-lg mx-auto rounded-t-sheet bg-pcard px-5 pt-3 pb-[calc(1.5rem+var(--safe-bottom,0px))] text-pfg shadow-2xl">
              <div data-drag-handle className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-white/20 mx-auto mt-1 mb-4" />
              <h3 className="text-[18px] font-black text-pfg mb-3">{ru ? 'Махалля' : 'Mahalla'}</h3>
              <input
                type="text"
                value={tempNeighborhood}
                onChange={(e) => setTempNeighborhood(e.target.value)}
                className="w-full rounded-2xl bg-psurface border-2 border-pline-strong px-4 py-3 text-[15px] font-bold text-pfg outline-none focus:border-pprimary"
                placeholder={ru ? 'Введите махаллю' : 'Mahalla nomini kiriting'}
              />
              <div className="mt-4">
                <Button
                  block
                  size="default"
                  onClick={() => {
                    setEditNeighborhood(tempNeighborhood.trim() || editNeighborhood)
                    setShowNeighborhoodModal(false)
                  }}
                  className="font-black text-[15px] uppercase tracking-wider h-12 shadow-sm"
                >
                  {ru ? 'ВЫБРАТЬ' : 'TANLASH'}
                </Button>
              </div>
            </div>
          </DialogOverlay>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 1: ASOSIY PROFIL MA'LUMOTLARI (Ma'lumotlar / Manzil tablari, SILLIQ ANIMATSIYA, BORDERSIZ CHEVRON)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-[85vh] flex flex-col pb-28 animate-premiumIn">
      {/* ── Top Bar Header: BORDERSIZ CHEVRON ── */}
      <div className="relative flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => {
            playSound('click')
            haptics.impact('light')
            onBack()
          }}
          className="size-11 rounded-full bg-white dark:bg-pcard shadow-sm flex items-center justify-center text-pfg active:scale-95 transition-transform"
          aria-label={ru ? 'Назад' : 'Orqaga'}
        >
          <ChevronLeft size={22} strokeWidth={2.4} />
        </button>

        <h1 className="text-[17px] font-extrabold text-pfg tracking-tight">
          {ru ? 'Данные профиля' : 'Profil ma’lumotlari'}
        </h1>

        <div className="size-11" aria-hidden="true" />
      </div>

      {/* ── Segment / Tab Switcher (Pill Style, Themes Mos, Silliq) ── */}
      <div className="mx-4 mt-2 grid grid-cols-2 p-1 rounded-full bg-white dark:bg-pcard shadow-sm gap-1">
        <button
          type="button"
          onClick={() => {
            if (activeTab !== 'info') {
              setActiveTab('info')
              playSound('click')
              haptics.impact('light')
            }
          }}
          className={cn(
            'py-2.5 px-4 rounded-full text-sm font-extrabold transition-all duration-200 text-center select-none',
            activeTab === 'info'
              ? 'bg-pprimary text-ponprimary shadow-xs'
              : 'text-pfg hover:text-pfg/80'
          )}
        >
          {ru ? 'Данные' : 'Ma’lumotlar'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (activeTab !== 'address') {
              setActiveTab('address')
              playSound('click')
              haptics.impact('light')
            }
          }}
          className={cn(
            'py-2.5 px-4 rounded-full text-sm font-extrabold transition-all duration-200 text-center select-none',
            activeTab === 'address'
              ? 'bg-pprimary text-ponprimary shadow-xs'
              : 'text-pfg hover:text-pfg/80'
          )}
        >
          {ru ? 'Адрес' : 'Manzil'}
        </button>
      </div>

      {/* ── TAB CONTENT (Key bilan silliq tabSmoothIn animatsiyasi) ── */}
      <div key={activeTab} className="animate-tabSmoothIn">
        {/* ── TAB 1: Ma'lumotlar ── */}
        {activeTab === 'info' && (
          <div className="flex flex-col">
            {/* Centered Avatar (toza, qalamchasiz) and Name */}
            <div className="mt-6 flex flex-col items-center">
              <div
                onClick={() => {
                  playSound('click')
                  haptics.impact('light')
                  onEditPhoto()
                }}
                className="cursor-pointer active:scale-95 transition-transform"
                title={ru ? 'Изменить фото' : 'Rasmni o‘zgartirish'}
              >
                <Avatar
                  name={currentFullName}
                  photoUrl={avatarSrcFor(user) ?? undefined}
                  size="lg"
                />
              </div>
              <h2 className="mt-3 text-[22px] font-extrabold text-pfg tracking-tight">
                {currentFullName}
              </h2>
            </div>

            {/* Details Card */}
            <div className="mx-4 mt-5 overflow-hidden rounded-3xl bg-pcard border-2 border-pline-strong divide-y divide-pline shadow-xs">
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-[14.5px] font-medium text-pmuted">
                  {ru ? 'Возраст:' : 'Yosh:'}
                </span>
                <span className="text-[15px] font-bold text-pfg">
                  {extra.age}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-[14.5px] font-medium text-pmuted">
                  Username
                </span>
                <span className="text-[15px] font-bold text-pfg">
                  {extra.username}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-[14.5px] font-medium text-pmuted">
                  {ru ? 'Пол:' : 'Jins:'}
                </span>
                <span className="text-[15px] font-bold text-pfg">
                  {extra.gender === 'male' ? (ru ? 'Мужской' : 'Erkak') : (ru ? 'Женский' : 'Ayol')}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-[14.5px] font-medium text-pmuted">
                  {ru ? 'Номер телефона:' : 'Telefon raqam:'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-pfg">
                    {phoneDisplay}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click')
                      haptics.impact('light')
                      onEditPhone()
                    }}
                    className="p-1 rounded-lg text-pprimary hover:bg-psurface transition-colors active:scale-95"
                    aria-label={ru ? 'Изменить телефон' : 'Telefonni o‘zgartirish'}
                  >
                    <SquarePen size={20} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Manzil ── */}
        {activeTab === 'address' && (
          <div className="flex flex-col mt-4">
            <div className="mx-4 overflow-hidden rounded-3xl bg-pcard border-2 border-pline-strong divide-y divide-pline shadow-xs">
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-[14.5px] font-medium text-pmuted">
                  {ru ? 'Страна:' : 'Mamlakat:'}
                </span>
                <span className="text-[15px] font-bold text-pfg">
                  {extra.country}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-[14.5px] font-medium text-pmuted">
                  {ru ? 'Область:' : 'Viloyat:'}
                </span>
                <span className="text-[15px] font-bold text-pfg">
                  {extra.region}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-[14.5px] font-medium text-pmuted">
                  {ru ? 'Район:' : 'Tuman:'}
                </span>
                <span className="text-[15px] font-bold text-pfg">
                  {extra.district}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-[14.5px] font-medium text-pmuted">
                  {ru ? 'Махалля:' : 'Mahalla:'}
                </span>
                <span className="text-[15px] font-bold text-pfg">
                  {extra.neighborhood}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky Bottom CTA: TAHRIRLASH ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-[max(16px,var(--safe-bottom,0px))] bg-gradient-to-t from-pcanvas via-pcanvas/95 to-transparent z-20">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={() => {
              playSound('click')
              haptics.impact('light')
              if (activeTab === 'info') {
                setEditMode('info')
              } else {
                setEditMode('address')
              }
            }}
            className="w-full min-h-[52px] rounded-full bg-pcard border-2 border-pline-strong text-pfg font-black text-[15px] uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xs active:translate-y-[2px] transition-transform"
          >
            <span>{ru ? 'РЕДАКТИРОВАТЬ' : 'TAHRIRLASH'}</span>
            <SquarePen size={19} strokeWidth={2.2} className="text-pfg" />
          </button>
        </div>
      </div>
    </div>
  )
}
