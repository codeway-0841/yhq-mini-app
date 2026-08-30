import React from 'react'
import { X, Download, Smartphone, CheckCircle2 } from 'lucide-react'
import { playSound } from '../../../shared/lib/sounds'

interface ApkDownloadModalProps {
  isOpen: boolean
  onClose: () => void
  lang: 'uz' | 'ru'
}

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  if (!isOpen) return null

  const handleDownload = () => {
    playSound('coins')
    // Trigger download
    const link = document.createElement('a')
    link.href = '/kiwi-app.apk'
    link.download = 'kiwi-app.apk'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const steps = [
    {
      step: '1',
      titleUz: 'APK faylni yuklab oling',
      titleRu: 'Скачайте APK файл',
      descUz: 'Qurilmangizda yuklab olishni tasdiqlang',
      descRu: 'Подтвердите загрузку на устройстве',
    },
    {
      step: '2',
      titleUz: 'O\'rnatishga ruxsat bering',
      titleRu: 'Разрешите установку',
      descUz: 'Noma\'lum manbalardan o\'rnatishga rozilik bering',
      descRu: 'Разрешите установку из неизвестных источников',
    },
    {
      step: '3',
      titleUz: 'Ilovani oching va kiring',
      titleRu: 'Откройте приложение',
      descUz: 'Telegram orqali 1 soniyada avtorizatsiya qiling',
      descRu: 'Авторизуйтесь через Telegram за 1 секунду',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-pcard rounded-sheet max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            playSound('click')
            onClose()
          }}
          className="absolute top-4 right-4 p-2 rounded-control bg-psurface hover:bg-pcard text-pmuted hover:text-pfg transition-colors shadow-xs"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="p-3 rounded-container bg-pprimary/10 text-pprimary">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-pfg">
              {lang === 'uz' ? 'Android APK Yuklab Olish' : 'Скачать APK для Android'}
            </h3>
            <p className="text-xs text-pmuted">
              {lang === 'uz' ? 'Versiya 2.0.0 • Hajmi: 8.5 MB' : 'Версия 2.0.0 • Размер: 8.5 МБ'}
            </p>
          </div>
        </div>

        {/* 3 Step Guide */}
        <div className="space-y-3 mb-6">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-container bg-psurface/80 flex items-start gap-3 shadow-xs"
            >
              <div className="w-6 h-6 rounded-full bg-pprimary/20 text-pprimary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                {s.step}
              </div>
              <div className="text-xs">
                <div className="font-bold text-pfg">{lang === 'uz' ? s.titleUz : s.titleRu}</div>
                <div className="text-pmuted text-[11px]">{lang === 'uz' ? s.descUz : s.descRu}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Download Button */}
        <button
          type="button"
          onClick={handleDownload}
          className="w-full py-3.5 rounded-container bg-pprimary text-ponprimary font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-pprimary/25 hover:brightness-110 active:scale-98 transition-all mb-4"
        >
          <Download className="w-4 h-4" />
          <span>{lang === 'uz' ? 'To\'g\'ridan-to\'g\'ri Yuklab Olish (APK)' : 'Скачать напрямую (APK)'}</span>
        </button>

        <div className="flex items-center justify-center gap-2 text-[11px] text-pmuted text-center">
          <CheckCircle2 className="w-3.5 h-3.5 text-psuccess" />
          <span>
            {lang === 'uz'
              ? 'Xavfsiz va viruslardan xoli rasmiy dastur'
              : 'Безопасное официальное приложение'}
          </span>
        </div>
      </div>
    </div>
  )
}
