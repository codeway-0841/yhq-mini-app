import { useState, useEffect } from 'react'
import { ChevronLeft, SquarePen, Check } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'
import { Avatar } from './Avatar'
import { avatarSrcFor, type ApiUser } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import ModalShell from '../../../shared/components/ModalShell'
import { Button } from '../../../shared/components/ui/button'

export interface UserExtraProfile {
  age: string
  gender: string
  country: string
  region: string
  district: string
  neighborhood: string
}

const STORAGE_KEY = 'kivvi_user_extra_profile'

const DEFAULT_EXTRA: UserExtraProfile = {
  age: '28',
  gender: 'Erkak',
  country: 'Uzbekistan',
  region: 'Buxoro viloyati',
  district: 'Jondor tumani',
  neighborhood: 'Darveshi',
}

function loadExtraProfile(userId?: string): UserExtraProfile {
  if (typeof window === 'undefined') return DEFAULT_EXTRA
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId || 'default'}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_EXTRA, ...parsed }
    }
  } catch {}
  return DEFAULT_EXTRA
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
  const [extra, setExtra] = useState<UserExtraProfile>(() => loadExtraProfile(user?.id))
  const [showEditModal, setShowEditModal] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState(name)
  const [editAge, setEditAge] = useState(extra.age)
  const [editGender, setEditGender] = useState(extra.gender)
  const [editCountry, setEditCountry] = useState(extra.country)
  const [editRegion, setEditRegion] = useState(extra.region)
  const [editDistrict, setEditDistrict] = useState(extra.district)
  const [editNeighborhood, setEditNeighborhood] = useState(extra.neighborhood)

  const setDisplayName = useAppStore((s) => s.setDisplayName)

  useEffect(() => {
    setEditName(name)
    setEditAge(extra.age)
    setEditGender(extra.gender)
    setEditCountry(extra.country)
    setEditRegion(extra.region)
    setEditDistrict(extra.district)
    setEditNeighborhood(extra.neighborhood)
  }, [name, extra])

  const handleSave = () => {
    const updatedExtra: UserExtraProfile = {
      age: editAge.trim() || '28',
      gender: editGender.trim() || 'Erkak',
      country: editCountry.trim() || 'Uzbekistan',
      region: editRegion.trim() || 'Buxoro viloyati',
      district: editDistrict.trim() || 'Jondor tumani',
      neighborhood: editNeighborhood.trim() || 'Darveshi',
    }
    setExtra(updatedExtra)
    saveExtraProfile(updatedExtra, user?.id)

    if (editName.trim() && editName.trim() !== name) {
      setDisplayName(editName.trim())
    }

    playSound('click')
    haptics.notify('success')
    setShowEditModal(false)
  }

  const ru = lang === 'ru'
  const usernameDisplay = user?.username ? `@${user.username.replace(/^@/, '')}` : '@ddqgrvtrdswe222'
  const phoneDisplay = user?.phone || '+998934440841'

  return (
    <div className="min-h-[85vh] flex flex-col pb-28 animate-premiumIn">
      {/* ── Top Bar Header ── */}
      <div className="relative flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => {
            playSound('click')
            haptics.impact('light')
            onBack()
          }}
          className="size-11 rounded-full bg-pcard border-2 border-pline-strong flex items-center justify-center text-pfg shadow-xs active:scale-95 transition-transform"
          aria-label={ru ? 'Назад' : 'Orqaga'}
        >
          <ChevronLeft size={22} strokeWidth={2.4} />
        </button>

        <h1 className="text-[17px] font-extrabold text-pfg tracking-tight">
          {ru ? 'Данные профиля' : "Profil ma'lumotlari"}
        </h1>

        <div className="size-11" aria-hidden="true" />
      </div>

      {/* ── Segment / Tab Switcher (Pill Style) ── */}
      <div className="mx-4 mt-2 grid grid-cols-2 p-1.5 rounded-full bg-pcard border-2 border-pline-strong gap-1.5">
        <button
          type="button"
          onClick={() => {
            setActiveTab('info')
            playSound('click')
            haptics.impact('light')
          }}
          className={cn(
            'py-2.5 px-4 rounded-full text-sm font-extrabold transition-all text-center select-none',
            activeTab === 'info'
              ? 'bg-[#5b52e0] text-white shadow-xs'
              : 'text-pfg hover:bg-psurface'
          )}
        >
          {ru ? 'Данные' : "Ma'lumotlar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('address')
            playSound('click')
            haptics.impact('light')
          }}
          className={cn(
            'py-2.5 px-4 rounded-full text-sm font-extrabold transition-all text-center select-none',
            activeTab === 'address'
              ? 'bg-[#5b52e0] text-white shadow-xs'
              : 'text-pfg hover:bg-psurface'
          )}
        >
          {ru ? 'Адрес' : 'Manzil'}
        </button>
      </div>

      {/* ── TAB 1: Ma'lumotlar ── */}
      {activeTab === 'info' && (
        <div className="flex flex-col">
          {/* Centered Avatar and Name */}
          <div className="mt-6 flex flex-col items-center">
            <div
              onClick={() => {
                playSound('click')
                haptics.impact('light')
                onEditPhoto()
              }}
              className="cursor-pointer active:scale-95 transition-transform"
              title={ru ? 'Изменить фото' : "Rasmni o'zgartirish"}
            >
              <Avatar
                name={name}
                photoUrl={avatarSrcFor(user) ?? undefined}
                size="lg"
              />
            </div>
            <h2 className="mt-3 text-[22px] font-extrabold text-pfg tracking-tight">
              {name}
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
                {usernameDisplay}
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-[14.5px] font-medium text-pmuted">
                {ru ? 'Пол:' : 'Jins:'}
              </span>
              <span className="text-[15px] font-bold text-pfg">
                {extra.gender}
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
                  className="p-1 rounded-lg text-[#2563eb] hover:bg-psurface transition-colors active:scale-95"
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

      {/* ── Sticky Bottom CTA: TAHRIRLASH ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-[max(16px,var(--safe-bottom,0px))] bg-gradient-to-t from-pcanvas via-pcanvas/95 to-transparent z-20">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={() => {
              playSound('click')
              haptics.impact('light')
              setShowEditModal(true)
            }}
            className="w-full min-h-[52px] rounded-full bg-pcard border-2 border-pline-strong text-pfg font-black text-[15px] uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xs active:translate-y-[2px] transition-transform"
          >
            <span>{ru ? 'РЕДАКТИРОВАТЬ' : 'TAHRIRLASH'}</span>
            <SquarePen size={19} strokeWidth={2.2} className="text-pfg" />
          </button>
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      {showEditModal && (
        <ModalShell
          title={ru ? 'Редактировать профиль' : "Profil ma'lumotlarini tahrirlash"}
          onClose={() => setShowEditModal(false)}
          closeLabel={ru ? 'Отмена' : 'Bekor qilish'}
        >
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-pmuted">
                {ru ? 'Имя' : 'Ism'}
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={32}
                className="w-full rounded-2xl bg-pcard border-2 border-pline-strong px-4 py-3 text-sm font-bold text-pfg outline-none focus:border-pprimary shadow-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-pmuted">
                  {ru ? 'Возраст' : 'Yosh'}
                </label>
                <input
                  type="number"
                  value={editAge}
                  onChange={(e) => setEditAge(e.target.value)}
                  maxLength={3}
                  className="w-full rounded-2xl bg-pcard border-2 border-pline-strong px-4 py-3 text-sm font-bold text-pfg outline-none focus:border-pprimary shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-pmuted">
                  {ru ? 'Пол' : 'Jins'}
                </label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                  className="w-full rounded-2xl bg-pcard border-2 border-pline-strong px-4 py-3 text-sm font-bold text-pfg outline-none focus:border-pprimary shadow-xs"
                >
                  <option value="Erkak">{ru ? 'Мужской' : 'Erkak'}</option>
                  <option value="Ayol">{ru ? 'Женский' : 'Ayol'}</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-pline">
              <p className="text-xs font-black uppercase tracking-wider text-pmuted mb-3">
                {ru ? 'Адрес' : 'Manzil'}
              </p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-pmuted">
                    {ru ? 'Страна' : 'Mamlakat'}
                  </label>
                  <input
                    type="text"
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    className="w-full rounded-2xl bg-pcard border-2 border-pline-strong px-4 py-2.5 text-sm font-bold text-pfg outline-none focus:border-pprimary shadow-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-pmuted">
                    {ru ? 'Область' : 'Viloyat'}
                  </label>
                  <input
                    type="text"
                    value={editRegion}
                    onChange={(e) => setEditRegion(e.target.value)}
                    className="w-full rounded-2xl bg-pcard border-2 border-pline-strong px-4 py-2.5 text-sm font-bold text-pfg outline-none focus:border-pprimary shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-pmuted">
                      {ru ? 'Район' : 'Tuman'}
                    </label>
                    <input
                      type="text"
                      value={editDistrict}
                      onChange={(e) => setEditDistrict(e.target.value)}
                      className="w-full rounded-2xl bg-pcard border-2 border-pline-strong px-4 py-2.5 text-sm font-bold text-pfg outline-none focus:border-pprimary shadow-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-pmuted">
                      {ru ? 'Махалля' : 'Mahalla'}
                    </label>
                    <input
                      type="text"
                      value={editNeighborhood}
                      onChange={(e) => setEditNeighborhood(e.target.value)}
                      className="w-full rounded-2xl bg-pcard border-2 border-pline-strong px-4 py-2.5 text-sm font-bold text-pfg outline-none focus:border-pprimary shadow-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3">
              <Button block size="lg" className="font-bold flex items-center justify-center gap-2" onClick={handleSave}>
                <Check size={18} />
                <span>{ru ? 'Сохранить' : 'Saqlash'}</span>
              </Button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  )
}
