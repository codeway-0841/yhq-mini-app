import React, { useState } from 'react'
import { CheckCircle2, Clock, Award, GraduationCap } from 'lucide-react'
import { SUBJECTS } from '../../../shared/config/subjects'
import { playSound } from '../../../shared/lib/sounds'

interface LandingSubjectsProps {
  lang: 'uz' | 'ru'
}

export const LandingSubjects: React.FC<LandingSubjectsProps> = ({ lang }) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'certificate'>('all')

  const filterTabs = [
    { id: 'all' as const, labelUz: 'Barcha Fanlar (8 ta)', labelRu: 'Все Предметы (8)' },
    { id: 'active' as const, labelUz: 'Faol Bazalar', labelRu: 'Активные Базы' },
    { id: 'certificate' as const, labelUz: 'Milliy Sertifikat & Attestatsiya', labelRu: 'Сертификат и Аттестация' },
  ]

  const filteredSubjects = SUBJECTS.filter((s) => {
    if (filter === 'active') return s.available
    if (filter === 'certificate') return s.id === 'rustili' || s.id === 'matematika' || s.id === 'fizika'
    return true
  })

  return (
    <section id="subjects" className="py-20 md:py-28 relative">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-pprimary/10 text-pprimary text-[12px] font-bold uppercase tracking-wider mb-3">
            <GraduationCap size={15} strokeWidth={1.75} />
            <span>{lang === 'uz' ? 'Fanlar & Imtihonlar' : 'Предметы и Экзамены'}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-pfg tracking-tight mb-4">
            {lang === 'uz' ? 'Barcha asosiy fanlar bitta platformada' : 'Все основные предметы в одной платформе'}
          </h2>
          <p className="text-[15px] sm:text-[17px] text-pmuted leading-relaxed font-sans font-medium">
            {lang === 'uz'
              ? "O'qituvchilar attestatsiyasi, o'quvchilar milliy sertifikati, DTM kirish imtihonlari va YHQ haydovchilik biletlari — har bir yo'nalish uchun maxsus tayyorlangan rasmiy bazalar."
              : 'Аттестация педагогов, национальные сертификаты, вступительные тесты ДТМ и экзаменационные билеты ПДД — официальные базы для каждого направления.'}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-center gap-2 mb-12 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                playSound('click')
                setFilter(tab.id)
              }}
              className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all shadow-xs active:scale-[0.98] ${
                filter === tab.id
                  ? 'bg-pprimary text-ponprimary shadow-md font-bold'
                  : 'bg-psurface/80 text-pmuted hover:text-pfg hover:bg-psurface'
              }`}
            >
              {lang === 'uz' ? tab.labelUz : tab.labelRu}
            </button>
          ))}
        </div>

        {/* Subjects Grid (Widescreen 4-Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {filteredSubjects.map((subj) => {
            const Icon = subj.icon
            return (
              <div
                key={subj.id}
                onClick={() => playSound('click')}
                className={`p-6 sm:p-7 rounded-sheet bg-pcard transition-all duration-200 relative overflow-hidden flex flex-col justify-between cursor-pointer active:scale-[0.99] ${
                  subj.available
                    ? 'shadow-sm hover:-translate-y-1 hover:shadow-xl'
                    : 'opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-container flex items-center justify-center shadow-xs"
                      style={{ backgroundColor: `${subj.color}20`, color: subj.color }}
                    >
                      <Icon size={24} strokeWidth={1.75} />
                    </div>
                    {subj.available ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-psuccess/15 text-psuccess">
                        <CheckCircle2 size={13} strokeWidth={2} />
                        <span>{lang === 'uz' ? 'Ochiq & Faol' : 'Активен'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-psurface text-pmuted">
                        <Clock size={13} strokeWidth={1.75} />
                        <span>{lang === 'uz' ? 'Tez kunda' : 'Скоро'}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-[17px] sm:text-[19px] font-display font-bold text-pfg mb-2">
                    {lang === 'uz' ? subj.name : subj.nameRu}
                  </h3>
                  <p className="text-[13px] text-pmuted mb-6 leading-relaxed font-sans font-medium">
                    {subj.id === 'rustili'
                      ? lang === 'uz'
                        ? 'Milliy sertifikat (A, B+, C) va O\'qituvchilar attestatsiyasi uchun to\'liq rasmiy savollar bazasi va grammatika qoidalari.'
                        : 'Полная база для Национального сертификата (A, B+, C) и Аттестации учителей с грамматическим разбором.'
                      : subj.id === 'yhq'
                      ? lang === 'uz'
                        ? '70 ta rasmiy imtihon bileti, 700+ qonuniy savol, yo\'l belgilari va haqiqiy imtihon simulyatori.'
                        : '70 официальных билетов, 700+ вопросов с правовым анализом, знаки и симулятор экзамена.'
                      : subj.id === 'matematika' || subj.id === 'fizika'
                      ? lang === 'uz'
                        ? 'DTM, Milliy sertifikat va Attestatsiya formulalari, mantiqiy misollar hamda interaktiv testlar.'
                        : 'Формулы ДТМ, Национального сертификата и Аттестации, задачи и интерактивные тесты.'
                      : lang === 'uz'
                      ? 'DTM kirish imtihonlari va Milliy sertifikat talablari asosidagi maxsus savollar banki.'
                      : 'База вопросов по стандартам ДТМ и Национального сертификата.'}
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-between text-[12px] text-pmuted">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Award size={14} strokeWidth={1.75} className="text-pgold" />
                    <span>
                      {subj.id === 'rustili' || subj.id === 'matematika' || subj.id === 'fizika'
                        ? lang === 'uz' ? 'Sertifikat & Attestatsiya' : 'Сертификат и Аттестация'
                        : lang === 'uz' ? 'Rasmiy Biletlar' : 'Официальные Билеты'}
                    </span>
                  </span>
                  <span className="font-bold text-pprimary text-[11px] font-mono">KIWI Pro</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
