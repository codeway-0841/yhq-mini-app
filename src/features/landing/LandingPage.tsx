import { useState } from 'react'
import { useAppStore } from '../../shared/store/useAppStore'
import { LandingNavbar } from './components/LandingNavbar'
import { LandingHero } from './components/LandingHero'
import { LandingLiveActivity } from './components/LandingLiveActivity'
import { LandingPvPWidget } from './components/LandingPvPWidget'
import { LandingFeaturesBento } from './components/LandingFeaturesBento'
import { LandingCalculator } from './components/LandingCalculator'
import { LandingAppShowcase } from './components/LandingAppShowcase'
import { LandingSubjects } from './components/LandingSubjects'
import { LandingComparison } from './components/LandingComparison'
import { LandingTestimonials } from './components/LandingTestimonials'
import { LandingPricing } from './components/LandingPricing'
import { LandingFaq } from './components/LandingFaq'
import { LandingCta } from './components/LandingCta'
import { LandingFooter } from './components/LandingFooter'
import { ApkDownloadModal } from './components/ApkDownloadModal'
import { Sparkles } from 'lucide-react'

interface LandingPageProps {
  onOpenAuth?: () => void
}

export default function LandingPage({ onOpenAuth }: LandingPageProps) {
  const currentLang = useAppStore((s) => s.settings.language) || 'uz'
  const currentTheme = useAppStore((s) => s.settings.theme) || 'dark'
  const updateSettings = useAppStore((s) => s.updateSettings)

  const [lang, setLang] = useState<'uz' | 'ru'>(currentLang)
  const [apkModalOpen, setApkModalOpen] = useState(false)

  const handleLangChange = (newLang: 'uz' | 'ru') => {
    setLang(newLang)
    updateSettings({ language: newLang })
  }

  const handleThemeToggle = () => {
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light'
    updateSettings({ theme: nextTheme })
    document.body.dataset.theme = nextTheme
    document.documentElement.dataset.theme = nextTheme
  }

  const handleOpenAuth = () => {
    if (onOpenAuth) {
      onOpenAuth()
    } else {
      window.location.hash = '#/login'
    }
  }

  const handleScrollToDemo = () => {
    const demoSection = document.getElementById('features')
    if (demoSection) {
      const navHeight = 84
      const elementPosition = demoSection.getBoundingClientRect().top + window.pageYOffset
      window.scrollTo({
        top: elementPosition - navHeight,
        behavior: 'smooth',
      })
    }
  }

  return (
    <div className="min-h-screen bg-pcanvas text-pfg selection:bg-pprimary/30 selection:text-pfg font-sans relative overflow-x-hidden antialiased">
      {/* Real-time Activity Floating Toast */}
      <LandingLiveActivity lang={lang} />

      {/* Top Navbar */}
      <LandingNavbar
        lang={lang}
        onLangChange={handleLangChange}
        theme={currentTheme}
        onThemeToggle={handleThemeToggle}
        onOpenAuth={handleOpenAuth}
        onOpenApkModal={() => setApkModalOpen(true)}
      />

      {/* Main Content */}
      <main className="w-full">
        {/* 1. Hero Section with Interactive Live Question Engine */}
        <LandingHero
          lang={lang}
          onOpenAuth={handleOpenAuth}
          onOpenApkModal={() => setApkModalOpen(true)}
          onScrollToDemo={handleScrollToDemo}
        />

        {/* 2. Interactive PvP Arena Live Matchmaking Widget Section */}
        <section id="arena" className="py-12 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-pgold/10 text-pgold text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{lang === 'uz' ? 'Jonli Jang Arenasi' : 'Арена Живых Дуэлей'}</span>
              </div>
              <h3 className="text-2xl sm:text-4xl font-display font-extrabold text-pfg tracking-tight">
                {lang === 'uz' ? "Do'stingiz bilan real vaqtda bellashing" : 'Сразитесь с другом в реальном времени'}
              </h3>
            </div>
            <LandingPvPWidget lang={lang} />
          </div>
        </section>

        {/* 3. Bento Grid with Interactive Micro-Widgets */}
        <LandingFeaturesBento lang={lang} />

        {/* 4. Interactive Exam Readiness Calculator */}
        <LandingCalculator lang={lang} />

        {/* 5. Interactive App Showcase Mockup */}
        <LandingAppShowcase lang={lang} />

        {/* 6. Multi-Subject Learning Ecosystem */}
        <LandingSubjects lang={lang} />

        {/* 7. Why KIWI? Comparison Table */}
        <LandingComparison lang={lang} />

        {/* 8. Testimonials & Student Reviews */}
        <LandingTestimonials lang={lang} />

        {/* 9. Transparent Pricing Tiers */}
        <LandingPricing lang={lang} onOpenAuth={handleOpenAuth} />

        {/* 10. Frequently Asked Questions (FAQ) */}
        <LandingFaq lang={lang} />

        {/* 11. Final High-Conversion CTA Banner */}
        <LandingCta
          lang={lang}
          onOpenAuth={handleOpenAuth}
          onOpenApkModal={() => setApkModalOpen(true)}
        />
      </main>

      {/* Footer */}
      <LandingFooter
        lang={lang}
        onOpenAuth={handleOpenAuth}
        onOpenApkModal={() => setApkModalOpen(true)}
      />

      {/* Android APK Download Modal */}
      <ApkDownloadModal
        isOpen={apkModalOpen}
        onClose={() => setApkModalOpen(false)}
        lang={lang}
      />
    </div>
  )
}
