import React, { useState, useEffect } from 'react'
import { Trophy, Swords, Crown, Sparkles } from 'lucide-react'

interface ActivityItem {
  id: number
  icon: 'exam' | 'duel' | 'vip' | 'streak'
  titleUz: string
  titleRu: string
  subUz: string
  subRu: string
  timeUz: string
  timeRu: string
}

const ACTIVITIES: ActivityItem[] = [
  {
    id: 1,
    icon: 'exam',
    titleUz: 'Rustam K. (Toshkent)',
    titleRu: 'Рустам К. (Ташкент)',
    subUz: '18-biletni 20/20 bilan topshirdi 🚗',
    subRu: 'Сдал 18-й билет на 20/20 🚗',
    timeUz: 'Hozirgina',
    timeRu: 'Только что',
  },
  {
    id: 2,
    icon: 'duel',
    titleUz: 'Sardor vs Jasur',
    titleRu: 'Сардор против Жасура',
    subUz: 'Oktagon duelida g\'alaba qozondi (+150 XP) ⚔️',
    subRu: 'Победа в дуэли Октагон (+150 XP) ⚔️',
    timeUz: '1 daqiqa oldin',
    timeRu: '1 мин назад',
  },
  {
    id: 3,
    icon: 'vip',
    titleUz: 'Madina (Samarqand)',
    titleRu: 'Мадина (Самарканд)',
    subUz: 'VIP Premium tarifiga ulandi 👑',
    subRu: 'Подключила VIP Премиум 👑',
    timeUz: '2 daqiqa oldin',
    timeRu: '2 мин назад',
  },
  {
    id: 4,
    icon: 'streak',
    titleUz: 'Bobur A. (Farg\'ona)',
    titleRu: 'Бобур А. (Фергана)',
    subUz: '14 kunlik uzluksiz seriya (Streak) 🔥',
    subRu: '14 дней непрерывной серии (Streak) 🔥',
    timeUz: '3 daqiqa oldin',
    timeRu: '3 мин назад',
  },
]

export const LandingLiveActivity: React.FC<{ lang: 'uz' | 'ru' }> = ({ lang }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % ACTIVITIES.length)
        setVisible(true)
      }, 400)
    }, 4500)

    return () => clearInterval(interval)
  }, [])

  const current = ACTIVITIES[currentIndex]

  const getIcon = () => {
    switch (current.icon) {
      case 'exam':
        return <Trophy className="w-4 h-4 text-psuccess" />
      case 'duel':
        return <Swords className="w-4 h-4 text-pgold" />
      case 'vip':
        return <Crown className="w-4 h-4 text-pprimary" />
      case 'streak':
        return <Sparkles className="w-4 h-4 text-pwarning" />
    }
  }

  return (
    <div className="fixed bottom-6 left-6 z-40 hidden sm:block pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-container bg-pcard/95 shadow-2xl backdrop-blur-xl transition-all duration-400 ${
          visible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-3 scale-95'
        }`}
      >
        <div className="p-2 rounded-control bg-psurface flex items-center justify-center shrink-0 shadow-xs">
          {getIcon()}
        </div>
        <div className="text-xs pr-2">
          <div className="font-bold text-pfg flex items-center gap-1.5">
            <span>{lang === 'uz' ? current.titleUz : current.titleRu}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-psuccess inline-block" />
          </div>
          <div className="text-pmuted text-[11px]">
            {lang === 'uz' ? current.subUz : current.subRu}
          </div>
        </div>
        <span className="text-[10px] text-psubtle font-mono pl-2">
          {lang === 'uz' ? current.timeUz : current.timeRu}
        </span>
      </div>
    </div>
  )
}
