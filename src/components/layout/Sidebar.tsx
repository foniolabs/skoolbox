'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from '../../lib/router'
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react'
import logo from '../../assets/logo.svg'
import { useAuthStore } from '../../stores/useAuthStore'

export interface SidebarItem {
  label: string
  to: string
  icon: LucideIcon
  /** Match this path exactly, so a parent route doesn't stay highlighted. */
  end?: boolean
}

export interface SidebarGroup {
  title?: string
  items: SidebarItem[]
}

interface SidebarProps {
  groups: SidebarGroup[]
  roleLabel: string
  /** Extra controls above the user card, e.g. Settings. */
  footer?: ReactNode
}

function SidebarContent({
  groups,
  roleLabel,
  footer,
  onClose,
}: SidebarProps & { onClose?: () => void }) {
  const { user: signedInUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const user = mounted ? signedInUser : null

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = (user?.full_name || roleLabel)
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex h-full flex-col bg-primary-dark text-white">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <img src={logo.src} alt="" className="h-8 w-auto rounded-md bg-white p-0.5" />
          <span className="text-lg font-bold tracking-tight">SkoolBox</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-3">
        {groups.map((group, i) => (
          <div key={group.title ?? i}>
            {group.title && (
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-white/60">
                {group.title}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map(({ label, to, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-white text-primary-dark shadow-sm'
                          : 'text-white/85 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-white/15 p-3">
        {footer}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-bold text-primary-dark"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.full_name || roleLabel}</p>
            <p className="text-xs text-white/70">{roleLabel}</p>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Shared app navigation for teachers and students, on desktop and web: a fixed
 * sidebar from 1024px up, and a slide-in drawer behind a top bar below that.
 */
export default function Sidebar(props: SidebarProps) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <SidebarContent {...props} />
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-white px-2 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-text-primary hover:bg-bg-secondary"
        >
          <Menu className="h-6 w-6" />
        </button>
        <img src={logo.src} alt="" className="h-7 w-auto" />
        <span className="font-bold tracking-tight text-text-primary">SkoolBox</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/50"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">
            <SidebarContent {...props} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
