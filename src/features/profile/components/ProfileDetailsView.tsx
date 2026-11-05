import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronDown, SquarePen, Trash2 } from 'lucide-react'
import { MdMan, MdWoman } from 'react-icons/md'
import { cn } from '../../../shared/lib/cn'
import { Avatar } from './Avatar'
import { avatarSrcFor, type ApiUser } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { Button } from '../../../shared/components/ui/button'
import { PageHeader } from '../../../shared/components/ui/page-header'

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
  neighborhood?: string
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
}

const COUNTRIES_LIST = [
  'Uzbekistan',
]

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

const REGION_DISTRICTS_MAP: Record<string, string[]> = {
  'Andijon viloyati': [
    'Andijon shahri',
    'Xonobod shahri',
    'Andijon tumani',
    'Asaka tumani',
    'Baliqchi tumani',
    'Bo‘ston tumani',
    'Buloqboshi tumani',
    'Izboskan tumani',
    'Jalaquduq tumani',
    'Marhamat tumani',
    'Oltinko‘l tumani',
    'Paxtaobod tumani',
    'Qo‘rg‘ontepa tumani',
    'Shahrixon tumani',
    'Ulug‘nor tumani',
    'Xo‘jaobod tumani',
  ],
  'Buxoro viloyati': [
    'Buxoro shahri',
    'Kogon shahri',
    'Buxoro tumani',
    'G‘ijduvon tumani',
    'Jondor tumani',
    'Kogon tumani',
    'Olot tumani',
    'Peshku tumani',
    'Qorako‘l tumani',
    'Qorovulbozor tumani',
    'Romitan tumani',
    'Shofirkon tumani',
    'Vobkent tumani',
  ],
  'Jizzax viloyati': [
    'Jizzax shahri',
    'Arnasoy tumani',
    'Baxmal tumani',
    'Do‘stlik tumani',
    'Forish tumani',
    'G‘allaorol tumani',
    'Mirzacho‘l tumani',
    'Paxtakor tumani',
    'Sharof Rashidov tumani',
    'Yangiobod tumani',
    'Zafarobod tumani',
    'Zarbdor tumani',
    'Zomin tumani',
  ],
  'Qashqadaryo viloyati': [
    'Qarshi shahri',
    'Shahrisabz shahri',
    'Chiroqchi tumani',
    'Dehqonobod tumani',
    'G‘uzor tumani',
    'Kasbi tumani',
    'Kitob tumani',
    'Koson tumani',
    'Ko‘kdala tumani',
    'Mirishkor tumani',
    'Muborak tumani',
    'Nishon tumani',
    'Qamashi tumani',
    'Qarshi tumani',
    'Shahrisabz tumani',
    'Yakkabog‘ tumani',
  ],
  'Qoraqalpog‘iston Respublikasi': [
    'Nukus shahri',
    'Amudaryo tumani',
    'Beruniy tumani',
    'Bo‘zatov tumani',
    'Chimboy tumani',
    'Ellikqala tumani',
    'Kegeyli tumani',
    'Mo‘ynoq tumani',
    'Nukus tumani',
    'Qonliko‘l tumani',
    'Qorao‘zak tumani',
    'Qo‘ng‘irot tumani',
    'Sho‘manoy tumani',
    'Taxtako‘pir tumani',
    'Taxiatosh tumani',
    'To‘rtko‘l tumani',
    'Xo‘jayli tumani',
  ],
  'Navoiy viloyati': [
    'Navoiy shahri',
    'Zarafshon shahri',
    'Karmana tumani',
    'Konimex tumani',
    'Navbahor tumani',
    'Nurota tumani',
    'Qiziltepa tumani',
    'Tomdi tumani',
    'Uchquduq tumani',
    'Xatirchi tumani',
  ],
  'Namangan viloyati': [
    'Namangan shahri',
    'Chortoq tumani',
    'Chust tumani',
    'Davlatobod tumani',
    'Kosonsoy tumani',
    'Mingbuloq tumani',
    'Namangan tumani',
    'Norin tumani',
    'Pop tumani',
    'To‘raqo‘rg‘on tumani',
    'Uchqo‘rg‘on tumani',
    'Uychi tumani',
    'Yangi Namangan tumani',
    'Yangiqo‘rg‘on tumani',
  ],
  'Samarqand viloyati': [
    'Samarqand shahri',
    'Kattaqo‘rg‘on shahri',
    'Bulung‘ur tumani',
    'Ishtixon tumani',
    'Jomboy tumani',
    'Kattaqo‘rg‘on tumani',
    'Narpay tumani',
    'Nurobod tumani',
    'Oqdaryo tumani',
    'Pastdarg‘om tumani',
    'Paxtachi tumani',
    'Payariq tumani',
    'Qo‘shrabot tumani',
    'Samarqand tumani',
    'Toyloq tumani',
    'Urgut tumani',
  ],
  'Sirdaryo viloyati': [
    'Guliston shahri',
    'Shirin shahri',
    'Yangiyer shahri',
    'Boyovut tumani',
    'Guliston tumani',
    'Mirzaobod tumani',
    'Oqoltin tumani',
    'Sardoba tumani',
    'Sayxunobod tumani',
    'Sirdaryo tumani',
    'Xovos tumani',
  ],
  'Surxondaryo viloyati': [
    'Termiz shahri',
    'Angor tumani',
    'Bandixon tumani',
    'Boysun tumani',
    'Denov tumani',
    'Jarqo‘rg‘on tumani',
    'Muzrabot tumani',
    'Oltinsoy tumani',
    'Qiziriq tumani',
    'Qumqo‘rg‘on tumani',
    'Sariosiyo tumani',
    'Sherobod tumani',
    'Sho‘rchi tumani',
    'Termiz tumani',
    'Uzun tumani',
  ],
  'Toshkent viloyati': [
    'Nurafshon shahri',
    'Angren shahri',
    'Bekobod shahri',
    'Chirchiq shahri',
    'Olmaliq shahri',
    'Yangiyo‘l shahri',
    'Bekobod tumani',
    'Bo‘ka tumani',
    'Bo‘stonliq tumani',
    'Chinoz tumani',
    'Oqqo‘rg‘on tumani',
    'O‘rtachirchiq tumani',
    'Parkent tumani',
    'Piskent tumani',
    'Qibray tumani',
    'Quyi Chirchiq tumani',
    'Toshkent tumani',
    'Yangiyo‘l tumani',
    'Yuqori Chirchiq tumani',
    'Zangiota tumani',
  ],
  'Toshkent shahri': [
    'Bektemir tumani',
    'Chilonzor tumani',
    'Mirobod tumani',
    'Mirzo Ulug‘bek tumani',
    'Olmazor tumani',
    'Sergeli tumani',
    'Shayxontohur tumani',
    'Uchtepa tumani',
    'Yakkasaroy tumani',
    'Yangihayot tumani',
    'Yashnobod tumani',
    'Yunusobod tumani',
  ],
  'Farg‘ona viloyati': [
    'Farg‘ona shahri',
    'Marg‘ilon shahri',
    'Qo‘qon shahri',
    'Quvasoy shahri',
    'Bag‘dod tumani',
    'Beshariq tumani',
    'Buvayda tumani',
    'Dang‘ara tumani',
    'Farg‘ona tumani',
    'Furqat tumani',
    'O‘zbekiston tumani',
    'Quva tumani',
    'Rishton tumani',
    'So‘x tumani',
    'Toshloq tumani',
    'Uchko‘prik tumani',
    'Yozyovon tumani',
  ],
  'Xorazm viloyati': [
    'Urganch shahri',
    'Xiva shahri',
    'Bog‘ot tumani',
    'Gurlan tumani',
    'Hazorasp tumani',
    'Qo‘shko‘pir tumani',
    'Shovot tumani',
    'Tuproqqal’a tumani',
    'Urganch tumani',
    'Xiva tumani',
    'Xonqa tumani',
    'Yangiariq tumani',
    'Yangibozor tumani',
  ],
}

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

  // Bottom Sheets
  const [showOccupationSheet, setShowOccupationSheet] = useState(false)
  const [selectedOccupationTemp, setSelectedOccupationTemp] = useState(extra.occupation)

  const [showCountrySheet, setShowCountrySheet] = useState(false)
  const [selectedCountryTemp, setSelectedCountryTemp] = useState(extra.country)

  const [showRegionSheet, setShowRegionSheet] = useState(false)
  const [selectedRegionTemp, setSelectedRegionTemp] = useState(extra.region)

  const [showDistrictSheet, setShowDistrictSheet] = useState(false)
  const [selectedDistrictTemp, setSelectedDistrictTemp] = useState(extra.district)

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
  // VIEW 2: MA'LUMOTLARNI TAHRIRLASH (2-rasm: 100% SCROLLSIZ, DUMALOQ CHEVRON, COMPACT JINS)
  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 2: PROFIL MA'LUMOTLARINI TAHRIRLASH (ISMINGIZDAN JINSGACHA 1 TA BLOK)
  // ══════════════════════════════════════════════════════════════════════════
  if (editMode === 'info') {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col select-none animate-fadeIn">
        {/* ── Top Bar Header (O'ng-chap surilgan, fonsiz toza ikonlar) ── */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onClick={() => {
              playSound('click')
              haptics.impact('light')
              setEditMode('none')
            }}
            className="flex size-10 items-center justify-center -ml-2 text-pfg hover:opacity-80 active:scale-90 transition-transform cursor-pointer"
            aria-label={ru ? 'Назад' : 'Orqaga'}
          >
            <ChevronLeft size={24} strokeWidth={2.25} />
          </button>

          <h1 className="text-[17px] font-bold text-pfg tracking-tight">
            {ru ? 'Редактировать данные' : 'Ma’lumotlarni tahrirlash'}
          </h1>

          <button
            type="button"
            onClick={handleResetInfo}
            className="flex size-10 items-center justify-center -mr-2 text-red-500 hover:opacity-80 active:scale-90 transition-transform cursor-pointer"
            aria-label={ru ? 'Сбросить' : 'Tozalash'}
            title={ru ? 'Сбросить данные' : 'Ma’lumotlarni tiklash'}
          >
            <Trash2 size={21} strokeWidth={2.2} />
          </button>
        </div>

        {/* ── Avatar (Blokdan tashqarida, markazda) ── */}
        <div className="flex justify-center my-3">
          <Avatar
            name={`${editFirstName} ${editLastName}`.trim() || name}
            photoUrl={avatarSrcFor(user) ?? undefined}
            size="lg"
            onEditPhoto={onEditPhoto}
          />
        </div>

        {/* ── Bitta yaxlit blok (Ismingizdan Jinsgacha) ── */}
        <div className="w-full px-4 pb-24">
          <div className="overflow-hidden rounded-3xl bg-white dark:bg-pcard border border-pline/40 p-3 space-y-2.5 shadow-sm">
            {/* Ismingiz */}
            <div className="rounded-2xl bg-[#f0f3f6] dark:bg-psurface px-4 py-2 focus-within:ring-2 focus-within:ring-pprimary/30 transition-all">
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
            <div className="rounded-2xl bg-[#f0f3f6] dark:bg-psurface px-4 py-2 focus-within:ring-2 focus-within:ring-pprimary/30 transition-all">
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
            <div className="rounded-2xl bg-[#f0f3f6] dark:bg-psurface px-4 py-2 focus-within:ring-2 focus-within:ring-pprimary/30 transition-all">
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
            <div className="rounded-2xl bg-[#f0f3f6] dark:bg-psurface px-4 py-2 focus-within:ring-2 focus-within:ring-pprimary/30 transition-all">
              <label className="block text-[11px] font-medium text-pmuted">
                {ru ? 'Возраст' : 'Yosh'}
              </label>
              <input
                type="number"
                inputMode="numeric"
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
              className="w-full text-left rounded-2xl bg-[#f0f3f6] dark:bg-psurface px-4 py-2.5 flex items-center justify-between active:scale-[0.99] transition-transform cursor-pointer"
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

            {/* Jins */}
            <div className="rounded-2xl bg-[#f0f3f6] dark:bg-psurface px-4 py-2 flex items-center justify-between">
              <span className="text-[12px] font-medium text-pmuted">
                {ru ? 'Пол' : 'Jins'}
              </span>
              <div className="w-32 grid grid-cols-2 p-1 rounded-xl bg-gray-200/70 dark:bg-pcard border border-pline/40 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    playSound('click')
                    haptics.impact('light')
                    setEditGender('male')
                  }}
                  className={cn(
                    'h-8 rounded-lg flex items-center justify-center transition-all select-none cursor-pointer',
                    editGender === 'male'
                      ? 'bg-[#383838] text-white dark:bg-[#f2f2f2] dark:text-[#141414] shadow-xs'
                      : 'text-pmuted hover:text-pfg'
                  )}
                  aria-label={ru ? 'Мужской' : 'Erkak'}
                  title={ru ? 'Мужской' : 'Erkak'}
                >
                  <MdMan size={22} className="shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSound('click')
                    haptics.impact('light')
                    setEditGender('female')
                  }}
                  className={cn(
                    'h-8 rounded-lg flex items-center justify-center transition-all select-none cursor-pointer',
                    editGender === 'female'
                      ? 'bg-[#383838] text-white dark:bg-[#f2f2f2] dark:text-[#141414] shadow-xs'
                      : 'text-pmuted hover:text-pfg'
                  )}
                  aria-label={ru ? 'Женский' : 'Ayol'}
                  title={ru ? 'Женский' : 'Ayol'}
                >
                  <MdWoman size={22} className="shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Fixed Bottom CTA: SAQLASH ── */}
        <div className="fixed bottom-0 inset-x-0 p-4 pb-[max(1rem,var(--safe-bottom,0px))] bg-gradient-to-t from-pcanvas via-pcanvas/95 to-transparent z-20 pointer-events-auto">
          <div className="w-full max-w-lg mx-auto">
            <Button
              block
              size="default"
              variant="secondary"
              onClick={handleSaveInfo}
              className="font-black text-[15px] uppercase tracking-wider h-12 shadow-md rounded-full cursor-pointer"
            >
              {ru ? 'СОХРАНИТЬ' : 'SAQLASH'}
            </Button>
          </div>
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
                  variant="secondary"
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
  // VIEW 3: MANZILNI TAHRIRLASH (4-rasm: 100% SCROLLSIZ, DUMALOQ CHEVRON, YAXLIT BLOK)
  // ══════════════════════════════════════════════════════════════════════════
  if (editMode === 'address') {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col select-none animate-fadeIn">
        <PageHeader
          title={ru ? 'Редактировать адрес' : 'Manzilni tahrirlash'}
          onBack={() => {
            playSound('click')
            haptics.impact('light')
            setEditMode('none')
          }}
          backLabel={ru ? 'Назад' : 'Orqaga'}
          className="-mx-4 mb-2"
        />

        {/* Address Fields inside SINGLE rounded card at TOP */}
        <div className="w-full px-4 mt-3 pb-24">
          <div className="overflow-hidden rounded-3xl bg-white dark:bg-pcard border border-pline/40 p-3 space-y-2.5 shadow-sm">
            {/* Mamlakat (Clickable -> Opens Country Sheet) */}
            <button
              type="button"
              onClick={() => {
                playSound('click')
                haptics.impact('light')
                setSelectedCountryTemp(editCountry)
                setShowCountrySheet(true)
              }}
              className="w-full text-left rounded-2xl bg-[#f0f3f6] dark:bg-psurface px-4 py-3 flex items-center justify-between active:scale-[0.99] transition-transform"
            >
              <div>
                <span className="block text-[11px] font-medium text-pmuted">
                  {ru ? 'Страна' : 'Mamlakat'}
                </span>
                <span className="mt-0.5 block text-[15px] font-bold text-pfg">
                  {editCountry}
                </span>
              </div>
              <ChevronDown size={18} className="text-pfg shrink-0" strokeWidth={2.4} />
            </button>

            {/* Viloyat (Clickable -> Opens Region Sheet) */}
            <button
              type="button"
              onClick={() => {
                playSound('click')
                haptics.impact('light')
                setSelectedRegionTemp(editRegion)
                setShowRegionSheet(true)
              }}
              className="w-full text-left rounded-2xl bg-[#f0f3f6] dark:bg-psurface px-4 py-3 flex items-center justify-between active:scale-[0.99] transition-transform"
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

            {/* Tuman (Clickable -> Opens District Sheet) */}
            <button
              type="button"
              onClick={() => {
                playSound('click')
                haptics.impact('light')
                setSelectedDistrictTemp(editDistrict)
                setShowDistrictSheet(true)
              }}
              className="w-full text-left rounded-2xl bg-[#f0f3f6] dark:bg-psurface px-4 py-3 flex items-center justify-between active:scale-[0.99] transition-transform"
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
          </div>
        </div>

        {/* ── Fixed Bottom CTA: SAQLASH ── */}
        <div className="fixed bottom-0 inset-x-0 p-4 pb-[max(1rem,var(--safe-bottom,0px))] bg-gradient-to-t from-pcanvas via-pcanvas/95 to-transparent z-20 pointer-events-auto">
          <div className="w-full max-w-lg mx-auto">
            <Button
              block
              size="default"
              variant="secondary"
              onClick={handleSaveAddress}
              className="font-black text-[15px] uppercase tracking-wider h-12 shadow-md rounded-full cursor-pointer"
            >
              {ru ? 'СОХРАНИТЬ' : 'SAQLASH'}
            </Button>
          </div>
        </div>

        {/* ── SHEET: Mamlakatni tanlang (O'zbekiston) ── */}
        {showCountrySheet && (
          <DialogOverlay
            onClose={() => setShowCountrySheet(false)}
            position="bottom"
            swipeToDismiss
            labelId="country-sheet-title"
          >
            <div className="w-full max-w-lg mx-auto rounded-t-sheet bg-pcard px-5 pt-3 pb-[calc(1.5rem+var(--safe-bottom,0px))] text-pfg shadow-2xl">
              <div
                data-drag-handle
                className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-white/20 mx-auto mt-1 mb-4 cursor-grab touch-none select-none shrink-0"
              />
              <h2 id="country-sheet-title" className="text-[18px] font-black text-pfg mb-2 px-1 shrink-0">
                {ru ? 'Выберите страну' : 'Mamlakatni tanlang'}
              </h2>

              <div className="divide-y divide-pline">
                {COUNTRIES_LIST.map((country) => {
                  const isSelected = selectedCountryTemp === country
                  return (
                    <button
                      key={country}
                      type="button"
                      onClick={() => {
                        playSound('click')
                        haptics.impact('light')
                        setSelectedCountryTemp(country)
                      }}
                      className="w-full flex items-center justify-between py-3.5 px-1 text-left active:bg-psurface transition-colors"
                    >
                      <span className="text-[15px] font-bold text-pfg">
                        {country}
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
                  variant="secondary"
                  onClick={() => {
                    setEditCountry(selectedCountryTemp)
                    playSound('click')
                    haptics.impact('light')
                    setShowCountrySheet(false)
                  }}
                  className="font-black text-[15px] uppercase tracking-wider h-12 shadow-sm"
                >
                  {ru ? 'ВЫБРАТЬ' : 'TANLASH'}
                </Button>
              </div>
            </div>
          </DialogOverlay>
        )}

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
                  variant="secondary"
                  onClick={() => {
                    setEditRegion(selectedRegionTemp)
                    const newDistricts = REGION_DISTRICTS_MAP[selectedRegionTemp] || []
                    if (newDistricts.length > 0 && !newDistricts.includes(editDistrict)) {
                      setEditDistrict(newDistricts[0])
                    }
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

        {/* ── SHEET: Tumanni tanlang (Tumanlar to'liq ro'yxati) ── */}
        {showDistrictSheet && (
          <DialogOverlay
            onClose={() => setShowDistrictSheet(false)}
            position="bottom"
            swipeToDismiss
            labelId="district-sheet-title"
          >
            <div className="w-full max-w-lg mx-auto max-h-[80vh] flex flex-col rounded-t-sheet bg-pcard px-5 pt-3 pb-[calc(1.5rem+var(--safe-bottom,0px))] text-pfg shadow-2xl">
              <div
                data-drag-handle
                className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-white/20 mx-auto mt-1 mb-4 cursor-grab touch-none select-none shrink-0"
              />
              <h2 id="district-sheet-title" className="text-[18px] font-black text-pfg mb-2 px-1 shrink-0">
                {ru ? 'Выберите район' : 'Tumanni tanlang'}
              </h2>

              <div className="overflow-y-auto overscroll-contain flex-1 divide-y divide-pline pr-1">
                {(REGION_DISTRICTS_MAP[editRegion] || REGION_DISTRICTS_MAP['Buxoro viloyati'] || []).map((dist) => {
                  const isSelected = selectedDistrictTemp === dist
                  return (
                    <button
                      key={dist}
                      type="button"
                      onClick={() => {
                        playSound('click')
                        haptics.impact('light')
                        setSelectedDistrictTemp(dist)
                      }}
                      className="w-full flex items-center justify-between py-3.5 px-1 text-left active:bg-psurface transition-colors"
                    >
                      <span className="text-[15px] font-bold text-pfg">
                        {dist}
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
                  variant="secondary"
                  onClick={() => {
                    setEditDistrict(selectedDistrictTemp)
                    playSound('click')
                    haptics.impact('light')
                    setShowDistrictSheet(false)
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
  // VIEW 1: ASOSIY PROFIL MA'LUMOTLARI (CHEVRONSIZ DUMALOQ, DUAL-SLIDE SILIQ ANIMATSIYA)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full max-w-lg mx-auto flex flex-col select-none animate-fadeIn pb-28">
      {/* ── Top Bar Header (PageHeader SSOT — boshqa sahifalar kabi) ── */}
      <PageHeader
        title={ru ? 'Данные профиля' : 'Profil ma’lumotlari'}
        onBack={() => {
          playSound('click')
          haptics.impact('light')
          onBack()
        }}
        backLabel={ru ? 'Назад' : 'Orqaga'}
        className="-mx-4 mb-2"
      />

      {/* ── Segment / Tab Switcher (Pill Style, Themes Mos, Silliq) ── */}
      <div className="w-full px-4 mt-1">
          <div className="grid grid-cols-2 p-1 rounded-full bg-white dark:bg-pcard shadow-sm gap-1">
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
                'py-2 px-4 rounded-full text-sm font-extrabold transition-all duration-200 text-center select-none',
                activeTab === 'info'
                  ? 'bg-[#383838] text-white shadow-[0_2px_0_0_#000000] dark:bg-[#f2f2f2] dark:text-[#141414] dark:shadow-[0_2px_0_0_#b3b3b3]'
                  : 'text-pmuted hover:text-pfg'
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
                'py-2 px-4 rounded-full text-sm font-extrabold transition-all duration-200 text-center select-none',
                activeTab === 'address'
                  ? 'bg-[#383838] text-white shadow-[0_2px_0_0_#000000] dark:bg-[#f2f2f2] dark:text-[#141414] dark:shadow-[0_2px_0_0_#b3b3b3]'
                  : 'text-pmuted hover:text-pfg'
              )}
            >
              {ru ? 'Адрес' : 'Manzil'}
            </button>
          </div>
        </div>

        {/* ── DUAL-SLIDE HORIZONTAL CONTAINER (0 qupollik, to'liq silliq) ── */}
        <div className="w-full max-w-lg mx-auto overflow-hidden mt-2">
          <div
            className="flex w-[200%] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              transform: activeTab === 'info' ? 'translateX(0%)' : 'translateX(-50%)',
            }}
          >
            {/* ── SLIDE 1: Ma'lumotlar ── */}
            <div className="w-1/2 shrink-0 px-4 flex flex-col">
              {/* Centered Avatar (toza, qalamchasiz) and Name */}
              <div className="mt-4 flex flex-col items-center">
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
                <h2 className="mt-3 text-[21px] font-extrabold text-pfg tracking-tight">
                  {currentFullName}
                </h2>
              </div>

              {/* Details Card */}
              <div className="mt-4 overflow-hidden rounded-3xl bg-white dark:bg-pcard border border-pline/40 divide-y divide-pline shadow-sm">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[14px] font-medium text-pmuted">
                    {ru ? 'Возраст:' : 'Yosh:'}
                  </span>
                  <span className="text-[15px] font-bold text-pfg">
                    {extra.age}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[14px] font-medium text-pmuted">
                    Username
                  </span>
                  <span className="text-[15px] font-bold text-pfg">
                    {extra.username}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[14px] font-medium text-pmuted">
                    {ru ? 'Пол:' : 'Jins:'}
                  </span>
                  <span className="text-[15px] font-bold text-pfg">
                    {extra.gender === 'male' ? (ru ? 'Мужской' : 'Erkak') : (ru ? 'Женский' : 'Ayol')}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[14px] font-medium text-pmuted">
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
                      className="p-1 rounded-lg text-pprimary hover:bg-psurface transition-colors active:scale-95 cursor-pointer"
                      aria-label={ru ? 'Изменить телефон' : 'Telefonni o‘zgartirish'}
                    >
                      <SquarePen size={19} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SLIDE 2: Manzil ── */}
            <div className="w-1/2 shrink-0 px-4 flex flex-col mt-3">
              <div className="overflow-hidden rounded-3xl bg-white dark:bg-pcard border border-pline/40 divide-y divide-pline shadow-sm">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[14px] font-medium text-pmuted">
                    {ru ? 'Страна:' : 'Mamlakat:'}
                  </span>
                  <span className="text-[15px] font-bold text-pfg">
                    {extra.country}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[14px] font-medium text-pmuted">
                    {ru ? 'Область:' : 'Viloyat:'}
                  </span>
                  <span className="text-[15px] font-bold text-pfg">
                    {extra.region}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[14px] font-medium text-pmuted">
                    {ru ? 'Район:' : 'Tuman:'}
                  </span>
                  <span className="text-[15px] font-bold text-pfg">
                    {extra.district}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* ── Fixed Bottom CTA: TAHRIRLASH (Rasmdagidek toza oq pill) ── */}
      <div className="fixed bottom-0 inset-x-0 p-4 pb-[max(1rem,var(--safe-bottom,0px))] bg-gradient-to-t from-pcanvas via-pcanvas/95 to-transparent z-20 pointer-events-auto">
        <div className="w-full max-w-lg mx-auto">
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
            className="w-full h-14 rounded-full bg-[#383838] text-white shadow-[0_4px_0_0_#000000] dark:bg-[#f2f2f2] dark:text-[#141414] dark:shadow-[0_4px_0_0_#b3b3b3] active:translate-y-[2px] active:shadow-none hover:brightness-[1.08] dark:hover:brightness-[0.95] font-black text-[15px] uppercase tracking-wider flex items-center justify-center gap-2.5 transition-transform cursor-pointer select-none"
          >
            <span>{ru ? 'РЕДАКТИРОВАТЬ' : 'TAHRIRLASH'}</span>
            <SquarePen size={18} strokeWidth={2.2} className="text-current" />
          </button>
        </div>
      </div>
    </div>
  )
}
