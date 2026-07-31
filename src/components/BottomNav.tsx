import { NavLink } from 'react-router-dom'
import { Home, BookOpen, Ticket, TriangleAlert, User, Trophy } from 'lucide-react'

const links = [
  { to: '/',         icon: Home,          label: 'Bosh sahifa' },
  { to: '/darslik',  icon: BookOpen,      label: 'Darslik'     },
  { to: '/biletlar', icon: Ticket,        label: 'Biletlar'    },
  { to: '/belgilar', icon: TriangleAlert, label: 'Belgilar'    },
  { to: '/reyting',  icon: Trophy,        label: 'Reyting'     },
  { to: '/profil',   icon: User,          label: 'Profil'      },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
      style={{
        background: 'linear-gradient(to top, #0d1117 80%, rgba(13,17,23,0.92))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Top separator line */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#30363d] to-transparent" />

      <div className="flex items-end justify-around px-1 pt-1.5 pb-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold transition-all duration-200 ${
                isActive
                  ? 'text-[#58cc02]'
                  : 'text-[#6e7681] active:scale-90'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator dot */}
                {isActive && (
                  <span
                    className="absolute -top-1.5 w-1 h-1 rounded-full bg-[#58cc02]"
                    style={{ boxShadow: '0 0 6px 1px rgba(88,204,2,0.5)' }}
                  />
                )}
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.6}
                  fill={isActive ? 'currentColor' : 'none'}
                  style={isActive ? {
                    filter: 'drop-shadow(0 0 4px rgba(88,204,2,0.4))'
                  } : undefined}
                />
                <span className={isActive ? 'font-bold' : ''}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
