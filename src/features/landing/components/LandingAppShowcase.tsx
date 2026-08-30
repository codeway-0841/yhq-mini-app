import React, { useState } from 'react'
import {
  Sparkles,
  BookOpen,
  FileCheck,
  Swords,
  Compass,
  Trophy,
  CheckCircle2,
  Timer,
  Zap,
} from 'lucide-react'
import { playSound } from '../../../shared/lib/sounds'

interface LandingAppShowcaseProps {
  lang: 'uz' | 'ru'
}

export const LandingAppShowcase: React.FC<LandingAppShowcaseProps> = ({ lang }) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'dashboard' | 'octagon' | 'signs' | 'leaderboard'>('tickets')

  const tabs = [
    {
      id: 'tickets' as const,
      labelUz: '70 ta Biletlar',
      labelRu: '70 Билетов',
      icon: FileCheck,
    },
    {
      id: 'dashboard' as const,
      labelUz: 'Darslik & Boshqaruv',
      labelRu: 'Обучение и Темы',
      icon: BookOpen,
    },
    {
      id: 'octagon' as const,
      labelUz: '1v1 Duel Arena',
      labelRu: '1v1 Октагон',
      icon: Swords,
    },
    {
      id: 'signs' as const,
      labelUz: 'Belgilar O\'yini',
      labelRu: 'Игра знаков',
      icon: Compass,
    },
    {
      id: 'leaderboard' as const,
      labelUz: 'Reyting & Ligalar',
      labelRu: 'Рейтинг и Лиги',
      icon: Trophy,
    },
  ]

  const handleTabChange = (tabId: typeof activeTab) => {
    playSound('click')
    setActiveTab(tabId)
  }

  return (
    <section id="showcase" className="py-20 md:py-28 bg-psurface/30 relative overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-pprimary/10 text-pprimary text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'uz' ? 'Ilova Interfeysi' : 'Интерфейс приложения'}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-pfg tracking-tight mb-4">
            {lang === 'uz'
              ? 'Qulay, tezkor va zamonaviy interfeys'
              : 'Удобный, быстрый и современный интерфейс'}
          </h2>
          <p className="text-base sm:text-lg text-pmuted">
            {lang === 'uz'
              ? "Telegram Mini App, Android va Veb uchun bir xil qulaylikda optimallashtirilgan."
              : 'Оптимизирован для комфортной работы в Telegram Mini App, на Android и в веб-браузере.'}
          </p>
        </div>

        {/* Tab Selection Bar */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap mb-12">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`px-5 py-3 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2.5 shadow-xs ${
                  isActive
                    ? 'bg-pprimary text-ponprimary shadow-lg shadow-pprimary/25 scale-105'
                    : 'bg-pcard hover:bg-psurface text-pmuted hover:text-pfg'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{lang === 'uz' ? tab.labelUz : tab.labelRu}</span>
              </button>
            )
          })}
        </div>

        {/* Showcase Mock Frame (Widescreen) */}
        <div className="max-w-5xl xl:max-w-6xl mx-auto rounded-sheet bg-pcard shadow-2xl p-5 sm:p-10 relative">
          {/* Top Mock Window Bar */}
          <div className="flex items-center justify-between pb-4 mb-8 text-xs text-pmuted">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-pdanger/70" />
              <div className="w-3.5 h-3.5 rounded-full bg-pwarning/70" />
              <div className="w-3.5 h-3.5 rounded-full bg-psuccess/70" />
            </div>
            <div className="px-4 py-1.5 rounded-full bg-psurface text-xs font-mono text-pmuted flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-psuccess inline-block animate-pulse" />
              <span>https://kivvi.uz/app/{activeTab}</span>
            </div>
            <div className="text-xs text-pmuted font-bold">KIWI Pro v2.0</div>
          </div>

          {/* Tab 1: Tickets Preview */}
          {activeTab === 'tickets' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-container bg-psurface gap-4 shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-control bg-pprimary/10 text-pprimary">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base sm:text-lg font-bold text-pfg">
                      {lang === 'uz' ? '70 ta Rasmiy Biletlar' : '70 Официальных Билетов'}
                    </h4>
                    <p className="text-xs sm:text-sm text-pmuted">
                      {lang === 'uz' ? 'Har biletda 10 tadan rasmiy imtihon savoli' : 'По 10 официальных вопросов в билете'}
                    </p>
                  </div>
                </div>
                <div className="sm:text-right">
                  <span className="text-sm font-bold text-pprimary">700 {lang === 'uz' ? 'rasmiy savol' : 'вопросов'}</span>
                  <div className="text-xs text-pmuted">{lang === 'uz' ? 'To\'liq ochiq' : 'Полный доступ'}</div>
                </div>
              </div>

              {/* Sample Tickets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                  <div
                    key={num}
                    className="p-3.5 rounded-container bg-psurface/80 hover:bg-psurface transition-all hover:scale-102 flex items-center justify-between shadow-xs"
                  >
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-pfg">
                        {lang === 'uz' ? `${num}-Bilet` : `Билет №${num}`}
                      </span>
                      <div className="text-[11px] text-pmuted">10 {lang === 'uz' ? 'savol' : 'вопросов'}</div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-psuccess/15 text-psuccess flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Dashboard Preview */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="p-6 rounded-container bg-gradient-to-r from-pprimary/20 via-psurface to-psurface shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs sm:text-sm font-bold text-pprimary uppercase tracking-wider">
                    {lang === 'uz' ? 'Bugungi Progress' : 'Сегодняшний прогресс'}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-pfg">85% {lang === 'uz' ? 'bajarildi' : 'выполнено'}</span>
                </div>
                <div className="w-full bg-pcanvas/80 h-3 rounded-full overflow-hidden mb-3">
                  <div className="bg-pprimary h-full rounded-full" style={{ width: '85%' }} />
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm text-pmuted">
                  <span>17 / 20 {lang === 'uz' ? 'savol to\'g\'ri' : 'верно'}</span>
                  <span className="font-bold text-pwarning">🔥 5 {lang === 'uz' ? 'kunlik seriya (streak)' : 'дней серии'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-container bg-psurface/80 shadow-xs">
                  <BookOpen className="w-6 h-6 text-pprimary mb-2" />
                  <div className="text-sm font-bold text-pfg">{lang === 'uz' ? '32 Darslik Mavzulari' : '32 Темы ПДД'}</div>
                  <div className="text-xs text-pmuted mt-1">{lang === 'uz' ? 'Interaktiv modullar' : 'Интерактивные модули'}</div>
                </div>
                <div className="p-4 rounded-container bg-psurface/80 shadow-xs">
                  <Zap className="w-6 h-6 text-pgold mb-2" />
                  <div className="text-sm font-bold text-pfg">{lang === 'uz' ? 'Speed Round ⚡' : 'Спид-тест ⚡'}</div>
                  <div className="text-xs text-pmuted mt-1">{lang === 'uz' ? 'Vaqtga qarshi test' : 'Тест на скорость'}</div>
                </div>
                <div className="p-4 rounded-container bg-psurface/80 shadow-xs">
                  <CheckCircle2 className="w-6 h-6 text-psuccess mb-2" />
                  <div className="text-sm font-bold text-pfg">{lang === 'uz' ? 'Xatolar Tahlili' : 'Работа над ошибками'}</div>
                  <div className="text-xs text-pmuted mt-1">{lang === 'uz' ? 'Qayta takrorlash' : 'Повторение'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Octagon PvP Preview */}
          {activeTab === 'octagon' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="p-8 rounded-container bg-psurface text-center relative overflow-hidden shadow-xs">
                <div className="flex items-center justify-around gap-6 mb-6">
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full bg-pprimary/20 flex items-center justify-center font-bold text-base text-pfg mb-1.5 shadow-md">
                      Siz
                    </div>
                    <span className="text-sm font-bold text-pfg">Foydalanuvchi</span>
                    <span className="text-xs text-psuccess font-bold">3 {lang === 'uz' ? 'ochko' : 'очка'}</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="p-3 rounded-full bg-pgold/10 text-pgold mb-2">
                      <Swords className="w-8 h-8" />
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-pdanger">
                      <Timer className="w-4 h-4" />
                      <span>00:08</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full bg-pdanger/20 flex items-center justify-center font-bold text-base text-pfg mb-1.5 shadow-md">
                      Raqib
                    </div>
                    <span className="text-sm font-bold text-pfg">Sardor_2026</span>
                    <span className="text-xs text-pdanger font-bold">2 {lang === 'uz' ? 'ochko' : 'очка'}</span>
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-pmuted bg-pcard/70 p-3.5 rounded-control max-w-lg mx-auto font-medium shadow-xs">
                  {lang === 'uz'
                    ? 'Round 4/5: Kim birinchi to\'g\'ri topsa, g\'alaba qozonadi!'
                    : 'Раунд 4/5: Кто первым ответит правильно, побеждает!'}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Signs Game Preview */}
          {activeTab === 'signs' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="p-6 sm:p-8 rounded-container bg-psurface shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-base sm:text-lg font-bold text-pfg">
                      {lang === 'uz' ? 'Yo\'l Belgilari Mini-O\'yini' : 'Игра на знание знаков'}
                    </h4>
                    <p className="text-xs sm:text-sm text-pmuted">
                      {lang === 'uz' ? 'Belgiga qarab to\'g\'ri nomini toping' : 'Угадайте название по знаку'}
                    </p>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-pgold bg-pgold/10 px-3.5 py-1.5 rounded-control">
                    ⚡️ Rekord: 28 ta
                  </div>
                </div>

                <div className="flex items-center justify-center py-4 mb-4">
                  <div className="w-24 h-24 rounded-full flex items-center justify-center bg-white text-4xl shadow-xl">
                    ⛔️
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="p-3.5 rounded-control bg-pcard font-medium shadow-xs">
                    1. Kirish taqiqlangan
                  </div>
                  <div className="p-3.5 rounded-control bg-pcard font-medium shadow-xs">
                    2. To'xtash taqiqlangan
                  </div>
                  <div className="p-3.5 rounded-control bg-psuccess/20 text-psuccess font-bold shadow-xs">
                    3. Harakatlanish taqiqlangan ✓
                  </div>
                  <div className="p-3.5 rounded-control bg-pcard font-medium shadow-xs">
                    4. Bojxona
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Leaderboard Preview */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-3.5 animate-in fade-in duration-300">
              {[
                { rank: '🥇 1', name: 'Jasur_Tashkent', xp: '14,250 XP', league: 'Olmos Liga' },
                { rank: '🥈 2', name: 'Madina_Samarkand', xp: '12,800 XP', league: 'Olmos Liga' },
                { rank: '🥉 3', name: 'Bobur_Fergana', xp: '11,450 XP', league: 'Oltin Liga' },
                { rank: '4', name: 'Anvar_Bukhara', xp: '9,920 XP', league: 'Oltin Liga' },
              ].map((user, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-container bg-psurface/80 shadow-xs"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-sm sm:text-base text-pgold w-8">{user.rank}</span>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-pfg">{user.name}</div>
                      <div className="text-[11px] text-pmuted">{user.league}</div>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-mono font-bold text-pprimary">{user.xp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
