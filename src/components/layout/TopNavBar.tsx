import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, User, Heart, Settings, LogOut, UserPlus, Library } from 'lucide-react'
import logo from '../../assets/logo.svg'
import SettingsModal from '../settings/SettingsModal'
import { useAuthStore } from '../../stores/useAuthStore'

const tabs = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Prepare', to: '/prepare' },
  { label: 'Teach', to: '/teach' },
  { label: 'Assess', to: '/assess' },
  { label: 'Monitor', to: '/monitor' },
]

export default function TopNavBar() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src={logo} alt="SkoolBox" className="h-8 w-auto" />
            <span className="text-lg font-bold text-text-primary">SkoolBox</span>
          </div>

          {/* Center navigation tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map(({ label, to }) => (
              <NavLink
                key={label}
                to={to}
                end={to === '/dashboard'}
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'text-text-primary bg-bg-secondary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary/50'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* Heart / favorites */}
            <button className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary transition-colors">
              <Heart className="h-5 w-5" />
            </button>

            {/* Notifications */}
            <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-card-coral text-[10px] font-bold text-white">3</span>
            </button>

            {/* User avatar dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-xl p-1 hover:bg-bg-secondary transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-light to-primary text-white">
                  <User className="h-4 w-4" />
                </div>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-white py-1 shadow-lg">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold text-text-primary">{user?.full_name || 'Teacher'}</p>
                    <p className="text-xs text-text-muted">Teacher</p>
                  </div>
                  <button className="flex w-full items-center px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-secondary transition-colors">
                    Profile
                  </button>
                  <button
                    onClick={() => { navigate('/enroll'); setDropdownOpen(false) }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Enroll Students
                  </button>
                  <button
                    onClick={() => { navigate('/curriculum-library'); setDropdownOpen(false) }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
                  >
                    <Library className="w-4 h-4" />
                    Curriculum Library
                  </button>
                  <button
                    onClick={() => { setSettingsOpen(true); setDropdownOpen(false) }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <div className="border-t border-border">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-bg-secondary transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile tab bar */}
        <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2">
          {tabs.map(({ label, to }) => (
            <NavLink
              key={label}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'text-text-primary bg-bg-secondary'
                    : 'text-text-secondary'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
