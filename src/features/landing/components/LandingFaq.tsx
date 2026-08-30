import React, { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { playSound } from '../../../shared/lib/sounds'

interface LandingFaqProps {
  lang: 'uz' | 'ru'
}

export const LandingFaq: React.FC<LandingFaqProps> = ({ lang }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = [
    {
      qUz: "KIWI platformasida qanday fanlar va imtihonlar mavjud?",
      qRu: "Какие предметы и форматы экзаменов доступны в KIWI?",
      aUz: "KIWI — bu universal ta'lim ekotizimi bo'lib, quyidagi yo'nalishlarni qamrab oladi: 1) O'qituvchilar Attestatsiyasi va Milliy sertifikat (Rus tili, Matematika, Fizika, Kimyo va h.k.); 2) DTM OTMga kirish testlari; 3) Yo'l Harakati Qoidalari (YHQ) 70 ta rasmiy biletlar. Barcha bazalar rasmiy standartlarga to'liq mos.",
      aRu: "KIWI — это универсальная образовательная платформа, включающая: 1) Аттестацию педагогов и Национальные сертификаты (Русский язык, Математика, Физика, Химия и др.); 2) Вступительные тесты ДТМ в ВУЗы; 3) Официальные билеты ПДД (70 билетов). Все базы соответствуют государственным стандартам.",
    },
    {
      qUz: "Har bir fan uchun alohida to'lov qilish kerakmi?",
      qRu: "Нужно ли платить за каждый предмет отдельно?",
      aUz: "Yo'q! KIWI'da yagona VIP Universal obuna amal qiladi. Bitta obunani faollashtirib, barcha 8 ta fanning to'liq savollar bazasiga, Attestatsiya modullariga, DTM testlariga va YHQ biletlariga to'liq cheklovlarsiz ega bo'lasiz.",
      aRu: "Нет! В KIWI действует единая VIP Универсал подписка. Оформив одну подписку, вы получаете неограниченный доступ ко всем 8 предметам, модулям Аттестации, ДТМ и билетам ПДД.",
    },
    {
      qUz: "Savollarning to'g'ri javobiga tushuntirish berilganmi?",
      qRu: "Есть ли подробные пояснения к ответам?",
      aUz: "Albatta! Har bir savol ostida qonuniy (YHQ), grammatik (Rus tili/Ingliz tili) yoki ilmiy formulaviy (Matematika/Fizika) batafsil tushuntirish keltirilgan. Siz shunchaki javobni yodlamaysiz, balki fanni chuqur tushunib olasiz.",
      aRu: "Конечно! Под каждым вопросом приведено детальное правовое, грамматическое или научное пояснение с формулами и правилами.",
    },
    {
      qUz: "Telegram ilovadan qanday foydalaniladi?",
      qRu: "Как пользоваться приложением в Telegram?",
      aUz: "Juda oddiy! Telefoningizga alohida dastur yuklab olish shart emas. Shunchaki Telegramda @kivvi_app_bot ga kiring va 'Boshlash' tugmasini bosing — ilova darhol ochiladi va barcha natijalaringiz Telegram hisobingizga avtomatik biriktiriladi.",
      aRu: "Очень просто! Вам не нужно скачивать отдельные приложения. Просто откройте бота @kivvi_app_bot в Telegram и нажмите кнопку 'Старт' — приложение откроется мгновенно, а ваш прогресс сохранится.",
    },
    {
      qUz: "To'lovlar qanday amalga oshiriladi?",
      qRu: "Как принимается оплата за Премиум?",
      aUz: "VIP obunani O'zbekistondagi barcha mashhur to'lov tizimlari (Click va Payme) orqali to'g'ridan-to'g'ri milliy valyutada (so'mda) 1 daqiqada xavfsiz amalga oshirishingiz mumkin.",
      aRu: "Подключить VIP можно за 1 минуту через популярные платежные системы Узбекистана — Click и Payme в национальной валюте.",
    },
  ]

  const toggleFaq = (idx: number) => {
    playSound('click')
    setOpenIndex(openIndex === idx ? null : idx)
  }

  return (
    <section id="faq" className="py-20 md:py-28 relative">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-pprimary/10 text-pprimary text-[12px] font-bold uppercase tracking-wider mb-3">
            <HelpCircle size={14} strokeWidth={1.75} />
            <span>FAQ</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-pfg tracking-tight mb-4">
            {lang === 'uz'
              ? 'Ko\'p beriladigan savollar'
              : 'Часто задаваемые вопросы'}
          </h2>
          <p className="text-[15px] sm:text-[17px] text-pmuted leading-relaxed font-sans font-medium">
            {lang === 'uz'
              ? 'Platforma, fanlar va imtihonlarga oid barcha savollaringizga aniq javoblar.'
              : 'Ответы на самые популярные вопросы о платформе, предметах и сдаче экзаменов.'}
          </p>
        </div>

        {/* Accordion List (Widescreen Centered) */}
        <div className="max-w-4xl mx-auto space-y-3 font-sans">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx
            return (
              <div
                key={idx}
                className="rounded-container bg-pcard overflow-hidden transition-all duration-200 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-[14.5px] sm:text-[16px] text-pfg hover:text-pprimary transition-colors"
                >
                  <span className="leading-snug">{lang === 'uz' ? faq.qUz : faq.qRu}</span>
                  <ChevronDown
                    size={18}
                    strokeWidth={2}
                    className={`text-pmuted shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-pprimary' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-6 sm:px-6 text-[13px] sm:text-[14px] text-pmuted leading-relaxed pt-1 animate-in fade-in duration-200 font-medium">
                    {lang === 'uz' ? faq.aUz : faq.aRu}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
