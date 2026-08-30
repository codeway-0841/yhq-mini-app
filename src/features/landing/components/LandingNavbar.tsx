import React, { useState, useEffect } from 'react'
import { Sun, Moon, Sparkles, Smartphone, Menu, X, ArrowRight, ShieldCheck, Palette } from 'lucide-react'
import { config } from '../../../shared/config'
import { playSound } from '../../../shared/lib/sounds'
import { getAccentTheme } from '../../../shared/config/themes'
import { useAppStore } from '../../../shared/store/useAppStore'

interface LandingNavbarProps {
  lang: 'uz' | 'ru'
  onLangChange: (lang: 'uz' | 'ru') => void
  theme: 'light' | 'dark' | 'system'
  onThemeToggle: () => void
  onOpenAuth: () => void
  onOpenApkModal: () => void
}

const FEATURED_ACCENTS = ['kiwi', 'obsidian', 'cupertino', 'gold', 'deeppurple', 'neo', 'claude']

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  lang,
  onLangChange,
  theme,
  onThemeToggle,
  onOpenAuth,
  onOpenApkModal,
}) => {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [themePickerOpen, setThemePickerOpen] = useState(false)

  const currentAccent = useAppStore((s) => s.accent) || 'kiwi'
  const setAccent = useAppStore((s) => s.setAccent)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleAccentChange = (accentId: string) => {
    playSound('toggle')
    setAccent(accentId)
    document.body.dataset.accent = accentId
    setThemePickerOpen(false)
  }

  const botUsername = config.botUsername || 'kivvi_app_bot'
  const telegramBotUrl = `https://t.me/${botUsername}`

  const navLinks = [
    { href: '#features', label: lang === 'uz' ? 'Imkoniyatlar' : 'Возможности' },
    { href: '#subjects', label: lang === 'uz' ? 'Fanlar' : 'Предметы' },
    { href: '#arena', label: lang === 'uz' ? 'PvP Arena' : 'PvP Арена' },
    { href: '#calculator', label: lang === 'uz' ? 'Kalkulyator' : 'Калькулятор' },
    { href: '#showcase', label: lang === 'uz' ? 'Interfeys' : 'Интерфейс' },
    { href: '#pricing', label: lang === 'uz' ? 'Tariflar' : 'Тарифы' },
    { href: '#faq', label: lang === 'uz' ? 'Savollar' : 'FAQ' },
  ]

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    const element = document.querySelector(href)
    if (element) {
      const navHeight = 84
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
      window.scrollTo({
        top: elementPosition - navHeight,
        behavior: 'smooth',
      })
    }
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-pcanvas/90 backdrop-blur-xl shadow-xl shadow-black/10 py-3'
          : 'bg-transparent py-5 sm:py-6'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <a
            href="#hero"
            onClick={() => playSound('click')}
            className="flex items-center gap-3.5 group shrink-0"
          >
            <div className="relative">
              <img
                src="/images/splash-brand.webp"
                alt="KIWI"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover shadow-lg shadow-pprimary/15 transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/splash-brand.png'
                }}
              />
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-psuccess rounded-full flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-2xl tracking-tight text-pfg">
                  KI<span className="text-pprimary">WI</span>
                </span>
                <span className="text-[10px] uppercase font-extrabold tracking-widest px-2 py-0.5 rounded-full bg-pprimary/10 text-pprimary">
                  PRO
                </span>
              </div>
              <span className="text-[11px] text-pmuted hidden xs:inline-block font-medium">
                {lang === 'uz' ? "Universal Ta'lim & Imtihonlar Platformasi" : 'Образовательная и Экзаменационная Платформа'}
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links (Pill Bar) */}
          <nav className="hidden xl:flex items-center gap-1.5 px-4 py-2 rounded-full bg-psurface/80 backdrop-blur-xl shadow-xs">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="px-3.5 py-1.5 text-xs font-semibold text-pmuted hover:text-pfg hover:bg-pcard/90 rounded-full transition-all duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 relative">
            {/* Real App Accent Theme Swatcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setThemePickerOpen(!themePickerOpen)}
                className="p-2.5 rounded-full bg-psurface text-pmuted hover:text-pfg hover:bg-pcard transition-colors shadow-xs flex items-center gap-1.5 text-xs font-bold"
                aria-label="Select Theme Color"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full inline-block shadow-xs"
                  style={{ backgroundColor: getAccentTheme(currentAccent).color }}
                />
                <Palette className="w-3.5 h-3.5" />
              </button>

              {/* Accent Picker Dropdown */}
              {themePickerOpen && (
                <div className="absolute top-12 right-0 w-52 p-3 bg-pcard rounded-container shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95">
                  <div className="text-[11px] font-bold text-pmuted uppercase tracking-wider mb-2 px-1">
                    {lang === 'uz' ? 'Mavzular (Temalar)' : 'Цветовые темы'}
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {FEATURED_ACCENTS.map((accId) => {
                      const t = getAccentTheme(accId)
                      const isSel = currentAccent === accId
                      return (
                        <button
                          key={accId}
                          type="button"
                          onClick={() => handleAccentChange(accId)}
                          className={`w-full p-2 rounded-control text-xs font-bold flex items-center justify-between transition-colors ${
                            isSel ? 'bg-psurface text-pfg' : 'hover:bg-psurface/60 text-pmuted'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-4 h-4 rounded-full shadow-xs"
                              style={{ backgroundColor: t.color }}
                            />
                            <span>{lang === 'uz' ? t.label.uz : t.label.ru}</span>
                          </div>
                          {isSel && <span className="text-xs text-pprimary">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <div className="flex items-center bg-psurface rounded-full p-0.5 text-xs font-bold shadow-xs">
              <button
                type="button"
                onClick={() => {
                  playSound('click')
                  onLangChange('uz')
                }}
                className={`px-2.5 py-1 rounded-full transition-all duration-200 ${
                  lang === 'uz'
                    ? 'bg-pprimary text-ponprimary shadow-xs'
                    : 'text-pmuted hover:text-pfg'
                }`}
              >
                UZ
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound('click')
                  onLangChange('ru')
                }}
                className={`px-2.5 py-1 rounded-full transition-all duration-200 ${
                  lang === 'ru'
                    ? 'bg-pprimary text-ponprimary shadow-xs'
                    : 'text-pmuted hover:text-pfg'
                }`}
              >
                RU
              </button>
            </div>

            {/* Theme Toggle (Dark / Light) */}
            <button
              type="button"
              onClick={() => {
                playSound('toggle')
                onThemeToggle()
              }}
              aria-label="Toggle Theme"
              className="p-2.5 rounded-full bg-psurface text-pmuted hover:text-pfg hover:bg-pcard transition-colors shadow-xs"
            >
              {theme === 'light' ? (
                <Sun className="w-4 h-4 text-pgold" />
              ) : (
                <Moon className="w-4 h-4 text-pblue" />
              )}
            </button>

            {/* Web Version / Login Button */}
            <button
              type="button"
              onClick={() => {
                playSound('click')
                onOpenAuth()
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-control bg-psurface hover:bg-pcard text-xs font-bold text-pfg transition-all duration-200 shadow-xs"
            >
              <ShieldCheck className="w-4 h-4 text-pmuted" />
              <span>{lang === 'uz' ? 'Veb-kirish' : 'Вход'}</span>
            </button>

            {/* Primary CTA (Telegram Bot WebApp) */}
            <a
              href={telegramBotUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playSound('click')}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-control bg-pprimary text-ponprimary text-xs sm:text-sm font-bold hover:brightness-110 shadow-lg shadow-pprimary/25 active:scale-95 transition-all duration-200"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden xs:inline">
                {lang === 'uz' ? 'Telegramda ochish' : 'В Telegram'}
              </span>
              <span className="xs:hidden">Bot</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-90 hidden sm:inline" />
            </a>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-control bg-psurface text-pmuted hover:text-pfg transition-colors shadow-xs"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden mt-3 pt-3 pb-5 px-4 bg-pcard/95 rounded-container shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex flex-col gap-1.5">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="px-3.5 py-2.5 rounded-control text-sm font-semibold text-pfg hover:bg-psurface transition-colors flex items-center justify-between"
                >
                  <span>{link.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-psubtle" />
                </a>
              ))}
              <div className="h-px bg-psurface my-2" />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    onOpenApkModal()
                  }}
                  className="w-full py-2.5 px-3 rounded-control bg-psurface text-xs font-bold text-pfg flex items-center justify-center gap-2 shadow-xs"
                >
                  <Smartphone className="w-4 h-4 text-pprimary" />
                  <span>Android APK</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    onOpenAuth()
                  }}
                  className="w-full py-2.5 px-3 rounded-control bg-psurface text-xs font-bold text-pfg flex items-center justify-center gap-2 shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4 text-pmuted" />
                  <span>{lang === 'uz' ? 'Veb-kirish' : 'Вход'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
