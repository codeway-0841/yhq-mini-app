import React from 'react'
import { FileCheck, Users, Swords, Zap, CheckCircle2 } from 'lucide-react'

interface LandingStatsProps {
  lang: 'uz' | 'ru'
}

export const LandingStats: React.FC<LandingStatsProps> = ({ lang }) => {
  const stats = [
    {
      icon: FileCheck,
      value: '70 / 700+',
      labelUz: 'Rasmiy biletlar va savollar',
      labelRu: 'Официальных билетов и вопросов',
      subUz: '100% yangi tahrirdagi YHQ',
      subRu: '100% актуальная база ПДД',
      color: 'text-pprimary',
      bg: 'bg-pprimary/10',
      border: 'border-pprimary/20',
    },
    {
      icon: Users,
      value: '50,000+',
      labelUz: "Muvaffaqiyatli o'quvchilar",
      labelRu: 'Успешных учеников',
      subUz: 'Butun O\'zbekiston bo\'ylab',
      subRu: 'По всему Узбекистану',
      color: 'text-pblue',
      bg: 'bg-pblue/10',
      border: 'border-pblue/20',
    },
    {
      icon: CheckCircle2,
      value: '98.4%',
      labelUz: 'Imtihon topshirish ko\'rsatkichi',
      labelRu: 'Процент сдачи экзамена',
      subUz: '1-urinishda topshirganlar',
      subRu: 'Сдали с 1-й попытки',
      color: 'text-psuccess',
      bg: 'bg-psuccess/10',
      border: 'border-psuccess/20',
    },
    {
      icon: Swords,
      value: '150,000+',
      labelUz: '1v1 PvP Oktagon janglari',
      labelRu: '1v1 PvP дуэлей в Октагоне',
      subUz: 'Real vaqtdagi musobaqalar',
      subRu: 'Соревнования в реальном времени',
      color: 'text-pgold',
      bg: 'bg-pgold/10',
      border: 'border-pgold/20',
    },
  ]

  return (
    <section className="py-16 md:py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, i) => {
            const Icon = stat.icon
            return (
              <div
                key={i}
                className="p-6 rounded-sheet bg-pcard border border-pline hover:border-plineStrong transition-all duration-300 hover:-translate-y-1 shadow-sm flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-container ${stat.bg} ${stat.border} border`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <Zap className="w-4 h-4 text-psubtle opacity-40" />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-display font-bold text-pfg tracking-tight mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm font-semibold text-pfg mb-0.5">
                    {lang === 'uz' ? stat.labelUz : stat.labelRu}
                  </div>
                  <div className="text-xs text-pmuted">
                    {lang === 'uz' ? stat.subUz : stat.subRu}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
