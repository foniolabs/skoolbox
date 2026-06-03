import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import TopNavBar from './TopNavBar'
import { useSettingsStore } from '../../stores/useSettingsStore'

export default function Layout() {
  const loadSettings = useSettingsStore((s) => s.loadSettings)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div className="min-h-screen bg-bg-app">
      <TopNavBar />
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
