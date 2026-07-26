import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, BookOpen, Ticket, TriangleAlert, User } from 'lucide-react'

const links = [
  { to: '/',        icon: Home,          label: 'Bosh sahifa' },
  { to: '/darslik', icon: BookOpen,      label: 'Darslik' },
  { to: '/biletlar',icon: Ticket,        label: 'Biletlar' },
  { to: '/belgilar',icon: TriangleAlert, label: 'Belgilar' },
  { to: '/profil',  icon: User,          label: 'Profil' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#161b22] border-t border-[#30363d] safe-bottom z-50">
      <div className="flex items-center justify-around h-14">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#1f6feb]' : 'text-[#8b949e]'
              }`
            }
          >
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
