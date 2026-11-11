'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Library,
  Settings,
  UserPlus,
} from 'lucide-react'
import Sidebar, { type SidebarGroup } from './Sidebar'
import DemoBanner from './DemoBanner'
import PageLoading from './PageLoading'
import SettingsModal from '../settings/SettingsModal'
import { useSettingsStore } from '../../stores/useSettingsStore'

const groups: SidebarGroup[] = [
  {
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, end: true },
      { label: 'Prepare', to: '/prepare', icon: BookOpen },
      { label: 'Teach', to: '/teach', icon: GraduationCap },
      { label: 'Assess', to: '/assess', icon: ClipboardCheck },
      { label: 'Monitor', to: '/monitor', icon: BarChart3 },
    ],
  },
  {
    title: 'Manage',
    items: [
      { label: 'Enroll Students', to: '/enroll', icon: UserPlus },
      { label: 'Curriculum Library', to: '/curriculum-library', icon: Library },
    ],
  },
]

export default function Layout({ children }: { children: ReactNode }) {
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div className="min-h-screen bg-bg-app lg:pl-64">
      <Sidebar
        groups={groups}
        roleLabel="Teacher"
        footer={
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
            Settings
          </button>
        }
      />
      <DemoBanner />
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<PageLoading />}>
          {children}
        </Suspense>
      </main>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
