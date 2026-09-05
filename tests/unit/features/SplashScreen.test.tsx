import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SplashScreen from '../../../src/features/onboarding/SplashScreen'

describe('SplashScreen component', () => {
  it('renders branding image and loading indicator', () => {
    render(<SplashScreen />)

    const status = screen.getByRole('status', { name: 'KIVVI yuklanmoqda' })
    const img = screen.getByAltText('KIVVI')
    expect(status).toHaveClass('first-launch-screen')
    expect(img).toBeInTheDocument()
    expect(img.closest('picture')?.querySelector('source')).toHaveAttribute('srcset', '/images/splash-brand.webp')
    expect(screen.getByText('Yuklanmoqda...')).toBeInTheDocument()
  })
})
